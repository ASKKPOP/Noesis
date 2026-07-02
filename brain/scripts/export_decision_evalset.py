"""W-A8 — export a Nous's decision history as a GEPA/DSPy eval set.

Offline prompt evolution (docs/noesis-system-analysis-2026-07.html §8, adoption
#5): treat the Brain's own logged (situation → action → outcome) traces as an
eval set, then let a stronger reflection model (Claude, or a larger local
model) evolve the small runtime model's decision prompts against it.

This exporter is the first half — it mines the Brain's persistent memory
(`$BRAIN_DATA_DIR/nous.db`, the same SQLite the mind loop writes) into JSONL:

    {"tick": 812, "kind": "work", "content": "Worked on 'survey parcels': ..."}
    {"tick": 850, "kind": "lesson", "content": "Lesson: failed 'estimate' — ..."}

Usage:
    python -m scripts.export_decision_evalset [path/to/nous.db] [out.jsonl]
    # defaults: $BRAIN_DATA_DIR/nous.db → ./evalset-<nous>.jsonl

The second half (running the optimizer) is dev-time and offline by design —
sovereignty is preserved because nothing here talks to any network:
    1. pip install dspy gepa
    2. Load the JSONL; score = did the decision lead to a completed task /
       accepted action (kind in {work_done, decision}) vs a lesson (failure).
    3. Run GEPA with a large reflection LM over brain/src/noesis_brain/prompts/
       decision.py templates; ship the evolved prompts as a versioned config.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path

# Memory-content prefixes written by the mind loop (W-A) and social cycle (W-B),
# mapped to eval-set kinds. Ordered — first match wins.
_KINDS: list[tuple[str, str]] = [
    ("Completed task", "work_done"),
    ("Worked on", "work"),
    ("Lesson:", "lesson"),
    ("Planned", "plan"),
    ("Economic decision:", "decision"),
    ("Considered my finances", "decision"),
    ("Chose to rest", "rest"),
    ("Distilled skill", "skill"),
    ("Reached out to", "social"),
    ("Taught skill", "social"),
    ("Contributed lore", "social"),
    ("Committed my ballot", "civic"),
    ("Revealed my ballot", "civic"),
]


def classify(content: str) -> str | None:
    for prefix, kind in _KINDS:
        if content.startswith(prefix):
            return kind
    return None


def export(db_path: str | Path, out_path: str | Path) -> dict[str, int]:
    """Mine decision-relevant memories into JSONL. Returns per-kind counts."""
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT tick, content, importance FROM memories ORDER BY tick ASC, id ASC"
        ).fetchall()
    finally:
        conn.close()

    counts: dict[str, int] = {}
    with open(out_path, "w", encoding="utf-8") as f:
        for tick, content, importance in rows:
            kind = classify(content or "")
            if kind is None:
                continue
            counts[kind] = counts.get(kind, 0) + 1
            f.write(json.dumps(
                {"tick": tick, "kind": kind, "importance": importance, "content": content},
                ensure_ascii=False,
            ) + "\n")
    return counts


def main(argv: list[str]) -> int:
    data_dir = os.environ.get("BRAIN_DATA_DIR", "")
    db = Path(argv[1]) if len(argv) > 1 else Path(data_dir) / "nous.db"
    out = Path(argv[2]) if len(argv) > 2 else Path(f"evalset-{db.stem}.jsonl")
    if not db.exists():
        print(f"export_decision_evalset: db not found: {db}", file=sys.stderr)
        return 1
    counts = export(db, out)
    total = sum(counts.values())
    print(f"exported {total} decision traces → {out}")
    for kind, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {kind:10s} {n}")
    if total == 0:
        print("  (no traces yet — let the Nous live a while, then re-run)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
