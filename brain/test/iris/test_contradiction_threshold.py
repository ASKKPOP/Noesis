"""Test IRIS_CONTRADICTION_THRESHOLD=0.3: small confidence delta → no contradiction.

Phase 17 Wave 4 — IRIS-TEST-02.
"""
import json
from unittest.mock import MagicMock

from noesis_brain.iris.elicit import IrisRuntime, IRIS_CONTRADICTION_THRESHOLD
from noesis_brain.iris.store import IrisStore


NOUS_DID = "did:noesis:alpha"
TARGET_DID = "did:noesis:beta"


def _resp(confidence: float) -> str:
    return json.dumps({
        "dimension": "belief",
        "content": "a test belief about the peer",
        "confidence": confidence,
    })


def make_runtime(responses: list) -> IrisRuntime:
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    mock_llm = MagicMock()
    mock_llm.complete.side_effect = responses
    return IrisRuntime(store, mock_llm)


def test_near_identical_no_contradiction():
    """Delta 0.05 < 0.3 threshold → result.contradiction is False."""
    runtime = make_runtime([_resp(0.7), _resp(0.65)])
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=20)
    assert not result.contradiction, (
        f"Delta 0.05 should NOT trigger contradiction (threshold={IRIS_CONTRADICTION_THRESHOLD})"
    )


def test_large_delta_triggers_contradiction():
    """Delta 0.7 > 0.3 threshold → result.contradiction is True."""
    runtime = make_runtime([_resp(0.8), _resp(0.1)])
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=20)
    assert result.contradiction, "Delta 0.7 should trigger contradiction"


def test_first_belief_never_contradicts():
    """No prior belief → contradiction is always False."""
    runtime = make_runtime([_resp(0.9)])
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    assert not result.contradiction, "First belief cannot contradict (no prior)"


def test_threshold_boundary_below():
    """Delta exactly = 0.3 does NOT trigger contradiction (> not >=)."""
    runtime = make_runtime([_resp(0.7), _resp(0.4)])  # delta = 0.3 exactly
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=20)
    # delta == 0.3 is NOT strictly > 0.3
    assert not result.contradiction, (
        "Delta exactly 0.3 should NOT trigger contradiction (threshold is strictly >)"
    )


def test_threshold_boundary_above():
    """Delta 0.31 > 0.3 → triggers contradiction."""
    runtime = make_runtime([_resp(0.7), _resp(0.39)])  # delta ≈ 0.31
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=20)
    assert result.contradiction, "Delta 0.31 should trigger contradiction"


def test_contradiction_result_has_hashes():
    """When contradiction fires, result carries non-empty new_hash and prior_hash."""
    runtime = make_runtime([_resp(0.9), _resp(0.1)])
    runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=0)
    result = runtime.elicit(NOUS_DID, TARGET_DID, {}, tick=20)
    assert result.contradiction
    assert result.new_hash, "new_hash must be non-empty on contradiction"
    assert result.prior_hash, "prior_hash must be non-empty on contradiction"
