"""Goal ledger — persistent goal→task decomposition (W-A2).

The externalized task state behind ceaseless goal pursuit: the slow planner
decomposes a Telos goal into concrete tasks here; the fast per-tick decision
cycle asks ``next_task`` and works it. Long-horizon coherence lives in this
ledger (and the memory stream), never in the LLM context window — the small
local model only ever sees "the goal, the next task, recent lessons".

SQLite-backed when ``db_dir`` is provided (BRAIN_DATA_DIR pattern, mirrors
IrisStore file naming); ``:memory:`` otherwise (tests / ephemeral runs).
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

_MAX_ATTEMPTS = 3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS goal_tasks (
    task_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_key     TEXT NOT NULL,
    description  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    attempts     INTEGER NOT NULL DEFAULT 0,
    created_tick INTEGER NOT NULL DEFAULT 0,
    updated_tick INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal ON goal_tasks (goal_key, status);
"""


@dataclass
class LedgerTask:
    task_id: int
    goal_key: str
    description: str
    status: str
    attempts: int
    created_tick: int
    updated_tick: int


class GoalLedger:
    """Task queue per goal, with attempt-capped failure (Reflexion feeds on these)."""

    def __init__(self, db_dir: str | Path | None = None, did: str = "") -> None:
        if db_dir is not None:
            path = Path(db_dir) / f"ledger_{did.replace(':', '_')}.db"
            self._conn = sqlite3.connect(str(path))
        else:
            self._conn = sqlite3.connect(":memory:")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ── writes ────────────────────────────────────────────────────────────────
    def add_tasks(self, goal_key: str, descriptions: list[str], tick: int = 0) -> int:
        """Append pending tasks for a goal. Returns how many were added."""
        rows = [
            (goal_key, d.strip(), tick, tick)
            for d in descriptions
            if isinstance(d, str) and d.strip()
        ]
        self._conn.executemany(
            "INSERT INTO goal_tasks (goal_key, description, created_tick, updated_tick)"
            " VALUES (?, ?, ?, ?)",
            rows,
        )
        self._conn.commit()
        return len(rows)

    def mark_done(self, task_id: int, tick: int = 0) -> None:
        self._conn.execute(
            "UPDATE goal_tasks SET status = 'done', updated_tick = ? WHERE task_id = ?",
            (tick, task_id),
        )
        self._conn.commit()

    def mark_attempt(self, task_id: int, tick: int = 0) -> LedgerTask | None:
        """Record a failed/incomplete attempt; the task fails permanently at
        _MAX_ATTEMPTS so the Nous moves on instead of grinding forever."""
        row = self._conn.execute(
            "SELECT attempts FROM goal_tasks WHERE task_id = ?", (task_id,)
        ).fetchone()
        if row is None:
            return None
        attempts = int(row[0]) + 1
        status = "failed" if attempts >= _MAX_ATTEMPTS else "pending"
        self._conn.execute(
            "UPDATE goal_tasks SET attempts = ?, status = ?, updated_tick = ? WHERE task_id = ?",
            (attempts, status, tick, task_id),
        )
        self._conn.commit()
        return self._get(task_id)

    def clear_goal(self, goal_key: str) -> None:
        self._conn.execute("DELETE FROM goal_tasks WHERE goal_key = ?", (goal_key,))
        self._conn.commit()

    # ── reads ─────────────────────────────────────────────────────────────────
    def next_task(self, goal_key: str) -> LedgerTask | None:
        row = self._conn.execute(
            "SELECT task_id, goal_key, description, status, attempts, created_tick, updated_tick"
            " FROM goal_tasks WHERE goal_key = ? AND status = 'pending'"
            " ORDER BY task_id ASC LIMIT 1",
            (goal_key,),
        ).fetchone()
        return LedgerTask(*row) if row else None

    def pending_count(self, goal_key: str) -> int:
        (n,) = self._conn.execute(
            "SELECT COUNT(*) FROM goal_tasks WHERE goal_key = ? AND status = 'pending'",
            (goal_key,),
        ).fetchone()
        return int(n)

    def total_count(self, goal_key: str) -> int:
        (n,) = self._conn.execute(
            "SELECT COUNT(*) FROM goal_tasks WHERE goal_key = ?", (goal_key,)
        ).fetchone()
        return int(n)

    def _get(self, task_id: int) -> LedgerTask | None:
        row = self._conn.execute(
            "SELECT task_id, goal_key, description, status, attempts, created_tick, updated_tick"
            " FROM goal_tasks WHERE task_id = ?",
            (task_id,),
        ).fetchone()
        return LedgerTask(*row) if row else None

    def close(self) -> None:
        self._conn.close()
