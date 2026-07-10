"""Synopsis store — per-Nous persistence of synthesized research digests.

Clone of the iris/hypnos SQLite discipline (WAL, constructor accepts a file, a
directory that derives ``synopsis_{did_safe}.db``, or ``:memory:``). Append-only:
each synthesis run is a new row; the notebook accretes over a Nous's life.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from noesis_brain.synopsis.types import Synopsis


def _did_safe(did: str) -> str:
    return did.replace(":", "_") if did else "unknown"


class SynopsisStore:
    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            p = p / f"synopsis_{_did_safe(nous_did)}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._nous_did = nous_did
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS synopses (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                nous_did      TEXT NOT NULL,
                topic         TEXT NOT NULL,
                key_points    TEXT NOT NULL,
                source_titles TEXT NOT NULL,
                outline       TEXT NOT NULL,
                created_tick  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_synopses_tick ON synopses(created_tick DESC);
            """
        )
        self._conn.commit()

    def save(self, synopsis: Synopsis) -> int:
        cur = self._conn.execute(
            "INSERT INTO synopses (nous_did, topic, key_points, source_titles, outline, created_tick)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                self._nous_did,
                synopsis.topic,
                json.dumps(list(synopsis.key_points)),
                json.dumps(list(synopsis.source_titles)),
                synopsis.outline,
                synopsis.created_tick,
            ),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def latest(self, limit: int = 5) -> list[Synopsis]:
        rows = self._conn.execute(
            "SELECT topic, key_points, source_titles, outline, created_tick"
            " FROM synopses ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            Synopsis(
                topic=r["topic"],
                key_points=tuple(json.loads(r["key_points"])),
                source_titles=tuple(json.loads(r["source_titles"])),
                outline=r["outline"],
                created_tick=r["created_tick"],
            )
            for r in rows
        ]

    def count(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) FROM synopses").fetchone()[0])
