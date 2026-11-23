"""Property tests for the social cycle's trusted-peer list (P-SOCIAL-01..04).

Generated inputs only. The same IDs mark the Lean theorems in
verification/lean/Verification/SocialPeers.lean and the TLA+ invariant in
verification/tla/SocialPeers.tla; this file is the leg that runs the real code.

Seed: set PBT_SEED to repeat a run; it is printed in the test header either way.
Cases per property: PBT_CASES (default 1000).
"""
from __future__ import annotations

import asyncio
import json
import os
import random
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml
from hypothesis import HealthCheck, given, seed, settings
from hypothesis import strategies as st

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.social_logic import MAX_PEERS, TRUST_WEIGHT, trusted_peers
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SEED = int(os.environ.get("PBT_SEED") or random.SystemRandom().randrange(2**32))
CASES = int(os.environ.get("PBT_CASES") or 1000)
SELF = "did:noesis:sophia"

pbt = settings(
    max_examples=CASES, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow],
)


@pytest.fixture(scope="module", autouse=True)
def _print_seed(pytestconfig):
    pytestconfig.get_terminal_writer().line(f"\n[pbt] social peers: seed={SEED} cases={CASES}")


# ── generators ───────────────────────────────────────────────────────────────
# A small pool makes duplicates, self-references and one DID in several sources
# common; free text and non-strings stand for a hostile or broken Grid answer.
POOL = [SELF] + [f"did:noesis:n{i}" for i in range(6)]
@st.composite
def _mostly(draw, good, bad, n: int = 4):
    """`good` n times in n+1 — hostile values stay present without drowning the valid ones.
    (Repeating a strategy inside `st.one_of` does not weight it.)"""
    return draw(good) if draw(st.integers(0, n)) else draw(bad)


junk = st.one_of(st.none(), st.integers(), st.booleans(), st.floats(allow_nan=True), st.text(max_size=6))
dids = _mostly(st.sampled_from(POOL), st.text(max_size=12))
buckets = _mostly(st.sampled_from(["hot", "warm", "cold"]), junk)
weight_values = st.one_of(
    st.sampled_from([0.0, 0.29999, TRUST_WEIGHT, 0.30001, 1.0, -1.0, float("inf"), float("-inf"), float("nan")]),
    st.floats(allow_nan=True, allow_infinity=True),
)
# A live mind usually holds no numeric weights at all; when the weighted peers
# fill the list the ties never matter, so keep that case from dominating.
weights_st = st.one_of(
    st.just({}),
    st.dictionaries(dids, weight_values, max_size=1),
    st.dictionaries(dids, weight_values, max_size=2),
    st.dictionaries(dids, weight_values, max_size=6),
)
tie_st = _mostly(
    st.fixed_dictionaries({"counterparty_did": _mostly(dids, junk), "warmth_bucket": buckets}),
    st.one_of(
        st.fixed_dictionaries({"warmth_bucket": buckets}),            # no DID
        st.fixed_dictionaries({"counterparty_did": dids}),            # no bucket
        junk, st.lists(junk, max_size=2),                             # not a tie at all
    ),
)
ties_st = _mostly(
    st.lists(tie_st, max_size=14),
    st.one_of(junk, st.dictionaries(st.text(max_size=3), junk, max_size=2)),   # not a list at all
    n=9,
)


def _sources(weights, ties):
    """The three trusted sources, read straight off the inputs (the oracle)."""
    weighted = {d for d, w in weights.items() if isinstance(d, str) and w >= TRUST_WEIGHT}
    hot, warm = set(), set()
    if isinstance(ties, list):
        for t in ties:
            if isinstance(t, dict) and isinstance(t.get("counterparty_did"), str):
                if t.get("warmth_bucket") == "hot":
                    hot.add(t["counterparty_did"])
                elif t.get("warmth_bucket") == "warm":
                    warm.add(t["counterparty_did"])
    return weighted, hot, warm


# ── P-SOCIAL-01 ──────────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(weights=weights_st, ties=ties_st)
def test_p_social_01_only_trusted_others(weights, ties):
    """P-SOCIAL-01: a trusted peer is another Nous whose tie is hot or warm, or
    whose known weight is at least 0.3 — never cold, unknown, or the mind itself."""
    weighted, hot, warm = _sources(weights, ties)
    for peer in trusted_peers(weights, ties, SELF):
        assert isinstance(peer, str)
        assert peer != SELF
        assert peer in weighted | hot | warm


# ── P-SOCIAL-02 ──────────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(weights=weights_st, ties=ties_st)
def test_p_social_02_at_most_three_no_repeats(weights, ties):
    """P-SOCIAL-02: the list has at most three entries and none twice."""
    peers = trusted_peers(weights, ties, SELF)
    assert len(peers) <= MAX_PEERS == 3
    assert len(set(peers)) == len(peers)


# ── P-SOCIAL-03 ──────────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(weights=weights_st, ties=ties_st)
def test_p_social_03_earlier_sources_first(weights, ties):
    """P-SOCIAL-03: a peer from a later source (weight, then hot, then warm) is
    listed only if every peer from the earlier sources is listed."""
    weighted, hot, warm = _sources(weights, ties)
    weighted, hot = weighted - {SELF}, hot - {SELF}
    peers = set(trusted_peers(weights, ties, SELF))
    if peers - weighted:                 # something beyond the weighted peers made it
        assert weighted <= peers
    if peers - weighted - hot:           # a warm-only tie made it
        assert hot <= peers
    # And nothing eligible is left out while there is room.
    if len(peers) < MAX_PEERS:
        assert peers == (weighted | hot | warm) - {SELF}


# ── P-SOCIAL-04 ──────────────────────────────────────────────────────────────
_SOPHIA = yaml.safe_load((Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml").read_text())


def _handler(llm_text: str) -> BrainHandler:
    h = BrainHandler(
        psyche=load_psyche(data=_SOPHIA),
        thymos=ThymosTracker.from_yaml(_SOPHIA.get("thymos", {})),
        telos=TelosManager.from_yaml(_SOPHIA.get("telos", {})),
        llm=AsyncMock(),
        did=SELF,
    )
    h.memory = MagicMock()
    h.memory.recent = MagicMock(return_value=[])
    h.llm.generate = AsyncMock(return_value=LLMResponse(text=llm_text, model="m", provider="mock", usage={}))
    skill = MagicMock(description="d", instructions="i", triggers=[])
    skill.name = "s"
    h._skill_store = MagicMock()
    h._skill_store.retrieve = MagicMock(return_value=[skill])
    return h


answers = st.fixed_dictionaries({
    "action": st.sampled_from(["message_peer", "share_skill"]),
    "peer_did": st.one_of(dids, st.none(), st.integers(), st.lists(dids, max_size=2)),
    "text": st.one_of(st.text(max_size=20), st.just("hello")),
    "skill_name": st.sampled_from(["s", "other"]),
})
fetches = st.one_of(ties_st, st.just("raise"))


@seed(SEED)
@pbt
@given(weights=weights_st, ties=fetches, answer=answers)
def test_p_social_04_messages_only_to_listed_peers(weights, ties, answer):
    """P-SOCIAL-04: whatever DID the model names, the social cycle queues a
    message or a taught skill only to a peer on the list it built in that cycle.
    The Grid read may return anything, or fail."""
    h = _handler(json.dumps(answer))
    wire = MagicMock()
    wire.fetch_open_proposals = AsyncMock(return_value=[])
    wire.fetch_groups_list = AsyncMock(return_value=[])
    if ties == "raise":
        wire.fetch_relationships = AsyncMock(side_effect=RuntimeError("grid down"))
        seen = []
    else:
        wire.fetch_relationships = AsyncMock(return_value=ties)
        seen = ties
    h._grid_wire_client = wire
    h._cached_peer_weights = dict(weights)

    asyncio.run(h._run_social_cycle(100))

    listed = trusted_peers(weights, seen, SELF)
    sent = [a for a in h._pending_actions if a.action_type == ActionType.DIRECT_MESSAGE]
    assert len(sent) <= 1
    for a in sent:
        assert a.metadata["target_did"] in listed
        assert a.metadata["target_did"] != SELF
    if not listed:
        assert sent == []
