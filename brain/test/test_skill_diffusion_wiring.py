"""Tests for Phase 18 SKILL-01/SKILL-04: __skill_share: wiring + lineage column.

RED phase: tests for lineage_parent_hash column, __skill_share: dispatch in
on_message(), quarantine sweep in on_tick(), and PeerSkillFilter flood gate fix.
"""

from __future__ import annotations

import json
import sqlite3
from unittest.mock import AsyncMock, MagicMock

import pytest

from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.psyche.types import (
    CommunicationStyle,
    PersonalityProfile,
    Psyche,
)
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.skills.store import SkillStore
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.thymos.tracker import ThymosTracker


# ── Fixtures ─────────────────────────────────────────────────────────────────

def _make_psyche() -> Psyche:
    return Psyche(
        name="Sophia",
        archetype="The Philosopher",
        personality=PersonalityProfile(
            openness="high",
            conscientiousness="medium",
            extraversion="medium",
            agreeableness="high",
            resilience="medium",
            ambition="high",
        ),
        values=["truth"],
        communication_style=CommunicationStyle.THOUGHTFUL,
    )


def _make_thymos() -> ThymosTracker:
    return ThymosTracker(config={
        "baseline_mood": "neutral",
        "emotional_intensity": "medium",
        "triggers": {},
    })


def _make_telos() -> TelosManager:
    mgr = TelosManager()
    mgr.add_goal("Learn", GoalType.SHORT_TERM, priority=0.8)
    return mgr


def _make_llm() -> AsyncMock:
    from noesis_brain.llm.types import LLMResponse
    llm = AsyncMock()
    llm.generate.return_value = LLMResponse(
        text="I find that fascinating.",
        model="test-model",
        provider="mock",
        usage={"prompt_tokens": 10, "completion_tokens": 5},
    )
    return llm


def _make_handler_with_memory(tmp_path) -> tuple[BrainHandler, MemoryStore]:
    """Build a BrainHandler with hypnos_db_dir enabled (skills wired)."""
    memory = MemoryStore(":memory:")
    handler = BrainHandler(
        psyche=_make_psyche(),
        thymos=_make_thymos(),
        telos=_make_telos(),
        llm=_make_llm(),
        grid_name="genesis",
        location="Agora Central",
        memory=memory,
        did="did:key:zSophia",
        hypnos_db_dir=tmp_path,
    )
    return handler, memory


# ── lineage_parent_hash column (SKILL-04) ───────────────────────────────────

class TestLineageParentHashColumn:
    def test_skill_store_adds_lineage_column(self):
        """SkillStore.__init__ must add lineage_parent_hash via idempotent ALTER TABLE."""
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        # Create skills table WITHOUT lineage_parent_hash (simulates pre-Phase-18 DB)
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
                created_at   TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        # Column should NOT exist before SkillStore is initialized
        cols_before = [r[1] for r in conn.execute("PRAGMA table_info(skills)").fetchall()]
        assert "lineage_parent_hash" not in cols_before

        SkillStore(conn)

        cols_after = [r[1] for r in conn.execute("PRAGMA table_info(skills)").fetchall()]
        assert "lineage_parent_hash" in cols_after

    def test_skill_store_idempotent_migration(self):
        """SkillStore initialized twice does not raise on duplicate column."""
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                instructions TEXT NOT NULL DEFAULT '',
                triggers TEXT NOT NULL DEFAULT '[]',
                tags TEXT NOT NULL DEFAULT '[]',
                usage_count INTEGER NOT NULL DEFAULT 0,
                success_rate REAL NOT NULL DEFAULT 0.0,
                source_did TEXT NOT NULL DEFAULT '',
                peer_verified INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        SkillStore(conn)
        SkillStore(conn)  # Must not raise

    def test_memory_store_has_lineage_column_after_skill_store_init(self, tmp_path):
        """Via MemoryStore connection, SkillStore migration adds lineage_parent_hash."""
        memory = MemoryStore(":memory:")
        SkillStore(memory._conn)
        cols = [r[1] for r in memory._conn.execute("PRAGMA table_info(skills)").fetchall()]
        assert "lineage_parent_hash" in cols


# ── __skill_share: dispatch in on_message() (SKILL-01) ──────────────────────

class TestSkillShareDispatch:
    @pytest.mark.asyncio
    async def test_skill_share_prefix_returns_non_conversational(self, tmp_path):
        """on_message() with __skill_share: prefix never returns a SPEAK action.

        Result is either [] (accepted into quarantine) or [SKILL_REJECTED] (rejected
        immediately). In both cases, no LLM is called and no speak action is produced.
        """
        handler, _ = _make_handler_with_memory(tmp_path)
        # Set trust weight so skill passes the gate
        handler._cached_peer_weights["did:key:zTrustedPeer"] = 0.9
        payload = {
            "name": "trade_skill",
            "description": "A trade skill",
            "instructions": "step 1: evaluate; step 2: propose",
            "triggers": ["trade"],
        }
        actions = await handler.on_message({
            "sender_name": "Peer",
            "sender_did": "did:key:zTrustedPeer",
            "channel": "direct",
            "text": f"__skill_share:{json.dumps(payload)}",
        })
        # Accepted into quarantine — returns []
        assert actions == []
        # No speak action in any case
        assert not any(a.get("action_type") == "speak" for a in actions)

    @pytest.mark.asyncio
    async def test_skill_share_does_not_call_llm(self, tmp_path):
        """__skill_share: dispatch must not invoke the LLM (non-conversational)."""
        handler, _ = _make_handler_with_memory(tmp_path)
        payload = {
            "name": "test_skill",
            "description": "desc",
            "instructions": "step 1: do it",
            "triggers": [],
        }
        await handler.on_message({
            "sender_name": "Peer",
            "sender_did": "did:key:zTrustedPeer",
            "channel": "direct",
            "text": f"__skill_share:{json.dumps(payload)}",
        })
        handler.llm.generate.assert_not_called()

    @pytest.mark.asyncio
    async def test_normal_message_still_calls_llm(self, tmp_path):
        """Normal (non-__skill_share:) messages still go through LLM path."""
        handler, _ = _make_handler_with_memory(tmp_path)
        actions = await handler.on_message({
            "sender_name": "Peer",
            "sender_did": "did:key:zPeer",
            "channel": "agora",
            "text": "Hello!",
        })
        handler.llm.generate.assert_called_once()
        assert any(a.get("action_type") == "speak" for a in actions)

    @pytest.mark.asyncio
    async def test_skill_share_malformed_json_returns_empty(self, tmp_path):
        """Malformed JSON in __skill_share: payload is silently dropped (returns [])."""
        handler, _ = _make_handler_with_memory(tmp_path)
        actions = await handler.on_message({
            "sender_name": "Peer",
            "sender_did": "did:key:zPeer",
            "channel": "direct",
            "text": "__skill_share:{not valid json!!!",
        })
        assert actions == []

    @pytest.mark.asyncio
    async def test_skill_share_enqueues_to_quarantine(self, tmp_path):
        """Accepted skill (trusted peer) goes into quarantine, not direct store."""
        handler, memory = _make_handler_with_memory(tmp_path)
        # Set high trust weight for peer
        handler._cached_peer_weights["did:key:zTrustedPeer"] = 0.9
        instructions = "step 1: think carefully; step 2: act wisely"
        payload = {
            "name": "wisdom_skill",
            "description": "A wise skill",
            "instructions": instructions,
            "triggers": ["wisdom"],
        }
        await handler.on_message({
            "sender_name": "Peer",
            "sender_did": "did:key:zTrustedPeer",
            "channel": "direct",
            "text": f"__skill_share:{json.dumps(payload)}",
        })
        # Skill must be in quarantine, NOT in active skills table
        import hashlib
        skill_hash = hashlib.sha256(instructions.encode()).hexdigest()
        in_quarantine = handler._quarantine_store.has(skill_hash)
        assert in_quarantine is True
        # Not yet in active skills
        active_row = memory._conn.execute(
            "SELECT * FROM skills WHERE name = ?", ("wisdom_skill",)
        ).fetchone()
        assert active_row is None


# ── Quarantine sweep in on_tick() (SKILL-01) ─────────────────────────────────

class TestQuarantineSweepOnTick:
    @pytest.mark.asyncio
    async def test_on_tick_emits_skill_taught_on_promotion(self, tmp_path):
        """on_tick() sweep promotes a trusted quarantined skill and emits SKILL_TAUGHT."""
        handler, memory = _make_handler_with_memory(tmp_path)
        source_did = "did:key:zTeacher"
        handler._cached_peer_weights[source_did] = 0.9

        # Manually enqueue a skill into quarantine at tick 0
        from noesis_brain.skills.types import Skill
        skill = Skill(
            name="promoted_skill",
            description="A skill to promote",
            instructions="promoted instructions here",
            triggers=["promote"],
            tags=["peer"],
            source_did=source_did,
            peer_verified=True,
        )
        handler._quarantine_store.enqueue(
            skill, source_did=source_did, tick=0, parent_hash="parent_hash_xyz"
        )

        # Sweep at a tick far past promote_at_tick
        actions = await handler.on_tick({"tick": 9999})
        action_types = [a["action_type"] for a in actions]
        assert "skill_taught" in action_types

        skill_taught = next(a for a in actions if a["action_type"] == "skill_taught")
        assert "skill_hash" in skill_taught["metadata"]
        assert skill_taught["metadata"]["teacher_did"] == source_did

    @pytest.mark.asyncio
    async def test_on_tick_emits_skill_rejected_on_eviction(self, tmp_path):
        """on_tick() sweep evicts a low-trust quarantined skill and emits SKILL_REJECTED."""
        handler, _ = _make_handler_with_memory(tmp_path)
        source_did = "did:key:zRogue"
        # Trust below threshold — will be evicted
        handler._cached_peer_weights[source_did] = 0.05

        from noesis_brain.skills.types import Skill
        skill = Skill(
            name="rogue_skill",
            description="A rogue skill",
            instructions="rogue instructions to evict",
            triggers=[],
            tags=["peer"],
            source_did=source_did,
            peer_verified=True,
        )
        handler._quarantine_store.enqueue(
            skill, source_did=source_did, tick=0, parent_hash="rogue_parent"
        )

        actions = await handler.on_tick({"tick": 9999})
        action_types = [a["action_type"] for a in actions]
        assert "skill_rejected" in action_types

    @pytest.mark.asyncio
    async def test_on_tick_updates_cached_weights_from_relationship_context(self, tmp_path):
        """on_tick() reads relationship_context to update _cached_peer_weights."""
        handler, _ = _make_handler_with_memory(tmp_path)
        assert handler._cached_peer_weights.get("did:key:zNewPeer", None) is None

        await handler.on_tick({
            "tick": 1,
            "relationship_context": [
                {"did": "did:key:zNewPeer", "weight": 0.75},
            ],
        })
        assert handler._cached_peer_weights.get("did:key:zNewPeer") == 0.75

    @pytest.mark.asyncio
    async def test_on_tick_without_hypnos_still_works(self):
        """on_tick() works normally when hypnos_db_dir is None (no quarantine)."""
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        # Must not raise — quarantine is None-guarded
        actions = await handler.on_tick({"tick": 1})
        assert isinstance(actions, list)


# ── PeerSkillFilter flood gate fix (T-18-03) ─────────────────────────────────

class TestPeerSkillFilterFloodGateFix:
    def test_count_peer_skills_counts_quarantine_rows(self):
        """_count_peer_skills() must count both active skills AND quarantine rows."""
        from noesis_brain.skills.peer_filter import PeerSkillFilter
        from noesis_brain.skills.quarantine import QuarantineStore
        from noesis_brain.skills.store import SkillStore
        from noesis_brain.skills.types import Skill

        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        # Set up skills table with lineage column
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                instructions TEXT NOT NULL DEFAULT '',
                triggers TEXT NOT NULL DEFAULT '[]',
                tags TEXT NOT NULL DEFAULT '[]',
                usage_count INTEGER NOT NULL DEFAULT 0,
                success_rate REAL NOT NULL DEFAULT 0.0,
                source_did TEXT NOT NULL DEFAULT '',
                peer_verified INTEGER NOT NULL DEFAULT 1,
                lineage_parent_hash TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

        skill_store = SkillStore(conn)
        qs = QuarantineStore(conn)
        peer_did = "did:key:zFloodPeer"

        # Add 2 skills directly to active store with source_did
        conn.execute(
            """INSERT INTO skills (name, description, instructions, triggers, tags,
               source_did, peer_verified, created_at, last_used_at)
               VALUES (?, '', 'instr1', '[]', '[]', ?, 1, datetime('now'), datetime('now'))""",
            ("skill_a", peer_did),
        )
        conn.execute(
            """INSERT INTO skills (name, description, instructions, triggers, tags,
               source_did, peer_verified, created_at, last_used_at)
               VALUES (?, '', 'instr2', '[]', '[]', ?, 1, datetime('now'), datetime('now'))""",
            ("skill_b", peer_did),
        )
        conn.commit()

        # Add 1 skill in quarantine from same peer
        skill_q = Skill(
            name="skill_c",
            description="desc",
            instructions="quarantine instr",
            triggers=[],
            tags=[],
            source_did=peer_did,
            peer_verified=True,
        )
        qs.enqueue(skill_q, source_did=peer_did, tick=0, parent_hash="p")

        # PeerSkillFilter now needs to count active (2) + quarantine (1) = 3
        pf = PeerSkillFilter(skill_store=skill_store, relationship_weight_fn=None)
        count = pf._count_peer_skills(peer_did)
        # Combined count must be at least 3 (2 active + 1 quarantine)
        assert count >= 3
