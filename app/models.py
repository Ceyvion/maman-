from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

ShiftCode = Literal["MATIN", "SOIR", "JOUR_12H"]
ModeCode = Literal["12h_jour", "matin_soir", "mixte"]
LegalProfile = Literal["FPH", "contractuel", "mixte"]
RegimeCode = Literal[
    "REGIME_12H_JOUR",
    "REGIME_MATIN_ONLY",
    "REGIME_SOIR_ONLY",
    "REGIME_MIXTE",
    "REGIME_POLYVALENT",
]


class PlanningScope(BaseModel):
    day_only: bool = True
    service_window: Dict[str, str] = Field(default_factory=lambda: {"start": "07:00", "end": "21:00"})


class ShiftDef(BaseModel):
    start: str
    end: str
    duration_minutes: int


class Assumptions(BaseModel):
    transmissions_included: bool = True
    pause_included_in_shift: bool = True


class AdminParams(BaseModel):
    transmissions_minutes: int = 15
    pause_min_minutes: int = 20


class RulesetDefaults(BaseModel):
    daily_rest_min_minutes: int = 720
    daily_rest_min_minutes_with_agreement: int = 660
    weekly_rest_min_minutes: int = 2160
    max_minutes_rolling_7d: int = 2880
    cycle_mode_enabled: bool = False
    cycle_weeks: int = 4
    max_minutes_per_week_excluding_overtime: int = 2640


class RegimeDef(BaseModel):
    allowed_shifts: List[ShiftCode]
    max_consecutive_12h_days: Optional[int] = None


class TransitionRule(BaseModel):
    from_shift: ShiftCode = Field(alias="from")
    to_shift: ShiftCode = Field(alias="to")
    reason: str


class PlanningParams(BaseModel):
    service_unit: str
    start_date: str
    end_date: str
    mode: ModeCode
    coverage_requirements: Dict[ShiftCode, int]
    planning_scope: PlanningScope = PlanningScope()
    shifts: Dict[ShiftCode, ShiftDef]
    assumptions: Assumptions = Assumptions()
    admin_params: AdminParams = AdminParams()
    ruleset_defaults: RulesetDefaults = RulesetDefaults()
    agent_regimes: Dict[RegimeCode, RegimeDef]
    hard_forbidden_transitions: List[TransitionRule] = []
    legal_profile: LegalProfile = "FPH"
    agreement_11h_enabled: bool = False
    allow_single_12h_exception: bool = False
    max_12h_exceptions_per_agent: int = 1
    allowed_12h_exception_dates: List[str] = []
    forbid_matin_soir_matin: bool = True
    use_tracker: bool = True
    tracker_year: int = 2026
    auto_add_agents_if_needed: bool = True
    max_extra_agents: int = 10
    record_tracker_on_generate: bool = False


class Preference(BaseModel):
    date: str
    shift: ShiftCode
    type: Literal["prefer", "avoid"] = "prefer"
    weight: int = 1


class Agent(BaseModel):
    id: str
    first_name: str
    last_name: str
    regime: RegimeCode
    quotity: Literal[100, 80, 50] = 100
    unavailability_dates: List[str] = []
    preferences: List[Preference] = []
    annual_target_hours: Optional[float] = None


class LockedAssignment(BaseModel):
    agent_id: str
    date: str
    shift: ShiftCode


class GenerateRequest(BaseModel):
    params: PlanningParams
    agents: List[Agent]
    locked_assignments: List[LockedAssignment] = []


class ShiftAssignment(BaseModel):
    agent_id: str
    date: str
    shift: ShiftCode


class ExportRequest(BaseModel):
    assignments: List[ShiftAssignment]
    agents: List[Agent]
    service_unit: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class TrackerRecordRequest(BaseModel):
    year: int
    assignments: List[ShiftAssignment]
    agents: List[Agent]


class TrackerResponse(BaseModel):
    year: int
    minutes_by_agent: Dict[str, int]
    names_by_agent: Dict[str, str] = {}


LiveTaskStatus = Literal["planned", "in_progress", "done", "blocked"]


class LiveTaskCreateRequest(BaseModel):
    agent_id: str
    agent_name: str
    date: str
    shift: ShiftCode
    task_title: str
    details: str = ""
    status: LiveTaskStatus = "planned"


class LiveTaskUpdateRequest(BaseModel):
    task_title: Optional[str] = None
    details: Optional[str] = None
    status: Optional[LiveTaskStatus] = None


class LiveTaskEntry(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    date: str
    shift: ShiftCode
    task_title: str
    details: str = ""
    status: LiveTaskStatus
    created_at: str
    updated_at: str


class LiveTaskListResponse(BaseModel):
    entries: List[LiveTaskEntry]
    server_time: str


class ComplianceReport(BaseModel):
    hard_violations: List[str]
    warnings: List[str]
    ruleset_used: Dict[str, object]


class GenerateResponse(BaseModel):
    status: Literal["ok", "infeasible"]
    score: Optional[int]
    assignments: List[ShiftAssignment]
    compliance: ComplianceReport
    explanation: Optional[str] = None
    added_agents: List[Agent] = []
    tracker_year: Optional[int] = None
    tracker_baseline_minutes: Dict[str, int] = {}
    tracker_updated: bool = False
