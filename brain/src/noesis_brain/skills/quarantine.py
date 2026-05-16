"""QuarantineStore — holds inbound peer skills for QUARANTINE_TICKS before promotion (Phase 18).

Design decisions (D-18-01 through D-18-10):
  - Skills accepted by PeerSkillFilter enter quarantine, not the active SkillStore.
  - Trust is re-checked on every sweep (D-18-02 — trust is a live precondition).
  - Promotion is atomic: INSERT into skills + DELETE from quarantine in one transaction.
  - sweep() never raises — it is called on the on_tick() hot path.
  - skill_hash = sha256(instructions) — canonical per D-18-10.
  - QUARANTINE_TICKS defaults to 5; readable from env var QUARANTINE_TICKS (D-18-01).
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from dataclasses import dataclass
from typing import Callable

from noesis_brain.skills.peer_filter import TRUST_THRESHOLD_SKILL

QUARANTINE_TICKS_DEFAULT: int = 5


def _read_quarantine_ticks() -> int:
    """Read QUARANTINE_TICKS from env (TOML rig injects via env), default 5 (D-18-01)."""
    return int(os.environ.get("QUARANTINE_TICKS", QUARANTINE_TICKS_DEFAULT))


QUARANTINE_TICKS: int = _read_quarantine_ticks()


def _compute_skill_hash(instructions: str) -> str:
    """sha256(instructions) — canonical skill hash (D-18-10)."""
    return hashlib.sha256(instructions.encode()).hexdigest()


@dataclass
class QuarantineResult:
    skill_hash: str
    source_did: str
    parent_hash: str
    payload_json: str
    promoted: bool  # True = promoted to active store; False = evicted
    source: str = "peer"  # 'observed' for OL-path, 'peer' for whisper-path


class QuarantineStore:
    """Manages the skills_quarantine table for per-Nous Brain SQLite DB.

    Quarantine holds inbound skills for QUARANTINE_TICKS before promotion.
    Trust is re-checked on every sweep (D-18-02). Skills are promoted
    atomically (INSERT into skills + DELETE from quarantine).
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._ensure_table()

    def _ensure_table(self) -> None:
        """Create skills_quarantine if not exists (D-18-03 schema)."""
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS skills_quarantine (
                skill_hash      TEXT PRIMARY KEY,
                source_did      TEXT NOT NULL,
                received_tick   INTEGER NOT NULL,
                promote_at_tick INTEGER NOT NULL,
                payload_json    TEXT NOT NULL
            )
        """)
        self._conn.commit()

    def enqueue(
        self,
        skill: "object",  # noesis_brain.skills.types.Skill — avoid circular import
        source_did: str,
        tick: int,
        parent_hash: str,
        source: str = "peer",           # 'observed' for OL-path, 'peer' for whisper-path
        source_event_hash: str = "",    # for OL-path SKILL_INFERRED metadata
    ) -> None:
        """Insert skill into quarantine; promote_at_tick = tick + QUARANTINE_TICKS.

        INSERT OR IGNORE — duplicate skill_hash is silently dropped (idempotent).
        """
        instructions: str = getattr(skill, "instructions", "")
        skill_hash = _compute_skill_hash(instructions)
        payload = {
            "name": getattr(skill, "name", ""),
            "description": getattr(skill, "description", ""),
            "instructions": instructions,
            "triggers": getattr(skill, "triggers", []),
            "tags": getattr(skill, "tags", []),
            "source_did": source_did,
            "parent_hash": parent_hash,
            "source": source,                       # persists provenance through quarantine
            "source_event_hash": source_event_hash, # empty string for peer-path
        }
        try:
            self._conn.execute(
                """INSERT OR IGNORE INTO skills_quarantine
                   (skill_hash, source_did, received_tick, promote_at_tick, payload_json)
                   VALUES (?, ?, ?, ?, ?)""",
                (skill_hash, source_did, tick, tick + QUARANTINE_TICKS, json.dumps(payload)),
            )
            self._conn.commit()
        except sqlite3.Error:
            pass  # duplicate or DB error — silent drop per Brain discipline

    def sweep(
        self,
        current_tick: int,
        trust_fn: Callable[[str], float],
    ) -> list[QuarantineResult]:
        """Process all quarantine rows with promote_at_tick <= current_tick.

        Re-checks trust weight on every sweep (D-18-02 — trust is live precondition).
        Promoted rows: INSERT into skills + DELETE from quarantine.
        Evicted rows: DELETE from quarantine, result.promoted = False.
        Never raises — non-fatal tick path.
        """
        try:
            rows = self._conn.execute(
                "SELECT skill_hash, source_did, payload_json FROM skills_quarantine "
                "WHERE promote_at_tick <= ?",
                (current_tick,),
            ).fetchall()
        except sqlite3.Error:
            return []

        results: list[QuarantineResult] = []
        for row in rows:
            skill_hash: str = row[0]
            source_did: str = row[1]
            payload_json: str = row[2]
            try:
                weight = float(trust_fn(source_did))
            except Exception:
                weight = 0.0
            try:
                payload = json.loads(payload_json)
            except (json.JSONDecodeError, ValueError):
                payload = {}
            parent_hash: str = payload.get("parent_hash", skill_hash)
            skill_source: str = payload.get("source", "peer")

            if weight >= TRUST_THRESHOLD_SKILL:
                promoted = self._promote(skill_hash, payload, current_tick, parent_hash)
                results.append(QuarantineResult(
                    skill_hash=skill_hash,
                    source_did=source_did,
                    parent_hash=parent_hash,
                    payload_json=payload_json,
                    promoted=promoted,
                    source=skill_source,
                ))
            else:
                # Evict — trust too low
                try:
                    self._conn.execute(
                        "DELETE FROM skills_quarantine WHERE skill_hash = ?",
                        (skill_hash,),
                    )
                    self._conn.commit()
                except sqlite3.Error:
                    pass
                results.append(QuarantineResult(
                    skill_hash=skill_hash,
                    source_did=source_did,
                    parent_hash=parent_hash,
                    payload_json=payload_json,
                    promoted=False,
                    source=skill_source,
                ))
        return results

    def _promote(
        self,
        skill_hash: str,
        payload: dict,
        current_tick: int,
        parent_hash: str,
    ) -> bool:
        """INSERT skill into active skills table + DELETE from quarantine.

        Returns True on success, False on error (non-fatal).
        Uses INSERT OR IGNORE so a skill already in active store is dropped cleanly.
        """
        try:
            self._conn.execute(
                """INSERT OR IGNORE INTO skills
                   (name, description, instructions, triggers, tags,
                    usage_count, success_rate, source_did, peer_verified,
                    lineage_parent_hash, created_at, last_used_at)
                   VALUES (?, ?, ?, ?, ?, 0, 0.0, ?, 1, ?, ?, ?)""",
                (
                    payload.get("name", ""),
                    payload.get("description", ""),
                    payload.get("instructions", ""),
                    json.dumps(payload.get("triggers", [])),
                    json.dumps(payload.get("tags", [])),
                    payload.get("source_did", ""),
                    parent_hash,
                    current_tick,
                    current_tick,
                ),
            )
            self._conn.execute(
                "DELETE FROM skills_quarantine WHERE skill_hash = ?",
                (skill_hash,),
            )
            self._conn.commit()
            return True
        except sqlite3.Error:
            return False

    def has(self, skill_hash: str) -> bool:
        """Return True if skill_hash is currently in quarantine (dedup gate — Pitfall 6)."""
        try:
            row = self._conn.execute(
                "SELECT 1 FROM skills_quarantine WHERE skill_hash = ?",
                (skill_hash,),
            ).fetchone()
            return row is not None
        except sqlite3.Error:
            return False
