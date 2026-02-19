// ==========================================================================
// Modals — Drawer open/close + Agent table management
// ==========================================================================

import { REGIME_OPTIONS, QUOTITY_OPTIONS } from './config.js';
import { markOutputStale } from './state.js';
import { computeAnnualTarget } from './utils.js';

let currentDrawer = null;

export function initModals() {
  // Close buttons
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      closeDrawer(btn.dataset.close);
    });
  });

  // Overlay click closes
  const overlay = document.getElementById("modal_overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      if (currentDrawer) closeDrawer(currentDrawer);
    });
  }

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && currentDrawer) {
      closeDrawer(currentDrawer);
    }
  });

  // Load initial agents
  loadDefaultAgents();
}

export function openDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  const overlay = document.getElementById("modal_overlay");
  if (!drawer) return;

  // Close any open drawer first
  if (currentDrawer && currentDrawer !== drawerId) {
    closeDrawer(currentDrawer);
  }

  drawer.classList.remove("hidden");
  overlay?.classList.remove("hidden");
  currentDrawer = drawerId;

  // Animation
  const isLeft = drawer.classList.contains("drawer-left");
  drawer.classList.remove("slide-out-left", "slide-out-right");
  drawer.classList.add(isLeft ? "slide-in-left" : "slide-in-right");
}

export function closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  const overlay = document.getElementById("modal_overlay");
  if (!drawer) return;

  const isLeft = drawer.classList.contains("drawer-left");
  drawer.classList.remove("slide-in-left", "slide-in-right");
  drawer.classList.add(isLeft ? "slide-out-left" : "slide-out-right");

  setTimeout(() => {
    drawer.classList.add("hidden");
    drawer.classList.remove("slide-out-left", "slide-out-right");
    overlay?.classList.add("hidden");
    currentDrawer = null;
  }, 250);
}

// ── Agent Table Management ──

export function addAgentRow(values = {}) {
  const tbody = document.getElementById("agents_body");
  if (!tbody) return;

  const tr = document.createElement("tr");
  const defaultTarget = values.annual_target ?? computeAnnualTarget(values.quotity || 100);

  let regimeOptions = REGIME_OPTIONS.map(o =>
    `<option value="${o.value}" ${o.value === (values.regime || "REGIME_MIXTE") ? "selected" : ""}>${o.label}</option>`
  ).join("");

  let quotityOptions = QUOTITY_OPTIONS.map(o =>
    `<option value="${o.value}" ${o.value === (values.quotity || 100) ? "selected" : ""}>${o.label}</option>`
  ).join("");

  tr.innerHTML = `
    <td><input value="${values.last_name || ""}" placeholder="Nom" /></td>
    <td><input value="${values.first_name || ""}" placeholder="Prenom" /></td>
    <td><select>${regimeOptions}</select></td>
    <td><select>${quotityOptions}</select></td>
    <td class="advanced-col"><input type="number" min="0" placeholder="1607" value="${defaultTarget || ""}" /></td>
    <td><input placeholder="2026-02-12,..." value="${values.unavailability || ""}" /></td>
    <td><button class="agent-remove-btn" title="Supprimer">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button></td>
  `;

  tbody.appendChild(tr);

  // Quotity → annual target sync
  const selects = tr.querySelectorAll("select");
  const quotitySelect = selects[1];
  const annualInput = tr.querySelectorAll("input")[2];
  if (quotitySelect && annualInput && !values.annual_target) {
    quotitySelect.addEventListener("change", () => {
      const q = parseInt(quotitySelect.value, 10);
      annualInput.value = computeAnnualTarget(q).toFixed(0);
    });
  }

  // Remove button
  const removeBtn = tr.querySelector(".agent-remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      tr.remove();
      markOutputStale();
    });
  }

  // Simple mode: hide advanced cols
  const simpleMode = document.getElementById("simple_mode")?.checked;
  if (simpleMode) {
    tr.querySelectorAll(".advanced-col").forEach(el => { el.style.display = "none"; });
  }
}

function loadDefaultAgents() {
  addAgentRow({ first_name: "Anna", last_name: "Dupont", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Samir", last_name: "Khelifi", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Lea", last_name: "Martin", regime: "REGIME_MIXTE", quotity: 80 });
  addAgentRow({ first_name: "Noe", last_name: "Bernard", regime: "REGIME_MIXTE", quotity: 80 });
}

export function loadDemoData() {
  document.getElementById("service_unit").value = "USLD";
  document.getElementById("start_date").value = "2026-02-09";
  document.getElementById("end_date").value = "2026-02-15";
  document.getElementById("mode").value = "matin_soir";
  document.getElementById("cov_matin").value = "1";
  document.getElementById("cov_soir").value = "1";
  document.getElementById("cov_12h").value = "0";

  const tbody = document.getElementById("agents_body");
  if (tbody) tbody.innerHTML = "";

  addAgentRow({ first_name: "Anna", last_name: "Dupont", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Samir", last_name: "Khelifi", regime: "REGIME_MIXTE", quotity: 100 });
  addAgentRow({ first_name: "Lea", last_name: "Martin", regime: "REGIME_MIXTE", quotity: 80 });
  addAgentRow({ first_name: "Noe", last_name: "Bernard", regime: "REGIME_MIXTE", quotity: 80 });
}

export function buildMinimalTeam() {
  const mode = document.getElementById("mode")?.value;
  const covM = parseInt(document.getElementById("cov_matin")?.value, 10) || 0;
  const covS = parseInt(document.getElementById("cov_soir")?.value, 10) || 0;
  const cov12 = parseInt(document.getElementById("cov_12h")?.value, 10) || 0;

  const tbody = document.getElementById("agents_body");
  if (tbody) tbody.innerHTML = "";

  let count = Math.max(4, covM + covS + cov12 + 2);
  if (mode === "12h_jour") count = Math.max(4, cov12 * 4);

  for (let i = 0; i < count; i++) {
    const quotity = i < 2 ? 100 : 80;
    let regime = "REGIME_MIXTE";
    if (mode === "12h_jour") regime = "REGIME_12H_JOUR";
    else if (mode === "mixte" && cov12 > 0) regime = "REGIME_POLYVALENT";

    addAgentRow({
      first_name: `Agent${i + 1}`,
      last_name: "Equipe",
      regime,
      quotity
    });
  }

  markOutputStale();
}

export function updateModeInputs() {
  const mode = document.getElementById("mode")?.value;
  const covMatin = document.getElementById("cov_matin");
  const covSoir = document.getElementById("cov_soir");
  const cov12h = document.getElementById("cov_12h");

  if (mode === "12h_jour") {
    if (covMatin) { covMatin.value = "0"; covMatin.disabled = true; }
    if (covSoir) { covSoir.value = "0"; covSoir.disabled = true; }
    if (cov12h) { cov12h.disabled = false; if (cov12h.value === "0") cov12h.value = "1"; }
  } else if (mode === "matin_soir") {
    if (cov12h) { cov12h.value = "0"; cov12h.disabled = true; }
    if (covMatin) covMatin.disabled = false;
    if (covSoir) covSoir.disabled = false;
  } else {
    if (covMatin) covMatin.disabled = false;
    if (covSoir) covSoir.disabled = false;
    if (cov12h) cov12h.disabled = false;
  }
}
