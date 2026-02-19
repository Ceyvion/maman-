// ==========================================================================
// Utility Functions
// ==========================================================================

import { LIVE_STATUS_LABELS, DAY_NAMES_FR } from './config.js';

export function dateRange(start, end) {
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

export function dateOffset(dateStr, offset) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function parseTimeToMin(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function statusLabel(status) {
  return LIVE_STATUS_LABELS[status] || status;
}

export function timeAgo(isoStr) {
  const t = new Date(isoStr);
  if (Number.isNaN(t.getTime())) return "-";
  const diffMin = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
  if (diffMin < 1) return "a l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function computeAnnualTarget(quotity) {
  const base = 1607;
  if (quotity === 80) return base * 0.8;
  if (quotity === 50) return base * 0.5;
  return base;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shortDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

export function getDayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return DAY_NAMES_FR[d.getDay()];
}

export function getDayNumber(dateStr) {
  return parseInt(dateStr.split("-")[2], 10);
}

export function isWeekend(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
}

export function getMonthYear(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const months = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function avatarColor(name) {
  const colors = [
    "var(--avatar-1)", "var(--avatar-2)", "var(--avatar-3)",
    "var(--avatar-4)", "var(--avatar-5)", "var(--avatar-6)"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(firstName, lastName) {
  const f = (firstName || "")[0] || "";
  const l = (lastName || "")[0] || "";
  return (f + l).toUpperCase() || "?";
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
