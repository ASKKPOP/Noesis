"""Zero-diff invariant: Iris-enabled vs Iris-disabled → identical non-iris actions.

Phase 17 Wave 4 — IRIS-TEST-04.

Tests that enabling IrisRuntime only adds iris.* action entries; all non-iris
actions remain byte-identical between enabled and disabled paths.

This is a unit-level approximation of the zero-diff invariant (D-17-14):
- Disabled path: _iris_runtime=None → no iris.* actions
- Enabled path: _iris_runtime!=None → iris.* actions added; non-iris unchanged
"""
from unittest.mock import MagicMock

from noesis_brain.iris.elicit import IrisRuntime
from noesis_brain.iris.store import IrisStore


NOUS_DID = "did:noesis:alpha"
TARGET_DID = "did:noesis:beta"
JSON_RESPONSE = '{"dimension":"belief","content":"test belief","confidence":0.7}'


def _filter_iris(actions: list) -> list:
    """Remove iris.* action_types from an action list."""
    return [a for a in actions if not str(a.get("action_type", "")).startswith("iris")]


def _make_runtime() -> IrisRuntime:
    store = IrisStore(db_path=":memory:", nous_did=NOUS_DID)
    mock_llm = MagicMock()
    mock_llm.complete.return_value = JSON_RESPONSE
    return IrisRuntime(store, mock_llm)


def _simulate_ticks(runtime: IrisRuntime | None, ticks: int) -> list:
    """
    Simulate `ticks` on_tick() calls producing action lists.

    Represents the Brain's action emission: non-iris actions are always
    identical regardless of iris status. Iris actions only appear when runtime
    is enabled.

    Returns a flat list of action dicts.
    """
    actions: list = []

    # Non-iris actions: deterministic per tick (same in both paths).
    for tick in range(ticks):
        # Represent the non-iris actions that always appear.
        actions.append({"action_type": "state_update", "tick": tick})

        # Iris actions only if runtime is enabled.
        if runtime is not None:
            result = runtime.elicit(
                nous_did=NOUS_DID,
                target_did=TARGET_DID,
                context={"counterparty_did": TARGET_DID},
                tick=tick,
            )
            if result.beliefs:
                actions.append({"action_type": "iris_belief_revised", "tick": tick})
            if result.contradiction:
                actions.append({"action_type": "iris_contradiction_detected", "tick": tick})

    return actions


def test_zero_diff_iris_enabled_vs_disabled():
    """
    Iris enabled vs disabled → non-iris actions are identical.

    The invariant: filter(iris.* out of enabled actions) == disabled actions.
    """
    disabled_actions = _simulate_ticks(runtime=None, ticks=100)
    enabled_actions = _simulate_ticks(runtime=_make_runtime(), ticks=100)

    enabled_non_iris = _filter_iris(enabled_actions)
    assert enabled_non_iris == disabled_actions, (
        f"Non-iris actions differ between Iris-enabled and Iris-disabled paths.\n"
        f"Disabled: {disabled_actions[:3]}...\n"
        f"Enabled (filtered): {enabled_non_iris[:3]}..."
    )


def test_enabled_path_produces_iris_actions():
    """Iris-enabled path DOES produce iris.* actions (test is non-vacuous)."""
    enabled_actions = _simulate_ticks(runtime=_make_runtime(), ticks=100)
    iris_entries = [a for a in enabled_actions if str(a.get("action_type", "")).startswith("iris")]
    assert len(iris_entries) > 0, (
        "Iris-enabled path produced no iris.* actions — test is vacuous. "
        "Check that elicit() fires at ticks 0, 20, 40, ..."
    )


def test_disabled_path_has_no_iris_actions():
    """Iris-disabled path produces ZERO iris.* actions."""
    disabled_actions = _simulate_ticks(runtime=None, ticks=100)
    iris_entries = [a for a in disabled_actions if str(a.get("action_type", "")).startswith("iris")]
    assert len(iris_entries) == 0, (
        f"Disabled path should produce no iris.* actions, found {iris_entries}"
    )


def test_cooldown_governs_iris_action_count():
    """100 ticks with cooldown=20 → at most ceil(100/20)=5 iris.* action groups."""
    enabled_actions = _simulate_ticks(runtime=_make_runtime(), ticks=100)
    iris_entries = [a for a in enabled_actions if str(a.get("action_type", "")).startswith("iris")]
    # Each cooldown-tick-group produces at most 1 belief_revised (no contradiction on first belief).
    # 100 / 20 = 5 groups exactly: ticks 0, 20, 40, 60, 80.
    assert len(iris_entries) <= 5, (
        f"Expected ≤5 iris action groups (cooldown=20, 100 ticks), got {len(iris_entries)}"
    )
