// ==========================================================================
// Request Builder — buildRequest() + getAgents() + validation
// Preserves all form field IDs and payload structure exactly
// ==========================================================================

import { SHIFT_DEFS } from './config.js';
import { lockedAssignments, getEffectiveAgents } from './state.js';
import { dateRange, parseTimeToMin, dateOffset, computeAnnualTarget } from './utils.js';

export function getAgents() {
  const agents = [];
  const rows = [...document.getElementById("agents_body").querySelectorAll("tr")];
  rows.forEach((tr, idx) => {
    const inputs = tr.querySelectorAll("input, select");
    const lastName = inputs[0].value.trim();
    const firstName = inputs[1].value.trim();
    const regime = inputs[2].value;
    const quotity = parseInt(inputs[3].value, 10);
    const annualTarget = parseFloat(inputs[4].value);
    const unavailability = inputs[5].value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    agents.push({
      id: `A${idx + 1}`,
      first_name: firstName || `Agent${idx + 1}`,
      last_name: lastName || "",
      regime,
      quotity,
      annual_target_hours: Number.isFinite(annualTarget) ? annualTarget : null,
      unavailability_dates: unavailability,
      preferences: []
    });
  });
  return agents;
}

export function getBasicState() {
  const start = document.getElementById("start_date").value;
  const end = document.getElementById("end_date").value;
  const mode = document.getElementById("mode").value;
  const cov = {
    MATIN: parseInt(document.getElementById("cov_matin").value, 10) || 0,
    SOIR: parseInt(document.getElementById("cov_soir").value, 10) || 0,
    JOUR_12H: parseInt(document.getElementById("cov_12h").value, 10) || 0
  };
  return { start, end, mode, cov };
}

export function buildRequest() {
  const simpleMode = document.getElementById("simple_mode")?.checked ?? true;
  if (simpleMode) {
    setRecommendedSettingsQuiet();
  }

  return {
    params: {
      service_unit: document.getElementById("service_unit").value,
      start_date: document.getElementById("start_date").value,
      end_date: document.getElementById("end_date").value,
      mode: document.getElementById("mode").value,
      coverage_requirements: {
        MATIN: parseInt(document.getElementById("cov_matin").value, 10),
        SOIR: parseInt(document.getElementById("cov_soir").value, 10),
        JOUR_12H: parseInt(document.getElementById("cov_12h").value, 10)
      },
      planning_scope: {
        day_only: true,
        service_window: { start: "07:00", end: "21:00" }
      },
      shifts: {
        MATIN: { start: "07:00", end: "14:00", duration_minutes: 420 },
        SOIR: { start: "14:00", end: "21:00", duration_minutes: 420 },
        JOUR_12H: { start: "07:00", end: "19:00", duration_minutes: 720 }
      },
      assumptions: {
        transmissions_included: true,
        pause_included_in_shift: true
      },
      admin_params: {
        transmissions_minutes: 15,
        pause_min_minutes: 20
      },
      ruleset_defaults: {
        daily_rest_min_minutes: 720,
        daily_rest_min_minutes_with_agreement: 660,
        weekly_rest_min_minutes: 2160,
        max_minutes_rolling_7d: 2880,
        cycle_mode_enabled: false,
        cycle_weeks: 4,
        max_minutes_per_week_excluding_overtime: 2640
      },
      agent_regimes: {
        REGIME_12H_JOUR: { allowed_shifts: ["JOUR_12H"], max_consecutive_12h_days: 3 },
        REGIME_MATIN_ONLY: { allowed_shifts: ["MATIN"] },
        REGIME_SOIR_ONLY: { allowed_shifts: ["SOIR"] },
        REGIME_MIXTE: { allowed_shifts: ["MATIN", "SOIR"] },
        REGIME_POLYVALENT: { allowed_shifts: ["MATIN", "SOIR", "JOUR_12H"], max_consecutive_12h_days: 3 }
      },
      hard_forbidden_transitions: [
        { from: "SOIR", to: "MATIN", reason: "daily_rest < 11h (10h)" },
        { from: "SOIR", to: "JOUR_12H", reason: "daily_rest < 11h (10h)" }
      ],
      legal_profile: "FPH",
      agreement_11h_enabled: false,
      allow_single_12h_exception: simpleMode ? false : (document.getElementById("allow_12h_exception")?.checked ?? false),
      max_12h_exceptions_per_agent: simpleMode ? 1 : (parseInt(document.getElementById("max_12h_exception")?.value, 10) || 0),
      allowed_12h_exception_dates: simpleMode ? [] : (document.getElementById("exception_12h_date")?.value
        ? [document.getElementById("exception_12h_date").value]
        : []),
      forbid_matin_soir_matin: simpleMode ? true : (document.getElementById("forbid_msm")?.checked ?? true),
      use_tracker: simpleMode ? true : (document.getElementById("use_tracker")?.checked ?? true),
      tracker_year: parseInt(document.getElementById("tracker_year")?.value, 10) || 2026,
      auto_add_agents_if_needed: simpleMode ? true : (document.getElementById("auto_add_agents")?.checked ?? true),
      max_extra_agents: simpleMode ? 6 : (parseInt(document.getElementById("max_extra_agents")?.value, 10) || 0),
      record_tracker_on_generate: simpleMode ? false : (document.getElementById("record_tracker")?.checked ?? false)
    },
    agents: getAgents(),
    locked_assignments: lockedAssignments
  };
}

function setRecommendedSettingsQuiet() {
  const startDate = document.getElementById("start_date")?.value;
  const year = startDate ? parseInt(startDate.split("-")[0], 10) : 2026;
  const el = (id) => document.getElementById(id);
  if (el("allow_12h_exception")) el("allow_12h_exception").checked = false;
  if (el("max_12h_exception")) el("max_12h_exception").value = "1";
  if (el("exception_12h_date")) el("exception_12h_date").value = "";
  if (el("forbid_msm")) el("forbid_msm").checked = true;
  if (el("use_tracker")) el("use_tracker").checked = true;
  if (el("tracker_year")) el("tracker_year").value = String(year || 2026);
  if (el("auto_add_agents")) el("auto_add_agents").checked = true;
  if (el("max_extra_agents")) el("max_extra_agents").value = "6";
  if (el("record_tracker")) el("record_tracker").checked = false;
}

// ── Validation ──

export function getPanel1Issues() {
  const issues = [];
  const { start, end, mode, cov } = getBasicState();
  if (!start || !end) issues.push("Renseigner la periode.");
  if (start && end && start > end) issues.push("Date de fin avant date de debut.");
  if (mode === "12h_jour" && cov.JOUR_12H <= 0) issues.push("En mode 12h jour, la couverture JOUR_12H doit etre > 0.");
  if (mode === "matin_soir" && cov.MATIN + cov.SOIR <= 0) issues.push("En mode matin/soir, renseigner une couverture MATIN/SOIR.");
  return issues;
}

export function getPanel2Issues() {
  const issues = [];
  const rows = [...document.getElementById("agents_body").querySelectorAll("tr")];
  if (!rows.length) {
    issues.push("Ajouter au moins 1 agent.");
    return issues;
  }
  try { getAgents(); } catch (_err) { issues.push("Corriger les champs agents."); }
  return issues;
}

export function getAllIssues() {
  return [...getPanel1Issues(), ...getPanel2Issues()];
}

// ── Lock validation (preserved exactly from original) ──

export function canLockAssignment(candidate) {
  const req = buildRequest();
  const params = req.params;
  const agents = getEffectiveAgents(getAgents());

  const agent = agents.find(a => a.id === candidate.agent_id);
  if (!agent) return { ok: false, reason: "Agent introuvable." };

  if (agent.unavailability_dates.includes(candidate.date)) {
    return { ok: false, reason: "Agent indisponible a cette date." };
  }

  const regime = params.agent_regimes[agent.regime];
  let allowed = regime.allowed_shifts;
  if (agent.regime === "REGIME_MIXTE") {
    allowed = ["MATIN", "SOIR"];
    if (params.allow_single_12h_exception) {
      allowed = [...allowed, "JOUR_12H"];
    }
  }
  if (!allowed.includes(candidate.shift)) {
    return { ok: false, reason: "Regime incompatible avec ce shift." };
  }

  if (
    agent.regime === "REGIME_MIXTE" &&
    candidate.shift === "JOUR_12H" &&
    params.allow_single_12h_exception &&
    params.allowed_12h_exception_dates.length &&
    !params.allowed_12h_exception_dates.includes(candidate.date)
  ) {
    return { ok: false, reason: "12h autorise uniquement aux dates d'exception." };
  }

  if (
    agent.regime === "REGIME_MIXTE" &&
    candidate.shift === "JOUR_12H" &&
    params.allow_single_12h_exception
  ) {
    const max12 = params.max_12h_exceptions_per_agent || 0;
    const current12 = lockedAssignments.filter(
      l => l.agent_id === candidate.agent_id && l.shift === "JOUR_12H"
    ).length;
    if (current12 + 1 > max12) {
      return { ok: false, reason: "Depassement du nombre de 12h autorises pour cet agent." };
    }
  }

  const sameDayOther = lockedAssignments.find(
    l => l.agent_id === candidate.agent_id && l.date === candidate.date && l.shift !== candidate.shift
  );
  if (sameDayOther) {
    return { ok: false, reason: "Un autre shift est deja verrouille ce jour pour cet agent." };
  }

  const shifts = params.shifts;
  const forbiddenPairs = new Set(
    (params.hard_forbidden_transitions || []).map(t => `${t.from}->${t.to}`)
  );

  const minRest = params.agreement_11h_enabled
    ? Math.min(params.ruleset_defaults.daily_rest_min_minutes, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)
    : params.ruleset_defaults.daily_rest_min_minutes;

  function restBetween(s1, s2) {
    const end1 = parseTimeToMin(shifts[s1].end);
    const start2 = parseTimeToMin(shifts[s2].start);
    return (24 * 60 - end1) + start2;
  }

  const prevStr = dateOffset(candidate.date, -1);
  const nextStr = dateOffset(candidate.date, 1);
  const prevPrevStr = dateOffset(candidate.date, -2);
  const nextNextStr = dateOffset(candidate.date, 2);

  const prevLocked = lockedAssignments.find(l => l.agent_id === candidate.agent_id && l.date === prevStr);
  const nextLocked = lockedAssignments.find(l => l.agent_id === candidate.agent_id && l.date === nextStr);
  const prevPrevLocked = lockedAssignments.find(l => l.agent_id === candidate.agent_id && l.date === prevPrevStr);
  const nextNextLocked = lockedAssignments.find(l => l.agent_id === candidate.agent_id && l.date === nextNextStr);

  if (prevLocked) {
    const key = `${prevLocked.shift}->${candidate.shift}`;
    if (forbiddenPairs.has(key)) return { ok: false, reason: "Transition interdite avec le jour precedent." };
    if (restBetween(prevLocked.shift, candidate.shift) < minRest) return { ok: false, reason: "Repos quotidien insuffisant avec le jour precedent." };
  }

  if (nextLocked) {
    const key = `${candidate.shift}->${nextLocked.shift}`;
    if (forbiddenPairs.has(key)) return { ok: false, reason: "Transition interdite avec le jour suivant." };
    if (restBetween(candidate.shift, nextLocked.shift) < minRest) return { ok: false, reason: "Repos quotidien insuffisant avec le jour suivant." };
  }

  if (params.forbid_matin_soir_matin) {
    if (candidate.shift === "SOIR" && prevLocked?.shift === "MATIN" && nextLocked?.shift === "MATIN") {
      return { ok: false, reason: "Pattern MATIN->SOIR->MATIN interdit." };
    }
    if (candidate.shift === "MATIN" && nextLocked?.shift === "SOIR" && nextNextLocked?.shift === "MATIN") {
      return { ok: false, reason: "Pattern MATIN->SOIR->MATIN interdit." };
    }
    if (candidate.shift === "MATIN" && prevLocked?.shift === "SOIR" && prevPrevLocked?.shift === "MATIN") {
      return { ok: false, reason: "Pattern MATIN->SOIR->MATIN interdit." };
    }
  }

  return { ok: true };
}

// ── Feasibility check ──

export function quickFeasibilityCheck(req) {
  const params = req.params;
  if (params.auto_add_agents_if_needed) return [];

  const shifts = params.shifts;
  const days = dateRange(params.start_date, params.end_date);
  const numDays = days.length;
  const max7d = params.ruleset_defaults.max_minutes_rolling_7d;
  const needWeeklyRest = numDays >= 7 && params.ruleset_defaults.weekly_rest_min_minutes >= 2160;

  let globalAllowed = Object.keys(shifts);
  if (params.mode === "12h_jour") globalAllowed = ["JOUR_12H"];
  if (params.mode === "matin_soir") globalAllowed = ["MATIN", "SOIR"];

  const agentShiftCounts = {};
  req.agents.forEach(a => {
    let allowed = params.agent_regimes[a.regime].allowed_shifts;
    if (a.regime === "REGIME_MIXTE") {
      allowed = ["MATIN", "SOIR"];
      if (params.allow_single_12h_exception) allowed = [...allowed, "JOUR_12H"];
    }
    allowed = allowed.filter(s => globalAllowed.includes(s));
    allowed.forEach(s => { agentShiftCounts[s] = (agentShiftCounts[s] || 0) + 1; });
  });

  const problems = [];
  Object.entries(params.coverage_requirements).forEach(([shift, cov]) => {
    if (!globalAllowed.includes(shift)) return;
    if (!cov || cov <= 0) return;
    const duration = shifts[shift].duration_minutes;
    let maxShiftsPerAgent = Math.floor(max7d / duration);
    if (needWeeklyRest) maxShiftsPerAgent = Math.min(maxShiftsPerAgent, numDays - 1);
    if (maxShiftsPerAgent <= 0) {
      problems.push(`Couverture ${shift}: duree ou regles incompatibles avec la periode.`);
      return;
    }
    const totalNeeded = cov * numDays;
    const minAgents = Math.ceil(totalNeeded / maxShiftsPerAgent);
    const available = agentShiftCounts[shift] || 0;
    if (available < minAgents) {
      problems.push(`Couverture ${shift}: besoin d'au moins ${minAgents} agent(s) (actuel: ${available}).`);
    }
  });

  return problems;
}
