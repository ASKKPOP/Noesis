"""Shared dialogue_context fixture factories for Phase 7 Brain tests.

Used by test_telos_refined_action.py and test_dialogue_context_consumption.py.
Deterministic by design so D-23 zero-diff invariant can lean on them.

Module colocated under ``brain/test/`` (the project's actual test root per
pyproject.toml ``testpaths = ["test"]``) rather than the plan's nominal
``brain/tests/fixtures/`` — the directory did not exist and the existing test
layout is flat with local helpers. Deviation documented in 07-02-SUMMARY.md.
"""
from __future__ import annotations

from typing import Any


def make_dialogue_context(
    *,
    dialogue_id: str = "a1b2c3d4e5f60718",  # 16-hex
    counterparty_did: str = "did:noesis:beta",
    channel: str = "agora",
    exchange_count: int = 2,
    window_start_tick: int = 10,
    window_end_tick: int = 15,
    utterances: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Produce a well-formed dialogue_context dict for Brain on_tick tests.

    Default utterances substring-match the goal 'Survive the day' so the
    minimal heuristic in _build_refined_telos fires. Override `utterances`
    to test the silent/no-match branch.
    """
    if utterances is None:
        utterances = [
            {
                "tick": 10,
                "speaker_did": "did:noesis:alpha",
                "speaker_name": "Alpha",
                "text": "we should focus on how to survive the day together",
            },
            {
                "tick": 12,
                "speaker_did": "did:noesis:beta",
                "speaker_name": "Beta",
                "text": "agreed — survive the day is the priority",
            },
        ]
    return {
        "dialogue_id": dialogue_id,
        "counterparty_did": counterparty_did,
        "channel": channel,
        "exchange_count": exchange_count,
        "window_start_tick": window_start_tick,
        "window_end_tick": window_end_tick,
        "utterances": utterances,
    }


def make_dialogue_context_no_match() -> dict[str, Any]:
    """Dialogue on an unrelated topic — should NOT trigger refinement."""
    return make_dialogue_context(
        utterances=[
            {
                "tick": 10,
                "speaker_did": "did:noesis:alpha",
                "speaker_name": "Alpha",
                "text": "the weather is nice today",
            },
            {
                "tick": 12,
                "speaker_did": "did:noesis:beta",
                "speaker_name": "Beta",
                "text": "yes very mild and sunny",
            },
        ],
    )
