// ==========================================================================
// API Layer — All backend communication
// ==========================================================================

import { API_BASE } from './config.js';

export async function apiGenerate(requestBody) {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  return res.json();
}

export async function apiGetLiveEntries(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  params.set("include_done", "true");
  const res = await fetch(`${API_BASE}/live/entries?${params.toString()}`);
  if (!res.ok) return null;
  return res.json();
}

export async function apiCreateLiveEntry(payload) {
  const res = await fetch(`${API_BASE}/live/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Impossible d'ajouter la tache live.");
  }
  return res.json();
}

export async function apiUpdateLiveEntry(entryId, payload) {
  const res = await fetch(`${API_BASE}/live/entries/${entryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Mise a jour live impossible.");
  }
  return res.json();
}

export async function apiDeleteLiveEntry(entryId) {
  const res = await fetch(`${API_BASE}/live/entries/${entryId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Suppression live impossible.");
  return res.json();
}

export async function apiGetTracker(year) {
  const res = await fetch(`${API_BASE}/tracker/${year}`);
  if (!res.ok) return null;
  return res.json();
}

export async function apiRecordTracker(payload) {
  const res = await fetch(`${API_BASE}/tracker/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function apiGetComplianceFrench() {
  const res = await fetch(`${API_BASE}/compliance/french-health`);
  if (!res.ok) return null;
  return res.json();
}

export async function apiExportCsv(payload) {
  const res = await fetch(`${API_BASE}/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    let detail = "Export CSV indisponible.";
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.blob();
}

export async function apiExportPdf(payload) {
  const res = await fetch(`${API_BASE}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    let detail = "Export PDF indisponible.";
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.blob();
}

export async function apiHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
