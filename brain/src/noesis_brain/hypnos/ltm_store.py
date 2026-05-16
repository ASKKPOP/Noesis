"""LtmStore — per-Nous LTM concept graph in SQLite WAL mode. Phase 16.

Clone of brain/src/noesis_brain/iris/store.py constructor + WAL discipline.
Graph is Brain-private: content never crosses the Brain-Grid wire. D-16-03, D-16-10.
Wall-clock FORBIDDEN: only tick from caller is the time axis. T-16-03.
"""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path


def _did_safe(nous_did: str) -> str:
    """Convert DID to filesystem-safe name. Mirrors IrisStore._did_safe convention."""
    return re.sub(r"[^a-z0-9_\-]", "_", nous_did.lower())


class LtmStore:
    """SQLite WAL store for the LTM concept graph. Two tables: ltm_nodes + ltm_edges."""

    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            safe = _did_safe(nous_did) if nous_did else "unknown"
            p = p / f"ltm_{safe}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS ltm_nodes (
                node_id          TEXT PRIMARY KEY,
                content_hash     TEXT NOT NULL,
                first_seen_tick  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ltm_edges (
                src               TEXT NOT NULL,
                dst               TEXT NOT NULL,
                weight            REAL NOT NULL DEFAULT 0.0,
                last_updated_tick INTEGER NOT NULL,
                PRIMARY KEY (src, dst)
            );
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_src ON ltm_edges(src);
            CREATE INDEX IF NOT EXISTS idx_ltm_edges_dst ON ltm_edges(dst);
        """)
        self._conn.commit()

    def upsert_node(self, node_id: str, content_hash: str, tick: int) -> None:
        """Insert node if new (first-seen wins; content_hash never overwritten). D-16-03."""
        self._conn.execute(
            """INSERT INTO ltm_nodes (node_id, content_hash, first_seen_tick)
               VALUES (?, ?, ?)
               ON CONFLICT(node_id) DO NOTHING""",
            (node_id, content_hash, tick),
        )
        self._conn.commit()

    def strengthen_edge(self, src: str, dst: str, delta: float, tick: int) -> None:
        """Accumulate Hebbian delta on edge (src, dst). src MUST be < dst (canonical undirected). D-16-03."""
        self._conn.execute(
            """INSERT INTO ltm_edges (src, dst, weight, last_updated_tick)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(src, dst) DO UPDATE SET
                   weight = weight + excluded.weight,
                   last_updated_tick = excluded.last_updated_tick""",
            (src, dst, delta, tick),
        )
        self._conn.commit()

    def scale_all_edges(self, sigma: float) -> None:
        """SHY downscale: w <- w * sigma for ALL edges. D-16-03, HYP-03."""
        self._conn.execute("UPDATE ltm_edges SET weight = weight * ?", (sigma,))
        self._conn.commit()

    def retrieve_candidates(self, budget: int) -> list[sqlite3.Row]:
        """Return top-(budget) nodes by total incident edge weight.

        O(concept_count) via SQL GROUP BY + LEFT JOIN — never O(N^2) Python iteration.
        Caller applies recency_factor re-ranking in Python. HYP-05.
        """
        return self._conn.execute(
            """SELECT n.node_id, n.content_hash, n.first_seen_tick,
                      COALESCE(SUM(e.weight), 0.0) AS total_weight
               FROM ltm_nodes n
               LEFT JOIN ltm_edges e ON (e.src = n.node_id OR e.dst = n.node_id)
               GROUP BY n.node_id
               ORDER BY total_weight DESC
               LIMIT ?""",
            (budget,),
        ).fetchall()

    def close(self) -> None:
        self._conn.close()
