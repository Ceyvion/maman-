from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "audit_log.jsonl"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _ensure(path: Path) -> None:
    if not path.parent.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("", encoding="utf-8")


def write_audit_event(action: str, payload: Dict[str, object], path: Path = AUDIT_LOG_PATH) -> None:
    _ensure(path)
    event = {"ts": _now_iso(), "action": action, "payload": payload}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def read_recent_audit_events(limit: int = 100, path: Path = AUDIT_LOG_PATH) -> List[Dict[str, object]]:
    _ensure(path)
    lines = path.read_text(encoding="utf-8").splitlines()
    out: List[Dict[str, object]] = []
    for line in lines[-max(1, limit):]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out

