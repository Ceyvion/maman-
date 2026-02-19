// ==========================================================================
// Timeline — Day-by-Day Vertical View + Event Cards + Agent Matrix
// ==========================================================================

import { SHIFT_ORDER, SHIFT_DEFS, SHIFT_CLASSES } from './config.js';
import { lastAssignments, lockedAssignments, getAgentNameMap, getEffectiveAgents, uiState } from './state.js';
import { dateRange, getDayNumber, getDayName, isWeekend, shortDateLabel, getInitials, avatarColor, escapeHtml } from './utils.js';
import { getAgents, canLockAssignment } from './request-builder.js';

let onLockToggle = null;

export function initTimeline(lockToggleHandler) {
  onLockToggle = lockToggleHandler;
}

export function renderTimeline() {
  const container = document.getElementById("timeline");
  if (!container) return;

  if (!lastAssignments.length) {
    container.innerHTML = `
      <div class="timeline-empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--main-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <p>Configurez vos parametres et generez un planning</p>
        <button class="btn-primary" id="empty_generate">Commencer</button>
      </div>`;
    return;
  }

  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;
  if (!startDate || !endDate) return;

  const dates = dateRange(startDate, endDate);
  const agents = getEffectiveAgents(getAgents());
  const nameMap = getAgentNameMap(agents);
  const agentLookup = {};
  agents.forEach(a => { agentLookup[a.id] = a; });

  const byDate = {};
  lastAssignments.forEach(a => {
    byDate[a.date] = byDate[a.date] || [];
    byDate[a.date].push(a);
  });

  const requiredByShift = {
    MATIN: parseInt(document.getElementById("cov_matin")?.value, 10) || 0,
    SOIR: parseInt(document.getElementById("cov_soir")?.value, 10) || 0,
    JOUR_12H: parseInt(document.getElementById("cov_12h")?.value, 10) || 0
  };

  let html = '';

  dates.forEach((d, idx) => {
    const dayNum = String(getDayNumber(d)).padStart(2, "0");
    const dayName = getDayName(d);
    const weekend = isWeekend(d);
    const dayItems = byDate[d] || [];

    html += `<div class="day-block ${weekend ? "weekend" : ""}" id="day-${d}">`;
    html += `<div class="day-label">`;
    html += `<span class="day-number">${dayNum}</span>`;
    html += `<span class="day-name">${dayName}</span>`;
    html += `</div>`;
    html += `<div class="day-events">`;

    // Group by shift
    SHIFT_ORDER.forEach(shift => {
      const items = dayItems
        .filter(a => a.shift === shift)
        .sort((a, b) => (nameMap[a.agent_id] || "").localeCompare(nameMap[b.agent_id] || ""));
      const required = requiredByShift[shift] || 0;

      if (required <= 0 && items.length === 0) return;

      const def = SHIFT_DEFS[shift];
      const coverageOk = items.length >= required;
      const shiftClass = SHIFT_CLASSES[shift];
      const catClass = `cat-${shift.toLowerCase().replace("jour_", "")}`;

      html += `<div class="event-card ${shiftClass}">`;
      html += `<div class="event-card-header">`;
      html += `<span class="event-time"><span class="event-time-range">${def.start}</span> - ${def.end}</span>`;
      html += `<span class="event-category ${catClass}">${def.label}</span>`;
      html += `</div>`;

      html += `<div class="event-title">${def.labelFull}</div>`;

      html += `<div class="event-meta">`;
      html += `<span class="event-subtitle">${items.length} agent(s) affecte(s)</span>`;
      html += `<span class="event-coverage ${coverageOk ? "" : "warn"}">${items.length}/${required}</span>`;
      html += `</div>`;

      if (items.length > 0) {
        html += `<div class="event-agents">`;
        items.forEach(a => {
          const name = nameMap[a.agent_id] || a.agent_id;
          const agent = agentLookup[a.agent_id];
          const initials = agent ? getInitials(agent.first_name, agent.last_name) : "?";
          const color = avatarColor(name);
          const isLocked = lockedAssignments.some(l => l.agent_id === a.agent_id && l.date === a.date && l.shift === a.shift);

          html += `<span class="agent-chip ${isLocked ? "locked" : ""}" data-agent="${a.agent_id}" data-date="${a.date}" data-shift="${a.shift}">`;
          html += `<span class="agent-avatar" style="background:${color}">${escapeHtml(initials)}</span>`;
          html += `${escapeHtml(name)}`;
          html += `</span>`;
        });
        html += `</div>`;
      }

      html += `</div>`;

      // Spacer between shifts
    });

    if (dayItems.length === 0) {
      html += `<div class="day-no-events">Aucune affectation</div>`;
    }

    // Add button
    html += `<button class="day-add-btn" data-day="${d}" title="Options du jour">+</button>`;

    html += `</div></div>`;

    // Next meeting divider between days
    if (idx < dates.length - 1) {
      const nextDayItems = byDate[dates[idx + 1]] || [];
      if (nextDayItems.length > 0) {
        // Calculate gap
        const lastShift = dayItems.length ? dayItems[dayItems.length - 1].shift : null;
        const nextShift = nextDayItems.length ? nextDayItems[0].shift : null;
        if (lastShift && nextShift) {
          const gap = computeGapHours(lastShift, nextShift);
          if (gap) {
            html += `<div class="next-meeting">Prochain shift ${gap}</div>`;
          }
        }
      }
    }
  });

  container.innerHTML = html;

  // Wire lock/unlock clicks
  container.querySelectorAll(".agent-chip").forEach(el => {
    el.addEventListener("click", () => {
      const { agent, date, shift } = el.dataset;
      if (onLockToggle) onLockToggle(agent, date, shift);
    });
  });

  // Wire empty generate button
  const emptyBtn = container.querySelector("#empty_generate");
  if (emptyBtn) {
    emptyBtn.addEventListener("click", () => {
      document.getElementById("btn_open_settings")?.click();
    });
  }
}

function computeGapHours(fromShift, toShift) {
  const fromEnd = SHIFT_DEFS[fromShift]?.end;
  const toStart = SHIFT_DEFS[toShift]?.start;
  if (!fromEnd || !toStart) return null;
  const [fh, fm] = fromEnd.split(":").map(Number);
  const [th, tm] = toStart.split(":").map(Number);
  const endMin = fh * 60 + fm;
  const startMin = th * 60 + tm;
  const gap = (24 * 60 - endMin) + startMin;
  const h = Math.floor(gap / 60);
  const m = gap % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

// ── Agent Matrix Rendering ──

export function renderAgentMatrix() {
  const container = document.getElementById("matrix_container");
  if (!container) return;

  if (!lastAssignments.length) {
    container.innerHTML = '<p class="text-muted text-sm">Generez un planning pour voir la matrice.</p>';
    return;
  }

  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;
  if (!startDate || !endDate) return;

  const dates = dateRange(startDate, endDate);
  const agents = getEffectiveAgents(getAgents());
  const nameMap = getAgentNameMap(agents);

  const byAgentDate = {};
  agents.forEach(a => { byAgentDate[a.id] = {}; });
  lastAssignments.forEach(a => {
    byAgentDate[a.agent_id] = byAgentDate[a.agent_id] || {};
    byAgentDate[a.agent_id][a.date] = a.shift;
  });

  const sortedAgents = [...agents].sort((a, b) =>
    (nameMap[a.id] || a.id).toLowerCase().localeCompare((nameMap[b.id] || b.id).toLowerCase())
  );

  const shiftShort = { MATIN: "M", SOIR: "S", JOUR_12H: "12" };

  let html = '<div class="agent-matrix-wrap"><table class="agent-matrix"><thead><tr><th>Agent</th>';
  dates.forEach(d => {
    const wc = isWeekend(d) ? "weekend-col" : "";
    html += `<th class="${wc}">${shortDateLabel(d)}</th>`;
  });
  html += '<th>Total h</th></tr></thead><tbody>';

  sortedAgents.forEach(agent => {
    const schedule = byAgentDate[agent.id] || {};
    let minutes = 0;
    html += `<tr><td class="matrix-agent">${escapeHtml(nameMap[agent.id])}</td>`;
    dates.forEach(d => {
      const shift = schedule[d];
      const wc = isWeekend(d) ? "weekend-col" : "";
      if (!shift) {
        html += `<td class="${wc}"><span class="matrix-off">OFF</span></td>`;
      } else {
        const locked = lockedAssignments.some(l => l.agent_id === agent.id && l.date === d && l.shift === shift);
        minutes += SHIFT_DEFS[shift]?.duration_minutes || 0;
        html += `<td class="${wc}"><span class="matrix-chip ${SHIFT_CLASSES[shift]} ${locked ? "locked" : ""}" data-agent="${agent.id}" data-date="${d}" data-shift="${shift}">${shiftShort[shift]}</span></td>`;
      }
    });
    html += `<td class="matrix-total">${(minutes / 60).toFixed(1)}</td></tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Wire lock/unlock clicks on matrix chips
  container.querySelectorAll(".matrix-chip").forEach(el => {
    el.addEventListener("click", () => {
      const { agent, date, shift } = el.dataset;
      if (onLockToggle) onLockToggle(agent, date, shift);
    });
  });
}

// ── Sidebar Events ──

export function renderSidebarEvents() {
  const container = document.getElementById("sidebar_events");
  if (!container) return;

  if (!lastAssignments.length) {
    container.innerHTML = '<div class="sidebar-empty">Generez un planning</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const agents = getEffectiveAgents(getAgents());
  const agentLookup = {};
  agents.forEach(a => { agentLookup[a.id] = a; });
  const nameMap = getAgentNameMap(agents);

  // Show today's assignments, or first day if today not in range
  const startDate = document.getElementById("start_date")?.value || "";
  const endDate = document.getElementById("end_date")?.value || "";
  let targetDate = today;
  if (today < startDate || today > endDate) targetDate = startDate;

  const todayItems = lastAssignments
    .filter(a => a.date === targetDate)
    .sort((a, b) => {
      const si = SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
      if (si !== 0) return si;
      return (nameMap[a.agent_id] || "").localeCompare(nameMap[b.agent_id] || "");
    });

  if (!todayItems.length) {
    container.innerHTML = `<div class="sidebar-empty">Pas d'affectation le ${targetDate}</div>`;
    return;
  }

  let html = '';
  todayItems.forEach(a => {
    const name = nameMap[a.agent_id] || a.agent_id;
    const agent = agentLookup[a.agent_id];
    const initials = agent ? getInitials(agent.first_name, agent.last_name) : "?";
    const color = avatarColor(name);
    const def = SHIFT_DEFS[a.shift];
    const time = `${def.start} - ${def.end}`;

    html += `<div class="sidebar-event">`;
    html += `<span class="sidebar-event-avatar" style="background:${color}">${escapeHtml(initials)}</span>`;
    html += `<div class="sidebar-event-info">`;
    html += `<div class="sidebar-event-name">${escapeHtml(name)}</div>`;
    html += `<div class="sidebar-event-time">${time}</div>`;
    html += `</div></div>`;
  });

  container.innerHTML = html;
}

// ── Stats Update ──

export function updateStats() {
  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;
  if (!startDate || !endDate) return;

  const dates = dateRange(startDate, endDate);
  const agents = getEffectiveAgents(getAgents());

  const requiredByShift = {
    MATIN: parseInt(document.getElementById("cov_matin")?.value, 10) || 0,
    SOIR: parseInt(document.getElementById("cov_soir")?.value, 10) || 0,
    JOUR_12H: parseInt(document.getElementById("cov_12h")?.value, 10) || 0
  };

  let coveredSlots = 0;
  let requiredSlots = 0;

  const byDate = {};
  lastAssignments.forEach(a => {
    byDate[a.date] = byDate[a.date] || [];
    byDate[a.date].push(a);
  });

  dates.forEach(d => {
    const dayItems = byDate[d] || [];
    SHIFT_ORDER.forEach(shift => {
      const required = requiredByShift[shift] || 0;
      if (required > 0) {
        requiredSlots += required;
        const assigned = dayItems.filter(a => a.shift === shift).length;
        coveredSlots += Math.min(assigned, required);
      }
    });
  });

  const pct = requiredSlots > 0 ? Math.round((coveredSlots / requiredSlots) * 100) : 100;

  const el = id => document.getElementById(id);
  if (el("stat_assignments")) el("stat_assignments").textContent = lastAssignments.length;
  if (el("stat_coverage")) el("stat_coverage").textContent = `${pct}%`;
  if (el("stat_locks")) el("stat_locks").textContent = lockedAssignments.length;
  if (el("stat_agents")) el("stat_agents").textContent = agents.length;
}
