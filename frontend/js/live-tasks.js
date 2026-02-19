// ==========================================================================
// Live Tasks — CRUD + rendering
// ==========================================================================

import { SHIFT_DEFS, SHIFT_ORDER } from './config.js';
import { lastAssignments, liveEntries, setLiveEntries, setLiveRefreshTimer, liveRefreshTimer, getEffectiveAgents, getAgentNameMap } from './state.js';
import { apiGetLiveEntries, apiCreateLiveEntry, apiUpdateLiveEntry, apiDeleteLiveEntry, apiGetComplianceFrench } from './api.js';
import { statusLabel, timeAgo, escapeHtml } from './utils.js';
import { getAgents } from './request-builder.js';

export function initLiveTasks() {
  setLiveAutoRefresh();
  refreshLiveEntries();
  loadFrenchComplianceNotice();
}

export async function refreshLiveEntries() {
  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;

  try {
    const data = await apiGetLiveEntries(startDate, endDate);
    if (!data) return;
    setLiveEntries(data.entries || []);
    const serverTimeEl = document.getElementById("live_server_time");
    if (serverTimeEl) serverTimeEl.textContent = data.server_time ? `Synchro: ${data.server_time}` : "";
    renderLiveEntriesFull();
    renderSidebarTasks();
    renderRightTasks();
  } catch (_err) {
    // silent
  }
}

export function renderLiveAssignmentOptions() {
  const select = document.getElementById("live_assignment_select");
  if (!select) return;

  const agents = getEffectiveAgents(getAgents());
  const nameMap = getAgentNameMap(agents);

  const sorted = [...lastAssignments].sort((a, b) => {
    const ka = `${a.date}-${a.shift}-${nameMap[a.agent_id] || a.agent_id}`;
    const kb = `${b.date}-${b.shift}-${nameMap[b.agent_id] || b.agent_id}`;
    return ka.localeCompare(kb);
  });

  if (!sorted.length) {
    select.innerHTML = "<option value=''>Generez un planning d'abord</option>";
    return;
  }

  select.innerHTML = sorted.map(a => {
    const label = `${a.date} | ${a.shift} | ${nameMap[a.agent_id] || a.agent_id}`;
    return `<option value="${a.agent_id}|${a.date}|${a.shift}">${label}</option>`;
  }).join("");
}

export async function addLiveTask() {
  if (!lastAssignments.length) {
    alert("Generez un planning avant d'ajouter des taches live.");
    return;
  }
  const select = document.getElementById("live_assignment_select");
  const selected = select?.value;
  if (!selected) { alert("Choisissez une affectation."); return; }

  const [agentId, date, shift] = selected.split("|");
  const title = document.getElementById("live_task_title")?.value.trim();
  if (!title) { alert("Saisissez une tache."); return; }

  const agents = getEffectiveAgents(getAgents());
  const agent = agents.find(a => a.id === agentId);
  const agentName = agent ? `${agent.last_name} ${agent.first_name}`.trim() : agentId;

  const payload = {
    agent_id: agentId,
    agent_name: agentName,
    date,
    shift,
    task_title: title,
    details: document.getElementById("live_task_details")?.value.trim() || "",
    status: document.getElementById("live_status")?.value || "planned"
  };

  try {
    await apiCreateLiveEntry(payload);
    const titleEl = document.getElementById("live_task_title");
    const detailsEl = document.getElementById("live_task_details");
    if (titleEl) titleEl.value = "";
    if (detailsEl) detailsEl.value = "";
    await refreshLiveEntries();
  } catch (err) {
    alert(err.message);
  }
}

function renderLiveEntriesFull() {
  const container = document.getElementById("live_entries_full");
  if (!container) return;

  if (!liveEntries.length) {
    container.innerHTML = '<p class="text-muted text-sm">Aucune tache live pour la periode.</p>';
    return;
  }

  let html = '<table class="live-table"><thead><tr>';
  html += '<th>Agent</th><th>Date</th><th>Shift</th><th>Statut</th><th>Tache</th><th>Details</th><th>MAJ</th><th>Actions</th>';
  html += '</tr></thead><tbody>';

  liveEntries.forEach(entry => {
    html += '<tr>';
    html += `<td>${escapeHtml(entry.agent_name)}</td>`;
    html += `<td>${entry.date}</td>`;
    html += `<td>${entry.shift}</td>`;
    html += `<td><span class="live-status-badge ${entry.status}">${statusLabel(entry.status)}</span></td>`;
    html += `<td>${escapeHtml(entry.task_title)}</td>`;
    html += `<td>${escapeHtml(entry.details || "-")}</td>`;
    html += `<td>${timeAgo(entry.updated_at)}</td>`;
    html += '<td class="live-actions">';
    html += `<button data-live-action="start" data-id="${entry.id}">En cours</button>`;
    html += `<button data-live-action="done" data-id="${entry.id}">Termine</button>`;
    html += `<button data-live-action="delete" data-id="${entry.id}">Suppr.</button>`;
    html += '</td></tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll("button[data-live-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.liveAction;
      const entryId = btn.dataset.id;
      try {
        if (action === "start") await apiUpdateLiveEntry(entryId, { status: "in_progress" });
        else if (action === "done") await apiUpdateLiveEntry(entryId, { status: "done" });
        else if (action === "delete") await apiDeleteLiveEntry(entryId);
        await refreshLiveEntries();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// ── Sidebar Tasks (left sidebar, compact) ──

function renderSidebarTasks() {
  const container = document.getElementById("sidebar_tasks");
  if (!container) return;

  const active = liveEntries.filter(e => e.status !== "done").slice(0, 6);
  if (!active.length) {
    container.innerHTML = '<div class="sidebar-empty">Aucune tache</div>';
    return;
  }

  let html = '';
  active.forEach(entry => {
    const isDone = entry.status === "done";
    const statusIcon = isDone
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : entry.status === "blocked"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : entry.status === "in_progress"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="var(--sidebar-dark-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

    html += `<div class="sidebar-task ${isDone ? "done" : ""}">`;
    html += `<span class="sidebar-task-icon">${statusIcon}</span>`;
    html += `<span class="sidebar-task-text">${escapeHtml(entry.task_title)}</span>`;
    html += '</div>';
  });

  container.innerHTML = html;
}

// ── Right Tasks Tab ──

function renderRightTasks() {
  const container = document.getElementById("right_tasks");
  if (!container) return;

  if (!liveEntries.length) {
    container.innerHTML = '<div class="sidebar-empty">Aucune tache</div>';
    return;
  }

  let html = '';
  liveEntries.forEach(entry => {
    const isDone = entry.status === "done";
    const statusIcon = isDone
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : entry.status === "blocked"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : entry.status === "in_progress"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="var(--main-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

    html += `<div class="task-item">`;
    html += `<span class="task-icon">${statusIcon}</span>`;
    html += `<div class="task-info">`;
    html += `<div class="task-title">${escapeHtml(entry.task_title)}</div>`;
    html += `<div class="task-detail">${escapeHtml(entry.agent_name)} &middot; ${entry.shift} &middot; ${timeAgo(entry.updated_at)}</div>`;
    html += `</div>`;
    html += `<div class="task-actions">`;
    html += `<button data-rt-action="done" data-id="${entry.id}">Done</button>`;
    html += `<button data-rt-action="delete" data-id="${entry.id}">Del</button>`;
    html += `</div></div>`;
  });

  container.innerHTML = html;

  container.querySelectorAll("button[data-rt-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.rtAction;
      const entryId = btn.dataset.id;
      try {
        if (action === "done") await apiUpdateLiveEntry(entryId, { status: "done" });
        else if (action === "delete") await apiDeleteLiveEntry(entryId);
        await refreshLiveEntries();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

export function setLiveAutoRefresh() {
  if (liveRefreshTimer) {
    clearInterval(liveRefreshTimer);
    setLiveRefreshTimer(null);
  }
  const checkbox = document.getElementById("live_auto_refresh");
  if (checkbox?.checked) {
    setLiveRefreshTimer(setInterval(() => { refreshLiveEntries(); }, 10000));
  }
}

async function loadFrenchComplianceNotice() {
  const el = document.getElementById("fr_compliance_notice");
  if (!el) return;
  try {
    const data = await apiGetComplianceFrench();
    if (!data) { el.textContent = "Conformite FR: informations indisponibles."; return; }
    const mode = data.french_health_mode ? "actif" : "inactif";
    const pii = data.controls?.block_patient_identifiers ? "blocage identifiants ON" : "blocage identifiants OFF";
    const retention = data.controls?.live_task_retention_days || "-";
    el.textContent = `Conformite FR (${mode}): ${pii}, retention live ${retention} jours. Ne saisissez pas de donnees patient identifiantes.`;
  } catch (_err) {
    el.textContent = "Conformite FR: informations indisponibles.";
  }
}
