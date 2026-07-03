"""W-A8 — the decision-evalset exporter mines real mind-loop memories."""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.export_decision_evalset import classify, export  # noqa: E402


def _seed_db(path: Path) -> None:
    conn = sqlite3.connect(str(path))
    conn.execute(
        """CREATE TABLE memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT, memory_type TEXT NOT NULL,
            content TEXT NOT NULL, importance REAL NOT NULL DEFAULT 5.0,
            source_did TEXT DEFAULT '', location TEXT DEFAULT '',
            tick INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))"""
    )
    rows = [
        ("event", "Worked on 'survey parcels': counted 24", 6.0, 100),
        ("event", "Lesson: failed 'estimate demand' — no data", 7.0, 120),
        ("event", "Completed task 'survey parcels' toward 'map ring'", 6.0, 140),
        ("event", "random chatter that is not a decision", 3.0, 150),
        ("event", "Committed my ballot on proposal prop-1", 5.0, 160),
    ]
    conn.executemany(
        "INSERT INTO memories (memory_type, content, importance, tick) VALUES (?, ?, ?, ?)", rows
    )
    conn.commit()
    conn.close()


def test_classify_maps_prefixes():
    assert classify("Worked on 'x': y") == "work"
    assert classify("Lesson: z") == "lesson"
    assert classify("Committed my ballot on p") == "civic"
    assert classify("hello world") is None


def test_export_writes_jsonl_and_counts(tmp_path):
    db = tmp_path / "nous.db"
    out = tmp_path / "evalset.jsonl"
    _seed_db(db)

    counts = export(db, out)

    assert counts == {"work": 1, "lesson": 1, "work_done": 1, "civic": 1}
    lines = [json.loads(l) for l in out.read_text().strip().splitlines()]
    assert len(lines) == 4                       # chatter excluded
    assert lines[0]["tick"] == 100 and lines[0]["kind"] == "work"
    assert lines[1]["kind"] == "lesson"
