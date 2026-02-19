// ==========================================================================
// App — Main Orchestrator
// ==========================================================================

import {
  lastAssignments, lastAgents, lockedAssignments, uiState,
  setLastAssignments, setLastAgents, setLockedAssignments,
  loadUiState, saveUiState, markOutputStale, clearOutputStale,
  getEffectiveAgents, getAgentNameMap
} from './state.js';

import { MONTH_NAMES_FR } from './config.js';
import { apiGenerate, apiRecordTracker, apiGetTracker, apiExportCsv, apiExportPdf } from './api.js';

import { getAgents, buildRequest, getPanel1Issues, getPanel2Issues, getAllIssues, canLockAssignment, quickFeasibilityCheck } from './request-builder.js';

import { initCalendar, setCalendarRange, renderCalendar } from './calendar.js';
import { initTimeline, renderTimeline, renderAgentMatrix, renderSidebarEvents, updateStats } from './timeline.js';
import { initModals, openDrawer, closeDrawer, addAgentRow, loadDemoData, buildMinimalTeam, updateModeInputs } from './modals.js';
import { buildComplianceSummary, renderComplianceBadges, buildFullComplianceSummary } from './compliance.js';
import { initLiveTasks, refreshLiveEntries, renderLiveAssignmentOptions, addLiveTask, setLiveAutoRefresh } from './live-tasks.js';
import { initMonthOverview, renderMonthOverview } from './month-overview.js';
import { initCommandBar, closeCommandBar } from './command-bar.js';

import { getMonthYear, downloadBlob, escapeHtml } from './utils.js';

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  loadUiState();
  initCalendar(onCalendarDayClick);
  initTimeline(onLockToggle);
  initMonthOverview(onLockToggle, onCalendarDayClick);
  initModals();
  initLiveTasks();
  initCommandBar(buildCommandList());
  wireEventListeners();
  updateMonthTitle();
  updateModeInputs();
  renderLiveAssignmentOptions();
});

// ── Month Title ──
function updateMonthTitle() {
  const startDate = document.getElementById("start_date")?.value;
  const el = document.getElementById("month_title");
  if (el && startDate) {
    el.textContent = getMonthYear(startDate);
  }
}

// ── Calendar Day Click ──
function onCalendarDayClick(dateStr) {
  // If overview is visible, switch to timeline and scroll
  const overview = document.getElementById("month_overview");
  const timeline = document.getElementById("timeline");
  if (overview && !overview.classList.contains("hidden")) {
    switchView("timeline");
  }
  const dayEl = document.getElementById(`day-${dateStr}`);
  if (dayEl) {
    dayEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ── Lock/Unlock Toggle ──
function onLockToggle(agentId, date, shift) {
  const idx = lockedAssignments.findIndex(l => l.agent_id === agentId && l.date === date && l.shift === shift);
  if (idx >= 0) {
    lockedAssignments.splice(idx, 1);
  } else {
    const check = canLockAssignment({ agent_id: agentId, date, shift });
    if (!check.ok) {
      alert(`Verrouillage refuse: ${check.reason}`);
      return;
    }
    lockedAssignments.push({ agent_id: agentId, date, shift });
  }
  renderTimeline();
  renderAgentMatrix();
  renderMonthOverview();
  updateStats();
  renderCalendar();
}

// ── Generate ──
async function handleGenerate() {
  const statusBar = document.getElementById("status_bar");
  const statusMsg = document.getElementById("status_message");

  // Show loading
  if (statusBar) { statusBar.classList.remove("hidden"); statusMsg.textContent = "Generation en cours..."; }

  const issues = getAllIssues();
  if (issues.length) {
    alert(`Corrigez avant de generer:\n- ${issues.join("\n- ")}`);
    if (statusBar) statusBar.classList.add("hidden");
    return;
  }

  const req = buildRequest();
  const problems = quickFeasibilityCheck(req);
  if (problems.length) {
    alert(`Infaisable probable:\n- ${problems.join("\n- ")}`);
    if (statusMsg) statusMsg.textContent = "Parametres a ajuster.";
    return;
  }

  try {
    const data = await apiGenerate(req);

    if (data.status !== "ok") {
      if (statusMsg) statusMsg.textContent = "Aucune solution faisable.";
      document.getElementById("compliance_json").textContent = JSON.stringify(data, null, 2);
      return;
    }

    setLastAssignments(data.assignments);
    setLastAgents(req.agents.concat(data.added_agents || []));

    // Render everything
    renderTimeline();
    renderAgentMatrix();
    renderMonthOverview();
    renderSidebarEvents();
    renderCalendar();
    updateStats();
    renderLiveAssignmentOptions();
    refreshLiveEntries();

    // Compliance
    const compSummary = buildComplianceSummary(req, data.assignments, data.tracker_baseline_minutes || {}, data.tracker_year);
    renderComplianceBadges(compSummary);
    document.getElementById("compliance_json").textContent = JSON.stringify(data.compliance, null, 2);

    // View toggle
    const viewToggle = document.getElementById("view_toggle");
    if (viewToggle) viewToggle.style.display = "flex";

    // Tracker
    if (req.params.record_tracker_on_generate) {
      await apiRecordTracker({
        year: req.params.tracker_year,
        assignments: data.assignments,
        agents: getEffectiveAgents(getAgents())
      });
    }
    if (req.params.use_tracker) {
      loadTrackerView(req.params.tracker_year);
    }

    // Status
    const added = (data.added_agents || []).length;
    const addedText = added > 0 ? ` (${added} renfort(s))` : "";
    if (statusMsg) statusMsg.textContent = `Planning genere: ${data.assignments.length} affectations${addedText}.`;

    clearOutputStale();
    updateMonthTitle();

    // Print summary
    const service = document.getElementById("service_unit")?.value;
    const startDate = document.getElementById("start_date")?.value;
    const endDate = document.getElementById("end_date")?.value;
    const printSummary = document.getElementById("print_summary");
    if (printSummary) printSummary.textContent = `${service} · ${startDate} → ${endDate}`;

  } catch (err) {
    if (statusMsg) statusMsg.textContent = `Erreur: ${err.message}`;
  }
}

// ── Generate Full Month ──
async function handleGenerateMonth() {
  const startEl = document.getElementById("start_date");
  const endEl = document.getElementById("end_date");
  if (!startEl || !endEl) return;

  // Check for agents first
  const agentIssues = getPanel2Issues();
  if (agentIssues.length) {
    alert(`Corrigez avant de generer:\n- ${agentIssues.join("\n- ")}`);
    return;
  }

  const origStart = startEl.value;
  const origEnd = endEl.value;

  if (!origStart) {
    alert("Veuillez renseigner une date de debut.");
    return;
  }

  // Calculate full month from start_date
  const d = new Date(`${origStart}T00:00:00`);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const monthStart = firstDay.toISOString().slice(0, 10);
  const monthEnd = lastDay.toISOString().slice(0, 10);

  // Temporarily set dates to full month
  startEl.value = monthStart;
  endEl.value = monthEnd;

  // Update UI
  updateMonthTitle();
  setCalendarRange(monthStart, monthEnd);

  // Validate full-month request before processing
  const baseRequest = buildRequest();
  const preflightIssues = getAllIssues();
  if (preflightIssues.length) {
    alert(`Corrigez avant de generer:\n- ${preflightIssues.join("\n- ")}`);
    return;
  }

  const feasibility = quickFeasibilityCheck(baseRequest);
  if (feasibility.length) {
    alert(`Infaisable probable:\n- ${feasibility.join("\n- ")}`);
    if (statusMsg) statusMsg.textContent = "Parametres a ajuster.";
    return;
  }

  const statusMsg = document.getElementById("status_message");
  const statusBar = document.getElementById("status_bar");
  if (statusBar) { statusBar.classList.remove("hidden"); }
  if (statusMsg) statusMsg.textContent = `Generation du mois complet: ${MONTH_NAMES_FR[month]} ${year}...`;

  // Generate week by week to handle solver limits
  const allAssignments = [];
  let allAgents = [...baseRequest.agents];
  let lastCompliance = null;
  let weekStart = new Date(firstDay);
  let weekNum = 0;
  let hadError = false;

  while (weekStart <= lastDay) {
    weekNum++;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());

    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);

    // Set dates for this week
    startEl.value = ws;
    endEl.value = we;

    if (statusMsg) statusMsg.textContent = `Semaine ${weekNum}: ${ws} → ${we}...`;

    try {
      const req = buildRequest();

      // Add previously generated assignments as locked for continuity
      if (allAssignments.length > 0) {
        // Lock the last 2 days of the previous week to maintain rest constraints
        const prevEnd = new Date(weekStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 1);

        const overlapLocks = allAssignments.filter(a => {
          return a.date === prevStart.toISOString().slice(0, 10) ||
                 a.date === prevEnd.toISOString().slice(0, 10);
        }).map(a => ({ agent_id: a.agent_id, date: a.date, shift: a.shift }));

        req.locked_assignments = [...lockedAssignments, ...overlapLocks];
      }

      const data = await apiGenerate(req);

      if (data.status === "ok") {
        allAssignments.push(...data.assignments);
        (data.added_agents || []).forEach(agent => {
          if (!allAgents.some(a => a.id === agent.id)) {
            allAgents.push(agent);
          }
        });
        lastCompliance = data.compliance;
      } else {
        if (statusMsg) statusMsg.textContent = `Semaine ${weekNum}: aucune solution. Essai avec parametres ajustes...`;
        hadError = true;
      }
    } catch (err) {
      if (statusMsg) statusMsg.textContent = `Erreur semaine ${weekNum}: ${err.message}`;
      hadError = true;
    }

    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Restore full month dates
  startEl.value = monthStart;
  endEl.value = monthEnd;

  // Set results
  setLastAssignments(allAssignments);
  if (allAgents) setLastAgents(allAgents);

  // Render everything
  renderTimeline();
  renderAgentMatrix();
  renderMonthOverview();
  renderSidebarEvents();
  renderCalendar();
  updateStats();
  renderLiveAssignmentOptions();
  refreshLiveEntries();

  // Show view toggle and switch to overview
  const viewToggle = document.getElementById("view_toggle");
  if (viewToggle) viewToggle.style.display = "flex";
  switchView("overview");

  // Compliance
  const finalReq = buildRequest();
  const compSummary = buildComplianceSummary(finalReq, allAssignments, {}, null);
  renderComplianceBadges(compSummary);
  if (lastCompliance) {
    document.getElementById("compliance_json").textContent = JSON.stringify(lastCompliance, null, 2);
  }

  // Status
  const warnText = hadError ? " (certaines semaines echouees)" : "";
  if (statusMsg) statusMsg.textContent = `Mois genere: ${allAssignments.length} affectations sur ${MONTH_NAMES_FR[month]}${warnText}.`;

  clearOutputStale();
  updateMonthTitle();
  setCalendarRange(monthStart, monthEnd);
}

// ── View Switching ──
function switchView(viewName) {
  const el = id => document.getElementById(id);
  const timelineContainer = el("timeline");
  const overviewContainer = el("month_overview");
  const matrixContainer = el("matrix_container");

  // Update toggle buttons
  document.querySelectorAll(".view-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });

  // Toggle containers
  timelineContainer?.classList.toggle("hidden", viewName !== "timeline");
  overviewContainer?.classList.toggle("hidden", viewName !== "overview");
  matrixContainer?.classList.toggle("hidden", viewName !== "matrix");

  // Render the active view
  if (viewName === "overview") renderMonthOverview();
  if (viewName === "matrix") renderAgentMatrix();
}

// ── Tracker View ──
async function loadTrackerView(year) {
  const container = document.getElementById("tracker_view");
  if (!container) return;
  try {
    const data = await apiGetTracker(year);
    if (!data) { container.textContent = "Tracker indisponible."; return; }
    const rows = Object.entries(data.minutes_by_agent || {});
    const namesByAgent = data.names_by_agent || {};
    if (!rows.length) { container.textContent = "Aucune donnee pour cette annee."; return; }

    const agents = getEffectiveAgents(getAgents());
    let html = '<table class="tracker-table"><thead><tr><th>Agent</th><th>Heures</th></tr></thead><tbody>';
    rows.forEach(([agentId, minutes]) => {
      const agent = agents.find(a => a.id === agentId);
      const name = namesByAgent[agentId] || (agent ? `${agent.last_name} ${agent.first_name}`.trim() : agentId);
      html += `<tr><td>${escapeHtml(name)}</td><td>${(minutes / 60).toFixed(1)}h</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (_err) {
    container.textContent = "Tracker indisponible.";
  }
}

// ── Export ──
async function handleExportCsv() {
  if (!lastAssignments.length) return;
  const req = buildRequest();
  const blob = await apiExportCsv({
    assignments: lastAssignments,
    agents: getEffectiveAgents(getAgents()),
    service_unit: req.params.service_unit,
    start_date: req.params.start_date,
    end_date: req.params.end_date
  });
  downloadBlob(blob, "planning.csv");
}

async function handleExportPdf() {
  if (!lastAssignments.length) return;
  const req = buildRequest();
  const blob = await apiExportPdf({
    assignments: lastAssignments,
    agents: getEffectiveAgents(getAgents()),
    service_unit: req.params.service_unit,
    start_date: req.params.start_date,
    end_date: req.params.end_date
  });
  downloadBlob(blob, "planning.pdf");
}

// ── Command Bar Commands ──
function buildCommandList() {
  return [
    // Generation
    { label: "Generer le planning", description: "Lancer la generation pour la periode", icon: "▶", category: "Generation", shortcut: "G", action: handleGenerate },
    { label: "Generer le mois entier", description: "Planning pour tout le mois courant", icon: "📅", category: "Generation", action: handleGenerateMonth },

    // Views
    { label: "Vue Timeline", description: "Afficher la vue jour par jour", icon: "📋", category: "Vues", action: () => switchView("timeline") },
    { label: "Vue Mois", description: "Vue calendrier mensuel complet", icon: "🗓", category: "Vues", action: () => switchView("overview") },
    { label: "Vue Matrice agents", description: "Tableau agent x jours", icon: "📊", category: "Vues", action: () => switchView("matrix") },

    // Configuration
    { label: "Ouvrir parametres", description: "Service, dates, mode, couverture", icon: "⚙", category: "Configuration", shortcut: "P", action: () => openDrawer("drawer_settings") },
    { label: "Ouvrir agents", description: "Ajouter, supprimer, configurer agents", icon: "👥", category: "Configuration", shortcut: "A", action: () => openDrawer("drawer_agents") },
    { label: "Parametres recommandes", description: "Appliquer la configuration FPH standard", icon: "✓", category: "Configuration", action: () => document.getElementById("apply_recommended")?.click() },
    { label: "Charger donnees demo", description: "4 agents, USLD, matin-soir", icon: "📦", category: "Configuration", action: () => { loadDemoData(); markOutputStale(); updateMonthTitle(); renderCalendar(); } },
    { label: "Equipe minimale", description: "Generer le minimum d'agents requis", icon: "👤", category: "Configuration", action: () => buildMinimalTeam() },

    // Live
    { label: "Suivi en temps reel", description: "Ouvrir le suivi live des taches", icon: "⚡", category: "Suivi", action: () => openDrawer("drawer_live") },
    { label: "Rafraichir taches", description: "Recharger les taches live", icon: "↻", category: "Suivi", action: refreshLiveEntries },

    // Export
    { label: "Exporter CSV", description: "Telecharger le planning en CSV", icon: "📄", category: "Export", action: handleExportCsv },
    { label: "Exporter PDF", description: "Telecharger le planning en PDF", icon: "📑", category: "Export", action: handleExportPdf },
    { label: "Imprimer", description: "Lancer l'impression du planning", icon: "🖨", category: "Export", shortcut: "⌘P", action: () => { if (lastAssignments.length) window.print(); } },

    // Navigation
    { label: "Tab Tasks", description: "Afficher l'onglet taches", icon: "✔", category: "Navigation", action: () => switchRightTab("tasks") },
    { label: "Tab Docs", description: "Afficher exports et tracker", icon: "📁", category: "Navigation", action: () => switchRightTab("docs") }
  ];
}

// ── Wire Event Listeners ──
function wireEventListeners() {
  const el = id => document.getElementById(id);

  // ── Generate ──
  el("generate")?.addEventListener("click", handleGenerate);
  el("generate_month")?.addEventListener("click", handleGenerateMonth);
  el("empty_generate")?.addEventListener("click", () => openDrawer("drawer_settings"));

  // ── Search button opens command bar ──
  el("btn_search")?.addEventListener("click", () => {
    // Simulate Cmd+K
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  });

  // ── Drawers ──
  el("btn_open_settings")?.addEventListener("click", () => openDrawer("drawer_settings"));
  el("btn_open_agents")?.addEventListener("click", () => openDrawer("drawer_agents"));
  el("btn_add_event")?.addEventListener("click", () => openDrawer("drawer_settings"));

  // Nav buttons
  el("nav_settings")?.addEventListener("click", () => openDrawer("drawer_settings"));
  el("nav_agents")?.addEventListener("click", () => openDrawer("drawer_agents"));
  document.querySelectorAll(".nav-btn[data-nav='live']").forEach(btn => {
    btn.addEventListener("click", () => openDrawer("drawer_live"));
  });

  // ── Agent management ──
  el("add_agent")?.addEventListener("click", () => { addAgentRow(); markOutputStale(); });
  el("load_demo")?.addEventListener("click", () => { loadDemoData(); markOutputStale(); updateMonthTitle(); renderCalendar(); });
  el("build_min_team")?.addEventListener("click", () => buildMinimalTeam());

  // ── Recommended settings ──
  el("apply_recommended")?.addEventListener("click", () => {
    const startDate = el("start_date")?.value;
    const year = startDate ? parseInt(startDate.split("-")[0], 10) : 2026;
    if (el("allow_12h_exception")) el("allow_12h_exception").checked = false;
    if (el("max_12h_exception")) el("max_12h_exception").value = "1";
    if (el("exception_12h_date")) el("exception_12h_date").value = "";
    if (el("forbid_msm")) el("forbid_msm").checked = true;
    if (el("use_tracker")) el("use_tracker").checked = true;
    if (el("tracker_year")) el("tracker_year").value = String(year || 2026);
    if (el("auto_add_agents")) el("auto_add_agents").checked = true;
    if (el("max_extra_agents")) el("max_extra_agents").value = "6";
    if (el("record_tracker")) el("record_tracker").checked = false;
    markOutputStale();
  });

  // ── Mode change ──
  el("mode")?.addEventListener("change", () => {
    updateModeInputs();
    markOutputStale();
  });

  // ── Date changes ──
  ["start_date", "end_date"].forEach(id => {
    el(id)?.addEventListener("change", () => {
      markOutputStale();
      updateMonthTitle();
      setCalendarRange(el("start_date")?.value, el("end_date")?.value);
      refreshLiveEntries();
    });
  });

  // ── Coverage changes ──
  ["cov_matin", "cov_soir", "cov_12h"].forEach(id => {
    el(id)?.addEventListener("change", () => markOutputStale());
  });

  // ── Agent table changes ──
  el("agents_body")?.addEventListener("input", () => markOutputStale());
  el("agents_body")?.addEventListener("change", () => markOutputStale());

  // ── Exports ──
  el("download_csv")?.addEventListener("click", handleExportCsv);
  el("download_pdf")?.addEventListener("click", handleExportPdf);
  el("print_planning")?.addEventListener("click", () => { if (lastAssignments.length) window.print(); });

  // ── Share (export menu) ──
  el("btn_share")?.addEventListener("click", () => {
    const rightSidebar = document.querySelector(".sidebar-right");
    if (rightSidebar) {
      rightSidebar.classList.toggle("visible");
    }
    switchRightTab("docs");
  });

  // ── Tracker ──
  el("refresh_tracker")?.addEventListener("click", () => {
    const year = parseInt(el("tracker_year")?.value, 10) || 2026;
    loadTrackerView(year);
  });

  // ── Live tasks ──
  el("refresh_live")?.addEventListener("click", refreshLiveEntries);
  el("add_live_task")?.addEventListener("click", addLiveTask);
  el("live_auto_refresh")?.addEventListener("change", setLiveAutoRefresh);
  el("btn_add_task")?.addEventListener("click", () => openDrawer("drawer_live"));

  // ── View toggle (Timeline / Overview / Matrix) ──
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  // ── Right sidebar tabs ──
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchRightTab(btn.dataset.tab);
    });
  });

  // ── Status bar regenerate ──
  el("status_action")?.addEventListener("click", handleGenerate);
}

function switchRightTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  document.getElementById("tab_tasks")?.classList.toggle("hidden", tabName !== "tasks");
  document.getElementById("tab_docs")?.classList.toggle("hidden", tabName !== "docs");
  uiState.activeRightTab = tabName;
  saveUiState();
}
