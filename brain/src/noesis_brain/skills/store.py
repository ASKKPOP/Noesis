"""SkillStore — SQLite-backed skill library with FTS5 retrieval (Phase 15).

Sole writer: BrainHandler.on_tick() → SKILL_LEARN action dispatch.
Reader: build_system_prompt() via retrieve().

Retrieval ranking (EvoAgent §4 three-stage cascade):
  1. Fast trigger keyword match (O(1)) — checked before FTS5.
  2. FTS5 BM25 match over name + description + instructions.
  3. Re-rank by: bm25 × log1p(usage_count) × (0.5 + 0.5 × success_rate).
"""

from __future__ import annotations

import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from noesis_brain.skills.types import Skill


class SkillStore:
    """Wraps the shared MemoryStore SQLite connection to operate on the skills table.

    Accepts the same sqlite3.Connection used by MemoryStore so there is one DB
    file per Nous — no additional file handle needed.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn  # shared with MemoryStore

    # ── Writes ──────────────────────────────────────────────────────────────

    def add(self, skill: Skill) -> Skill:
        """Store a new skill. Raises ValueError on validation failure or name collision.

        Phase 16: source_did and peer_verified are persisted so provenance is
        preserved across sessions and the trust-gate decision is auditable.
        """
        skill.validate()
        try:
            cur = self._conn.execute(
                """INSERT INTO skills
                   (name, description, instructions, triggers, tags,
                    usage_count, success_rate, source_did, peer_verified,
                    created_at, last_used_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    skill.name,
                    skill.description,
                    skill.instructions,
                    skill.triggers_json(),
                    skill.tags_json(),
                    skill.usage_count,
                    skill.success_rate,
                    skill.source_did,
                    1 if skill.peer_verified else 0,
                    skill.created_at.isoformat(),
                    skill.last_used_at.isoformat(),
                ),
            )
            self._conn.commit()
            skill.id = cur.lastrowid
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"Skill name already exists: {skill.name!r}") from exc
        return skill

    def update_outcome(self, name: str, success: bool) -> None:
        """Adjust success_rate (EMA α=0.1) and bump usage_count."""
        row = self._conn.execute(
            "SELECT usage_count, success_rate FROM skills WHERE name = ?", (name,)
        ).fetchone()
        if not row:
            return
        alpha = 0.1
        new_rate = alpha * (1.0 if success else 0.0) + (1 - alpha) * row["success_rate"]
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """UPDATE skills SET usage_count = usage_count + 1,
               success_rate = ?, last_used_at = ? WHERE name = ?""",
            (new_rate, now, name),
        )
        self._conn.commit()

    # ── Reads ───────────────────────────────────────────────────────────────

    def retrieve(self, query: str, k: int = 3) -> list[Skill]:
        """Return top-k skills for the query using FTS5 + re-ranking.

        Stage 1: fast trigger scan (O(N) over skill count, acceptable < 1000 skills).
        Stage 2: FTS5 BM25 retrieval for top-20 candidates.
        Stage 3: composite re-rank and pick top-k.
        """
        if not query.strip():
            return []

        query_words = set(query.lower().split())

        # Stage 1 — trigger keyword match (exact)
        trigger_hits: list[Skill] = []
        all_skills = self._all_skills()
        for skill in all_skills:
            if any(t.lower() in query.lower() for t in skill.triggers):
                trigger_hits.append(skill)

        # Stage 2 — FTS5 BM25 candidates (sanitise query for FTS5 syntax)
        safe_query = " ".join(
            w for w in query.split() if w.isalnum() or "_" in w
        ) or query[:50]
        try:
            rows = self._conn.execute(
                """SELECT s.id, s.name, s.description, s.instructions,
                          s.triggers, s.tags, s.usage_count, s.success_rate,
                          s.created_at, s.last_used_at,
                          skills_fts.rank AS fts_rank
                   FROM skills_fts
                   JOIN skills s ON skills_fts.rowid = s.id
                   WHERE skills_fts MATCH ?
                   ORDER BY rank
                   LIMIT 20""",
                (safe_query,),
            ).fetchall()
            fts_hits = [Skill.from_row(r) for r in rows]
        except Exception:
            fts_hits = []

        # Merge (trigger hits first, then FTS; deduplicate by name)
        seen: set[str] = set()
        candidates: list[tuple[float, Skill]] = []
        for skill in trigger_hits:
            if skill.name not in seen:
                seen.add(skill.name)
                score = self._score(skill, boost=2.0)
                candidates.append((score, skill))

        for i, skill in enumerate(fts_hits):
            if skill.name not in seen:
                seen.add(skill.name)
                # bm25 rank from SQLite is negative (lower = better); invert
                bm25 = -(i + 1)  # positional approximation if rank not accessible
                score = self._score(skill, bm25_pos=i)
                candidates.append((score, skill))

        candidates.sort(key=lambda x: x[0], reverse=True)
        return [skill for _, skill in candidates[:k]]

    def get(self, name: str) -> Skill | None:
        """Get a single skill by name."""
        row = self._conn.execute(
            "SELECT * FROM skills WHERE name = ?", (name,)
        ).fetchone()
        return Skill.from_row(row) if row else None

    def count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) FROM skills").fetchone()
        return row[0]

    def list_all(self) -> list[Skill]:
        return self._all_skills()

    # ── Internal ─────────────────────────────────────────────────────────────

    def _all_skills(self) -> list[Skill]:
        rows = self._conn.execute(
            "SELECT * FROM skills ORDER BY last_used_at DESC"
        ).fetchall()
        return [Skill.from_row(r) for r in rows]

    @staticmethod
    def _score(skill: Skill, bm25_pos: int = 0, boost: float = 1.0) -> float:
        """Composite score: bm25 position × log1p(usage) × success_weight × boost."""
        bm25_weight = 1.0 / (1 + bm25_pos)
        usage_weight = math.log1p(skill.usage_count)
        success_weight = 0.5 + 0.5 * skill.success_rate
        return boost * bm25_weight * max(1.0, usage_weight) * success_weight
