"""
Tests for lore prompt injection gap closure (Phase 20 LORE-02).

Verifies that:
1. build_system_prompt includes '## Lore Commons' when lore_entries is a non-empty list.
2. build_system_prompt does NOT include '## Lore Commons' when lore_entries is None or [].
3. NousRpcHandler sets _cached_lore_entries from LoreStore.retrieve() during on_tick()
   so that on_message() build_system_prompt call receives real lore data.
"""
import hashlib
import sqlite3
import pytest
from unittest.mock import AsyncMock, MagicMock

from noesis_brain.prompts.system import build_system_prompt
from noesis_brain.lore.store import LoreStore
from noesis_brain.lore.types import LoreEntry
from noesis_brain.psyche.types import Psyche, PersonalityProfile, CommunicationStyle
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.telos.manager import TelosManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_psyche() -> Psyche:
    return Psyche(
        name="TestNous",
        archetype="Seeker",
        personality=PersonalityProfile(),
        communication_style=CommunicationStyle.DIRECT,
    )


def make_telos() -> TelosManager:
    return TelosManager()


def make_mood():
    from noesis_brain.thymos.types import MoodState
    return MoodState()


def make_lore_entry(content: str = "Compassion yields harmony.") -> LoreEntry:
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    return LoreEntry(
        content_hash=content_hash,
        contributor_did="did:noesis:test",
        category_tag="observation",
        title="Test Lore",
        content=content,
        received_tick=1,
    )


# ---------------------------------------------------------------------------
# Tests: build_system_prompt lore_entries kwarg
# ---------------------------------------------------------------------------

class TestBuildSystemPromptLoreInjection:
    """Direct tests against build_system_prompt — no handler needed."""

    def test_lore_entries_none_no_lore_commons_section(self):
        """lore_entries=None → '## Lore Commons' absent from system prompt."""
        result = build_system_prompt(
            make_psyche(), make_mood(), make_telos(),
            grid_name="test", location="Agora",
        )
        assert "## Lore Commons" not in result

    def test_lore_entries_empty_list_no_lore_commons_section(self):
        """lore_entries=[] → '## Lore Commons' absent from system prompt."""
        result = build_system_prompt(
            make_psyche(), make_mood(), make_telos(),
            grid_name="test", location="Agora",
            lore_entries=[],
        )
        assert "## Lore Commons" not in result

    def test_lore_entries_with_entry_adds_lore_commons_section(self):
        """lore_entries=[LoreEntry(...)] → '## Lore Commons' present in system prompt."""
        entry = make_lore_entry("Compassion yields harmony.")
        result = build_system_prompt(
            make_psyche(), make_mood(), make_telos(),
            grid_name="test", location="Agora",
            lore_entries=[entry],
        )
        assert "## Lore Commons" in result

    def test_lore_entry_body_appears_in_prompt(self):
        """Lore entry content text appears in system prompt via to_prompt_block()."""
        body = "Patience is the highest virtue in The Grid."
        entry = make_lore_entry(body)
        result = build_system_prompt(
            make_psyche(), make_mood(), make_telos(),
            grid_name="test", location="Agora",
            lore_entries=[entry],
        )
        assert body in result


# ---------------------------------------------------------------------------
# Tests: NousRpcHandler._cached_lore_entries updated by on_tick
# ---------------------------------------------------------------------------

class TestHandlerCachedLoreEntries:
    """Verify that on_tick populates _cached_lore_entries from LoreStore."""

    def _make_handler(self, conn):
        """Construct a minimal NousRpcHandler with an in-memory LoreStore."""
        from noesis_brain.rpc.handler import BrainHandler

        psyche = make_psyche()
        telos = make_telos()
        thymos = ThymosTracker()
        llm = AsyncMock()
        llm.generate = AsyncMock(return_value="test response")
        # Memory mock with _conn pointing to our in-memory SQLite
        memory = MagicMock()
        memory._conn = conn
        memory.lore_capacity = 50
        handler = BrainHandler(
            psyche=psyche,
            thymos=thymos,
            telos=telos,
            llm=llm,
            grid_name="test",
            memory=memory,
            did="did:noesis:test",
        )
        return handler

    def test_cached_lore_entries_none_on_init(self):
        """_cached_lore_entries is None immediately after __init__."""
        conn = sqlite3.connect(":memory:")
        handler = self._make_handler(conn)
        assert handler._cached_lore_entries is None

    @pytest.mark.asyncio
    async def test_cached_lore_entries_populated_after_on_tick_with_entries(self):
        """After on_tick() fires when LoreStore has entries, _cached_lore_entries is non-empty."""
        conn = sqlite3.connect(":memory:")
        handler = self._make_handler(conn)

        # Initialize LoreStore on handler and add one entry.
        # Content uses words that overlap with TelosManager.describe() → "No active goals."
        # so FTS5 can match and lore_entries_for_prompt is non-empty after on_tick().
        handler._lore_store = LoreStore(conn, capacity=50)
        entry = make_lore_entry("No goals are more active than shared wisdom.")
        handler._lore_store.add(entry)

        # Simulate a tick — on_tick retrieves from LoreStore and sets _cached_lore_entries
        await handler.on_tick({"tick": 1, "epoch": 0})

        assert handler._cached_lore_entries is not None
        assert len(handler._cached_lore_entries) >= 1
        hashes = [e.content_hash for e in handler._cached_lore_entries]
        assert entry.content_hash in hashes
