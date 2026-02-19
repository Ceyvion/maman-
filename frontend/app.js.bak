const API_BASE = `${window.location.protocol}//${window.location.hostname || "localhost"}:8000`;

const agentsBody = document.getElementById("agents_body");
const generationFeedback = document.getElementById("generation_feedback");
const quickSummary = document.getElementById("quick_summary");
const readyCheck = document.getElementById("ready_check");
const liveEntriesContainer = document.getElementById("live_entries");
const liveAssignmentSelect = document.getElementById("live_assignment_select");
const liveTaskTitle = document.getElementById("live_task_title");
const liveTaskDetails = document.getElementById("live_task_details");
const liveStatus = document.getElementById("live_status");
const liveServerTime = document.getElementById("live_server_time");
const frComplianceNotice = document.getElementById("fr_compliance_notice");
const simpleModeInput = document.getElementById("simple_mode");
const simpleModeLabel = document.getElementById("simple_mode_label");
const screen1Advanced = document.getElementById("screen1_advanced");
const staleNotice = document.getElementById("stale_notice");
const staleRegenerateButton = document.getElementById("stale_regenerate");
const panelStatusEls = {
  "screen-1": document.getElementById("panel_status_screen-1"),
  "screen-2": document.getElementById("panel_status_screen-2"),
  "screen-3": document.getElementById("panel_status_screen-3")
};
const panelSummaryEls = {
  "screen-1": document.getElementById("panel_summary_screen-1"),
  "screen-2": document.getElementById("panel_summary_screen-2"),
  "screen-3": document.getElementById("panel_summary_screen-3")
};
const panel3StaleBadge = document.getElementById("panel3_stale_badge");
const PANEL_IDS = ["screen-1", "screen-2", "screen-3"];
const SECTION_IDS = ["planning", "live", "tracker", "compliance"];
const UI_STORAGE_KEY = "planning_jour_ui_v1";

const LIVE_STATUS_LABELS = {
  planned: "Prévu",
  in_progress: "En cours",
  blocked: "Bloqué",
  done: "Terminé"
};

function defaultUiState() {
  return {
    activePanel: "screen-1",
    sections: {
      planning: true,
      live: false,
      tracker: false,
      compliance: false
    },
    panelValidity: {
      "screen-1": false,
      "screen-2": false,
      "screen-3": false
    },
    outputStale: false
  };
}

function loadUiState() {
  const base = defaultUiState();
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}");
    if (typeof parsed !== "object" || parsed === null) return base;
    if (PANEL_IDS.includes(parsed.activePanel)) {
      base.activePanel = parsed.activePanel;
    }
    if (parsed.sections && typeof parsed.sections === "object") {
      SECTION_IDS.forEach(id => {
        if (typeof parsed.sections[id] === "boolean") {
          base.sections[id] = parsed.sections[id];
        }
      });
    }
    if (typeof parsed.outputStale === "boolean") {
      base.outputStale = parsed.outputStale;
    }
    return base;
  } catch (_err) {
    return base;
  }
}

const uiState = loadUiState();

function computeAnnualTarget(quotity) {
  const base = 1607;
  if (quotity === 80) return base * 0.8;
  if (quotity === 50) return base * 0.5;
  return base;
}

function addAgentRow(values = {}) {
  const tr = document.createElement("tr");
  const defaultTarget = values.annual_target ?? computeAnnualTarget(values.quotity || 100);
  tr.innerHTML = `
    <td><input value="${values.last_name || ""}" /></td>
    <td><input value="${values.first_name || ""}" /></td>
    <td>
      <select>
        <option value="REGIME_12H_JOUR">12h jour</option>
        <option value="REGIME_MATIN_ONLY">Matin uniquement</option>
        <option value="REGIME_SOIR_ONLY">Soir uniquement</option>
        <option value="REGIME_MIXTE">Mixte (Matin+Soir)</option>
        <option value="REGIME_POLYVALENT">Polyvalent (M+S+12H)</option>
      </select>
    </td>
    <td>
      <select>
        <option value="100">100%</option>
        <option value="80">80%</option>
        <option value="50">50%</option>
      </select>
    </td>
    <td class="advanced-col"><input type="number" min="0" placeholder="1607" value="${defaultTarget || ""}" /></td>
    <td><input placeholder="2026-02-12,2026-02-13" value="${values.unavailability || ""}" /></td>
  `;
  agentsBody.appendChild(tr);

  const selects = tr.querySelectorAll("select");
  if (selects[0]) {
    selects[0].value = values.regime || "REGIME_MIXTE";
  }
  if (selects[1]) {
    selects[1].value = values.quotity ? String(values.quotity) : "100";
  }

  const quotitySelect = selects[1];
  const annualInput = tr.querySelectorAll("input")[2];
  if (quotitySelect && annualInput && !values.annual_target) {
    quotitySelect.addEventListener("change", () => {
      const q = parseInt(quotitySelect.value, 10);
      annualInput.value = computeAnnualTarget(q).toFixed(0);
    });
  }

  if (document.getElementById("simple_mode")?.checked) {
    tr.querySelectorAll(".advanced-col").forEach(el => {
      el.style.display = "none";
    });
  }
}

function setRecommendedSettings() {
  const startDate = document.getElementById("start_date").value;
  const year = startDate ? parseInt(startDate.split("-")[0], 10) : 2026;
  document.getElementById("allow_12h_exception").checked = false;
  document.getElementById("max_12h_exception").value = "1";
  document.getElementById("exception_12h_date").value = "";
  document.getElementById("forbid_msm").checked = true;
  document.getElementById("use_tracker").checked = true;
  document.getElementById("tracker_year").value = String(year || 2026);
  document.getElementById("auto_add_agents").checked = true;
  document.getElementById("max_extra_agents").value = "6";
  document.getElementById("record_tracker").checked = false;
  updateModeInputs();
  renderQuickSummary();
  renderReadyCheck();
}

function setSimpleMode(enabled) {
  if (simpleModeInput) {
    simpleModeInput.checked = enabled;
  }
  if (screen1Advanced) {
    screen1Advanced.open = !enabled;
  }
  document.querySelectorAll(".advanced-col").forEach(el => {
    el.style.display = enabled ? "none" : "";
  });
  if (simpleModeLabel) {
    simpleModeLabel.textContent = enabled ? "Mode simple actif (recommandé)" : "Mode avancé actif";
  }
  if (enabled) {
    setRecommendedSettings();
  } else {
    renderReadyCheck();
  }
}

addAgentRow({ first_name: "Anna", last_name: "Dupont", regime: "REGIME_MIXTE", quotity: 100 });
addAgentRow({ first_name: "Samir", last_name: "Khelifi", regime: "REGIME_MIXTE", quotity: 100 });
addAgentRow({ first_name: "Lea", last_name: "Martin", regime: "REGIME_MIXTE", quotity: 80 });
addAgentRow({ first_name: "Noe", last_name: "Bernard", regime: "REGIME_MIXTE", quotity: 80 });

function loadDemoData() {
  document.getElementById("service_unit").value = "USLD";
  document.getElementById("start_date").value = "2026-02-09";
  document.getElementById("end_date").value = "2026-02-15";
  document.getElementById("mode").value = "matin_soir";
  document.getElementById("cov_matin").value = "1";
  document.getElementById("cov_soir").value = "1";
  document.getElementById("cov_12h").value = "0";
  setRecommendedSettings();

  agentsBody.innerHTML = "";
  addAgentRow({ first_name: "Anna", last_name: "Dupont", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Samir", last_name: "Khelifi", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Lea", last_name: "Martin", regime: "REGIME_MIXTE", quotity: 80 });
  addAgentRow({ first_name: "Noe", last_name: "Bernard", regime: "REGIME_MIXTE", quotity: 80 });

  lockedAssignments = [];
  lastAssignments = [];
  lastAgents = [];
  document.getElementById("planning").innerHTML = "";
  document.getElementById("compliance").textContent = "";
  document.getElementById("compliance_summary").innerHTML = "";
  liveEntriesContainer.innerHTML = "";
  liveServerTime.textContent = "";
  generationFeedback.textContent = "";
  uiState.outputStale = false;
  renderLiveAssignmentOptions();
  renderQuickSummary();
  renderReadyCheck();
}

function getModeCoverageDefault(mode) {
  if (mode === "12h_jour") {
    return { MATIN: 0, SOIR: 0, JOUR_12H: 1 };
  }
  if (mode === "matin_soir") {
    return { MATIN: 1, SOIR: 1, JOUR_12H: 0 };
  }
  return { MATIN: 1, SOIR: 1, JOUR_12H: 0 };
}

function updateModeInputs() {
  const mode = document.getElementById("mode").value;
  const covMatin = document.getElementById("cov_matin");
  const covSoir = document.getElementById("cov_soir");
  const cov12h = document.getElementById("cov_12h");
  const defaults = getModeCoverageDefault(mode);

  if (mode === "12h_jour") {
    covMatin.value = String(defaults.MATIN);
    covSoir.value = String(defaults.SOIR);
    cov12h.value = String(defaults.JOUR_12H);
    covMatin.disabled = true;
    covSoir.disabled = true;
    cov12h.disabled = false;
  } else if (mode === "matin_soir") {
    cov12h.value = String(defaults.JOUR_12H);
    covMatin.disabled = false;
    covSoir.disabled = false;
    cov12h.disabled = true;
  } else {
    covMatin.disabled = false;
    covSoir.disabled = false;
    cov12h.disabled = false;
  }
}

function getBasicState() {
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

function renderQuickSummary() {
  const { start, end, mode, cov } = getBasicState();
  const modeLabel = mode === "12h_jour" ? "12H JOUR" : mode === "matin_soir" ? "MATIN/SOIR" : "MIXTE";
  const agents = getAgents().length;
  quickSummary.innerHTML =
    `<span class="quick-chip">Mode: ${modeLabel}</span>` +
    `<span class="quick-chip">Période: ${start || "-"} → ${end || "-"}</span>` +
    `<span class="quick-chip">Couverture: M ${cov.MATIN} / S ${cov.SOIR} / 12H ${cov.JOUR_12H}</span>` +
    `<span class="quick-chip">Agents: ${agents}</span>`;
}

function getPanel1Issues() {
  const issues = [];
  const { start, end, mode, cov } = getBasicState();
  if (!start || !end) issues.push("Renseigner la période.");
  if (start && end && start > end) issues.push("Date de fin avant date de début.");
  if (mode === "12h_jour" && cov.JOUR_12H <= 0) issues.push("En mode 12h jour, la couverture JOUR_12H doit être > 0.");
  if (mode === "matin_soir" && cov.MATIN + cov.SOIR <= 0) issues.push("En mode matin/soir, renseigner une couverture MATIN/SOIR.");
  return issues;
}

function getPanel2Issues() {
  const issues = [];
  const rows = [...agentsBody.querySelectorAll("tr")];
  if (!rows.length) {
    issues.push("Ajouter au moins 1 agent.");
    return issues;
  }
  try {
    getAgents();
  } catch (_err) {
    issues.push("Corriger les champs agents.");
  }
  return issues;
}

function getGateReason(targetPanelId) {
  if (targetPanelId === "screen-1") return "";
  const panel1Issues = getPanel1Issues();
  if (targetPanelId === "screen-2" && panel1Issues.length) {
    return panel1Issues[0];
  }
  const panel2Issues = getPanel2Issues();
  if (targetPanelId === "screen-3") {
    if (panel1Issues.length) return panel1Issues[0];
    if (panel2Issues.length) return panel2Issues[0];
  }
  return "";
}

function renderReadyCheck() {
  const issues = [...getPanel1Issues(), ...getPanel2Issues()];

  if (!issues.length) {
    readyCheck.innerHTML = "<span class='check-ok'>Prêt à générer</span>";
  } else {
    readyCheck.innerHTML = `<span class='check-warn'>À corriger:</span> ${issues.join(" ")}`;
  }
  updateUiChrome();
}

function buildMinimalTeam() {
  const { mode, cov } = getBasicState();
  agentsBody.innerHTML = "";
  let count = Math.max(4, cov.MATIN + cov.SOIR + cov.JOUR_12H + 2);
  if (mode === "12h_jour") count = Math.max(4, cov.JOUR_12H * 4);
  for (let i = 0; i < count; i++) {
    const quotity = i < 2 ? 100 : 80;
    let regime = "REGIME_MIXTE";
    if (mode === "12h_jour") {
      regime = "REGIME_12H_JOUR";
    } else if (mode === "mixte" && cov.JOUR_12H > 0) {
      regime = "REGIME_POLYVALENT";
    }
    addAgentRow({
      first_name: `Agent${i + 1}`,
      last_name: "Equipe",
      regime,
      quotity
    });
  }
  generationFeedback.textContent = `Équipe minimale générée (${count} agents).`;
  markOutputStale();
  renderQuickSummary();
  renderReadyCheck();
}

function getAgents() {
  const agents = [];
  [...agentsBody.querySelectorAll("tr")].forEach((tr, idx) => {
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

function buildRequest() {
  const simpleMode = document.getElementById("simple_mode").checked;
  if (simpleMode) {
    setRecommendedSettings();
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
      allow_single_12h_exception: simpleMode ? false : document.getElementById("allow_12h_exception").checked,
      max_12h_exceptions_per_agent: simpleMode ? 1 : (parseInt(document.getElementById("max_12h_exception").value, 10) || 0),
      allowed_12h_exception_dates: simpleMode ? [] : (document.getElementById("exception_12h_date").value
        ? [document.getElementById("exception_12h_date").value]
        : []),
      forbid_matin_soir_matin: simpleMode ? true : document.getElementById("forbid_msm").checked,
      use_tracker: simpleMode ? true : document.getElementById("use_tracker").checked,
      tracker_year: parseInt(document.getElementById("tracker_year").value, 10) || 2026,
      auto_add_agents_if_needed: simpleMode ? true : document.getElementById("auto_add_agents").checked,
      max_extra_agents: simpleMode ? 6 : (parseInt(document.getElementById("max_extra_agents").value, 10) || 0),
      record_tracker_on_generate: simpleMode ? false : document.getElementById("record_tracker").checked
    },
    agents: getAgents(),
    locked_assignments: lockedAssignments
  };
}

function getEffectiveAgents() {
  return lastAgents.length ? lastAgents : getAgents();
}

function canLockAssignment(candidate) {
  const req = buildRequest();
  const params = req.params;
  const agents = getEffectiveAgents();

  const agent = agents.find(a => a.id === candidate.agent_id);
  if (!agent) return { ok: false, reason: "Agent introuvable." };

  if (agent.unavailability_dates.includes(candidate.date)) {
    return { ok: false, reason: "Agent indisponible à cette date." };
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
    return { ok: false, reason: "Régime incompatible avec ce shift." };
  }

  if (
    agent.regime === "REGIME_MIXTE" &&
    candidate.shift === "JOUR_12H" &&
    params.allow_single_12h_exception &&
    params.allowed_12h_exception_dates.length &&
    !params.allowed_12h_exception_dates.includes(candidate.date)
  ) {
    return { ok: false, reason: "12h autorisé uniquement aux dates d’exception." };
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
      return { ok: false, reason: "Dépassement du nombre de 12h autorisés pour cet agent." };
    }
  }

  // One shift per day per agent
  const sameDayOther = lockedAssignments.find(
    l => l.agent_id === candidate.agent_id && l.date === candidate.date && l.shift !== candidate.shift
  );
  if (sameDayOther) {
    return { ok: false, reason: "Un autre shift est déjà verrouillé ce jour pour cet agent." };
  }

  // Daily rest / forbidden transitions with adjacent locked days
  const shifts = params.shifts;
  const forbiddenPairs = new Set(
    (params.hard_forbidden_transitions || []).map(t => `${t.from}->${t.to}`)
  );

  const minRest = params.agreement_11h_enabled
    ? Math.min(params.ruleset_defaults.daily_rest_min_minutes, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)
    : params.ruleset_defaults.daily_rest_min_minutes;

  function parseTimeToMin(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }

  function restBetween(s1, s2) {
    const end1 = parseTimeToMin(shifts[s1].end);
    const start2 = parseTimeToMin(shifts[s2].start);
    return (24 * 60 - end1) + start2;
  }

  function dateOffset(dateStr, offset) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
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
    if (forbiddenPairs.has(key)) {
      return { ok: false, reason: "Transition interdite avec le jour précédent." };
    }
    if (restBetween(prevLocked.shift, candidate.shift) < minRest) {
      return { ok: false, reason: "Repos quotidien insuffisant avec le jour précédent." };
    }
  }

  if (nextLocked) {
    const key = `${candidate.shift}->${nextLocked.shift}`;
    if (forbiddenPairs.has(key)) {
      return { ok: false, reason: "Transition interdite avec le jour suivant." };
    }
    if (restBetween(candidate.shift, nextLocked.shift) < minRest) {
      return { ok: false, reason: "Repos quotidien insuffisant avec le jour suivant." };
    }
  }

  if (params.forbid_matin_soir_matin) {
    if (
      candidate.shift === "SOIR" &&
      prevLocked && prevLocked.shift === "MATIN" &&
      nextLocked && nextLocked.shift === "MATIN"
    ) {
      return { ok: false, reason: "Pattern MATIN→SOIR→MATIN interdit." };
    }
    if (
      candidate.shift === "MATIN" &&
      nextLocked && nextLocked.shift === "SOIR" &&
      nextNextLocked && nextNextLocked.shift === "MATIN"
    ) {
      return { ok: false, reason: "Pattern MATIN→SOIR→MATIN interdit." };
    }
    if (
      candidate.shift === "MATIN" &&
      prevLocked && prevLocked.shift === "SOIR" &&
      prevPrevLocked && prevPrevLocked.shift === "MATIN"
    ) {
      return { ok: false, reason: "Pattern MATIN→SOIR→MATIN interdit." };
    }
  }

  return { ok: true };
}

function renderPlanning(assignments) {
  const shiftOrder = ["MATIN", "SOIR", "JOUR_12H"];
  const shiftLabels = {
    MATIN: "MATIN (07:00-14:00)",
    SOIR: "SOIR (14:00-21:00)",
    JOUR_12H: "JOUR_12H (07:00-19:00)"
  };
  const shiftShort = {
    MATIN: "M",
    SOIR: "S",
    JOUR_12H: "12"
  };
  const shiftClasses = {
    MATIN: "shift-matin",
    SOIR: "shift-soir",
    JOUR_12H: "shift-12h"
  };
  const byDate = {};
  const byAgentDate = {};
  const agents = getEffectiveAgents();
  const agentMap = {};
  const requiredByShift = {
    MATIN: parseInt(document.getElementById("cov_matin").value, 10) || 0,
    SOIR: parseInt(document.getElementById("cov_soir").value, 10) || 0,
    JOUR_12H: parseInt(document.getElementById("cov_12h").value, 10) || 0
  };

  agents.forEach(a => {
    const full = `${a.last_name} ${a.first_name}`.trim();
    agentMap[a.id] = full || a.id;
    byAgentDate[a.id] = {};
  });

  assignments.forEach(a => {
    byDate[a.date] = byDate[a.date] || [];
    byDate[a.date].push(a);
    byAgentDate[a.agent_id] = byAgentDate[a.agent_id] || {};
    byAgentDate[a.agent_id][a.date] = a.shift;
  });

  const start = document.getElementById("start_date").value;
  const end = document.getElementById("end_date").value;
  const dates = dateRange(start, end);

  function shortDateLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
  }

  const assignmentsCount = assignments.length;
  const lockedCount = lockedAssignments.length;
  let coveredSlots = 0;
  let requiredSlots = 0;
  dates.forEach(d => {
    const dayItems = byDate[d] || [];
    shiftOrder.forEach(shift => {
      const required = requiredByShift[shift] || 0;
      if (required > 0) {
        requiredSlots += required;
        const assigned = dayItems.filter(a => a.shift === shift).length;
        coveredSlots += Math.min(assigned, required);
      }
    });
  });

  const coveragePct = requiredSlots > 0 ? Math.round((coveredSlots / requiredSlots) * 100) : 100;
  const sortedAgents = [...agents].sort((a, b) => {
    const na = (agentMap[a.id] || a.id).toLowerCase();
    const nb = (agentMap[b.id] || b.id).toLowerCase();
    return na.localeCompare(nb);
  });

  let html = "<div class='planning-board'>";
  html += "<div class='planning-legend'>";
  html += "<span>Clique sur une affectation pour la verrouiller puis régénérer.</span>";
  html += "<div class='planning-legend-items'>";
  html += "<span class='legend-chip shift-matin'>M</span>";
  html += "<span class='legend-chip shift-soir'>S</span>";
  html += "<span class='legend-chip shift-12h'>12H</span>";
  html += "</div></div>";

  html += "<div class='planning-summary'>";
  html += `<span class='summary-chip'>Affectations: ${assignmentsCount}</span>`;
  html += `<span class='summary-chip'>Verrous: ${lockedCount}</span>`;
  html += `<span class='summary-chip'>Couverture: ${coveredSlots}/${requiredSlots} (${coveragePct}%)</span>`;
  html += "</div>";

  html += "<div class='day-cards'>";
  dates.forEach(d => {
    const dayItems = byDate[d] || [];
    const dayObj = new Date(`${d}T00:00:00`);
    const weekendClass = dayObj.getDay() === 0 || dayObj.getDay() === 6 ? "weekend" : "";
    html += `<article class='day-card ${weekendClass}'>`;
    html += `<header class='day-card-header'><strong>${shortDateLabel(d)}</strong><span>${d}</span></header>`;
    html += "<div class='day-card-grid'>";
    shiftOrder.forEach(shift => {
      const items = dayItems
        .filter(a => a.shift === shift)
        .sort((a1, a2) => (agentMap[a1.agent_id] || "").localeCompare(agentMap[a2.agent_id] || ""));
      const required = requiredByShift[shift] || 0;
      const statusClass = items.length >= required ? "coverage-ok" : "coverage-warn";
      html += `<section class='shift-row ${shiftClasses[shift]}'>`;
      html += `<div class='shift-meta'><span>${shiftLabels[shift]}</span><span class='${statusClass}'>${items.length}/${required}</span></div>`;
      html += "<div class='assignments-wrap'>";
      if (items.length === 0) {
        html += "<span class='empty-chip'>Aucun</span>";
      } else {
        html += items.map(a => {
          const locked = lockedAssignments.some(l => l.agent_id === a.agent_id && l.date === a.date && l.shift === a.shift);
          const name = agentMap[a.agent_id] || a.agent_id;
          return `<span class="assignment ${shiftClasses[a.shift]} ${locked ? "locked" : ""}" data-agent="${a.agent_id}" data-date="${a.date}" data-shift="${a.shift}">${name}</span>`;
        }).join("");
      }
      html += "</div></section>";
    });
    html += "</div></article>";
  });
  html += "</div>";

  html += "<div class='agent-matrix-wrap'>";
  html += "<table class='agent-matrix'><thead><tr><th>Agent</th>";
  dates.forEach(d => {
    const dayObj = new Date(`${d}T00:00:00`);
    const weekendClass = dayObj.getDay() === 0 || dayObj.getDay() === 6 ? "weekend-col" : "";
    html += `<th class='${weekendClass}'>${shortDateLabel(d)}</th>`;
  });
  html += "<th>Total h</th></tr></thead><tbody>";

  sortedAgents.forEach(agent => {
    const schedule = byAgentDate[agent.id] || {};
    let minutes = 0;
    html += `<tr><td class='matrix-agent'>${agentMap[agent.id]}</td>`;
    dates.forEach(d => {
      const shift = schedule[d];
      const dayObj = new Date(`${d}T00:00:00`);
      const weekendClass = dayObj.getDay() === 0 || dayObj.getDay() === 6 ? "weekend-col" : "";
      if (!shift) {
        html += `<td class='matrix-cell ${weekendClass}'><span class='off-chip'>OFF</span></td>`;
      } else {
        const locked = lockedAssignments.some(l => l.agent_id === agent.id && l.date === d && l.shift === shift);
        if (shift === "MATIN" || shift === "SOIR") minutes += 420;
        if (shift === "JOUR_12H") minutes += 720;
        html += `<td class='matrix-cell ${weekendClass}'><span class="assignment matrix-chip ${shiftClasses[shift]} ${locked ? "locked" : ""}" data-agent="${agent.id}" data-date="${d}" data-shift="${shift}">${shiftShort[shift]}</span></td>`;
      }
    });
    html += `<td class='matrix-total'>${(minutes / 60).toFixed(1)}</td></tr>`;
  });

  html += "</tbody></table></div>";
  html += "</div>";
  document.getElementById("planning").innerHTML = html;

  const service = document.getElementById("service_unit").value;
  document.getElementById("print_summary").textContent = `${service} · ${start} → ${end}`;

  document.querySelectorAll(".assignment").forEach(el => {
    el.addEventListener("click", () => {
      const agent_id = el.dataset.agent;
      const date = el.dataset.date;
      const shift = el.dataset.shift;
      const idx = lockedAssignments.findIndex(l => l.agent_id === agent_id && l.date === date && l.shift === shift);
      if (idx >= 0) {
        lockedAssignments.splice(idx, 1);
      } else {
        const check = canLockAssignment({ agent_id, date, shift });
        if (!check.ok) {
          alert(`Verrouillage refuse: ${check.reason}`);
          return;
        }
        lockedAssignments.push({ agent_id, date, shift });
      }
      renderPlanning(lastAssignments);
    });
  });
  updateUiChrome();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadTrackerView(year) {
  const res = await fetch(`${API_BASE}/tracker/${year}`);
  if (!res.ok) {
    document.getElementById("tracker_view").textContent = "Tracker indisponible.";
    return;
  }
  const data = await res.json();
  const rows = Object.entries(data.minutes_by_agent || {});
  const namesByAgent = data.names_by_agent || {};
  if (!rows.length) {
    document.getElementById("tracker_view").textContent = "Aucune donnée pour cette année.";
    return;
  }
  let html = "<table class='tracker-table'><thead><tr><th>Agent</th><th>Heures</th></tr></thead><tbody>";
  rows.forEach(([agentId, minutes]) => {
    const agent = getEffectiveAgents().find(a => a.id === agentId);
    const name =
      namesByAgent[agentId] ||
      (agent ? `${agent.last_name} ${agent.first_name}`.trim() : agentId);
    html += `<tr><td>${name}</td><td>${(minutes / 60).toFixed(1)}h</td></tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("tracker_view").innerHTML = html;
}

let lastAssignments = [];
let lastAgents = [];
let lockedAssignments = [];
let liveEntries = [];
let liveRefreshTimer = null;

function saveUiState() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      activePanel: uiState.activePanel,
      sections: uiState.sections,
      outputStale: uiState.outputStale
    }));
  } catch (_err) {
    // Ignore storage failures (private mode / quota, etc.)
  }
}

function setPanelStatus(panelId, text, tone) {
  const el = panelStatusEls[panelId];
  if (!el) return;
  el.textContent = text;
  el.className = "panel-status";
  if (tone === "ok") el.classList.add("panel-status-ok");
  if (tone === "warn") el.classList.add("panel-status-warn");
}

function panel1Summary() {
  const { start, end, mode, cov } = getBasicState();
  const modeLabel = mode === "12h_jour" ? "12H" : mode === "matin_soir" ? "M/S" : "Mixte";
  return `${modeLabel} · ${start || "-"} → ${end || "-"} · M${cov.MATIN}/S${cov.SOIR}/12H${cov.JOUR_12H}`;
}

function panel2Summary() {
  const count = agentsBody.querySelectorAll("tr").length;
  return `${count} agent(s) configuré(s)`;
}

function panel3Summary() {
  if (!lastAssignments.length) return "Aucun planning généré.";
  const staleText = uiState.outputStale ? " · régénération requise" : "";
  return `${lastAssignments.length} affectation(s) · ${lockedAssignments.length} verrou(s)${staleText}`;
}

function updatePanelMeta() {
  const panel1Valid = uiState.panelValidity["screen-1"];
  const panel2Valid = uiState.panelValidity["screen-2"];
  const panel3Ready = lastAssignments.length > 0 && !uiState.outputStale;

  setPanelStatus("screen-1", panel1Valid ? "Prêt" : "À corriger", panel1Valid ? "ok" : "warn");
  setPanelStatus("screen-2", panel2Valid ? "Prêt" : "À corriger", panel2Valid ? "ok" : "warn");
  setPanelStatus("screen-3", panel3Ready ? "Prêt" : "À corriger", panel3Ready ? "ok" : "warn");

  if (panelSummaryEls["screen-1"]) panelSummaryEls["screen-1"].textContent = panel1Summary();
  if (panelSummaryEls["screen-2"]) panelSummaryEls["screen-2"].textContent = panel2Summary();
  if (panelSummaryEls["screen-3"]) panelSummaryEls["screen-3"].textContent = panel3Summary();
}

function recomputePanelValidity() {
  uiState.panelValidity["screen-1"] = getPanel1Issues().length === 0;
  uiState.panelValidity["screen-2"] = getPanel2Issues().length === 0;
  uiState.panelValidity["screen-3"] = uiState.panelValidity["screen-1"] && uiState.panelValidity["screen-2"];
}

function isPanelLocked(panelId) {
  return Boolean(getGateReason(panelId));
}

function highestAccessiblePanel() {
  if (uiState.panelValidity["screen-3"]) return "screen-3";
  if (uiState.panelValidity["screen-2"]) return "screen-2";
  return "screen-1";
}

function applyPanelDisclosure() {
  PANEL_IDS.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const header = panel.querySelector(".panel-header");
    const body = panel.querySelector(".panel-body");
    const active = uiState.activePanel === panelId;
    const lockReason = getGateReason(panelId);
    const locked = !active && Boolean(lockReason);

    panel.classList.toggle("is-active", active);
    panel.classList.toggle("is-collapsed", !active);
    panel.classList.toggle("is-locked", locked);

    if (header) {
      header.setAttribute("aria-expanded", String(active));
      header.setAttribute("aria-disabled", String(locked));
      if (locked) {
        header.title = `Verrouillé: ${lockReason}`;
      } else {
        header.removeAttribute("title");
      }
    }
    if (body) {
      body.setAttribute("aria-hidden", String(!active));
    }
  });
}

function applySectionDisclosure() {
  SECTION_IDS.forEach(sectionId => {
    const section = document.querySelector(`.subsection[data-section="${sectionId}"]`);
    if (!section) return;
    const header = section.querySelector(".subsection-header");
    const body = section.querySelector(".subsection-body");
    const chevron = section.querySelector(".subsection-chevron");
    const open = Boolean(uiState.sections[sectionId]);

    section.classList.toggle("is-collapsed", !open);
    if (header) header.setAttribute("aria-expanded", String(open));
    if (body) body.setAttribute("aria-hidden", String(!open));
    if (chevron) chevron.textContent = open ? "▾" : "▸";
  });
}

function updateStaleIndicators() {
  const stale = uiState.outputStale && lastAssignments.length > 0;
  if (staleNotice) staleNotice.classList.toggle("hidden", !stale);
  if (panel3StaleBadge) panel3StaleBadge.classList.toggle("hidden", !stale);
}

function updateUiChrome() {
  recomputePanelValidity();
  if (!PANEL_IDS.includes(uiState.activePanel) || isPanelLocked(uiState.activePanel)) {
    uiState.activePanel = highestAccessiblePanel();
  }
  updatePanelMeta();
  updateStaleIndicators();
  applyPanelDisclosure();
  applySectionDisclosure();
  saveUiState();
}

function markOutputStale() {
  if (!lastAssignments.length) return;
  if (uiState.outputStale) return;
  uiState.outputStale = true;
  generationFeedback.textContent = "Modifications détectées. Régénérez pour actualiser le planning.";
  updateUiChrome();
}

function clearOutputStale() {
  uiState.outputStale = false;
  updateUiChrome();
}

function navigateToPanel(panelId, showAlert = true) {
  const reason = getGateReason(panelId);
  if (reason) {
    const msg = `Étape verrouillée. Complétez d'abord: ${reason}`;
    generationFeedback.textContent = msg;
    if (showAlert) {
      alert(msg);
    }
    updateUiChrome();
    return false;
  }
  uiState.activePanel = panelId;
  updateUiChrome();
  document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function dateRange(start, end) {
  const dates = [];
  const s = new Date(start);
  const e = new Date(end);
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function statusLabel(status) {
  return LIVE_STATUS_LABELS[status] || status;
}

function timeAgo(isoStr) {
  const t = new Date(isoStr);
  if (Number.isNaN(t.getTime())) return "-";
  const diffMin = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function renderLiveAssignmentOptions() {
  const agents = getEffectiveAgents();
  const nameMap = {};
  agents.forEach(a => {
    nameMap[a.id] = `${a.last_name} ${a.first_name}`.trim() || a.id;
  });
  const sorted = [...lastAssignments].sort((a, b) => {
    const keyA = `${a.date}-${a.shift}-${nameMap[a.agent_id] || a.agent_id}`;
    const keyB = `${b.date}-${b.shift}-${nameMap[b.agent_id] || b.agent_id}`;
    return keyA.localeCompare(keyB);
  });
  if (!sorted.length) {
    liveAssignmentSelect.innerHTML = "<option value=''>Générer un planning d'abord</option>";
    return;
  }
  liveAssignmentSelect.innerHTML = sorted.map(a => {
    const label = `${a.date} | ${a.shift} | ${nameMap[a.agent_id] || a.agent_id}`;
    return `<option value="${a.agent_id}|${a.date}|${a.shift}">${label}</option>`;
  }).join("");
}

async function loadFrenchComplianceNotice() {
  try {
    const res = await fetch(`${API_BASE}/compliance/french-health`);
    if (!res.ok) {
      frComplianceNotice.textContent = "Conformité FR: informations indisponibles.";
      return;
    }
    const data = await res.json();
    const controls = data.controls || {};
    const mode = data.french_health_mode ? "actif" : "inactif";
    const pii = controls.block_patient_identifiers ? "blocage identifiants ON" : "blocage identifiants OFF";
    const retention = controls.live_task_retention_days || "-";
    frComplianceNotice.textContent = `Conformité FR (${mode}): ${pii}, rétention live ${retention} jours. Ne saisissez pas de données patient identifiantes (nom, email, téléphone, NIR).`;
  } catch (_err) {
    frComplianceNotice.textContent = "Conformité FR: informations indisponibles.";
  }
}

async function refreshLiveEntries() {
  const start = document.getElementById("start_date").value;
  const end = document.getElementById("end_date").value;
  const params = new URLSearchParams();
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  params.set("include_done", "true");
  try {
    const res = await fetch(`${API_BASE}/live/entries?${params.toString()}`);
    if (!res.ok) {
      liveEntriesContainer.innerHTML = "<p>Données live indisponibles.</p>";
      return;
    }
    const data = await res.json();
    liveEntries = data.entries || [];
    liveServerTime.textContent = data.server_time ? `Dernière synchro: ${data.server_time}` : "";
    renderLiveEntries();
  } catch (_err) {
    liveEntriesContainer.innerHTML = "<p>Données live indisponibles.</p>";
  }
}

async function updateLiveEntry(entryId, payload) {
  const res = await fetch(`${API_BASE}/live/entries/${entryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.detail || "Mise à jour live impossible.");
    return;
  }
  await refreshLiveEntries();
}

async function deleteLiveEntry(entryId) {
  const res = await fetch(`${API_BASE}/live/entries/${entryId}`, { method: "DELETE" });
  if (!res.ok) {
    alert("Suppression live impossible.");
    return;
  }
  await refreshLiveEntries();
}

function renderLiveEntries() {
  if (!liveEntries.length) {
    liveEntriesContainer.innerHTML = "<p>Aucune tâche live pour la période.</p>";
    return;
  }
  let html = "<table class='live-table'><thead><tr>";
  html += "<th>Agent</th><th>Date</th><th>Shift</th><th>Statut</th><th>Tâche</th><th>Détails</th><th>MAJ</th><th>Actions</th>";
  html += "</tr></thead><tbody>";
  liveEntries.forEach(entry => {
    html += "<tr>";
    html += `<td>${entry.agent_name}</td>`;
    html += `<td>${entry.date}</td>`;
    html += `<td>${entry.shift}</td>`;
    html += `<td><span class="live-status live-${entry.status}">${statusLabel(entry.status)}</span></td>`;
    html += `<td>${entry.task_title}</td>`;
    html += `<td>${entry.details || "-"}</td>`;
    html += `<td>${timeAgo(entry.updated_at)}</td>`;
    html += "<td class='live-actions'>";
    html += `<button data-live-action="start" data-id="${entry.id}">En cours</button>`;
    html += `<button data-live-action="done" data-id="${entry.id}">Terminé</button>`;
    html += `<button data-live-action="delete" data-id="${entry.id}">Suppr.</button>`;
    html += "</td>";
    html += "</tr>";
  });
  html += "</tbody></table>";
  liveEntriesContainer.innerHTML = html;

  liveEntriesContainer.querySelectorAll("button[data-live-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.liveAction;
      const entryId = btn.dataset.id;
      if (action === "start") {
        await updateLiveEntry(entryId, { status: "in_progress" });
        return;
      }
      if (action === "done") {
        await updateLiveEntry(entryId, { status: "done" });
        return;
      }
      if (action === "delete") {
        await deleteLiveEntry(entryId);
      }
    });
  });
}

async function addLiveTask() {
  if (!lastAssignments.length) {
    alert("Génère un planning avant d'ajouter des tâches live.");
    return;
  }
  const selected = liveAssignmentSelect.value;
  if (!selected) {
    alert("Choisis une affectation.");
    return;
  }
  const [agentId, date, shift] = selected.split("|");
  const title = liveTaskTitle.value.trim();
  if (!title) {
    alert("Saisis une tâche.");
    return;
  }
  const agent = getEffectiveAgents().find(a => a.id === agentId);
  const agentName = agent ? `${agent.last_name} ${agent.first_name}`.trim() : agentId;
  const payload = {
    agent_id: agentId,
    agent_name: agentName,
    date,
    shift,
    task_title: title,
    details: liveTaskDetails.value.trim(),
    status: liveStatus.value
  };
  const res = await fetch(`${API_BASE}/live/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.detail || "Impossible d'ajouter la tâche live.");
    return;
  }
  liveTaskTitle.value = "";
  liveTaskDetails.value = "";
  await refreshLiveEntries();
}

function setLiveAutoRefresh() {
  if (liveRefreshTimer) {
    clearInterval(liveRefreshTimer);
    liveRefreshTimer = null;
  }
  if (document.getElementById("live_auto_refresh").checked) {
    liveRefreshTimer = setInterval(() => {
      refreshLiveEntries();
    }, 10000);
  }
}

function quickFeasibilityCheck(req) {
  const params = req.params;
  if (params.auto_add_agents_if_needed) {
    return [];
  }
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
      if (params.allow_single_12h_exception) {
        allowed = [...allowed, "JOUR_12H"];
      }
    }
    allowed = allowed.filter(s => globalAllowed.includes(s));
    allowed.forEach(s => {
      agentShiftCounts[s] = (agentShiftCounts[s] || 0) + 1;
    });
  });

  const problems = [];
  Object.entries(params.coverage_requirements).forEach(([shift, cov]) => {
    if (!globalAllowed.includes(shift)) return;
    if (!cov || cov <= 0) return;
    const duration = shifts[shift].duration_minutes;
    let maxShiftsPerAgent = Math.floor(max7d / duration);
    if (needWeeklyRest) {
      maxShiftsPerAgent = Math.min(maxShiftsPerAgent, numDays - 1);
    }
    if (maxShiftsPerAgent <= 0) {
      problems.push(`Couverture ${shift}: durée ou règles incompatibles avec la période.`);
      return;
    }
    const totalNeeded = cov * numDays;
    const minAgents = Math.ceil(totalNeeded / maxShiftsPerAgent);
    const available = agentShiftCounts[shift] || 0;
    if (available < minAgents) {
      problems.push(`Couverture ${shift}: besoin d’au moins ${minAgents} agent(s) (actuel: ${available}).`);
    }
  });

  return problems;
}

function buildComplianceSummary(req, assignments, baselineMinutes = {}, trackerYear = null) {
  const params = req.params;
  const shifts = params.shifts;
  const days = dateRange(params.start_date, params.end_date);
  const DAY_MIN = 24 * 60;

  function parseTimeToMin(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  const shiftInfo = {};
  Object.keys(shifts).forEach(code => {
    shiftInfo[code] = {
      start: parseTimeToMin(shifts[code].start),
      end: parseTimeToMin(shifts[code].end),
      duration: shifts[code].duration_minutes
    };
  });

  const minRest = params.agreement_11h_enabled
    ? Math.min(params.ruleset_defaults.daily_rest_min_minutes, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)
    : params.ruleset_defaults.daily_rest_min_minutes;

  const byAgent = {};
  assignments.forEach(a => {
    byAgent[a.agent_id] = byAgent[a.agent_id] || {};
    byAgent[a.agent_id][a.date] = a.shift;
  });

  const agents = getEffectiveAgents();
  const rows = agents.map(agent => {
    const schedule = byAgent[agent.id] || {};
    let totalMinutes = 0;
    let maxConsecWork = 0;
    let currentConsec = 0;
    let maxConsec12 = 0;
    let currentConsec12 = 0;
    let dailyRestOk = true;
    let maxRolling7 = 0;
    let weeklyRestOk = true;
    let msmOk = true;

    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const shift = schedule[d];
      if (shift) {
        totalMinutes += shiftInfo[shift].duration;
        currentConsec += 1;
        maxConsecWork = Math.max(maxConsecWork, currentConsec);
        if (shift === "JOUR_12H") {
          currentConsec12 += 1;
          maxConsec12 = Math.max(maxConsec12, currentConsec12);
        } else {
          currentConsec12 = 0;
        }
      } else {
        currentConsec = 0;
        currentConsec12 = 0;
      }

      if (i < days.length - 1) {
        const shift2 = schedule[days[i + 1]];
        if (shift && shift2) {
          const rest = (DAY_MIN - shiftInfo[shift].end) + shiftInfo[shift2].start;
          if (rest < minRest) {
            dailyRestOk = false;
          }
        }
      }
    }

    for (let i = 0; i < days.length; i++) {
      let sum = 0;
      for (let k = 0; k < 7; k++) {
        if (i + k >= days.length) break;
        const shift = schedule[days[i + k]];
        if (shift) sum += shiftInfo[shift].duration;
      }
      maxRolling7 = Math.max(maxRolling7, sum);
    }

    if (days.length >= 7) {
      const restBlocks = [];
      for (let i = 0; i < days.length - 1; i++) {
        const off1 = !schedule[days[i]];
        const off2 = !schedule[days[i + 1]];
        if (off1 && off2) restBlocks.push([i, i + 1]);
      }
      for (let i = 0; i < days.length - 2; i++) {
        const s1 = schedule[days[i]];
        const off = !schedule[days[i + 1]];
        const s2 = schedule[days[i + 2]];
        if (s1 && off && s2) {
          const rest = (DAY_MIN - shiftInfo[s1].end) + DAY_MIN + shiftInfo[s2].start;
          if (rest >= params.ruleset_defaults.weekly_rest_min_minutes) {
            restBlocks.push([i, i + 2]);
          }
        }
      }
      for (let w = 0; w <= days.length - 7; w++) {
        const ok = restBlocks.some(([s, e]) => s >= w && e <= w + 6);
        if (!ok) {
          weeklyRestOk = false;
          break;
        }
      }
    }

    if (params.forbid_matin_soir_matin) {
      for (let i = 0; i < days.length - 2; i++) {
        const a = schedule[days[i]];
        const b = schedule[days[i + 1]];
        const c = schedule[days[i + 2]];
        if (a === "MATIN" && b === "SOIR" && c === "MATIN") {
          msmOk = false;
          break;
        }
      }
    }

    const baseline = baselineMinutes[agent.id] || 0;
    const target = Number.isFinite(agent.annual_target_hours) && agent.annual_target_hours > 0
      ? agent.annual_target_hours * 60
      : null;
    return {
      agent,
      totalHours: (totalMinutes / 60).toFixed(1),
      annualBefore: (baseline / 60).toFixed(1),
      annualAfter: ((baseline + totalMinutes) / 60).toFixed(1),
      targetHours: target ? (target / 60).toFixed(0) : null,
      maxConsecWork,
      maxConsec12,
      maxRolling7,
      dailyRestOk,
      weeklyRestOk,
      msmOk
    };
  });

  const header = trackerYear ? `Résumé conformité (par agent) · Tracker ${trackerYear}` : "Résumé conformité (par agent)";
  let html = `<div class='compliance-summary'><h4>${header}</h4>`;
  html += "<table class='compliance-table'><thead><tr>";
  html += "<th>Agent</th><th>Annuel avant</th><th>Annuel après</th><th>Cible</th><th>Total h</th><th>Max jours</th><th>Max 12h</th><th>Max 7j (min)</th><th>Repos quotidien</th><th>Repos hebdo</th><th>MSM</th>";
  html += "</tr></thead><tbody>";
  rows.forEach(r => {
    const name = `${r.agent.last_name} ${r.agent.first_name}`.trim() || r.agent.id;
    html += "<tr>";
    html += `<td>${name}</td>`;
    html += `<td>${r.annualBefore}</td>`;
    html += `<td>${r.annualAfter}</td>`;
    html += `<td>${r.targetHours || "-"}</td>`;
    html += `<td>${r.totalHours}</td>`;
    html += `<td>${r.maxConsecWork}</td>`;
    html += `<td>${r.maxConsec12}</td>`;
    html += `<td>${r.maxRolling7}</td>`;
    html += `<td class='${r.dailyRestOk ? "badge-ok" : "badge-warn"}'>${r.dailyRestOk ? "OK" : "KO"}</td>`;
    html += `<td class='${r.weeklyRestOk ? "badge-ok" : "badge-warn"}'>${r.weeklyRestOk ? "OK" : "KO"}</td>`;
    html += `<td class='${r.msmOk ? "badge-ok" : "badge-warn"}'>${r.msmOk ? "OK" : "KO"}</td>`;
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  return html;
}

document.getElementById("generate").addEventListener("click", async () => {
  generationFeedback.textContent = "Génération en cours...";
  const req = buildRequest();
  renderReadyCheck();
  const problems = quickFeasibilityCheck(req);
  if (problems.length) {
    alert(`Infeasible probable. Ajuste avant de générer:\\n- ${problems.join("\\n- ")}`);
    generationFeedback.textContent = "Paramètres à ajuster avant génération.";
    return;
  }
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  const data = await res.json();
  if (data.status !== "ok") {
    document.getElementById("planning").innerHTML = "<p>Aucune solution.</p>";
    document.getElementById("compliance").textContent = JSON.stringify(data, null, 2);
    renderLiveAssignmentOptions();
    generationFeedback.textContent = "Aucune solution faisable avec les paramètres actuels.";
    updateUiChrome();
    return;
  }
  lastAssignments = data.assignments;
  lastAgents = req.agents.concat(data.added_agents || []);
  renderPlanning(data.assignments);
  renderLiveAssignmentOptions();
  refreshLiveEntries();
  document.getElementById("compliance_summary").innerHTML = buildComplianceSummary(
    req,
    data.assignments,
    data.tracker_baseline_minutes || {},
    data.tracker_year
  );
  document.getElementById("compliance").textContent = JSON.stringify(data.compliance, null, 2);

  if (req.params.record_tracker_on_generate) {
    await fetch(`${API_BASE}/tracker/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: req.params.tracker_year,
        assignments: data.assignments,
        agents: lastAgents
      })
    });
  }

  if (req.params.use_tracker) {
    loadTrackerView(req.params.tracker_year);
  }
  const added = (data.added_agents || []).length;
  const addedText = added > 0 ? ` (${added} renfort(s) ajouté(s))` : "";
  generationFeedback.textContent = `Planning généré: ${data.assignments.length} affectations${addedText}.`;
  clearOutputStale();
  uiState.sections.planning = true;
  uiState.activePanel = "screen-3";
  renderQuickSummary();
  renderReadyCheck();
});

document.getElementById("download_csv").addEventListener("click", async () => {
  if (!lastAssignments.length) return;
  const req = buildRequest();
  const res = await fetch(`${API_BASE}/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignments: lastAssignments,
      agents: lastAgents.length ? lastAgents : req.agents,
      service_unit: req.params.service_unit,
      start_date: req.params.start_date,
      end_date: req.params.end_date
    })
  });
  const blob = await res.blob();
  downloadBlob(blob, "planning.csv");
});

document.getElementById("download_pdf").addEventListener("click", async () => {
  if (!lastAssignments.length) return;
  const req = buildRequest();
  const res = await fetch(`${API_BASE}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignments: lastAssignments,
      agents: lastAgents.length ? lastAgents : req.agents,
      service_unit: req.params.service_unit,
      start_date: req.params.start_date,
      end_date: req.params.end_date
    })
  });
  const blob = await res.blob();
  downloadBlob(blob, "planning.pdf");
});

document.getElementById("add_agent").addEventListener("click", () => {
  addAgentRow();
  markOutputStale();
  renderQuickSummary();
  renderReadyCheck();
});
document.getElementById("load_demo").addEventListener("click", () => loadDemoData());
document.getElementById("build_min_team").addEventListener("click", () => buildMinimalTeam());
document.getElementById("apply_recommended").addEventListener("click", () => {
  setRecommendedSettings();
  markOutputStale();
  generationFeedback.textContent = "Paramètres recommandés appliqués.";
  renderQuickSummary();
  renderReadyCheck();
});
document.getElementById("clear_locks").addEventListener("click", () => {
  lockedAssignments = [];
  if (lastAssignments.length) {
    renderPlanning(lastAssignments);
  }
  updateUiChrome();
});
document.getElementById("print_planning").addEventListener("click", () => {
  if (!lastAssignments.length) return;
  window.print();
});
document.getElementById("refresh_tracker").addEventListener("click", () => {
  const year = parseInt(document.getElementById("tracker_year").value, 10) || 2026;
  loadTrackerView(year);
});
document.getElementById("refresh_live").addEventListener("click", () => {
  refreshLiveEntries();
});
document.getElementById("add_live_task").addEventListener("click", () => {
  addLiveTask();
});
document.getElementById("live_auto_refresh").addEventListener("change", () => {
  setLiveAutoRefresh();
});
screen1Advanced?.addEventListener("toggle", () => {
  const simpleEnabled = !screen1Advanced.open;
  setSimpleMode(simpleEnabled);
  if (simpleEnabled) {
    markOutputStale();
  }
  renderReadyCheck();
});

staleRegenerateButton?.addEventListener("click", () => {
  document.getElementById("generate")?.click();
});

["mode", "start_date", "end_date", "cov_matin", "cov_soir", "cov_12h"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    if (id === "mode") updateModeInputs();
    markOutputStale();
    renderQuickSummary();
    renderReadyCheck();
    if (id === "start_date" || id === "end_date") {
      refreshLiveEntries();
    }
  });
});

agentsBody.addEventListener("input", () => {
  markOutputStale();
  renderReadyCheck();
});
agentsBody.addEventListener("change", () => {
  markOutputStale();
  renderReadyCheck();
});

["screen-1", "screen-2"].forEach(panelId => {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.addEventListener("change", event => {
    if (event.target.closest("button")) return;
    markOutputStale();
  });
});

[...document.querySelectorAll("button[data-panel-toggle]")].forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.panelToggle;
    if (!target) return;
    navigateToPanel(target);
  });
});

[...document.querySelectorAll("button[data-next]")].forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.next;
    if (!target) return;
    navigateToPanel(target);
  });
});

[...document.querySelectorAll("button[data-back]")].forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.back;
    if (!target) return;
    navigateToPanel(target, false);
  });
});

[...document.querySelectorAll("button[data-section-toggle]")].forEach(btn => {
  btn.addEventListener("click", () => {
    const sectionId = btn.dataset.sectionToggle;
    if (!sectionId || !SECTION_IDS.includes(sectionId)) return;
    uiState.sections[sectionId] = !uiState.sections[sectionId];
    updateUiChrome();
  });
});

setSimpleMode(Boolean(simpleModeInput?.checked));
updateModeInputs();
renderQuickSummary();
renderReadyCheck();
renderLiveAssignmentOptions();
setLiveAutoRefresh();
refreshLiveEntries();
loadFrenchComplianceNotice();
updateUiChrome();
