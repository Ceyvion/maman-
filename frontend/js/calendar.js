// ==========================================================================
// Mini Calendar — Left Sidebar
// ==========================================================================

import { MONTH_NAMES_FR, DAY_NAMES_FR } from './config.js';
import { lastAssignments } from './state.js';

let displayMonth = null; // { year, month } — 0-indexed month
let onDayClick = null;

export function initCalendar(dayClickHandler) {
  onDayClick = dayClickHandler;
  const today = new Date();
  displayMonth = { year: today.getFullYear(), month: today.getMonth() };
  renderCalendar();
}

export function setCalendarRange(startDate, endDate) {
  if (startDate) {
    const d = new Date(`${startDate}T00:00:00`);
    displayMonth = { year: d.getFullYear(), month: d.getMonth() };
  }
  renderCalendar();
}

export function renderCalendar() {
  const container = document.getElementById("mini_calendar");
  if (!container) return;

  const { year, month } = displayMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Monday=0

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Determine planning range
  const startEl = document.getElementById("start_date");
  const endEl = document.getElementById("end_date");
  const rangeStart = startEl?.value || "";
  const rangeEnd = endEl?.value || "";

  // Dates with assignments
  const assignmentDates = new Set(lastAssignments.map(a => a.date));

  const dows = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

  let html = '<div class="cal-header">';
  html += `<span class="cal-month-label">${MONTH_NAMES_FR[month]} ${year}</span>`;
  html += '<div class="cal-nav">';
  html += '<button data-cal-nav="prev">&lt;</button>';
  html += '<button data-cal-nav="next">&gt;</button>';
  html += '</div></div>';

  html += '<div class="cal-grid">';
  dows.forEach(d => { html += `<span class="cal-dow">${d}</span>`; });

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += '<span class="cal-day"></span>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const classes = ["cal-day", "current-month"];

    if (dateStr === todayStr) classes.push("today");
    if (rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd) classes.push("in-range");
    if (assignmentDates.has(dateStr)) classes.push("has-events");

    html += `<span class="${classes.join(" ")}" data-date="${dateStr}">${day}</span>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Event listeners
  container.querySelectorAll("[data-cal-nav]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.calNav === "prev") {
        displayMonth.month--;
        if (displayMonth.month < 0) { displayMonth.month = 11; displayMonth.year--; }
      } else {
        displayMonth.month++;
        if (displayMonth.month > 11) { displayMonth.month = 0; displayMonth.year++; }
      }
      renderCalendar();
    });
  });

  container.querySelectorAll(".cal-day[data-date]").forEach(el => {
    el.addEventListener("click", () => {
      if (onDayClick) onDayClick(el.dataset.date);
    });
  });
}
