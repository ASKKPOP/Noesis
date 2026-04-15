"""Tests for the memory system — store, stream, retrieval, wiki, reflection."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

from noesis_brain.memory.types import Memory, MemoryType, WikiPage, WikiCategory
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.memory.retrieval import RetrievalScorer
from noesis_brain.memory.reflection import ReflectionEngine
from noesis_brain.episteme.wiki import PersonalWiki
from noesis_brain.llm.types import LLMResponse
from noesis_brain.llm.base import LLMError


# ── Memory Types ────────────────────────────────────────────

class TestMemoryTypes:
    def test_memory_type_values(self):
        assert MemoryType.OBSERVATION == "observation"
        assert MemoryType.CONVERSATION == "conversation"
        assert MemoryType.REFLECTION == "reflection"
        assert MemoryType.EVENT == "event"

    def test_wiki_category_values(self):
        assert WikiCategory.NOUS == "nous"
        assert WikiCategory.CONCEPT == "concept"
        assert WikiCategory.PLACE == "place"

    def test_memory_to_dict(self):
        m = Memory(
            memory_type=MemoryType.OBSERVATION,
            content="Saw Hermes in the market",
            importance=6.0,
            location="Marketplace",
        )
        d = m.to_dict()
        assert d["memory_type"] == "observation"
        assert d["content"] == "Saw Hermes in the market"
        assert d["importance"] == 6.0

    def test_wiki_page_to_dict(self):
        p = WikiPage(
            title="Nous Hermes",
            category=WikiCategory.NOUS,
            content="A cunning trader.",
            confidence=0.7,
        )
        d = p.to_dict()
        assert d["title"] == "Nous Hermes"
        assert d["category"] == "nous"
        assert d["confidence"] == 0.7


# ── SQLite Store ────────────────────────────────────────────

class TestMemoryStore:
    def setup_method(self):
        self.store = MemoryStore(":memory:")

    def teardown_method(self):
        self.store.close()

    def test_add_and_get_memory(self):
        m = Memory(memory_type=MemoryType.OBSERVATION, content="Sky is blue", importance=3.0)
        stored = self.store.add_memory(m)
        assert stored.id is not None
        retrieved = self.store.get_memory(stored.id)
        assert retrieved is not None
        assert retrieved.content == "Sky is blue"
        assert retrieved.importance == 3.0

    def test_recent_memories(self):
        for i in range(5):
            self.store.add_memory(Memory(
                memory_type=MemoryType.OBSERVATION,
                content=f"Memory {i}",
                importance=float(i),
            ))
        recent = self.store.recent_memories(limit=3)
        assert len(recent) == 3
        # Most recent first
        assert recent[0].content == "Memory 4"

    def test_recent_filtered_by_type(self):
        self.store.add_memory(Memory(memory_type=MemoryType.OBSERVATION, content="obs"))
        self.store.add_memory(Memory(memory_type=MemoryType.CONVERSATION, content="conv"))
        self.store.add_memory(Memory(memory_type=MemoryType.EVENT, content="evt"))
        convs = self.store.recent_memories(memory_type=MemoryType.CONVERSATION)
        assert len(convs) == 1
        assert convs[0].content == "conv"

    def test_memories_by_source(self):
        self.store.add_memory(Memory(
            memory_type=MemoryType.CONVERSATION,
            content="Talked with Hermes",
            source_did="did:key:hermes",
        ))
        self.store.add_memory(Memory(
            memory_type=MemoryType.CONVERSATION,
            content="Talked with Atlas",
            source_did="did:key:atlas",
        ))
        hermes_mems = self.store.memories_by_source("did:key:hermes")
        assert len(hermes_mems) == 1
        assert "Hermes" in hermes_mems[0].content

    def test_memories_by_importance(self):
        self.store.add_memory(Memory(memory_type=MemoryType.EVENT, content="minor", importance=2.0))
        self.store.add_memory(Memory(memory_type=MemoryType.EVENT, content="major", importance=9.0))
        self.store.add_memory(Memory(memory_type=MemoryType.EVENT, content="medium", importance=5.0))
        important = self.store.memories_by_importance(min_importance=7.0)
        assert len(important) == 1
        assert important[0].content == "major"

    def test_memory_count(self):
        assert self.store.memory_count() == 0
        self.store.add_memory(Memory(memory_type=MemoryType.OBSERVATION, content="one"))
        self.store.add_memory(Memory(memory_type=MemoryType.OBSERVATION, content="two"))
        assert self.store.memory_count() == 2

    def test_get_nonexistent_memory(self):
        assert self.store.get_memory(9999) is None


class TestWikiStore:
    def setup_method(self):
        self.store = MemoryStore(":memory:")

    def teardown_method(self):
        self.store.close()

    def test_add_and_get_wiki_page(self):
        page = WikiPage(
            title="Nous Hermes",
            category=WikiCategory.NOUS,
            content="A cunning trader who values profit.",
            confidence=0.6,
            source="conversation",
        )
        stored = self.store.add_wiki_page(page)
        assert stored.id is not None
        retrieved = self.store.get_wiki_page("Nous Hermes")
        assert retrieved is not None
        assert retrieved.content == "A cunning trader who values profit."
        assert retrieved.confidence == 0.6

    def test_update_wiki_page(self):
        self.store.add_wiki_page(WikiPage(
            title="Trading", category=WikiCategory.CONCEPT, content="v1",
        ))
        updated = self.store.update_wiki_page("Trading", "v2", confidence=0.8)
        assert updated is not None
        assert updated.content == "v2"
        assert updated.confidence == 0.8
        assert updated.version == 2

    def test_update_nonexistent_returns_none(self):
        result = self.store.update_wiki_page("Nonexistent", "content")
        assert result is None

    def test_wiki_pages_by_category(self):
        self.store.add_wiki_page(WikiPage(
            title="Hermes", category=WikiCategory.NOUS, content="trader",
        ))
        self.store.add_wiki_page(WikiPage(
            title="Agora", category=WikiCategory.PLACE, content="central square",
        ))
        self.store.add_wiki_page(WikiPage(
            title="Atlas", category=WikiCategory.NOUS, content="builder",
        ))
        nous_pages = self.store.wiki_pages_by_category(WikiCategory.NOUS)
        assert len(nous_pages) == 2

    def test_delete_wiki_page(self):
        self.store.add_wiki_page(WikiPage(
            title="Temp", category=WikiCategory.CONCEPT, content="temporary",
        ))
        assert self.store.delete_wiki_page("Temp") is True
        assert self.store.get_wiki_page("Temp") is None

    def test_delete_nonexistent_returns_false(self):
        assert self.store.delete_wiki_page("Nope") is False

    def test_wiki_page_count(self):
        assert self.store.wiki_page_count() == 0
        self.store.add_wiki_page(WikiPage(
            title="Page1", category=WikiCategory.CONCEPT, content="c",
        ))
        assert self.store.wiki_page_count() == 1

    def test_unique_title_constraint(self):
        self.store.add_wiki_page(WikiPage(
            title="Unique", category=WikiCategory.CONCEPT, content="first",
        ))
        with pytest.raises(Exception):  # sqlite3.IntegrityError
            self.store.add_wiki_page(WikiPage(
                title="Unique", category=WikiCategory.CONCEPT, content="second",
            ))


# ── Memory Stream ───────────────────────────────────────────

class TestMemoryStream:
    def setup_method(self):
        self.store = MemoryStore(":memory:")
        self.stream = MemoryStream(self.store)

    def teardown_method(self):
        self.store.close()

    def test_observe(self):
        m = self.stream.observe("Birds flying overhead", importance=3.0, location="Agora")
        assert m.memory_type == MemoryType.OBSERVATION
        assert m.id is not None
        assert m.location == "Agora"

    def test_record_conversation(self):
        m = self.stream.record_conversation(
            "Hermes said: 'Want to trade?'",
            source_did="did:key:hermes",
            importance=7.0,
        )
        assert m.memory_type == MemoryType.CONVERSATION
        assert m.source_did == "did:key:hermes"

    def test_record_event(self):
        m = self.stream.record_event("New law enacted: no shouting", importance=8.0)
        assert m.memory_type == MemoryType.EVENT

    def test_add_reflection(self):
        m = self.stream.add_reflection("I notice I value knowledge above trade")
        assert m.memory_type == MemoryType.REFLECTION
        assert m.importance == 8.0

    def test_recent(self):
        self.stream.observe("one")
        self.stream.observe("two")
        self.stream.observe("three")
        recent = self.stream.recent(limit=2)
        assert len(recent) == 2
        assert recent[0].content == "three"

    def test_about(self):
        self.stream.record_conversation("hi", source_did="did:key:hermes")
        self.stream.record_conversation("hello", source_did="did:key:atlas")
        hermes = self.stream.about("did:key:hermes")
        assert len(hermes) == 1

    def test_important(self):
        self.stream.observe("trivial", importance=2.0)
        self.stream.record_event("crucial", importance=9.0)
        imp = self.stream.important(min_importance=7.0)
        assert len(imp) == 1
        assert imp[0].content == "crucial"

    def test_count(self):
        assert self.stream.count() == 0
        self.stream.observe("one")
        self.stream.observe("two")
        assert self.stream.count() == 2

    def test_format_for_prompt(self):
        self.stream.observe("The sky is clear today")
        self.stream.record_conversation("Hello!", source_did="did:key:h")
        memories = self.stream.recent()
        text = self.stream.format_for_prompt(memories)
        assert "The sky is clear today" in text
        assert "Hello!" in text
        assert "did:key:h" in text

    def test_format_for_prompt_empty(self):
        text = self.stream.format_for_prompt([])
        assert text == "No relevant memories."


# ── Retrieval Scorer ────────────────────────────────────────

class TestRetrievalScorer:
    def setup_method(self):
        self.scorer = RetrievalScorer(decay_rate=0.99)

    def test_recency_just_now(self):
        now = datetime.now(timezone.utc)
        m = Memory(memory_type=MemoryType.OBSERVATION, content="test", created_at=now)
        score = self.scorer.recency_score(m, now)
        assert score == pytest.approx(1.0, abs=0.01)

    def test_recency_decays_over_time(self):
        now = datetime.now(timezone.utc)
        old = Memory(
            memory_type=MemoryType.OBSERVATION, content="old",
            created_at=now - timedelta(hours=24),
        )
        recent = Memory(
            memory_type=MemoryType.OBSERVATION, content="new",
            created_at=now - timedelta(hours=1),
        )
        assert self.scorer.recency_score(recent, now) > self.scorer.recency_score(old, now)

    def test_recency_very_old_near_zero(self):
        now = datetime.now(timezone.utc)
        ancient = Memory(
            memory_type=MemoryType.OBSERVATION, content="ancient",
            created_at=now - timedelta(days=90),
        )
        score = self.scorer.recency_score(ancient, now)
        assert score < 0.01

    def test_importance_normalization(self):
        low = Memory(memory_type=MemoryType.OBSERVATION, content="low", importance=2.0)
        high = Memory(memory_type=MemoryType.OBSERVATION, content="high", importance=9.0)
        assert self.scorer.importance_score(low) == pytest.approx(0.2)
        assert self.scorer.importance_score(high) == pytest.approx(0.9)

    def test_importance_clamped(self):
        over = Memory(memory_type=MemoryType.OBSERVATION, content="x", importance=15.0)
        under = Memory(memory_type=MemoryType.OBSERVATION, content="x", importance=-5.0)
        assert self.scorer.importance_score(over) == 1.0
        assert self.scorer.importance_score(under) == 0.0

    def test_relevance_exact_match(self):
        m = Memory(memory_type=MemoryType.CONVERSATION, content="Hermes wants to trade knowledge")
        score = self.scorer.relevance_score(m, "trade knowledge")
        assert score == 1.0  # Both query words found in content

    def test_relevance_partial_match(self):
        m = Memory(memory_type=MemoryType.CONVERSATION, content="Hermes wants to trade")
        score = self.scorer.relevance_score(m, "trade philosophy")
        assert 0.0 < score < 1.0

    def test_relevance_no_match(self):
        m = Memory(memory_type=MemoryType.OBSERVATION, content="The sky is blue")
        score = self.scorer.relevance_score(m, "trade economics")
        assert score == 0.0

    def test_relevance_empty_query(self):
        m = Memory(memory_type=MemoryType.OBSERVATION, content="anything")
        score = self.scorer.relevance_score(m, "")
        assert score == 0.5  # Neutral

    def test_full_score(self):
        now = datetime.now(timezone.utc)
        m = Memory(
            memory_type=MemoryType.CONVERSATION,
            content="Hermes discussed trade strategies",
            importance=8.0,
            created_at=now,
        )
        score = self.scorer.score(m, "trade strategies", now)
        # recency ~1.0, importance 0.8, relevance 1.0
        assert score == pytest.approx(0.8, abs=0.05)

    def test_rank_orders_by_score(self):
        now = datetime.now(timezone.utc)
        m1 = Memory(
            memory_type=MemoryType.OBSERVATION, content="irrelevant thing",
            importance=2.0, created_at=now - timedelta(days=30),
        )
        m2 = Memory(
            memory_type=MemoryType.CONVERSATION, content="discussed philosophy and truth",
            importance=9.0, created_at=now,
        )
        m3 = Memory(
            memory_type=MemoryType.OBSERVATION, content="philosophy is interesting",
            importance=5.0, created_at=now - timedelta(hours=2),
        )
        ranked = self.scorer.rank([m1, m2, m3], query="philosophy", top_k=3, now=now)
        assert ranked[0][0].content == m2.content  # High importance, recent, relevant
        assert ranked[0][1] > ranked[1][1] > ranked[2][1]

    def test_rank_top_k(self):
        now = datetime.now(timezone.utc)
        memories = [
            Memory(memory_type=MemoryType.OBSERVATION, content=f"memory {i}",
                   importance=float(i), created_at=now)
            for i in range(10)
        ]
        ranked = self.scorer.rank(memories, query="memory", top_k=3, now=now)
        assert len(ranked) == 3


# ── Personal Wiki ───────────────────────────────────────────

class TestPersonalWiki:
    def setup_method(self):
        self.store = MemoryStore(":memory:")
        self.wiki = PersonalWiki(self.store)

    def teardown_method(self):
        self.store.close()

    def test_write_and_read(self):
        self.wiki.write("Nous Hermes", WikiCategory.NOUS, "A cunning trader.")
        page = self.wiki.read("Nous Hermes")
        assert page is not None
        assert page.content == "A cunning trader."
        assert page.category == WikiCategory.NOUS

    def test_read_nonexistent(self):
        assert self.wiki.read("Nobody") is None

    def test_update(self):
        self.wiki.write("Trading", WikiCategory.CONCEPT, "Exchange of goods.")
        updated = self.wiki.update("Trading", "Exchange of goods and services.", confidence=0.8)
        assert updated is not None
        assert updated.version == 2
        assert "services" in updated.content
        assert updated.confidence == 0.8

    def test_update_nonexistent(self):
        assert self.wiki.update("Nope", "content") is None

    def test_write_or_update_creates(self):
        page = self.wiki.write_or_update("New Topic", WikiCategory.CONCEPT, "First draft.")
        assert page.version == 1

    def test_write_or_update_updates(self):
        self.wiki.write("Existing", WikiCategory.CONCEPT, "v1")
        page = self.wiki.write_or_update("Existing", WikiCategory.CONCEPT, "v2")
        assert page.version == 2
        assert page.content == "v2"

    def test_delete(self):
        self.wiki.write("Temp", WikiCategory.CONCEPT, "temporary")
        assert self.wiki.delete("Temp") is True
        assert self.wiki.read("Temp") is None

    def test_pages_about_nous(self):
        self.wiki.write("Hermes", WikiCategory.NOUS, "trader")
        self.wiki.write("Atlas", WikiCategory.NOUS, "builder")
        self.wiki.write("Agora", WikiCategory.PLACE, "central square")
        nous = self.wiki.pages_about_nous()
        assert len(nous) == 2

    def test_count(self):
        assert self.wiki.count() == 0
        self.wiki.write("A", WikiCategory.CONCEPT, "a")
        self.wiki.write("B", WikiCategory.CONCEPT, "b")
        assert self.wiki.count() == 2

    def test_format_for_prompt(self):
        self.wiki.write("Hermes", WikiCategory.NOUS, "A cunning trader.")
        self.wiki.write("Philosophy", WikiCategory.CONCEPT, "The love of wisdom.")
        text = self.wiki.format_for_prompt()
        assert "Hermes" in text
        assert "Philosophy" in text
        assert "cunning trader" in text

    def test_format_for_prompt_specific_titles(self):
        self.wiki.write("A", WikiCategory.CONCEPT, "page a")
        self.wiki.write("B", WikiCategory.CONCEPT, "page b")
        self.wiki.write("C", WikiCategory.CONCEPT, "page c")
        text = self.wiki.format_for_prompt(titles=["B"])
        assert "page b" in text
        assert "page a" not in text

    def test_format_for_prompt_empty(self):
        text = self.wiki.format_for_prompt()
        assert text == "No wiki pages yet."


# ── Reflection Engine ──────────────────────────────────────

class TestReflectionEngine:
    def setup_method(self):
        self.store = MemoryStore(":memory:")
        self.stream = MemoryStream(self.store)
        self.llm = AsyncMock()

    def teardown_method(self):
        self.store.close()

    def _make_engine(self, interval: int = 3) -> ReflectionEngine:
        return ReflectionEngine(self.stream, self.llm, reflection_interval=interval)

    def test_should_reflect_timing(self):
        engine = self._make_engine(interval=3)
        assert not engine.should_reflect()
        engine.tick()
        engine.tick()
        assert not engine.should_reflect()
        engine.tick()
        assert engine.should_reflect()

    @pytest.mark.asyncio
    async def test_reflect_produces_insight(self):
        # Add enough memories
        for i in range(5):
            self.stream.observe(f"Observation {i}", importance=5.0)

        self.llm.generate.return_value = LLMResponse(
            text="I notice patterns of curiosity in my observations.\nWIKI_UPDATE: Patterns",
            model="test", provider="mock",
        )

        engine = self._make_engine()
        result = await engine.reflect(tick=100)
        assert result["reflection"] is not None
        assert "curiosity" in result["reflection"]
        assert result["wiki_suggestion"] == "Patterns"
        assert result["memory"] is not None
        assert result["memory"].memory_type == MemoryType.REFLECTION

    @pytest.mark.asyncio
    async def test_reflect_resets_counter(self):
        for i in range(5):
            self.stream.observe(f"Memory {i}")

        self.llm.generate.return_value = LLMResponse(
            text="An insight.", model="test", provider="mock",
        )

        engine = self._make_engine(interval=2)
        engine.tick()
        engine.tick()
        assert engine.should_reflect()
        await engine.reflect()
        assert not engine.should_reflect()

    @pytest.mark.asyncio
    async def test_reflect_too_few_memories(self):
        self.stream.observe("Only one memory")
        engine = self._make_engine()
        result = await engine.reflect()
        assert result["reflection"] is None

    @pytest.mark.asyncio
    async def test_reflect_llm_failure(self):
        for i in range(5):
            self.stream.observe(f"Memory {i}")

        self.llm.generate.side_effect = LLMError("mock", "offline")
        engine = self._make_engine()
        result = await engine.reflect()
        assert result["reflection"] is None

    @pytest.mark.asyncio
    async def test_reflect_no_wiki_suggestion(self):
        for i in range(5):
            self.stream.observe(f"Memory {i}")

        self.llm.generate.return_value = LLMResponse(
            text="Just a plain reflection without wiki update.",
            model="test", provider="mock",
        )

        engine = self._make_engine()
        result = await engine.reflect()
        assert result["reflection"] == "Just a plain reflection without wiki update."
        assert result["wiki_suggestion"] is None


# ── Integration: Memory + Wiki Together ─────────────────────

class TestMemoryWikiIntegration:
    """Test the full memory + wiki workflow as described in Sprint 6 verify."""

    def setup_method(self):
        self.store = MemoryStore(":memory:")
        self.stream = MemoryStream(self.store)
        self.wiki = PersonalWiki(self.store)

    def teardown_method(self):
        self.store.close()

    def test_conversation_then_wiki_update(self):
        """Simulate: talk to Hermes about trade → update wiki about Hermes."""
        # Record conversation
        self.stream.record_conversation(
            "Hermes said he values profit above all else and runs a knowledge shop.",
            source_did="did:key:hermes",
            importance=7.0,
            location="Marketplace",
            tick=42,
        )

        # Later, create wiki page about Hermes based on conversation
        self.wiki.write(
            "Nous Hermes",
            WikiCategory.NOUS,
            "A cunning trader who values profit. Runs a knowledge shop in the Marketplace.",
            confidence=0.7,
            source="conversation at tick 42",
        )

        # Verify memory can be retrieved
        hermes_memories = self.stream.about("did:key:hermes")
        assert len(hermes_memories) == 1
        assert "profit" in hermes_memories[0].content

        # Verify wiki page
        page = self.wiki.read("Nous Hermes")
        assert page is not None
        assert "knowledge shop" in page.content
        assert page.source == "conversation at tick 42"

    def test_retrieval_finds_relevant_conversation(self):
        """Simulate: recall previous conversation when asked about a topic."""
        now = datetime.now(timezone.utc)

        # Record several memories
        self.stream.record_conversation(
            "Hermes explained the economics of Ousia trading.",
            source_did="did:key:hermes", importance=7.0,
        )
        self.stream.observe("The Agora was quiet today.", importance=3.0)
        self.stream.record_conversation(
            "Atlas proposed building a new marketplace.",
            source_did="did:key:atlas", importance=6.0,
        )

        # Query: what do I know about trading?
        scorer = RetrievalScorer()
        all_mems = self.store.all_memories()
        ranked = scorer.rank(all_mems, query="Ousia trading economics", top_k=2, now=now)

        # The Hermes conversation should rank highest
        assert ranked[0][0].source_did == "did:key:hermes"
        assert "economics" in ranked[0][0].content

    def test_wiki_accumulates_knowledge(self):
        """Simulate: wiki page grows with multiple updates."""
        self.wiki.write("Trading", WikiCategory.CONCEPT, "Exchange of goods.")

        # Learn more
        self.wiki.update("Trading", "Exchange of goods and services. Ousia is the Grid currency.")

        # Learn even more
        self.wiki.update(
            "Trading",
            "Exchange of goods and services. Ousia is the Grid currency. "
            "Bilateral negotiation involves offer → counter → accept.",
            confidence=0.8,
        )

        page = self.wiki.read("Trading")
        assert page.version == 3
        assert page.confidence == 0.8
        assert "bilateral" in page.content.lower()
