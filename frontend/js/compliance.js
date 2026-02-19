// ==========================================================================
// Compliance — Summary builder + right sidebar rendering
// ==========================================================================

import { SHIFT_DEFS, SHIFT_ORDER } from './config.js';
import { lastAssignments, getEffectiveAgents } from './state.js';
import { dateRange, parseTimeToMin } from './utils.js';
import { getAgents, buildRequest } from './request-builder.js';

export function buildComplianceSummary(req, assignments, baselineMinutes = {}, trackerYear = null) {
  const params = req.params;
  const shifts = params.shifts;
  const days = dateRange(params.start_date, params.end_date);
  const DAY_MIN = 24 * 60;

  const shiftInfo = {};
  Object.keys(shifts).forEach(code => {
    shiftInfo[code] = {
      start: parseTimeToMin(shifts[code].start),
      end: parseTimeToMin(shifts[code].end),
      duration: shifts[code].duration_minutes
    };
  });

  const minRest = params.agreement_11h_enabled
    ? Math.min(params.ruleset_defaults.daily_rest_min_minutes, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)
    : params.ruleset_defaults.daily_rest_min_minutes;

  const byAgent = {};
  assignments.forEach(a => {
    byAgent[a.agent_id] = byAgent[a.agent_id] || {};
    byAgent[a.agent_id][a.date] = a.shift;
  });

  const agents = getEffectiveAgents(getAgents());

  let allDailyRestOk = true;
  let allWeeklyRestOk = true;
  let allMsmOk = true;

  agents.forEach(agent => {
    const schedule = byAgent[agent.id] || {};
    let dailyRestOk = true;
    let weeklyRestOk = true;
    let msmOk = true;

    for (let i = 0; i < days.length - 1; i++) {
      const shift = schedule[days[i]];
      const shift2 = schedule[days[i + 1]];
      if (shift && shift2) {
        const rest = (DAY_MIN - shiftInfo[shift].end) + shiftInfo[shift2].start;
        if (rest < minRest) dailyRestOk = false;
      }
    }

    if (days.length >= 7) {
      const restBlocks = [];
      for (let i = 0; i < days.length - 1; i++) {
        if (!schedule[days[i]] && !schedule[days[i + 1]]) restBlocks.push([i, i + 1]);
      }
      for (let i = 0; i < days.length - 2; i++) {
        const s1 = schedule[days[i]];
        const off = !schedule[days[i + 1]];
        const s2 = schedule[days[i + 2]];
        if (s1 && off && s2) {
          const rest = (DAY_MIN - shiftInfo[s1].end) + DAY_MIN + shiftInfo[s2].start;
          if (rest >= params.ruleset_defaults.weekly_rest_min_minutes) restBlocks.push([i, i + 2]);
        }
      }
      for (let w = 0; w <= days.length - 7; w++) {
        const ok = restBlocks.some(([s, e]) => s >= w && e <= w + 6);
        if (!ok) { weeklyRestOk = false; break; }
      }
    }

    if (params.forbid_matin_soir_matin) {
      for (let i = 0; i < days.length - 2; i++) {
        if (schedule[days[i]] === "MATIN" && schedule[days[i + 1]] === "SOIR" && schedule[days[i + 2]] === "MATIN") {
          msmOk = false; break;
        }
      }
    }

    if (!dailyRestOk) allDailyRestOk = false;
    if (!weeklyRestOk) allWeeklyRestOk = false;
    if (!msmOk) allMsmOk = false;
  });

  return {
    dailyRestOk: allDailyRestOk,
    weeklyRestOk: allWeeklyRestOk,
    msmOk: allMsmOk
  };
}

export function renderComplianceBadges(summary) {
  const el = id => document.getElementById(id);

  function setBadge(elementId, ok) {
    const badge = el(elementId);
    if (!badge) return;
    badge.textContent = ok ? "OK" : "KO";
    badge.className = `compliance-value ${ok ? "ok" : "ko"}`;
  }

  setBadge("comp_daily_rest", summary.dailyRestOk);
  setBadge("comp_weekly_rest", summary.weeklyRestOk);
  setBadge("comp_msm", summary.msmOk);

  // Coverage
  const startDate = document.getElementById("start_date")?.value;
  const endDate = document.getElementById("end_date")?.value;
  if (startDate && endDate) {
    const dates = dateRange(startDate, endDate);
    const requiredByShift = {
      MATIN: parseInt(document.getElementById("cov_matin")?.value, 10) || 0,
      SOIR: parseInt(document.getElementById("cov_soir")?.value, 10) || 0,
      JOUR_12H: parseInt(document.getElementById("cov_12h")?.value, 10) || 0
    };
    const byDate = {};
    lastAssignments.forEach(a => {
      byDate[a.date] = byDate[a.date] || [];
      byDate[a.date].push(a);
    });
    let covered = 0, required = 0;
    dates.forEach(d => {
      const dayItems = byDate[d] || [];
      SHIFT_ORDER.forEach(shift => {
        const req = requiredByShift[shift] || 0;
        if (req > 0) {
          required += req;
          covered += Math.min(dayItems.filter(a => a.shift === shift).length, req);
        }
      });
    });
    const ok = covered >= required;
    setBadge("comp_coverage", ok);
  }

  // Global badge
  const globalBadge = el("compliance_global_badge");
  if (globalBadge) {
    const allOk = summary.dailyRestOk && summary.weeklyRestOk && summary.msmOk;
    globalBadge.textContent = allOk ? "Conforme" : "Alerte";
    globalBadge.className = `badge ${allOk ? "badge-ok" : "badge-warn"}`;
  }
}

// ── Full compliance summary for JSON view (preserved from original) ──

export function buildFullComplianceSummary(req, assignments, baselineMinutes = {}, trackerYear = null) {
  const params = req.params;
  const shifts = params.shifts;
  const days = dateRange(params.start_date, params.end_date);
  const DAY_MIN = 24 * 60;

  const shiftInfo = {};
  Object.keys(shifts).forEach(code => {
    shiftInfo[code] = {
      start: parseTimeToMin(shifts[code].start),
      end: parseTimeToMin(shifts[code].end),
      duration: shifts[code].duration_minutes
    };
  });

  const minRest = params.agreement_11h_enabled
    ? Math.min(params.ruleset_defaults.daily_rest_min_minutes, params.ruleset_defaults.daily_rest_min_minutes_with_agreement)
    : params.ruleset_defaults.daily_rest_min_minutes;

  const byAgent = {};
  assignments.forEach(a => {
    byAgent[a.agent_id] = byAgent[a.agent_id] || {};
    byAgent[a.agent_id][a.date] = a.shift;
  });

  const agents = getEffectiveAgents(getAgents());

  return agents.map(agent => {
    const schedule = byAgent[agent.id] || {};
    let totalMinutes = 0, maxConsecWork = 0, currentConsec = 0;
    let maxConsec12 = 0, currentConsec12 = 0;
    let dailyRestOk = true, maxRolling7 = 0, weeklyRestOk = true, msmOk = true;

    for (let i = 0; i < days.length; i++) {
      const shift = schedule[days[i]];
      if (shift) {
        totalMinutes += shiftInfo[shift].duration;
        currentConsec++;
        maxConsecWork = Math.max(maxConsecWork, currentConsec);
        if (shift === "JOUR_12H") { currentConsec12++; maxConsec12 = Math.max(maxConsec12, currentConsec12); }
        else currentConsec12 = 0;
      } else { currentConsec = 0; currentConsec12 = 0; }

      if (i < days.length - 1) {
        const s2 = schedule[days[i + 1]];
        if (shift && s2) {
          const rest = (DAY_MIN - shiftInfo[shift].end) + shiftInfo[s2].start;
          if (rest < minRest) dailyRestOk = false;
        }
      }
    }

    for (let i = 0; i < days.length; i++) {
      let sum = 0;
      for (let k = 0; k < 7 && i + k < days.length; k++) {
        const s = schedule[days[i + k]];
        if (s) sum += shiftInfo[s].duration;
      }
      maxRolling7 = Math.max(maxRolling7, sum);
    }

    if (params.forbid_matin_soir_matin) {
      for (let i = 0; i < days.length - 2; i++) {
        if (schedule[days[i]] === "MATIN" && schedule[days[i + 1]] === "SOIR" && schedule[days[i + 2]] === "MATIN") {
          msmOk = false; break;
        }
      }
    }

    const baseline = baselineMinutes[agent.id] || 0;
    const name = `${agent.last_name} ${agent.first_name}`.trim() || agent.id;

    return {
      name,
      totalHours: (totalMinutes / 60).toFixed(1),
      annualBefore: (baseline / 60).toFixed(1),
      annualAfter: ((baseline + totalMinutes) / 60).toFixed(1),
      maxConsecWork,
      maxConsec12,
      maxRolling7,
      dailyRestOk,
      weeklyRestOk,
      msmOk
    };
  });
}
