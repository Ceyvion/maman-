from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional
from uuid import uuid4

LIVE_ACTIVITY_PATH = Path(__file__).resolve().parent.parent / "data" / "live_activity.json"
_TMP_STORAGE = Path("/tmp") / "maman-emploi" / "data"
_LOCK = Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_iso(iso: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _ensure_file(path: Path) -> None:
    target = _resolve_storage_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_text(json.dumps({"entries": []}, ensure_ascii=False, indent=2), encoding="utf-8")


def _resolve_storage_path(path: Path) -> Path:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Probe writability when file does not exist yet (common on first startup)
        if not path.exists():
            path.write_text(json.dumps({"entries": []}, ensure_ascii=False, indent=2), encoding="utf-8")
            path.unlink()
        return path
    except OSError:
        _TMP_STORAGE.mkdir(parents=True, exist_ok=True)
        return _TMP_STORAGE / path.name


def _load_raw(path: Path = LIVE_ACTIVITY_PATH) -> Dict[str, List[Dict[str, object]]]:
    path = _resolve_storage_path(path)
    try:
        _ensure_file(path)
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = {"entries": []}
    except OSError:
        return {"entries": []}
    if not isinstance(data, dict) or "entries" not in data or not isinstance(data["entries"], list):
        return {"entries": []}
    return data


def _save_raw(data: Dict[str, List[Dict[str, object]]], path: Path = LIVE_ACTIVITY_PATH) -> None:
    path = _resolve_storage_path(path)
    try:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        return


def create_live_entry(
    *,
    agent_id: str,
    agent_name: str,
    date: str,
    shift: str,
    task_title: str,
    details: str,
    status: str,
    path: Path = LIVE_ACTIVITY_PATH,
) -> Dict[str, object]:
    entry = {
        "id": str(uuid4()),
        "agent_id": agent_id,
        "agent_name": agent_name,
        "date": date,
        "shift": shift,
        "task_title": task_title.strip(),
        "details": details.strip(),
        "status": status,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    with _LOCK:
        data = _load_raw(path)
        data["entries"].append(entry)
        _save_raw(data, path)
    return entry


def list_live_entries(
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    agent_id: Optional[str] = None,
    shift: Optional[str] = None,
    include_done: bool = True,
    path: Path = LIVE_ACTIVITY_PATH,
) -> List[Dict[str, object]]:
    data = _load_raw(path)
    out: List[Dict[str, object]] = []
    for entry in data["entries"]:
        d = str(entry.get("date", ""))
        if start_date and d < start_date:
            continue
        if end_date and d > end_date:
            continue
        if agent_id and str(entry.get("agent_id")) != agent_id:
            continue
        if shift and str(entry.get("shift")) != shift:
            continue
        if not include_done and str(entry.get("status")) == "done":
            continue
        out.append(entry)
    out.sort(key=lambda e: (str(e.get("date", "")), str(e.get("shift", "")), str(e.get("agent_name", "")), str(e.get("updated_at", ""))))
    return out


def update_live_entry(
    entry_id: str,
    *,
    task_title: Optional[str] = None,
    details: Optional[str] = None,
    status: Optional[str] = None,
    path: Path = LIVE_ACTIVITY_PATH,
) -> Optional[Dict[str, object]]:
    with _LOCK:
        data = _load_raw(path)
        for entry in data["entries"]:
            if str(entry.get("id")) != entry_id:
                continue
            if task_title is not None:
                entry["task_title"] = task_title.strip()
            if details is not None:
                entry["details"] = details.strip()
            if status is not None:
                entry["status"] = status
            entry["updated_at"] = _now_iso()
            _save_raw(data, path)
            return entry
    return None


def delete_live_entry(entry_id: str, path: Path = LIVE_ACTIVITY_PATH) -> bool:
    with _LOCK:
        data = _load_raw(path)
        before = len(data["entries"])
        data["entries"] = [e for e in data["entries"] if str(e.get("id")) != entry_id]
        if len(data["entries"]) == before:
            return False
        _save_raw(data, path)
        return True


def purge_old_entries(retention_days: int, path: Path = LIVE_ACTIVITY_PATH) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, retention_days))
    with _LOCK:
        data = _load_raw(path)
        before = len(data["entries"])
        kept = []
        for entry in data["entries"]:
            updated = _parse_iso(str(entry.get("updated_at", "")))
            if updated is None:
                kept.append(entry)
                continue
            if updated >= cutoff:
                kept.append(entry)
        if len(kept) != before:
            data["entries"] = kept
            _save_raw(data, path)
        return before - len(kept)
