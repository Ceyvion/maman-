from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from ortools.sat.python import cp_model

from .models import Agent, GenerateRequest, ShiftAssignment


@dataclass
class ShiftInfo:
    code: str
    start_min: int
    end_min: int
    duration: int


DAY_MINUTES = 24 * 60


def _parse_time_to_min(time_str: str) -> int:
    h, m = time_str.split(":")
    return int(h) * 60 + int(m)


def _date_range(start_date: str, end_date: str) -> List[str]:
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    days = []
    cur = start
    while cur <= end:
        days.append(cur.isoformat())
        cur += timedelta(days=1)
    return days


def _week_start(date_str: str) -> str:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def _is_weekend(date_str: str) -> bool:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return d.weekday() >= 5


def build_solution(
    req: GenerateRequest,
    baseline_minutes: Dict[str, int] | None = None,
) -> Tuple[str, List[ShiftAssignment], int | None, str | None, List[Agent]]:
    params = req.params
    days = _date_range(params.start_date, params.end_date)
    if not days:
        return "infeasible", [], None, "Période invalide", []

    shifts: Dict[str, ShiftInfo] = {}
    for code, sdef in params.shifts.items():
        shifts[code] = ShiftInfo(
            code=code,
            start_min=_parse_time_to_min(sdef.start),
            end_min=_parse_time_to_min(sdef.end),
            duration=sdef.duration_minutes,
        )

    global_allowed = set(shifts.keys())
    if params.mode == "12h_jour":
        global_allowed = {"JOUR_12H"}
    elif params.mode == "matin_soir":
        global_allowed = {"MATIN", "SOIR"}

    # A non-zero need on a shift disabled by mode must fail fast.
    for shift_code, required in params.coverage_requirements.items():
        if required > 0 and shift_code not in global_allowed:
            return (
                "infeasible",
                [],
                None,
                f"Couverture demandee pour {shift_code} incompatible avec le mode {params.mode}",
                [],
            )

    min_rest = params.ruleset_defaults.daily_rest_min_minutes
    if params.agreement_11h_enabled:
        min_rest = min(min_rest, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)

    forbidden_pairs = set()
    for tr in params.hard_forbidden_transitions:
        forbidden_pairs.add((tr.from_shift, tr.to_shift))

    baseline_minutes = baseline_minutes or {}
    max_shift_duration = max(s.duration for s in shifts.values())

    def _make_extra_agent(index: int) -> Agent:
        needs_12h = params.coverage_requirements.get("JOUR_12H", 0) > 0
        if params.mode == "12h_jour":
            regime = "REGIME_12H_JOUR"
        elif needs_12h and "REGIME_POLYVALENT" in params.agent_regimes:
            regime = "REGIME_POLYVALENT"
        elif needs_12h and "REGIME_12H_JOUR" in params.agent_regimes:
            regime = "REGIME_12H_JOUR"
        elif "REGIME_MIXTE" in params.agent_regimes:
            regime = "REGIME_MIXTE"
        elif "REGIME_MATIN_ONLY" in params.agent_regimes:
            regime = "REGIME_MATIN_ONLY"
        else:
            regime = list(params.agent_regimes.keys())[0]
        return Agent(
            id=f"R{index}",
            first_name=str(index),
            last_name="Renfort",
            regime=regime,
            quotity=100,
            unavailability_dates=[],
            preferences=[],
        )

    def _solve(agents: List[Agent]) -> Tuple[str, List[ShiftAssignment], int | None, str | None]:
        model = cp_model.CpModel()

        # Variables
        x = {}
        for a_idx, agent in enumerate(agents):
            for d_idx, d in enumerate(days):
                for s in shifts.keys():
                    x[(a_idx, d_idx, s)] = model.NewBoolVar(f"x_{a_idx}_{d_idx}_{s}")

        # One shift per day + availability + regime
        allowed_shifts_by_agent: Dict[int, set[str]] = {}
        for a_idx, agent in enumerate(agents):
            regime = params.agent_regimes[agent.regime]
            allowed = set(regime.allowed_shifts).intersection(global_allowed)
            if agent.regime == "REGIME_MIXTE":
                allowed = set(["MATIN", "SOIR"]).intersection(global_allowed)
                if params.allow_single_12h_exception and "JOUR_12H" in global_allowed:
                    allowed.add("JOUR_12H")
            allowed_shifts_by_agent[a_idx] = set(allowed)
            for d_idx, d in enumerate(days):
                day_vars = [x[(a_idx, d_idx, s)] for s in shifts.keys()]
                model.Add(sum(day_vars) <= 1)
                if d in agent.unavailability_dates:
                    model.Add(sum(day_vars) == 0)
                for s in shifts.keys():
                    if s not in allowed:
                        model.Add(x[(a_idx, d_idx, s)] == 0)
                    if (
                        agent.regime == "REGIME_MIXTE"
                        and s == "JOUR_12H"
                        and params.allow_single_12h_exception
                        and params.allowed_12h_exception_dates
                        and d not in params.allowed_12h_exception_dates
                    ):
                        model.Add(x[(a_idx, d_idx, s)] == 0)

        # Locked assignments
        for lock in req.locked_assignments:
            a_idx = next((i for i, a in enumerate(agents) if a.id == lock.agent_id), None)
            if a_idx is None:
                continue
            if lock.date not in days:
                continue
            d_idx = days.index(lock.date)
            for s in shifts.keys():
                model.Add(x[(a_idx, d_idx, s)] == (1 if s == lock.shift else 0))

        # Coverage constraints: assign exactly the requested count per shift/day.
        for d_idx, d in enumerate(days):
            for s in global_allowed:
                required = params.coverage_requirements.get(s, 0)
                vars_cover = [x[(a_idx, d_idx, s)] for a_idx in range(len(agents))]
                model.Add(sum(vars_cover) == required)

        # Daily rest and forbidden transitions
        for a_idx, agent in enumerate(agents):
            for d_idx in range(len(days) - 1):
                for s1 in shifts.keys():
                    for s2 in shifts.keys():
                        if (s1, s2) in forbidden_pairs:
                            model.Add(x[(a_idx, d_idx, s1)] + x[(a_idx, d_idx + 1, s2)] <= 1)
                            continue
                        end1 = shifts[s1].end_min
                        start2 = shifts[s2].start_min
                        rest = (DAY_MINUTES - end1) + start2
                        if rest < min_rest:
                            model.Add(x[(a_idx, d_idx, s1)] + x[(a_idx, d_idx + 1, s2)] <= 1)

        # Max consecutive 12h days
        for a_idx, agent in enumerate(agents):
            regime = params.agent_regimes[agent.regime]
            max_consec = regime.max_consecutive_12h_days or 0
            if max_consec > 0:
                for d_idx in range(len(days) - max_consec):
                    window = [x[(a_idx, d_idx + k, "JOUR_12H")] for k in range(max_consec + 1)]
                    model.Add(sum(window) <= max_consec)

        # Optional single 12h exception for mixed agents
        if params.allow_single_12h_exception and params.max_12h_exceptions_per_agent > 0:
            for a_idx, agent in enumerate(agents):
                if agent.regime != "REGIME_MIXTE":
                    continue
                model.Add(
                    sum(x[(a_idx, d_idx, "JOUR_12H")] for d_idx in range(len(days)))
                    <= params.max_12h_exceptions_per_agent
                )

        # Forbid dense pattern MATIN -> SOIR -> MATIN if enabled
        if params.forbid_matin_soir_matin:
            for a_idx, agent in enumerate(agents):
                for d_idx in range(len(days) - 2):
                    model.Add(
                        x[(a_idx, d_idx, "MATIN")]
                        + x[(a_idx, d_idx + 1, "SOIR")]
                        + x[(a_idx, d_idx + 2, "MATIN")]
                        <= 2
                    )

        # Rolling 7-day max minutes
        max_7d = params.ruleset_defaults.max_minutes_rolling_7d
        for a_idx, agent in enumerate(agents):
            for d_idx in range(len(days)):
                window_vars = []
                for k in range(7):
                    if d_idx + k >= len(days):
                        break
                    for s in shifts.keys():
                        window_vars.append(x[(a_idx, d_idx + k, s)] * shifts[s].duration)
                if window_vars:
                    model.Add(sum(window_vars) <= max_7d)

        # Weekly rest >= 36h (modeled via rest blocks)
        weekly_rest_min = params.ruleset_defaults.weekly_rest_min_minutes
        for a_idx, agent in enumerate(agents):
            off = []
            for d_idx in range(len(days)):
                off_var = model.NewBoolVar(f"off_{a_idx}_{d_idx}")
                day_sum = sum(x[(a_idx, d_idx, s)] for s in shifts.keys())
                model.Add(day_sum + off_var == 1)
                off.append(off_var)

            rest_blocks = []
            # Two consecutive off days
            for d_idx in range(len(days) - 1):
                rb = model.NewBoolVar(f"rest2_{a_idx}_{d_idx}")
                model.Add(rb <= off[d_idx])
                model.Add(rb <= off[d_idx + 1])
                model.Add(rb >= off[d_idx] + off[d_idx + 1] - 1)
                rest_blocks.append((d_idx, d_idx + 1, rb))

            # Single off day between shifts with >=36h rest
            single_blocks = []
            for d_idx in range(len(days) - 2):
                for s1 in shifts.keys():
                    for s2 in shifts.keys():
                        rest = (DAY_MINUTES - shifts[s1].end_min) + DAY_MINUTES + shifts[s2].start_min
                        if rest >= weekly_rest_min:
                            rb = model.NewBoolVar(f"rest1_{a_idx}_{d_idx}_{s1}_{s2}")
                            model.Add(rb <= x[(a_idx, d_idx, s1)])
                            model.Add(rb <= off[d_idx + 1])
                            model.Add(rb <= x[(a_idx, d_idx + 2, s2)])
                            model.Add(rb >= x[(a_idx, d_idx, s1)] + off[d_idx + 1] + x[(a_idx, d_idx + 2, s2)] - 2)
                            single_blocks.append((d_idx, d_idx + 2, rb))

            # For each rolling 7-day window, require at least one rest block inside
            if len(days) >= 7:
                for w in range(len(days) - 6):
                    candidates = []
                    for (d_start, d_end, rb) in rest_blocks:
                        if d_start >= w and d_end <= w + 6:
                            candidates.append(rb)
                    for (d_start, d_end, rb) in single_blocks:
                        if d_start >= w and d_end <= w + 6:
                            candidates.append(rb)
                    if candidates:
                        model.Add(sum(candidates) >= 1)

        # Cycle mode weekly max
        if params.ruleset_defaults.cycle_mode_enabled:
            max_week = params.ruleset_defaults.max_minutes_per_week_excluding_overtime
            weeks: Dict[str, List[int]] = {}
            for d_idx, d in enumerate(days):
                weeks.setdefault(_week_start(d), []).append(d_idx)
            for a_idx, agent in enumerate(agents):
                for wk, day_indices in weeks.items():
                    vars_week = []
                    for d_idx in day_indices:
                        for s in shifts.keys():
                            vars_week.append(x[(a_idx, d_idx, s)] * shifts[s].duration)
                    if vars_week:
                        model.Add(sum(vars_week) <= max_week)

        # Objective: fairness + preferences
        penalties = []

        # Preferences
        for a_idx, agent in enumerate(agents):
            pref_map = {(p.date, p.shift): p for p in agent.preferences}
            for d_idx, d in enumerate(days):
                for s in shifts.keys():
                    p = pref_map.get((d, s))
                    if not p:
                        continue
                    if p.type == "prefer":
                        # penalize if not assigned
                        not_assigned = model.NewBoolVar(f"pref_not_{a_idx}_{d_idx}_{s}")
                        model.Add(not_assigned == 1 - x[(a_idx, d_idx, s)])
                        penalties.append(not_assigned * p.weight)
                    else:
                        # avoid: penalize if assigned
                        penalties.append(x[(a_idx, d_idx, s)] * p.weight)

        # Fairness for SOIR and weekend shifts
        for target_shift in ["SOIR"]:
            counts = []
            for a_idx in range(len(agents)):
                count = model.NewIntVar(0, len(days), f"count_{target_shift}_{a_idx}")
                model.Add(count == sum(x[(a_idx, d_idx, target_shift)] for d_idx in range(len(days)) if target_shift in shifts))
                counts.append(count)
            if counts:
                max_count = model.NewIntVar(0, len(days), f"max_{target_shift}")
                min_count = model.NewIntVar(0, len(days), f"min_{target_shift}")
                model.AddMaxEquality(max_count, counts)
                model.AddMinEquality(min_count, counts)
                diff = model.NewIntVar(0, len(days), f"diff_{target_shift}")
                model.Add(diff == max_count - min_count)
                penalties.append(diff * 5)

        # Weekend rotation fairness on weekend blocks (not only weekend days):
        # - balance weekend duties across agents
        # - strongly penalize consecutive weekends for the same agent
        weekend_map: Dict[tuple[int, int], List[int]] = {}
        for d_idx, d in enumerate(days):
            dd = datetime.strptime(d, "%Y-%m-%d").date()
            if dd.weekday() < 5:
                continue
            iso = dd.isocalendar()
            weekend_map.setdefault((iso.year, iso.week), []).append(d_idx)
        weekend_keys = sorted(weekend_map.keys())
        weekend_groups = [weekend_map[k] for k in weekend_keys]

        weekend_block_counts = []
        for a_idx in range(len(agents)):
            worked_blocks = []
            for w_idx, group_indices in enumerate(weekend_groups):
                worked = model.NewBoolVar(f"weekend_block_{a_idx}_{w_idx}")
                assign_vars = [
                    x[(a_idx, d_idx, s)]
                    for d_idx in group_indices
                    for s in shifts.keys()
                ]
                if assign_vars:
                    for v in assign_vars:
                        model.Add(v <= worked)
                    model.Add(sum(assign_vars) >= worked)
                else:
                    model.Add(worked == 0)
                worked_blocks.append(worked)

            block_count = model.NewIntVar(0, len(weekend_groups), f"weekend_blocks_count_{a_idx}")
            if worked_blocks:
                model.Add(block_count == sum(worked_blocks))
            else:
                model.Add(block_count == 0)
            weekend_block_counts.append(block_count)

            for w_idx in range(len(worked_blocks) - 1):
                consecutive = model.NewBoolVar(f"weekend_consecutive_{a_idx}_{w_idx}")
                model.Add(consecutive <= worked_blocks[w_idx])
                model.Add(consecutive <= worked_blocks[w_idx + 1])
                model.Add(consecutive >= worked_blocks[w_idx] + worked_blocks[w_idx + 1] - 1)
                penalties.append(consecutive * 24)

        if weekend_block_counts:
            max_weekend = model.NewIntVar(0, len(weekend_groups), "max_weekend_blocks")
            min_weekend = model.NewIntVar(0, len(weekend_groups), "min_weekend_blocks")
            model.AddMaxEquality(max_weekend, weekend_block_counts)
            model.AddMinEquality(min_weekend, weekend_block_counts)
            diff = model.NewIntVar(0, len(weekend_groups), "diff_weekend_blocks")
            model.Add(diff == max_weekend - min_weekend)
            penalties.append(diff * 12)

        # Strongly discourage renfort usage unless needed for feasibility.
        for a_idx, agent in enumerate(agents):
            if agent.id.startswith("R"):
                renfort_count = model.NewIntVar(0, len(days), f"renfort_count_{a_idx}")
                model.Add(renfort_count == sum(x[(a_idx, d_idx, s)] for d_idx in range(len(days)) for s in shifts.keys()))
                penalties.append(renfort_count * 120)

        # Prefer stable rosters: penalize shift changes between consecutive worked days.
        for a_idx in range(len(agents)):
            for d_idx in range(len(days) - 1):
                for s1 in shifts.keys():
                    for s2 in shifts.keys():
                        if s1 == s2:
                            continue
                        sw = model.NewBoolVar(f"switch_{a_idx}_{d_idx}_{s1}_{s2}")
                        model.Add(sw <= x[(a_idx, d_idx, s1)])
                        model.Add(sw <= x[(a_idx, d_idx + 1, s2)])
                        model.Add(sw >= x[(a_idx, d_idx, s1)] + x[(a_idx, d_idx + 1, s2)] - 1)
                        penalties.append(sw * 4)

        # Penalize isolated single workdays surrounded by off-days.
        for a_idx in range(len(agents)):
            work = []
            for d_idx in range(len(days)):
                w = model.NewBoolVar(f"work_{a_idx}_{d_idx}")
                model.Add(w == sum(x[(a_idx, d_idx, s)] for s in shifts.keys()))
                work.append(w)
            for d_idx in range(1, len(days) - 1):
                single = model.NewBoolVar(f"single_{a_idx}_{d_idx}")
                model.Add(single <= work[d_idx])
                model.Add(single + work[d_idx - 1] <= 1)
                model.Add(single + work[d_idx + 1] <= 1)
                model.Add(single >= work[d_idx] - work[d_idx - 1] - work[d_idx + 1])
                penalties.append(single * 6)

        # Fairness on period target minutes by shift eligibility and quotity.
        desired_period_minutes = [0 for _ in agents]
        for shift_code in global_allowed:
            required_per_day = params.coverage_requirements.get(shift_code, 0)
            if required_per_day <= 0:
                continue
            total_minutes_for_shift = required_per_day * len(days) * shifts[shift_code].duration
            eligible = [a_idx for a_idx in range(len(agents)) if shift_code in allowed_shifts_by_agent[a_idx]]
            if not eligible:
                continue
            total_weight = sum(max(1, int(agents[a_idx].quotity)) for a_idx in eligible)
            if total_weight <= 0:
                continue
            for a_idx in eligible:
                weight = max(1, int(agents[a_idx].quotity))
                desired_period_minutes[a_idx] += int(round(total_minutes_for_shift * weight / total_weight))

        for a_idx, agent in enumerate(agents):
            max_dev = len(days) * max_shift_duration
            dev = model.NewIntVar(0, max_dev, f"dev_period_target_{a_idx}")
            planned = sum(x[(a_idx, d_idx, s)] * shifts[s].duration for d_idx in range(len(days)) for s in shifts.keys())
            target = desired_period_minutes[a_idx]
            model.Add(dev >= planned - target)
            model.Add(dev >= target - planned)
            penalties.append(dev * 2)

        # Fairness on total annual minutes (baseline + planned) and targets
        if agents:
            total_vars = []
            max_baseline = max(baseline_minutes.get(a.id, 0) for a in agents)
            max_target_minutes = max(
                (
                    int(round(a.annual_target_hours * 60))
                    for a in agents
                    if a.annual_target_hours is not None
                ),
                default=0,
            )
            # Keep total variable bounds large enough to compare with annual targets.
            max_bound = max(max_baseline, max_target_minutes) + len(days) * max_shift_duration
            for a_idx, agent in enumerate(agents):
                baseline = baseline_minutes.get(agent.id, 0)
                total_var = model.NewIntVar(0, max_bound, f"total_minutes_{a_idx}")
                planned = sum(x[(a_idx, d_idx, s)] * shifts[s].duration for d_idx in range(len(days)) for s in shifts.keys())
                model.Add(total_var == baseline + planned)
                total_vars.append(total_var)
            # Penalize deviation from annual target if provided
            for a_idx, agent in enumerate(agents):
                if agent.annual_target_hours is None:
                    continue
                target_minutes = int(round(agent.annual_target_hours * 60))
                max_dev = max_bound
                dev = model.NewIntVar(0, max_dev, f"dev_target_{a_idx}")
                model.Add(dev >= total_vars[a_idx] - target_minutes)
                model.Add(dev >= target_minutes - total_vars[a_idx])
                penalties.append(dev)

        model.Minimize(sum(penalties) if penalties else 0)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10
        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return "infeasible", [], None, "Aucune solution faisable sous contraintes"

        assignments: List[ShiftAssignment] = []
        for a_idx, agent in enumerate(agents):
            for d_idx, d in enumerate(days):
                for s in shifts.keys():
                    if solver.Value(x[(a_idx, d_idx, s)]) == 1:
                        assignments.append(ShiftAssignment(agent_id=agent.id, date=d, shift=s))

        return "ok", assignments, int(solver.ObjectiveValue()), None

    added_agents: List[Agent] = []
    base_agents = list(req.agents)
    if not params.auto_add_agents_if_needed:
        status, assignments, score, explanation = _solve(base_agents)
        return status, assignments, score, explanation, added_agents

    max_extra = max(params.max_extra_agents, 0)
    last_status = "infeasible"
    last_assignments: List[ShiftAssignment] = []
    last_score: int | None = None
    last_explanation: str | None = None
    for idx in range(max_extra + 1):
        status, assignments, score, explanation = _solve(base_agents + added_agents)
        last_status, last_assignments, last_score, last_explanation = status, assignments, score, explanation
        if status == "ok":
            return status, assignments, score, explanation, added_agents
        if idx < max_extra:
            added_agents.append(_make_extra_agent(idx + 1))

    return last_status, last_assignments, last_score, last_explanation, added_agents
