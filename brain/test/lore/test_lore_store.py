"""Unit tests for LoreStore (Phase 20 LORE-01)."""
import sqlite3
import pytest
from noesis_brain.lore.store import LoreStore
from noesis_brain.lore.types import LoreEntry


@pytest.fixture
def store():
    conn = sqlite3.connect(":memory:")
    return LoreStore(conn, capacity=5)


def _make_entry(n: int, tick: int = 1) -> LoreEntry:
    content = f"content of entry {n}"
    import hashlib
    h = hashlib.sha256(content.encode()).hexdigest()
    return LoreEntry(
        content_hash=h,
        contributor_did=f"did:noesis:nous-{n}",
        category_tag="observation",
        title=f"Entry {n}",
        content=content,
        received_tick=tick,
    )


def test_add_and_has(store):
    entry = _make_entry(1)
    assert not store.has(entry.content_hash)
    store.add(entry)
    assert store.has(entry.content_hash)


def test_count(store):
    assert store.count() == 0
    store.add(_make_entry(1))
    assert store.count() == 1


def test_add_idempotent(store):
    entry = _make_entry(1)
    store.add(entry)
    store.add(entry)
    assert store.count() == 1


def test_eviction_fifo(store):
    """Adding capacity+1 entries should evict the oldest by received_tick."""
    for i in range(5):
        store.add(_make_entry(i, tick=i + 1))
    assert store.count() == 5
    # Add one more — should evict tick=1 (entry 0)
    extra = _make_entry(99, tick=100)
    store.add(extra)
    assert store.count() == 5
    oldest = _make_entry(0, tick=1)
    assert not store.has(oldest.content_hash)
    assert store.has(extra.content_hash)


def test_retrieve_empty_query_returns_empty(store):
    store.add(_make_entry(1))
    assert store.retrieve("") == []


def test_retrieve_fts5(store):
    import hashlib
    content = "the quick brown fox jumps over the lazy dog"
    h = hashlib.sha256(content.encode()).hexdigest()
    entry = LoreEntry(
        content_hash=h,
        contributor_did="did:noesis:author",
        category_tag="observation",
        title="Fox Story",
        content=content,
        received_tick=1,
    )
    store.add(entry)
    results = store.retrieve("quick fox", k=3)
    assert len(results) >= 1
    assert results[0].content_hash == h


def test_retrieve_miss(store):
    results = store.retrieve("zzz_no_match_ever", k=3)
    assert results == []


def test_retrieve_by_hash_present(store):
    entry = _make_entry(42, tick=5)
    store.add(entry)
    result = store.retrieve_by_hash(entry.content_hash)
    assert result is not None
    assert result.content_hash == entry.content_hash
    assert result.contributor_did == entry.contributor_did


def test_retrieve_by_hash_absent(store):
    result = store.retrieve_by_hash("0" * 64)
    assert result is None


def test_lore_categories_frozenset():
    from noesis_brain.lore.types import LORE_CATEGORIES
    assert isinstance(LORE_CATEGORIES, frozenset)
    assert "observation" in LORE_CATEGORIES
    assert "synthesis" in LORE_CATEGORIES
    assert "historical" in LORE_CATEGORIES
    assert "cultural" in LORE_CATEGORIES
    assert len(LORE_CATEGORIES) == 4
