"""IrisStore — per-Nous ToM belief store (Phase 17).

SQLite WAL + FTS5 + append-only (superseded_by FK chain).
Beliefs are NEVER deleted; eviction sets superseded_by FK only.

Clone of brain/src/noesis_brain/hypnos/ltm_store.py for WAL + constructor discipline.
FTS5 pattern from brain/src/noesis_brain/memory/sqlite_store.py.

DB file: iris_{did_safe}.db (same directory convention as ltm_{did_safe}.db from Phase 16).
"""
from __future__ import annotations

import hashlib
import re
import sqlite3
from pathlib import Path

from noesis_brain.iris.config import IRIS_BELIEFS_CAP, IRIS_CONTEXT_TOP_K
from noesis_brain.iris.types import Belief, DIMENSION_VALUES


def _did_safe(nous_did: str) -> str:
    """Convert DID to filesystem-safe name. Mirrors Phase 16 ltm_{did_safe}.db convention."""
    return re.sub(r"[^a-z0-9_\-]", "_", nous_did.lower())


class IrisStore:
    """Per-Nous append-only belief store backed by SQLite WAL + FTS5.

    All writes are append-only: superseded beliefs get superseded_by FK,
    NEVER deleted. This mirrors the growth_journal.py append-only discipline.

    Thread safety: single-connection, single-process (same as LtmStore).
    """

    def __init__(self, db_path: str | Path = ":memory:", nous_did: str = "") -> None:
        """Open or create the iris belief store.

        Args:
            db_path: Path to the SQLite file, OR ':memory:' for in-process testing,
                     OR a directory path (auto-derives iris_{did_safe}.db from nous_did).
            nous_did: The owning Nous's DID. Used to derive filename if db_path is a directory.
        """
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            safe = _did_safe(nous_did) if nous_did else "unknown"
            p = p / f"iris_{safe}.db"

        self._db_path = str(p) if p is not None else ":memory:"
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        """Create iris_beliefs table, indexes, FTS5 virtual table, and triggers."""
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS iris_beliefs (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                nous_did       TEXT NOT NULL,
                target_did     TEXT NOT NULL,
                dimension      TEXT NOT NULL
                               CHECK(dimension IN ('belief','desire','intention','knowledge','emotion')),
                content        TEXT NOT NULL,
                content_hash   TEXT NOT NULL,
                confidence     REAL NOT NULL CHECK(confidence >= 0.0 AND confidence <= 1.0),
                superseded_by  INTEGER REFERENCES iris_beliefs(id),
                created_tick   INTEGER NOT NULL,
                source_event_hash TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_iris_target
                ON iris_beliefs(target_did, dimension);
            CREATE INDEX IF NOT EXISTS idx_iris_confidence
                ON iris_beliefs(confidence DESC);

            -- Autonomous FTS5 (NOT content=iris_beliefs) to avoid superseded-row sync bug
            -- (RESEARCH.md Pitfall 4 / Open Question #3). Autonomous storage avoids
            -- the complexity of maintaining triggers for superseded rows.
            CREATE VIRTUAL TABLE IF NOT EXISTS iris_beliefs_fts
                USING fts5(content);

            -- Keep FTS in sync on INSERT
            CREATE TRIGGER IF NOT EXISTS iris_fts_ai
                AFTER INSERT ON iris_beliefs BEGIN
                    INSERT INTO iris_beliefs_fts(rowid, content)
                    VALUES (new.id, new.content);
                END;
        """)
        self._conn.commit()

    # ---- write path (append-only) ----------------------------------------

    def add_belief(self, belief: Belief, tick: int) -> int:
        """Insert a new belief row. Returns the new row id.

        Validates dimension enum, computes content_hash, supersedes the prior
        highest-confidence active belief for the same (target_did, dimension),
        and enforces the LRU cap (IRIS_BELIEFS_CAP) if exceeded.

        NEVER deletes rows — eviction uses superseded_by FK only.
        """
        if belief.dimension not in DIMENSION_VALUES:
            raise ValueError(
                f"IrisStore: dimension must be one of {sorted(DIMENSION_VALUES)!r}, "
                f"got {belief.dimension!r}"
            )

        content_hash = hashlib.sha256(belief.content.encode("utf-8")).hexdigest()

        cursor = self._conn.execute(
            """
            INSERT INTO iris_beliefs
                (nous_did, target_did, dimension, content, content_hash,
                 confidence, superseded_by, created_tick, source_event_hash)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            (
                belief.nous_did, belief.target_did, belief.dimension,
                belief.content, content_hash, belief.confidence,
                tick, belief.source_event_hash,
            ),
        )
        new_id = cursor.lastrowid
        self._conn.commit()

        # Enforce LRU cap — evict lowest-score beliefs if over cap.
        # Cap enforcement is the sole eviction mechanism; beliefs accumulate
        # up to IRIS_BELIEFS_CAP active rows per (target, dimension).
        self._enforce_cap(belief.target_did, belief.dimension, new_id)

        return new_id

    def supersede(self, old_id: int, new_id: int) -> None:
        """Explicitly mark old_id as superseded by new_id.

        Called by elicit.py when a new elicited belief semantically replaces
        an existing one (contradiction or update scenario). This is separate
        from cap-eviction: elicit() decides WHEN to supersede based on content
        comparison; _enforce_cap handles the hard count limit.
        """
        self._conn.execute(
            "UPDATE iris_beliefs SET superseded_by=? WHERE id=? AND superseded_by IS NULL",
            (new_id, old_id),
        )
        self._conn.commit()

    def _enforce_cap(self, target_did: str, dimension: str, new_id: int) -> None:
        """Evict lowest-scoring active belief if count > IRIS_BELIEFS_CAP.

        Score = confidence * recency_decay (approximated here as confidence alone,
        since recency_decay is caller-supplied and may not be persisted).
        Eviction sets superseded_by = new_id; NEVER deletes.
        """
        active_rows = self._conn.execute(
            """
            SELECT id, confidence, created_tick FROM iris_beliefs
            WHERE target_did=? AND dimension=? AND superseded_by IS NULL
            ORDER BY confidence DESC
            """,
            (target_did, dimension),
        ).fetchall()

        if len(active_rows) <= IRIS_BELIEFS_CAP:
            return

        # Evict from the end (lowest confidence)
        to_evict = active_rows[IRIS_BELIEFS_CAP:]
        for row in to_evict:
            self._conn.execute(
                "UPDATE iris_beliefs SET superseded_by=? WHERE id=?",
                (new_id, row["id"]),
            )
        self._conn.commit()

    # ---- read path (pure reads) ------------------------------------------

    def get_beliefs(
        self,
        target_did: str,
        dimension: str | None = None,
        k: int = IRIS_CONTEXT_TOP_K,
        active_only: bool = True,
    ) -> list[Belief]:
        """Read top-k beliefs about target_did, ordered by confidence DESC.

        This is a PURE READ — no side effects, no writes.
        """
        where_parts = ["target_did=?"]
        params: list = [target_did]

        if dimension is not None:
            where_parts.append("dimension=?")
            params.append(dimension)
        if active_only:
            where_parts.append("superseded_by IS NULL")

        where_clause = " AND ".join(where_parts)
        query = f"""
            SELECT id, nous_did, target_did, dimension, content, confidence,
                   superseded_by, created_tick, source_event_hash
            FROM iris_beliefs
            WHERE {where_clause}
            ORDER BY confidence DESC
            LIMIT ?
        """
        params.append(k)
        rows = self._conn.execute(query, params).fetchall()

        return [
            Belief(
                id=r["id"],
                nous_did=r["nous_did"],
                target_did=r["target_did"],
                dimension=r["dimension"],  # type: ignore[arg-type]
                content=r["content"],
                confidence=r["confidence"],
                superseded_by=r["superseded_by"],
                created_tick=r["created_tick"],
                source_event_hash=r["source_event_hash"],
            )
            for r in rows
        ]

    def belief_count(self) -> int:
        """Total count of active beliefs (all targets, all dimensions)."""
        row = self._conn.execute(
            "SELECT COUNT(*) FROM iris_beliefs WHERE superseded_by IS NULL"
        ).fetchone()
        return row[0] if row else 0

    def peer_count(self) -> int:
        """Distinct target_did count with at least one active belief."""
        row = self._conn.execute(
            "SELECT COUNT(DISTINCT target_did) FROM iris_beliefs WHERE superseded_by IS NULL"
        ).fetchone()
        return row[0] if row else 0

    def has_prior_for(self, nous_did: str, target_did: str) -> bool:
        """Check if any belief (including superseded) exists for (nous_did, target_did).

        Used by priors.py to enforce once-per-pair iris.prior_seeded cardinality.
        """
        row = self._conn.execute(
            "SELECT id FROM iris_beliefs WHERE nous_did=? AND target_did=? LIMIT 1",
            (nous_did, target_did),
        ).fetchone()
        return row is not None

    def close(self) -> None:
        """Close the SQLite connection."""
        self._conn.close()
