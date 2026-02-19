from app.compliance import ComplianceSettings, detect_sensitive_patterns, french_health_compliance_snapshot, validate_live_text_for_french_health


def test_detect_sensitive_patterns():
    text = "patient: jean@example.com tel 06 12 34 56 78 nir 185027512345678"
    found = detect_sensitive_patterns(text)
    assert "email" in found
    assert "phone" in found
    assert "nir" in found


def test_validate_live_text_guard_enabled():
    settings = ComplianceSettings(
        french_health_mode=True,
        block_patient_identifiers=True,
        live_task_retention_days=90,
    )
    blocked = validate_live_text_for_french_health("call at 06 12 34 56 78", settings)
    assert blocked == ["phone"]


def test_validate_live_text_guard_disabled():
    settings = ComplianceSettings(
        french_health_mode=False,
        block_patient_identifiers=True,
        live_task_retention_days=90,
    )
    blocked = validate_live_text_for_french_health("jean@example.com", settings)
    assert blocked == []


def test_compliance_snapshot_shape():
    settings = ComplianceSettings(
        french_health_mode=True,
        block_patient_identifiers=True,
        live_task_retention_days=120,
    )
    snap = french_health_compliance_snapshot(settings)
    assert snap["french_health_mode"] is True
    assert snap["controls"]["live_task_retention_days"] == 120

