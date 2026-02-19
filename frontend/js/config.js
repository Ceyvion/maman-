// ==========================================================================
// Configuration & Constants
// ==========================================================================

export const API_BASE = `${window.location.protocol}//${window.location.hostname || "localhost"}:8000`;

export const SHIFT_DEFS = {
  MATIN:    { start: "07:00", end: "14:00", duration_minutes: 420, label: "MATIN",    short: "M",  labelFull: "Matin (07:00-14:00)" },
  SOIR:     { start: "14:00", end: "21:00", duration_minutes: 420, label: "SOIR",     short: "S",  labelFull: "Soir (14:00-21:00)" },
  JOUR_12H: { start: "07:00", end: "19:00", duration_minutes: 720, label: "JOUR_12H", short: "12", labelFull: "Jour 12H (07:00-19:00)" }
};

export const SHIFT_ORDER = ["MATIN", "SOIR", "JOUR_12H"];

export const SHIFT_CLASSES = {
  MATIN:    "shift-matin",
  SOIR:     "shift-soir",
  JOUR_12H: "shift-12h"
};

export const LIVE_STATUS_LABELS = {
  planned:     "Prevu",
  in_progress: "En cours",
  blocked:     "Bloque",
  done:        "Termine"
};

export const REGIME_OPTIONS = [
  { value: "REGIME_12H_JOUR",    label: "12h jour" },
  { value: "REGIME_MATIN_ONLY",  label: "Matin uniquement" },
  { value: "REGIME_SOIR_ONLY",   label: "Soir uniquement" },
  { value: "REGIME_MIXTE",       label: "Mixte (Matin+Soir)" },
  { value: "REGIME_POLYVALENT",  label: "Polyvalent (M+S+12H)" }
];

export const QUOTITY_OPTIONS = [
  { value: 100, label: "100%" },
  { value: 80,  label: "80%" },
  { value: 50,  label: "50%" }
];

export const AGENT_REGIMES_DEF = {
  REGIME_12H_JOUR:   { allowed_shifts: ["JOUR_12H"], max_consecutive_12h_days: 3 },
  REGIME_MATIN_ONLY: { allowed_shifts: ["MATIN"] },
  REGIME_SOIR_ONLY:  { allowed_shifts: ["SOIR"] },
  REGIME_MIXTE:      { allowed_shifts: ["MATIN", "SOIR"] },
  REGIME_POLYVALENT: { allowed_shifts: ["MATIN", "SOIR", "JOUR_12H"], max_consecutive_12h_days: 3 }
};

export const DAY_NAMES_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const MONTH_NAMES_FR = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"
];

export const UI_STORAGE_KEY = "planning_jour_ui_v2";
