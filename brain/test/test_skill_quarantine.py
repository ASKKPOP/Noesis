"""Tests for Phase 18 SKILL-01: QuarantineStore and ActionType skill members.

RED phase: these tests must fail until quarantine.py exists and types.py has
SKILL_TAUGHT/SKILL_INFERRED/SKILL_REJECTED.
"""

from __future__ import annotations

import sqlite3

import pytest

from noesis_brain.rpc.types import ActionType
from noesis_brain.skills.types import Skill


# ── ActionType members (SKILL-03) ────────────────────────────────────────────

class TestSkillActionTypes:
    def test_skill_taught_value(self):
        assert ActionType.SKILL_TAUGHT == "skill_taught"

    def test_skill_inferred_value(self):
        assert ActionType.SKILL_INFERRED == "skill_inferred"

    def test_skill_rejected_value(self):
        assert ActionType.SKILL_REJECTED == "skill_rejected"

    def test_skill_taught_is_string_enum(self):
        assert isinstance(ActionType.SKILL_TAUGHT, str)

    def test_all_three_distinct(self):
        values = {ActionType.SKILL_TAUGHT, ActionType.SKILL_INFERRED, ActionType.SKILL_REJECTED}
        assert len(values) == 3


# ── QuarantineStore (SKILL-01/D-18-03) ──────────────────────────────────────

def _make_conn() -> sqlite3.Connection:
    """In-memory SQLite connection with row_factory."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    # Skills table must exist for _promote() to insert into it.
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS skills (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL UNIQUE,
            description  TEXT NOT NULL DEFAULT '',
            instructions TEXT NOT NULL DEFAULT '',
            triggers     TEXT NOT NULL DEFAULT '[]',
            tags         TEXT NOT NULL DEFAULT '[]',
            usage_count  INTEGER NOT NULL DEFAULT 0,
            success_rate REAL NOT NULL DEFAULT 0.0,
            source_did   TEXT NOT NULL DEFAULT '',
            peer_verified INTEGER NOT NULL DEFAULT 1,
            lineage_parent_hash TEXT,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    return conn


def _make_skill(name: str = "test_skill", instructions: str = "do the thing") -> Skill:
    return Skill(
        name=name,
        description="A test skill",
        instructions=instructions,
        triggers=["test"],
        tags=["peer"],
        source_did="did:key:zTest123",
        peer_verified=True,
    )


class TestQuarantineStoreTable:
    def test_importable(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        assert QuarantineStore is not None

    def test_creates_skills_quarantine_table(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        QuarantineStore(conn)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        assert "skills_quarantine" in tables

    def test_skills_quarantine_schema_5_columns(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        QuarantineStore(conn)
        cols = [r[1] for r in conn.execute(
            "PRAGMA table_info(skills_quarantine)"
        ).fetchall()]
        assert "skill_hash" in cols
        assert "source_did" in cols
        assert "received_tick" in cols
        assert "promote_at_tick" in cols
        assert "payload_json" in cols
        assert len(cols) == 5

    def test_idempotent_construction(self):
        """Constructing QuarantineStore twice does not raise."""
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        QuarantineStore(conn)
        QuarantineStore(conn)  # Must not raise


class TestQuarantineTicks:
    def test_quarantine_ticks_constant_default(self):
        from noesis_brain.skills.quarantine import QUARANTINE_TICKS
        assert isinstance(QUARANTINE_TICKS, int)
        assert QUARANTINE_TICKS > 0

    def test_quarantine_ticks_env_readable(self, monkeypatch):
        """_read_quarantine_ticks() returns env value when set."""
        monkeypatch.setenv("QUARANTINE_TICKS", "12")
        from noesis_brain.skills import quarantine as q_mod
        result = q_mod._read_quarantine_ticks()
        assert result == 12


class TestQuarantineStoreEnqueue:
    def test_enqueue_inserts_row(self):
        from noesis_brain.skills.quarantine import QuarantineStore, QUARANTINE_TICKS
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill()
        qs.enqueue(skill, source_did="did:key:zPeer", tick=10, parent_hash="abc123")
        row = conn.execute("SELECT * FROM skills_quarantine").fetchone()
        assert row is not None
        assert row["source_did"] == "did:key:zPeer"
        assert row["received_tick"] == 10
        assert row["promote_at_tick"] == 10 + QUARANTINE_TICKS

    def test_enqueue_insert_or_ignore_idempotent(self):
        """Enqueueing same skill twice does not raise and leaves one row."""
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill()
        qs.enqueue(skill, source_did="did:key:zPeer", tick=5, parent_hash="p1")
        qs.enqueue(skill, source_did="did:key:zPeer", tick=6, parent_hash="p2")
        count = conn.execute("SELECT COUNT(*) FROM skills_quarantine").fetchone()[0]
        assert count == 1  # second enqueue is ignored

    def test_enqueue_skill_hash_is_sha256_of_instructions(self):
        import hashlib
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        instructions = "step 1: think; step 2: act"
        skill = _make_skill(instructions=instructions)
        qs.enqueue(skill, source_did="did:key:z", tick=0, parent_hash="h")
        row = conn.execute("SELECT skill_hash FROM skills_quarantine").fetchone()
        expected = hashlib.sha256(instructions.encode()).hexdigest()
        assert row["skill_hash"] == expected


class TestQuarantineStoreHas:
    def test_has_returns_false_for_unknown(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        assert qs.has("nonexistent_hash") is False

    def test_has_returns_true_after_enqueue(self):
        import hashlib
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(instructions="specific instructions text")
        qs.enqueue(skill, source_did="did:key:zX", tick=1, parent_hash="p")
        expected_hash = hashlib.sha256(b"specific instructions text").hexdigest()
        assert qs.has(expected_hash) is True


class TestQuarantineStoreSweep:
    def test_sweep_empty_returns_empty_list(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        results = qs.sweep(current_tick=100, trust_fn=lambda did: 0.9)
        assert results == []

    def test_sweep_not_yet_due_returns_empty(self):
        """Row with promote_at_tick=20 is not swept at tick 10."""
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill()
        qs.enqueue(skill, source_did="did:key:zPeer", tick=10, parent_hash="p")
        # promote_at_tick = 10 + QUARANTINE_TICKS (≥ 15); sweep at tick 12
        results = qs.sweep(current_tick=12, trust_fn=lambda did: 0.9)
        assert results == []

    def test_sweep_promotes_trusted_skill(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="trusted_skill", instructions="trusted instructions")
        qs.enqueue(skill, source_did="did:key:zTrusted", tick=0, parent_hash="ph")
        # Sweep at tick 1000 (well past promote_at_tick)
        results = qs.sweep(current_tick=1000, trust_fn=lambda did: 0.9)
        assert len(results) == 1
        assert results[0].promoted is True
        assert results[0].source_did == "did:key:zTrusted"

    def test_sweep_evicts_low_trust_skill(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="untrusted_skill", instructions="untrusted steps")
        qs.enqueue(skill, source_did="did:key:zRogue", tick=0, parent_hash="ph")
        results = qs.sweep(current_tick=1000, trust_fn=lambda did: 0.1)
        assert len(results) == 1
        assert results[0].promoted is False

    def test_sweep_deletes_row_on_promotion(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="del_on_promote", instructions="promo steps")
        qs.enqueue(skill, source_did="did:key:zP", tick=0, parent_hash="ph")
        qs.sweep(current_tick=1000, trust_fn=lambda did: 0.9)
        count = conn.execute("SELECT COUNT(*) FROM skills_quarantine").fetchone()[0]
        assert count == 0

    def test_sweep_deletes_row_on_eviction(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="del_on_evict", instructions="evict steps")
        qs.enqueue(skill, source_did="did:key:zE", tick=0, parent_hash="ph")
        qs.sweep(current_tick=1000, trust_fn=lambda did: 0.0)
        count = conn.execute("SELECT COUNT(*) FROM skills_quarantine").fetchone()[0]
        assert count == 0

    def test_sweep_never_raises(self):
        """sweep() must not raise even if trust_fn throws."""
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="safe_sweep", instructions="safe steps")
        qs.enqueue(skill, source_did="did:key:z", tick=0, parent_hash="ph")
        # trust_fn raises — sweep must still return results without raising
        def bad_trust_fn(did: str) -> float:
            raise RuntimeError("trust lookup exploded")
        results = qs.sweep(current_tick=1000, trust_fn=bad_trust_fn)
        # Should evict (weight defaults to 0.0 on exception)
        assert isinstance(results, list)

    def test_sweep_promotes_to_active_skills_table(self):
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="active_promote", instructions="active steps here")
        qs.enqueue(skill, source_did="did:key:zActive", tick=0, parent_hash="parent_xyz")
        qs.sweep(current_tick=1000, trust_fn=lambda did: 0.9)
        row = conn.execute("SELECT * FROM skills WHERE name = ?", ("active_promote",)).fetchone()
        assert row is not None
        assert row["peer_verified"] == 1
        assert row["source_did"] == "did:key:zActive"
        assert row["lineage_parent_hash"] == "parent_xyz"


class TestTrustThresholdImport:
    def test_quarantine_uses_trust_threshold_from_peer_filter(self):
        """QuarantineStore must use TRUST_THRESHOLD_SKILL == 0.35 from peer_filter."""
        from noesis_brain.skills.peer_filter import TRUST_THRESHOLD_SKILL
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="borderline_skill", instructions="borderline steps")
        qs.enqueue(skill, source_did="did:key:zBorder", tick=0, parent_hash="bp")

        # Exactly at threshold — should promote
        results = qs.sweep(current_tick=1000, trust_fn=lambda did: TRUST_THRESHOLD_SKILL)
        assert results[0].promoted is True

    def test_just_below_threshold_evicts(self):
        from noesis_brain.skills.peer_filter import TRUST_THRESHOLD_SKILL
        from noesis_brain.skills.quarantine import QuarantineStore
        conn = _make_conn()
        qs = QuarantineStore(conn)
        skill = _make_skill(name="below_threshold", instructions="below threshold steps")
        qs.enqueue(skill, source_did="did:key:zBelow", tick=0, parent_hash="bp")
        results = qs.sweep(current_tick=1000, trust_fn=lambda did: TRUST_THRESHOLD_SKILL - 0.01)
        assert results[0].promoted is False
