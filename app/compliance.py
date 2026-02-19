from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Dict, List


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
# Broad FR phone detector (accepts spaces/dots/dashes).
PHONE_RE = re.compile(r"\b(?:\+33|0)[ .-]?[1-9](?:[ .-]?\d{2}){4}\b")
# NIR pattern (accept compact or separated form, 13-15 digits).
NIR_RE = re.compile(r"\b[12](?:[ .-]?\d){12,14}\b")


@dataclass(frozen=True)
class ComplianceSettings:
    french_health_mode: bool
    block_patient_identifiers: bool
    live_task_retention_days: int


def load_compliance_settings() -> ComplianceSettings:
    mode = os.getenv("FRENCH_HEALTH_COMPLIANCE_MODE", "true").lower() in {"1", "true", "yes", "on"}
    block = os.getenv("BLOCK_PATIENT_IDENTIFIERS", "true").lower() in {"1", "true", "yes", "on"}
    retention_raw = os.getenv("LIVE_TASK_RETENTION_DAYS", "90")
    try:
        retention = max(1, int(retention_raw))
    except ValueError:
        retention = 90
    return ComplianceSettings(
        french_health_mode=mode,
        block_patient_identifiers=block,
        live_task_retention_days=retention,
    )


def detect_sensitive_patterns(text: str) -> List[str]:
    content = text or ""
    hits: List[str] = []
    if EMAIL_RE.search(content):
        hits.append("email")
    if PHONE_RE.search(content):
        hits.append("phone")
    if NIR_RE.search(content):
        hits.append("nir")
    return hits


def validate_live_text_for_french_health(text: str, settings: ComplianceSettings) -> List[str]:
    if not settings.french_health_mode or not settings.block_patient_identifiers:
        return []
    return detect_sensitive_patterns(text)


def french_health_compliance_snapshot(settings: ComplianceSettings) -> Dict[str, object]:
    return {
        "framework": "RGPD + Loi Informatique et Libertés + Code de la santé publique (secret médical / hébergement)",
        "french_health_mode": settings.french_health_mode,
        "controls": {
            "block_patient_identifiers": settings.block_patient_identifiers,
            "live_task_retention_days": settings.live_task_retention_days,
            "audit_logging": True,
            "minimum_data_ui_notice": True,
            "day_only_scope_enforced": True,
        },
        "disclaimer": "Outil d'aide. Validation juridique locale, DPO/RSSI et exigences HDS restent nécessaires.",
    }
