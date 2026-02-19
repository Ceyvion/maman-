from app.audit import read_recent_audit_events, write_audit_event


def test_audit_write_and_read(tmp_path):
    path = tmp_path / "audit.jsonl"
    write_audit_event("test_action", {"k": "v"}, path=path)
    write_audit_event("test_action_2", {"n": 2}, path=path)
    events = read_recent_audit_events(limit=10, path=path)
    assert len(events) == 2
    assert events[0]["action"] == "test_action"
    assert events[1]["action"] == "test_action_2"

