"""Bridge journal — per-Nous append-only record of every operator-bridge act.

Clone of the iris/synopsis SQLite discipline (WAL, constructor accepts a file,
a directory that derives ``bridge_{did_safe}.db``, or ``:memory:``). Stores a
privacy-safe *digest* per deed — never raw content, paths, frames, or
keystrokes. Brain-local: emits no Grid events (allowlist +0).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from noesis_brain.bridge.types import BridgeDeed


def _did_safe(did: str) -> str:
    return did.replace(":", "_") if did else "unknown"


class BridgeJournal:
    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            p = p / f"bridge_{_did_safe(nous_did)}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._nous_did = nous_did
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS bridge_deeds (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                nous_did    TEXT NOT NULL,
                capability  TEXT NOT NULL,
                verb        TEXT NOT NULL,
                tick        INTEGER NOT NULL,
                ok          INTEGER NOT NULL,
                digest      TEXT NOT NULL,
                reason      TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_bridge_deeds_id ON bridge_deeds(id DESC);
            """
        )
        self._conn.commit()

    def record(self, deed: BridgeDeed) -> int:
        cur = self._conn.execute(
            "INSERT INTO bridge_deeds (nous_did, capability, verb, tick, ok, digest, reason)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                self._nous_did,
                deed.capability,
                deed.verb,
                deed.tick,
                1 if deed.ok else 0,
                deed.digest,
                deed.reason,
            ),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def recent(self, limit: int = 10) -> list[BridgeDeed]:
        rows = self._conn.execute(
            "SELECT capability, verb, tick, ok, digest, reason"
            " FROM bridge_deeds ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            BridgeDeed(
                capability=r["capability"],
                verb=r["verb"],
                tick=r["tick"],
                ok=bool(r["ok"]),
                digest=r["digest"],
                reason=r["reason"],
            )
            for r in rows
        ]

    def count(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) FROM bridge_deeds").fetchone()[0])

    def count_by_capability(self) -> dict[str, int]:
        rows = self._conn.execute(
            "SELECT capability, COUNT(*) AS n FROM bridge_deeds GROUP BY capability"
        ).fetchall()
        return {r["capability"]: int(r["n"]) for r in rows}
