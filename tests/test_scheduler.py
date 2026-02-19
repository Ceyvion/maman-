from copy import deepcopy

from app.models import GenerateRequest
from app.scheduler import build_solution


def base_request():
    return {
        "params": {
            "service_unit": "USLD",
            "start_date": "2026-02-09",
            "end_date": "2026-02-12",
            "mode": "mixte",
            "coverage_requirements": {"MATIN": 1, "SOIR": 1, "JOUR_12H": 0},
            "planning_scope": {"day_only": True, "service_window": {"start": "07:00", "end": "21:00"}},
            "shifts": {
                "MATIN": {"start": "07:00", "end": "14:00", "duration_minutes": 420},
                "SOIR": {"start": "14:00", "end": "21:00", "duration_minutes": 420},
                "JOUR_12H": {"start": "07:00", "end": "19:00", "duration_minutes": 720}
            },
            "assumptions": {"transmissions_included": True, "pause_included_in_shift": True},
            "admin_params": {"transmissions_minutes": 15, "pause_min_minutes": 20},
            "ruleset_defaults": {
                "daily_rest_min_minutes": 720,
                "daily_rest_min_minutes_with_agreement": 660,
                "weekly_rest_min_minutes": 2160,
                "max_minutes_rolling_7d": 2880,
                "cycle_mode_enabled": False,
                "cycle_weeks": 4,
                "max_minutes_per_week_excluding_overtime": 2640
            },
            "agent_regimes": {
                "REGIME_12H_JOUR": {"allowed_shifts": ["JOUR_12H"], "max_consecutive_12h_days": 3},
                "REGIME_MATIN_ONLY": {"allowed_shifts": ["MATIN"]},
                "REGIME_SOIR_ONLY": {"allowed_shifts": ["SOIR"]},
                "REGIME_MIXTE": {"allowed_shifts": ["MATIN", "SOIR"]}
            },
            "hard_forbidden_transitions": [
                {"from": "SOIR", "to": "MATIN", "reason": "daily_rest < 11h (10h)"},
                {"from": "SOIR", "to": "JOUR_12H", "reason": "daily_rest < 11h (10h)"}
            ],
            "legal_profile": "FPH",
            "agreement_11h_enabled": False,
            "use_tracker": False,
            "tracker_year": 2026,
            "auto_add_agents_if_needed": False,
            "max_extra_agents": 0,
            "record_tracker_on_generate": False
        },
        "agents": [
            {"id": "A1", "first_name": "Anna", "last_name": "Dupont", "regime": "REGIME_MATIN_ONLY", "quotity": 100, "unavailability_dates": []},
            {"id": "A2", "first_name": "Samir", "last_name": "Khelifi", "regime": "REGIME_SOIR_ONLY", "quotity": 100, "unavailability_dates": []},
            {"id": "A3", "first_name": "Lea", "last_name": "Martin", "regime": "REGIME_MATIN_ONLY", "quotity": 100, "unavailability_dates": []}
        ],
        "locked_assignments": []
    }


def test_feasible_basic():
    req = GenerateRequest(**base_request())
    status, assignments, score, explanation, _ = build_solution(req)
    assert status == "ok"
    assert len(assignments) > 0


def test_regime_compatibility():
    req = GenerateRequest(**base_request())
    status, assignments, *_ = build_solution(req)
    assert all(a.shift == "MATIN" or a.shift == "SOIR" for a in assignments)


def test_coverage_enforced():
    data = base_request()
    data["params"]["coverage_requirements"]["SOIR"] = 2
    data["agents"] = [
        {"id": "A1", "first_name": "Anna", "last_name": "Dupont", "regime": "REGIME_SOIR_ONLY", "quotity": 100, "unavailability_dates": []}
    ]
    req = GenerateRequest(**data)
    status, *_ = build_solution(req)
    assert status == "infeasible"


def test_forbidden_transition_soir_to_matin():
    data = base_request()
    data["params"]["coverage_requirements"] = {"MATIN": 1, "SOIR": 1, "JOUR_12H": 0}
    data["agents"] = [
        {"id": "A1", "first_name": "A", "last_name": "A", "regime": "REGIME_SOIR_ONLY", "quotity": 100, "unavailability_dates": []},
        {"id": "A2", "first_name": "B", "last_name": "B", "regime": "REGIME_MATIN_ONLY", "quotity": 100, "unavailability_dates": []}
    ]
    req = GenerateRequest(**data)
    status, assignments, *_ = build_solution(req)
    assert status == "ok"
    # Ensure no SOIR then MATIN for same agent
    by_agent = {}
    for a in assignments:
        by_agent.setdefault(a.agent_id, {})[a.date] = a.shift
    for agent_id, m in by_agent.items():
        dates = sorted(m.keys())
        for i in range(len(dates) - 1):
            if m[dates[i]] == "SOIR" and m[dates[i + 1]] == "MATIN":
                assert False


def test_max_consecutive_12h():
    data = base_request()
    data["params"]["mode"] = "12h_jour"
    data["params"]["coverage_requirements"] = {"MATIN": 0, "SOIR": 0, "JOUR_12H": 1}
    data["agents"] = [
        {"id": "A1", "first_name": "A", "last_name": "A", "regime": "REGIME_12H_JOUR", "quotity": 100, "unavailability_dates": []}
    ]
    req = GenerateRequest(**data)
    status, assignments, *_ = build_solution(req)
    assert status == "infeasible"


def test_locked_assignment():
    data = base_request()
    data["locked_assignments"] = [{"agent_id": "A1", "date": "2026-02-10", "shift": "MATIN"}]
    req = GenerateRequest(**data)
    status, assignments, *_ = build_solution(req)
    assert status == "ok"
    assert any(a.agent_id == "A1" and a.date == "2026-02-10" and a.shift == "MATIN" for a in assignments)


def test_unavailability_enforced():
    data = base_request()
    data["agents"][0]["unavailability_dates"] = ["2026-02-10"]
    req = GenerateRequest(**data)
    status, assignments, *_ = build_solution(req)
    assert status == "ok"
    assert all(not (a.agent_id == "A1" and a.date == "2026-02-10") for a in assignments)


def test_mode_matin_soir_only():
    data = base_request()
    data["params"]["mode"] = "matin_soir"
    data["params"]["coverage_requirements"]["JOUR_12H"] = 1
    req = GenerateRequest(**data)
    status, *_ = build_solution(req)
    assert status == "infeasible"


def test_cycle_mode_weekly_max():
    data = base_request()
    data["params"]["ruleset_defaults"]["cycle_mode_enabled"] = True
    data["params"]["ruleset_defaults"]["max_minutes_per_week_excluding_overtime"] = 420
    req = GenerateRequest(**data)
    status, *_ = build_solution(req)
    assert status == "infeasible"


def test_rolling_7d_max():
    data = base_request()
    data["params"]["ruleset_defaults"]["max_minutes_rolling_7d"] = 420
    req = GenerateRequest(**data)
    status, *_ = build_solution(req)
    assert status == "infeasible"
