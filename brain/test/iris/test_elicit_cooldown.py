"""Test IRIS_ELICIT_COOLDOWN=20: 50 ticks same peer → at most ceil(50/20)=3 LLM calls.

Phase 17 Wave 4 — IRIS-TEST-01.
"""
from unittest.mock import MagicMock

from noesis_brain.iris.elicit import IrisRuntime, IRIS_ELICIT_COOLDOWN
from noesis_brain.iris.store import IrisStore


NOUS_DID = "did:noesis:alpha"
TARGET_DID = "did:noesis:beta"
JSON_RESPONSE = '{"dimension": "belief", "content": "test belief", "confidence": 0.7}'


def make_runtime():
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    mock_llm = MagicMock()
    mock_llm.complete.return_value = JSON_RESPONSE
    return IrisRuntime(store, mock_llm), mock_llm


def test_cooldown_50_ticks_at_most_3_llm_calls():
    """50 consecutive ticks → exactly 3 elicit calls (ticks 0, 20, 40)."""
    runtime, mock_llm = make_runtime()
    for tick in range(50):
        runtime.elicit(nous_did=NOUS_DID, target_did=TARGET_DID, context={}, tick=tick)
    assert mock_llm.complete.call_count <= 3, (
        f"Expected ≤3 LLM calls (cooldown={IRIS_ELICIT_COOLDOWN}), "
        f"got {mock_llm.complete.call_count}"
    )


def test_cooldown_exact_fire_ticks():
    """Ticks 0, 20, 40 each fire LLM; ticks 1-19, 21-39, 41-49 do not."""
    runtime, mock_llm = make_runtime()
    for tick in range(50):
        runtime.elicit(nous_did=NOUS_DID, target_did=TARGET_DID, context={}, tick=tick)
    # Ticks 0, 20, 40 → exactly 3 calls
    assert mock_llm.complete.call_count == 3, (
        f"Expected exactly 3 LLM calls at ticks 0, 20, 40 (cooldown={IRIS_ELICIT_COOLDOWN}), "
        f"got {mock_llm.complete.call_count}"
    )


def test_cooldown_first_tick_always_fires():
    """Tick 0 must fire immediately (no prior last_tick)."""
    runtime, mock_llm = make_runtime()
    runtime.elicit(nous_did=NOUS_DID, target_did=TARGET_DID, context={}, tick=0)
    assert mock_llm.complete.call_count == 1


def test_cooldown_does_not_block_different_peers():
    """Cooldown is per (nous_did, target_did) pair — different peers fire independently."""
    runtime, mock_llm = make_runtime()
    other_did = "did:noesis:gamma"
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    runtime.elicit(NOUS_DID, other_did, {}, tick=1)
    assert mock_llm.complete.call_count == 2  # both fire


def test_cooldown_tick_boundary_exact():
    """Tick N fires at 0; tick N+19 does NOT fire; tick N+20 DOES fire."""
    runtime, mock_llm = make_runtime()
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=5)
    assert mock_llm.complete.call_count == 1
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=24)  # delta=19 < 20
    assert mock_llm.complete.call_count == 1, "tick 24 should NOT fire (delta=19)"
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=25)  # delta=20 == cooldown
    assert mock_llm.complete.call_count == 2, "tick 25 SHOULD fire (delta=20)"
