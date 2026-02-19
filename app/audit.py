from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "audit_log.jsonl"
_TMP_AUDIT_LOG_PATH = Path("/tmp") / "maman-emploi" / "data" / "audit_log.jsonl"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _resolve_storage_path(path: Path) -> Path:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text("", encoding="utf-8")
        return path
    except OSError:
        _TMP_AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not _TMP_AUDIT_LOG_PATH.exists():
            _TMP_AUDIT_LOG_PATH.write_text("", encoding="utf-8")
        return _TMP_AUDIT_LOG_PATH


def _ensure(path: Path) -> Path:
    target = _resolve_storage_path(path)
    if not target.exists():
        target.write_text("", encoding="utf-8")
    return target


def write_audit_event(action: str, payload: Dict[str, object], path: Path = AUDIT_LOG_PATH) -> None:
    target = _ensure(path)
    event = {"ts": _now_iso(), "action": action, "payload": payload}
    try:
        with target.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
    except OSError:
        return


def read_recent_audit_events(limit: int = 100, path: Path = AUDIT_LOG_PATH) -> List[Dict[str, object]]:
    target = _ensure(path)
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    out: List[Dict[str, object]] = []
    for line in lines[-max(1, limit):]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out
