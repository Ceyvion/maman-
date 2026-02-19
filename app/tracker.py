from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

TRACKER_PATH = Path(__file__).resolve().parent.parent / "data" / "hours_tracker.json"
_TMP_TRACKER_PATH = Path("/tmp") / "maman-emploi" / "data" / "hours_tracker.json"


def _resolve_storage_path(path: Path) -> Path:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text("{}", encoding="utf-8")
        return path
    except OSError:
        _TMP_TRACKER_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not _TMP_TRACKER_PATH.exists():
            _TMP_TRACKER_PATH.write_text("{}", encoding="utf-8")
        return _TMP_TRACKER_PATH


def _ensure_file(path: Path) -> Path:
    target = _resolve_storage_path(path)
    if not target.exists():
        target.write_text("{}", encoding="utf-8")
    return target


def load_tracker(path: Path = TRACKER_PATH) -> Dict[str, Dict[str, Dict[str, object]]]:
    target = _ensure_file(path)
    try:
        return json.loads(target.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_tracker(data: Dict[str, Dict[str, Dict[str, object]]], path: Path = TRACKER_PATH) -> None:
    target = _ensure_file(path)
    try:
        target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        return


def get_year(data: Dict[str, Dict[str, Dict[str, object]]], year: int) -> Dict[str, Dict[str, object]]:
    return data.get(str(year), {})


def add_minutes(
    data: Dict[str, Dict[str, Dict[str, object]]],
    year: int,
    agent_id: str,
    minutes: int,
    name: str | None = None,
) -> None:
    year_key = str(year)
    if year_key not in data:
        data[year_key] = {}
    entry = data[year_key].get(agent_id, {"minutes": 0, "name": name or agent_id})
    entry["minutes"] = int(entry.get("minutes", 0)) + int(minutes)
    if name:
        entry["name"] = name
    data[year_key][agent_id] = entry


def snapshot_minutes(data: Dict[str, Dict[str, Dict[str, object]]], year: int) -> Dict[str, int]:
    year_data = get_year(data, year)
    return {agent_id: int(entry.get("minutes", 0)) for agent_id, entry in year_data.items()}


def snapshot_names(data: Dict[str, Dict[str, Dict[str, object]]], year: int) -> Dict[str, str]:
    year_data = get_year(data, year)
    return {agent_id: str(entry.get("name", agent_id)) for agent_id, entry in year_data.items()}
