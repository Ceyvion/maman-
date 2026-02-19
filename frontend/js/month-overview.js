// ==========================================================================
// Month Overview — Full Calendar Grid View
// ==========================================================================

import { SHIFT_ORDER, SHIFT_DEFS, SHIFT_CLASSES, MONTH_NAMES_FR, DAY_NAMES_FR } from './config.js';
import { lastAssignments, lockedAssignments, getAgentNameMap, getEffectiveAgents } from './state.js';
import { dateRange, isWeekend, getInitials, avatarColor, escapeHtml } from './utils.js';
import { getAgents } from './request-builder.js';

let onLockToggle = null;
let onDayClick = null;

export function initMonthOverview(lockHandler, dayClickHandler) {
  onLockToggle = lockHandler;
  onDayClick = dayClickHandler;
}

export function renderMonthOverview() {
  const container = document.getElementById("month_overview");
  if (!container) return;

  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;

  if (!lastAssignments.length || !startDate || !endDate) {
    container.innerHTML = `
      <div class="overview-empty">
        <p>Generez un planning pour voir la vue mensuelle</p>
      </div>`;
    return;
  }

  // Determine the full month to display (based on start_date's month)
  const startD = new Date(`${startDate}T00:00:00`);
  const year = startD.getFullYear();
  const month = startD.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const startDow = (firstOfMonth.getDay() + 6) % 7; // Monday=0

  const today = new Date().toISOString().slice(0, 10);

  // Build assignment lookup
  const agents = getEffectiveAgents(getAgents());
  const nameMap = getAgentNameMap(agents);
  const agentLookup = {};
  agents.forEach(a => { agentLookup[a.id] = a; });

  const byDate = {};
  lastAssignments.forEach(a => {
    byDate[a.date] = byDate[a.date] || [];
    byDate[a.date].push(a);
  });

  // Coverage requirements
  const requiredByShift = {
    MATIN: parseInt(document.getElementById("cov_matin")?.value, 10) || 0,
    SOIR: parseInt(document.getElementById("cov_soir")?.value, 10) || 0,
    JOUR_12H: parseInt(document.getElementById("cov_12h")?.value, 10) || 0
  };

  // Header
  const monthLabel = `${MONTH_NAMES_FR[month]} ${year}`;
  let html = `<div class="overview-header">
    <h2 class="overview-title">${monthLabel}</h2>
    <div class="overview-legend">
      <span class="legend-item"><span class="legend-dot shift-matin"></span>Matin</span>
      <span class="legend-item"><span class="legend-dot shift-soir"></span>Soir</span>
      <span class="legend-item"><span class="legend-dot shift-12h"></span>12H</span>
    </div>
  </div>`;

  // Day-of-week headers
  const dowHeaders = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  html += '<div class="overview-grid">';
  dowHeaders.forEach(d => {
    html += `<div class="overview-dow">${d}</div>`;
  });

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += '<div class="overview-cell overview-cell-empty"></div>';
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekend = isWeekend(dateStr);
    const isToday = dateStr === today;
    const inRange = dateStr >= startDate && dateStr <= endDate;
    const dayItems = byDate[dateStr] || [];

    const classes = ["overview-cell"];
    if (weekend) classes.push("weekend");
    if (isToday) classes.push("today");
    if (inRange) classes.push("in-range");
    if (!inRange) classes.push("out-of-range");

    html += `<div class="${classes.join(" ")}" data-date="${dateStr}">`;
    html += `<div class="overview-cell-header">`;
    html += `<span class="overview-day-num ${isToday ? "today-badge" : ""}">${day}</span>`;
    if (dayItems.length > 0) {
      const totalRequired = Object.values(requiredByShift).reduce((a, b) => a + b, 0);
      const totalAssigned = dayItems.length;
      html += `<span class="overview-count ${totalAssigned >= totalRequired ? "ok" : "warn"}">${totalAssigned}/${totalRequired}</span>`;
    }
    html += `</div>`;

    if (inRange && dayItems.length > 0) {
      html += '<div class="overview-shifts">';

      SHIFT_ORDER.forEach(shift => {
        const items = dayItems.filter(a => a.shift === shift);
        const required = requiredByShift[shift] || 0;
        if (required <= 0 && items.length === 0) return;

        const shiftClass = SHIFT_CLASSES[shift];
        const def = SHIFT_DEFS[shift];
        const coverageOk = items.length >= required;

        html += `<div class="overview-shift-row ${shiftClass}">`;
        html += `<span class="overview-shift-label">${def.short}</span>`;
        html += '<div class="overview-shift-agents">';
        items.forEach(a => {
          const agent = agentLookup[a.agent_id];
          const initials = agent ? getInitials(agent.first_name, agent.last_name) : "?";
          const name = nameMap[a.agent_id] || a.agent_id;
          const color = avatarColor(name);
          const isLocked = lockedAssignments.some(l => l.agent_id === a.agent_id && l.date === a.date && l.shift === a.shift);

          html += `<span class="overview-avatar ${isLocked ? "locked" : ""}" style="background:${color}" title="${escapeHtml(name)} - ${def.label}" data-agent="${a.agent_id}" data-date="${a.date}" data-shift="${a.shift}">${escapeHtml(initials)}</span>`;
        });
        if (!coverageOk) {
          for (let i = items.length; i < required; i++) {
            html += `<span class="overview-avatar missing" title="Poste non couvert">?</span>`;
          }
        }
        html += '</div>';
        html += '</div>';
      });

      html += '</div>';
    } else if (inRange) {
      html += '<div class="overview-no-data">-</div>';
    }

    html += '</div>';
  }

  // Trailing empty cells
  const totalCells = startDow + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder > 0) {
    for (let i = 0; i < (7 - remainder); i++) {
      html += '<div class="overview-cell overview-cell-empty"></div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;

  // Wire clicks
  container.querySelectorAll(".overview-cell[data-date]").forEach(cell => {
    cell.addEventListener("click", (e) => {
      // Don't trigger day click if clicking an avatar
      if (e.target.closest(".overview-avatar")) return;
      if (cell.classList.contains("out-of-range")) return;
      if (onDayClick) onDayClick(cell.dataset.date);
    });
  });

  container.querySelectorAll(".overview-avatar[data-agent]").forEach(av => {
    av.addEventListener("click", (e) => {
      e.stopPropagation();
      const { agent, date, shift } = av.dataset;
      if (onLockToggle) onLockToggle(agent, date, shift);
    });
  });
}
