import json
from datetime import datetime, timedelta, timezone

from app.live_activity import create_live_entry, delete_live_entry, list_live_entries, purge_old_entries, update_live_entry


def test_create_and_list_live_entries(tmp_path):
    path = tmp_path / "live_activity.json"
    created = create_live_entry(
        agent_id="A1",
        agent_name="Dupont Anna",
        date="2026-02-10",
        shift="MATIN",
        task_title="Traitement",
        details="Pilulier",
        status="planned",
        path=path,
    )
    assert created["id"]
    rows = list_live_entries(path=path)
    assert len(rows) == 1
    assert rows[0]["agent_id"] == "A1"
    assert rows[0]["task_title"] == "Traitement"


def test_update_live_entry(tmp_path):
    path = tmp_path / "live_activity.json"
    created = create_live_entry(
        agent_id="A2",
        agent_name="Khelifi Samir",
        date="2026-02-11",
        shift="SOIR",
        task_title="Tour",
        details="Secteur B",
        status="planned",
        path=path,
    )
    updated = update_live_entry(created["id"], status="in_progress", details="Secteur B + urgences", path=path)
    assert updated is not None
    assert updated["status"] == "in_progress"
    assert "urgences" in updated["details"]


def test_delete_live_entry(tmp_path):
    path = tmp_path / "live_activity.json"
    created = create_live_entry(
        agent_id="A3",
        agent_name="Martin Lea",
        date="2026-02-12",
        shift="MATIN",
        task_title="Accueil",
        details="Nouveaux entrants",
        status="planned",
        path=path,
    )
    assert delete_live_entry(created["id"], path=path) is True
    assert delete_live_entry(created["id"], path=path) is False
    assert list_live_entries(path=path) == []


def test_purge_old_entries(tmp_path):
    path = tmp_path / "live_activity.json"
    old = create_live_entry(
        agent_id="A4",
        agent_name="Bernard Noe",
        date="2026-01-01",
        shift="MATIN",
        task_title="Tache ancienne",
        details="",
        status="done",
        path=path,
    )
    keep = create_live_entry(
        agent_id="A5",
        agent_name="Durand Zoe",
        date="2026-02-01",
        shift="SOIR",
        task_title="Tache recente",
        details="",
        status="planned",
        path=path,
    )

    data = json.loads(path.read_text(encoding="utf-8"))
    for entry in data["entries"]:
        if entry["id"] == old["id"]:
            entry["updated_at"] = (datetime.now(timezone.utc) - timedelta(days=120)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    removed = purge_old_entries(90, path=path)
    assert removed == 1
    rows = list_live_entries(path=path)
    assert len(rows) == 1
    assert rows[0]["id"] == keep["id"]
