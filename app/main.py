from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Dict, List

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .audit import read_recent_audit_events, write_audit_event
from .compliance import (
    french_health_compliance_snapshot,
    load_compliance_settings,
    validate_live_text_for_french_health,
)
from .live_activity import create_live_entry, delete_live_entry, list_live_entries, purge_old_entries, update_live_entry
from .models import (
    ComplianceReport,
    ExportRequest,
    GenerateRequest,
    GenerateResponse,
    LiveTaskCreateRequest,
    LiveTaskEntry,
    LiveTaskListResponse,
    LiveTaskUpdateRequest,
    ShiftAssignment,
    TrackerRecordRequest,
    TrackerResponse,
)
from .scheduler import build_solution
from .tracker import add_minutes, load_tracker, save_tracker, snapshot_minutes, snapshot_names

app = FastAPI(title="Planning Jour MVP")
COMPLIANCE_SETTINGS = load_compliance_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


def _blocked_patterns(text: str) -> List[str]:
    return validate_live_text_for_french_health(text, COMPLIANCE_SETTINGS)


def _date_range(start_date: str, end_date: str) -> List[str]:
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    days = []
    cur = start
    while cur <= end:
        days.append(cur.isoformat())
        cur += timedelta(days=1)
    return days


def _build_compliance(req: GenerateRequest, assignments: List[ShiftAssignment], agents) -> ComplianceReport:
    params = req.params
    ruleset_used = {
        "daily_rest_min_minutes": params.ruleset_defaults.daily_rest_min_minutes,
        "daily_rest_min_minutes_with_agreement": params.ruleset_defaults.daily_rest_min_minutes_with_agreement,
        "weekly_rest_min_minutes": params.ruleset_defaults.weekly_rest_min_minutes,
        "max_minutes_rolling_7d": params.ruleset_defaults.max_minutes_rolling_7d,
        "cycle_mode_enabled": params.ruleset_defaults.cycle_mode_enabled,
        "cycle_weeks": params.ruleset_defaults.cycle_weeks,
        "max_minutes_per_week_excluding_overtime": params.ruleset_defaults.max_minutes_per_week_excluding_overtime,
        "transmissions_minutes": params.admin_params.transmissions_minutes,
        "pause_min_minutes": params.admin_params.pause_min_minutes,
        "agreement_11h_enabled": params.agreement_11h_enabled,
        "legal_profile": params.legal_profile,
        "allow_single_12h_exception": params.allow_single_12h_exception,
        "max_12h_exceptions_per_agent": params.max_12h_exceptions_per_agent,
        "allowed_12h_exception_dates": params.allowed_12h_exception_dates,
        "forbid_matin_soir_matin": params.forbid_matin_soir_matin,
    }

    hard_violations: List[str] = []
    warnings: List[str] = []

    # Basic validation checks (should be empty if solver respected constraints)
    assigned_map: Dict[str, Dict[str, str]] = {}
    for a in assignments:
        assigned_map.setdefault(a.agent_id, {})[a.date] = a.shift

    # Coverage
    days = _date_range(params.start_date, params.end_date)
    for d in days:
        for shift, required in params.coverage_requirements.items():
            count = sum(1 for a in assignments if a.date == d and a.shift == shift)
            if count < required:
                hard_violations.append(f"Couverture insuffisante {shift} le {d}: {count}/{required}")

    # Regime compatibility
    regime_map = {a.id: a.regime for a in agents}
    for a in assignments:
        regime = regime_map.get(a.agent_id)
        if not regime:
            continue
        allowed = params.agent_regimes[regime].allowed_shifts
        if regime == "REGIME_MIXTE":
            allowed = ["MATIN", "SOIR"]
            if params.allow_single_12h_exception:
                allowed.append("JOUR_12H")
        if a.shift not in allowed:
            hard_violations.append(f"Incompatibilite regime/shift pour {a.agent_id} le {a.date}: {a.shift}")
        if (
            regime == "REGIME_MIXTE"
            and a.shift == "JOUR_12H"
            and params.allow_single_12h_exception
            and params.allowed_12h_exception_dates
            and a.date not in params.allowed_12h_exception_dates
        ):
            hard_violations.append(f"12h non autorise hors dates d’exception pour {a.agent_id} le {a.date}")

    # Warnings: fairness
    soir_counts = {}
    weekend_counts = {}
    weekend_blocks = {}
    for a in agents:
        soir_counts[a.id] = 0
        weekend_counts[a.id] = 0
        weekend_blocks[a.id] = set()
    for a in assignments:
        if a.shift == "SOIR":
            soir_counts[a.agent_id] += 1
        d = datetime.strptime(a.date, "%Y-%m-%d").date()
        if d.weekday() >= 5:
            weekend_counts[a.agent_id] += 1
            saturday = d if d.weekday() == 5 else (d - timedelta(days=1))
            weekend_blocks[a.agent_id].add(saturday.isoformat())
    if soir_counts:
        diff = max(soir_counts.values()) - min(soir_counts.values())
        if diff >= 2:
            warnings.append("Equite: ecart important de nombre de soirs entre agents")
    if weekend_counts:
        diff = max(weekend_counts.values()) - min(weekend_counts.values())
        if diff >= 2:
            warnings.append("Equite: ecart important de week-ends entre agents")

    consecutive_weekends = []
    for agent_id, wk_set in weekend_blocks.items():
        wk_dates = sorted(datetime.strptime(x, "%Y-%m-%d").date() for x in wk_set)
        for i in range(len(wk_dates) - 1):
            if (wk_dates[i + 1] - wk_dates[i]).days == 7:
                consecutive_weekends.append(agent_id)
                break
    if consecutive_weekends:
        warnings.append(
            "Rotation week-end: certains agents ont des week-ends consecutifs "
            f"({', '.join(sorted(consecutive_weekends))})"
        )

    return ComplianceReport(hard_violations=hard_violations, warnings=warnings, ruleset_used=ruleset_used)


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    tracker_baseline = {}
    tracker_year = None
    if req.params.use_tracker:
        tracker_year = req.params.tracker_year
        tracker_baseline = snapshot_minutes(load_tracker(), tracker_year)

    status, assignments, score, explanation, added_agents = build_solution(req, tracker_baseline)
    if status != "ok":
        write_audit_event(
            "generate_infeasible",
            {
                "service_unit": req.params.service_unit,
                "start_date": req.params.start_date,
                "end_date": req.params.end_date,
                "agents_count": len(req.agents),
                "reason": explanation or "infeasible",
            },
        )
        compliance = ComplianceReport(hard_violations=[explanation or "infeasible"], warnings=[], ruleset_used={})
        return GenerateResponse(
            status="infeasible",
            score=None,
            assignments=[],
            compliance=compliance,
            explanation=explanation,
            added_agents=added_agents,
            tracker_year=tracker_year,
            tracker_baseline_minutes=tracker_baseline,
            tracker_updated=False,
        )

    all_agents = list(req.agents) + list(added_agents)
    compliance = _build_compliance(req, assignments, all_agents)

    tracker_updated = False
    if req.params.use_tracker and req.params.record_tracker_on_generate:
        data = load_tracker()
        durations = {code: s.duration_minutes for code, s in req.params.shifts.items()}
        name_map = {a.id: f"{a.last_name} {a.first_name}".strip() for a in all_agents}
        for assignment in assignments:
            minutes = durations.get(assignment.shift, 0)
            add_minutes(data, req.params.tracker_year, assignment.agent_id, minutes, name_map.get(assignment.agent_id))
        save_tracker(data)
        tracker_updated = True

    write_audit_event(
        "generate_ok",
        {
            "service_unit": req.params.service_unit,
            "start_date": req.params.start_date,
            "end_date": req.params.end_date,
            "agents_count": len(all_agents),
            "assignments_count": len(assignments),
            "added_agents_count": len(added_agents),
            "tracker_updated": tracker_updated,
        },
    )

    return GenerateResponse(
        status="ok",
        score=score,
        assignments=assignments,
        compliance=compliance,
        explanation=explanation,
        added_agents=added_agents,
        tracker_year=tracker_year,
        tracker_baseline_minutes=tracker_baseline,
        tracker_updated=tracker_updated,
    )


@app.get("/tracker/{year}", response_model=TrackerResponse)
def tracker_year(year: int) -> TrackerResponse:
    data = load_tracker()
    return TrackerResponse(
        year=year,
        minutes_by_agent=snapshot_minutes(data, year),
        names_by_agent=snapshot_names(data, year),
    )


@app.post("/tracker/record", response_model=TrackerResponse)
def tracker_record(req: TrackerRecordRequest) -> TrackerResponse:
    data = load_tracker()
    durations = {"MATIN": 420, "SOIR": 420, "JOUR_12H": 720}
    name_map = {a.id: f"{a.last_name} {a.first_name}".strip() for a in req.agents}
    for assignment in req.assignments:
        minutes = durations.get(assignment.shift, 0)
        add_minutes(data, req.year, assignment.agent_id, minutes, name_map.get(assignment.agent_id))
    save_tracker(data)
    write_audit_event(
        "tracker_record",
        {
            "year": req.year,
            "assignments_count": len(req.assignments),
            "agents_count": len(req.agents),
        },
    )
    return TrackerResponse(
        year=req.year,
        minutes_by_agent=snapshot_minutes(data, req.year),
        names_by_agent=snapshot_names(data, req.year),
    )


@app.get("/live/entries", response_model=LiveTaskListResponse)
def get_live_entries(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    shift: str | None = Query(default=None),
    include_done: bool = Query(default=True),
) -> LiveTaskListResponse:
    purged = purge_old_entries(COMPLIANCE_SETTINGS.live_task_retention_days)
    entries = list_live_entries(
        start_date=start_date,
        end_date=end_date,
        agent_id=agent_id,
        shift=shift,
        include_done=include_done,
    )
    if purged > 0:
        write_audit_event(
            "live_purge",
            {"retention_days": COMPLIANCE_SETTINGS.live_task_retention_days, "removed_entries": purged},
        )
    return LiveTaskListResponse(
        entries=[LiveTaskEntry(**entry) for entry in entries],
        server_time=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    )


@app.post("/live/entries", response_model=LiveTaskEntry)
def post_live_entry(req: LiveTaskCreateRequest) -> LiveTaskEntry:
    if not req.task_title.strip():
        raise HTTPException(status_code=400, detail="task_title is required")
    text = f"{req.task_title}\n{req.details}"
    blocked = _blocked_patterns(text)
    if blocked:
        write_audit_event(
            "live_create_blocked",
            {"agent_id": req.agent_id, "date": req.date, "shift": req.shift, "blocked_patterns": sorted(set(blocked))},
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "Texte refuse (donnees sensibles detectees: "
                + ", ".join(sorted(set(blocked)))
                + "). Retirez email/telephone/NIR ou identifiants patient."
            ),
        )
    entry = create_live_entry(
        agent_id=req.agent_id,
        agent_name=req.agent_name,
        date=req.date,
        shift=req.shift,
        task_title=req.task_title,
        details=req.details,
        status=req.status,
    )
    write_audit_event(
        "live_create",
        {
            "entry_id": entry["id"],
            "agent_id": req.agent_id,
            "date": req.date,
            "shift": req.shift,
            "status": req.status,
        },
    )
    return LiveTaskEntry(**entry)


@app.put("/live/entries/{entry_id}", response_model=LiveTaskEntry)
def put_live_entry(entry_id: str, req: LiveTaskUpdateRequest) -> LiveTaskEntry:
    to_check = "\n".join([part for part in [req.task_title or "", req.details or ""] if part])
    if to_check:
        blocked = _blocked_patterns(to_check)
        if blocked:
            write_audit_event(
                "live_update_blocked",
                {"entry_id": entry_id, "blocked_patterns": sorted(set(blocked))},
            )
            raise HTTPException(
                status_code=422,
                detail=(
                    "Mise a jour refusee (donnees sensibles detectees: "
                    + ", ".join(sorted(set(blocked)))
                    + ")."
                ),
            )
    entry = update_live_entry(
        entry_id,
        task_title=req.task_title,
        details=req.details,
        status=req.status,
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="entry not found")
    write_audit_event(
        "live_update",
        {"entry_id": entry_id, "status": req.status, "task_title_updated": req.task_title is not None, "details_updated": req.details is not None},
    )
    return LiveTaskEntry(**entry)


@app.delete("/live/entries/{entry_id}")
def remove_live_entry(entry_id: str) -> Dict[str, object]:
    deleted = delete_live_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="entry not found")
    write_audit_event("live_delete", {"entry_id": entry_id})
    return {"status": "ok", "deleted": True}


@app.get("/compliance/french-health")
def compliance_french_health() -> Dict[str, object]:
    snapshot = french_health_compliance_snapshot(COMPLIANCE_SETTINGS)
    snapshot["server_time"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return snapshot


@app.get("/compliance/audit/recent")
def compliance_audit_recent(limit: int = Query(default=100, ge=1, le=1000)) -> Dict[str, object]:
    events = read_recent_audit_events(limit=limit)
    return {"events": events, "count": len(events)}


@app.post("/export/csv")
def export_csv(req: ExportRequest) -> Response:
    agent_names = {a.id: f"{a.last_name} {a.first_name}".strip() for a in req.agents}
    rows = []
    for a in req.assignments:
        rows.append(
            {
                "agent_id": a.agent_id,
                "agent_name": agent_names.get(a.agent_id, a.agent_id),
                "date": a.date,
                "shift": a.shift,
            }
        )
    df = pd.DataFrame(rows)
    data = df.to_csv(index=False).encode("utf-8")
    write_audit_event(
        "export_csv",
        {
            "assignments_count": len(req.assignments),
            "agents_count": len(req.agents),
            "start_date": req.start_date,
            "end_date": req.end_date,
        },
    )
    return Response(content=data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=planning.csv"})


@app.post("/export/pdf")
def export_pdf(req: ExportRequest) -> Response:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40
    c.setFont("Helvetica", 12)
    title = "Planning Jour MVP"
    c.drawString(40, y, title)
    y -= 18
    if req.service_unit or (req.start_date and req.end_date):
        meta = " ".join(
            part
            for part in [
                f"Service: {req.service_unit}" if req.service_unit else "",
                f"Periode: {req.start_date} -> {req.end_date}" if req.start_date and req.end_date else "",
            ]
            if part
        )
        c.setFont("Helvetica", 9)
        c.drawString(40, y, meta)
        y -= 14
    c.setFont("Helvetica", 9)
    agent_names = {a.id: f"{a.last_name} {a.first_name}".strip() for a in req.agents}
    shift_order = ["MATIN", "SOIR", "JOUR_12H"]
    by_date_shift: Dict[str, Dict[str, List[str]]] = {}
    for assignment in req.assignments:
        by_date_shift.setdefault(assignment.date, {}).setdefault(assignment.shift, []).append(assignment.agent_id)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y, "Planning par jour")
    y -= 14
    c.setFont("Helvetica", 9)
    for day in sorted(by_date_shift.keys()):
        if y < 90:
            c.showPage()
            y = height - 40
            c.setFont("Helvetica", 9)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(40, y, day)
        y -= 12
        c.setFont("Helvetica", 9)
        for shift in shift_order:
            ids = sorted(by_date_shift.get(day, {}).get(shift, []), key=lambda aid: agent_names.get(aid, aid))
            names = [agent_names.get(aid, aid) for aid in ids]
            label = f"{shift}: {', '.join(names) if names else 'Aucun'}"
            c.drawString(52, y, label[:130])
            y -= 11

    # Per-agent summary
    y -= 8
    if y < 120:
        c.showPage()
        y = height - 40
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y, "Synthese par agent")
    y -= 12
    c.setFont("Helvetica", 9)
    durations = {"MATIN": 420, "SOIR": 420, "JOUR_12H": 720}
    minutes_by_agent: Dict[str, int] = {}
    for assignment in req.assignments:
        minutes_by_agent[assignment.agent_id] = minutes_by_agent.get(assignment.agent_id, 0) + durations.get(assignment.shift, 0)
    for agent in req.agents:
        if y < 60:
            c.showPage()
            y = height - 40
            c.setFont("Helvetica", 9)
        name = agent_names.get(agent.id, agent.id)
        line = f"{name}: {(minutes_by_agent.get(agent.id, 0) / 60):.1f}h"
        c.drawString(40, y, line)
        y -= 12

    # Tracker summary (if available)
    y -= 10
    if y < 120:
        c.showPage()
        y = height - 40
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y, "Résumé annuel (heures)")
    y -= 12
    c.setFont("Helvetica", 9)
    minutes_by_agent = {}
    if req.start_date and req.end_date:
        try:
            year = int(req.start_date.split("-")[0])
        except ValueError:
            year = None
        if year is not None:
            minutes_by_agent = snapshot_minutes(load_tracker(), year)
    for agent in req.agents:
        name = agent_names.get(agent.id, agent.id)
        minutes = minutes_by_agent.get(agent.id, 0)
        target = agent.annual_target_hours
        target_str = f" / cible {target:.0f}h" if target is not None else ""
        line = f"{name}: {minutes/60:.1f}h{target_str}"
        c.drawString(40, y, line)
        y -= 12
        if y < 40:
            c.showPage()
            y = height - 40
            c.setFont("Helvetica", 9)
    c.showPage()
    c.save()
    pdf = buffer.getvalue()
    write_audit_event(
        "export_pdf",
        {
            "assignments_count": len(req.assignments),
            "agents_count": len(req.agents),
            "start_date": req.start_date,
            "end_date": req.end_date,
        },
    )
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=planning.pdf"})


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
