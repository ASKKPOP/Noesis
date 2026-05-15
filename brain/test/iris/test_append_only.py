"""Test IrisStore append-only: 20 beliefs for same (target, dim) → 10 active, 10 superseded, 20 total.

Phase 17 Wave 4 — IRIS-TEST-03.

IrisStore.add_belief() enforces the cap automatically via _enforce_cap().
This test verifies:
  - Total rows = 20 (no deletions — append-only discipline)
  - Active rows ≤ IRIS_BELIEFS_CAP = 10
  - Superseded rows ≥ 10 (cap eviction uses superseded_by FK only)
"""
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.types import Belief
from noesis_brain.iris.config import IRIS_BELIEFS_CAP


NOUS_DID = "did:noesis:alpha"
TARGET_DID = "did:noesis:beta"


def make_belief(content: str, confidence: float, tick: int) -> Belief:
    return Belief(
        id=None,
        nous_did=NOUS_DID,
        target_did=TARGET_DID,
        dimension="belief",
        content=content,
        confidence=confidence,
        superseded_by=None,
        created_tick=tick,
        source_event_hash=None,
    )


def test_append_only_20_beliefs_cap():
    """20 adds for same (target, dimension) → cap=10 active, ≥10 superseded, 20 total rows."""
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)

    for i in range(20):
        belief = make_belief(
            content=f"belief content {i} unique text so hashes differ",
            confidence=0.5 + (i % 5) * 0.05,  # vary confidence slightly
            tick=i,
        )
        store.add_belief(belief, tick=i)

    # Active count must be at most IRIS_BELIEFS_CAP
    active = store.get_beliefs(TARGET_DID, dimension="belief", k=200, active_only=True)
    # Total count must be 20 (no deletions)
    all_beliefs = store.get_beliefs(TARGET_DID, dimension="belief", k=200, active_only=False)

    assert len(all_beliefs) == 20, (
        f"Expected 20 total rows (append-only — no deletes), got {len(all_beliefs)}"
    )
    assert len(active) <= IRIS_BELIEFS_CAP, (
        f"Expected ≤{IRIS_BELIEFS_CAP} active beliefs (cap enforcement), got {len(active)}"
    )
    superseded = [b for b in all_beliefs if b.superseded_by is not None]
    assert len(superseded) >= 10, (
        f"Expected ≥10 superseded beliefs (cap eviction), got {len(superseded)}"
    )


def test_no_delete_rows():
    """add_belief() never deletes rows — only superseded_by FK is set."""
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    ids = []
    for i in range(5):
        b = make_belief(content=f"content {i}", confidence=0.5, tick=i)
        ids.append(store.add_belief(b, tick=i))
    # Explicitly supersede id[0] → id[1]
    store.supersede(old_id=ids[0], new_id=ids[1])
    # All 5 rows must still exist
    all_beliefs = store.get_beliefs(TARGET_DID, dimension="belief", k=100, active_only=False)
    assert len(all_beliefs) == 5, "Supersede must not delete rows"


def test_supersede_marks_old_as_inactive():
    """After supersede(), the old belief appears in active_only=False but not active_only=True."""
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    old_b = make_belief("old content", 0.8, tick=0)
    old_id = store.add_belief(old_b, tick=0)
    new_b = make_belief("new content", 0.9, tick=1)
    new_id = store.add_belief(new_b, tick=1)

    # Before supersede: both are active
    active = store.get_beliefs(TARGET_DID, k=100, active_only=True)
    assert len(active) == 2

    store.supersede(old_id=old_id, new_id=new_id)

    active_after = store.get_beliefs(TARGET_DID, k=100, active_only=True)
    all_after = store.get_beliefs(TARGET_DID, k=100, active_only=False)

    assert len(all_after) == 2, "Both rows must still exist (no delete)"
    assert len(active_after) == 1, "Only new belief should be active after supersede"


def test_10_active_after_20_inserts():
    """After 20 inserts, active count is exactly IRIS_BELIEFS_CAP."""
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    for i in range(20):
        b = make_belief(
            content=f"unique content {i}",
            confidence=float(i) / 20.0,
            tick=i,
        )
        store.add_belief(b, tick=i)

    active = store.get_beliefs(TARGET_DID, dimension="belief", k=200, active_only=True)
    assert len(active) == IRIS_BELIEFS_CAP, (
        f"Expected exactly {IRIS_BELIEFS_CAP} active beliefs after 20 inserts, got {len(active)}"
    )
