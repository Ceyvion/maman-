// ==========================================================================
// Global State Management
// ==========================================================================

import { UI_STORAGE_KEY } from './config.js';

// ── Core scheduling state ──
export let lastAssignments = [];
export let lastAgents = [];
export let lockedAssignments = [];
export let liveEntries = [];
export let liveRefreshTimer = null;

export function setLastAssignments(val) { lastAssignments = val; }
export function setLastAgents(val) { lastAgents = val; }
export function setLockedAssignments(val) { lockedAssignments = val; }
export function setLiveEntries(val) { liveEntries = val; }
export function setLiveRefreshTimer(val) { liveRefreshTimer = val; }

// ── UI state ──
export const uiState = {
  activeDrawer: null,       // null | "settings" | "agents"
  outputStale: false,
  selectedDate: null,       // date string for timeline scroll
  activeRightTab: "tasks",  // "tasks" | "docs"
  calendarMonth: null,      // { year, month } for mini-calendar display
  showAgentMatrix: false
};

export function defaultUiState() {
  return {
    activeDrawer: null,
    outputStale: false,
    selectedDate: null,
    activeRightTab: "tasks",
    showAgentMatrix: false
  };
}

export function loadUiState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}");
    if (typeof parsed !== "object" || parsed === null) return;
    if (typeof parsed.outputStale === "boolean") uiState.outputStale = parsed.outputStale;
    if (typeof parsed.activeRightTab === "string") uiState.activeRightTab = parsed.activeRightTab;
    if (typeof parsed.showAgentMatrix === "boolean") uiState.showAgentMatrix = parsed.showAgentMatrix;
  } catch (_err) {
    // ignore
  }
}

export function saveUiState() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      outputStale: uiState.outputStale,
      activeRightTab: uiState.activeRightTab,
      showAgentMatrix: uiState.showAgentMatrix
    }));
  } catch (_err) {
    // ignore
  }
}

export function markOutputStale() {
  if (!lastAssignments.length) return;
  uiState.outputStale = true;
  saveUiState();
}

export function clearOutputStale() {
  uiState.outputStale = false;
  saveUiState();
}

// ── Helpers for agents ──
export function getEffectiveAgents(formAgents) {
  return lastAgents.length ? lastAgents : formAgents;
}

export function getAgentNameMap(agents) {
  const map = {};
  agents.forEach(a => {
    const full = `${a.last_name} ${a.first_name}`.trim();
    map[a.id] = full || a.id;
  });
  return map;
}
