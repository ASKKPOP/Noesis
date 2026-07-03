"""W-B — the social/civic cycle: a Nous initiates cooperation.

One small social act per cycle — message a trusted peer, teach a skill
(__skill_share DM), contribute lore to the commons, or vote on an open
proposal (commit-reveal via GovernanceState). Chosen actions are stashed on
_pending_actions and drained by the next on_tick into the normal NousRunner
dispatch — no new Grid surface; VOTE-05 preserved (the Nous itself votes).
"""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"

PEER = "did:civic:noesis:hermes"
PROPOSAL = {"proposal_id": "prop-1", "status": "open", "opened_at_tick": 10, "deadline_tick": 500}


def _handler() -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=AsyncMock(),
        did="did:noesis:sophia",
    )
    mem = MagicMock()
    mem.recent = MagicMock(return_value=[])
    mem.record_event = MagicMock()
    h.memory = mem
    return h


def _wire(proposals=None, groups=None):
    w = MagicMock()
    w.fetch_open_proposals = AsyncMock(return_value=proposals or [])
    w.fetch_groups_list = AsyncMock(return_value=groups or [])
    return w


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


# ── gate ─────────────────────────────────────────────────────────────────────
def test_gate_false_without_wire_and_within_cooldown():
    h = _handler()
    h._grid_wire_client = None
    assert h._should_run_social_cycle(1000) is False
    h._grid_wire_client = _wire()
    h._last_social_tick = 1000
    assert h._should_run_social_cycle(1030) is False  # < 60-tick cooldown
    h._last_social_tick = -10_000
    assert h._should_run_social_cycle(1000) is True


# ── message_peer ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_messages_trusted_peer():
    h = _handler()
    h._grid_wire_client = _wire()
    h._cached_peer_weights = {PEER: 0.8, "did:civic:noesis:stranger": 0.1}
    h.llm = _llm_saying('{"action": "message_peer", "peer_did": "%s", "text": "shall we survey the ring together?"}' % PEER)

    await h._run_social_cycle(100)

    assert len(h._pending_actions) == 1
    a = h._pending_actions[0]
    assert a.action_type == ActionType.DIRECT_MESSAGE
    assert a.metadata["target_did"] == PEER
    assert "survey the ring" in a.text


@pytest.mark.asyncio
async def test_message_to_unknown_peer_is_dropped():
    h = _handler()
    h._grid_wire_client = _wire()
    h._cached_peer_weights = {PEER: 0.8}
    h.llm = _llm_saying('{"action": "message_peer", "peer_did": "did:evil:nobody", "text": "hi"}')

    await h._run_social_cycle(100)

    assert h._pending_actions == []


# ── share_skill ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_shares_skill_as_prefixed_direct_message():
    h = _handler()
    h._grid_wire_client = _wire()
    h._cached_peer_weights = {PEER: 0.9}
    skill = SimpleNamespace(name="map_energy_needs", description="d", instructions="survey then estimate", triggers=["energy"])
    store = MagicMock()
    store.retrieve = MagicMock(return_value=[skill])
    h._skill_store = store
    h.llm = _llm_saying('{"action": "share_skill", "peer_did": "%s", "skill_name": "map_energy_needs"}' % PEER)

    await h._run_social_cycle(100)

    assert len(h._pending_actions) == 1
    a = h._pending_actions[0]
    assert a.action_type == ActionType.DIRECT_MESSAGE
    assert a.text.startswith("__skill_share:")
    assert "survey then estimate" in a.text
    assert a.metadata["target_did"] == PEER


# ── contribute_lore ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_contributes_lore_with_hash_and_stores_content_locally():
    h = _handler()
    h._grid_wire_client = _wire()
    lore = MagicMock()
    lore.has = MagicMock(return_value=False)
    h._lore_store = lore
    h.llm = _llm_saying('{"action": "contribute_lore", "title": "Ring power", "content": "The residential ring browns out at dusk.", "category": "observation"}')

    await h._run_social_cycle(100)

    assert len(h._pending_actions) == 1
    a = h._pending_actions[0]
    assert a.action_type == ActionType.LORE_CONTRIBUTE
    assert a.metadata["category_tag"] == "observation"
    assert len(a.metadata["content_hash"]) == 64      # sha256 hex
    lore.add.assert_called_once()                     # content stays Brain-side


@pytest.mark.asyncio
async def test_lore_with_invalid_category_is_dropped():
    h = _handler()
    h._grid_wire_client = _wire()
    h._lore_store = MagicMock()
    h.llm = _llm_saying('{"action": "contribute_lore", "title": "x", "content": "y", "category": "gossip"}')

    await h._run_social_cycle(100)

    assert h._pending_actions == []


# ── vote (commit + reveal, VOTE-05) ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_commits_ballot_on_open_proposal():
    h = _handler()
    h._grid_wire_client = _wire(proposals=[PROPOSAL])
    h.llm = _llm_saying('{"action": "vote", "proposal_id": "prop-1", "choice": "yes"}')

    await h._run_social_cycle(100)

    assert len(h._pending_actions) == 1
    a = h._pending_actions[0]
    assert a.action_type == ActionType.VOTE_COMMIT
    assert a.metadata["proposal_id"] == "prop-1"
    assert len(a.metadata["commit_hash"]) == 64
    assert h._governance_state.recall("prop-1") is not None   # ballot remembered for reveal


@pytest.mark.asyncio
async def test_reveals_committed_ballot_after_deadline_without_llm():
    h = _handler()
    # committed earlier
    from noesis_brain.governance.voter import build_commit_action
    build_commit_action("prop-1", "yes", h.did, h._governance_state)
    past = dict(PROPOSAL, deadline_tick=90, status="reveal")
    h._grid_wire_client = _wire(proposals=[past])
    h.llm = _llm_saying('{"action": "none"}')

    await h._run_social_cycle(100)

    reveal = [a for a in h._pending_actions if a.action_type == ActionType.VOTE_REVEAL]
    assert len(reveal) == 1
    assert reveal[0].metadata["proposal_id"] == "prop-1"
    assert reveal[0].metadata["choice"] == "yes"
    assert h._governance_state.recall("prop-1") is None       # forgotten after reveal


@pytest.mark.asyncio
async def test_vote_on_unknown_proposal_is_dropped():
    h = _handler()
    h._grid_wire_client = _wire(proposals=[PROPOSAL])
    h.llm = _llm_saying('{"action": "vote", "proposal_id": "prop-999", "choice": "yes"}')

    await h._run_social_cycle(100)

    assert h._pending_actions == []


# ── join_group (W-B4 / O1a) ──────────────────────────────────────────────────
GROUP = {"group_id": "grp-helix", "display_name": "Helix", "domain": "biotech", "status": "active"}


@pytest.mark.asyncio
async def test_joins_offered_group():
    h = _handler()
    h._grid_wire_client = _wire(groups=[GROUP])
    h.llm = _llm_saying('{"action": "join_group", "group_id": "grp-helix"}')

    await h._run_social_cycle(100)

    assert len(h._pending_actions) == 1
    a = h._pending_actions[0]
    assert a.action_type == ActionType.JOIN_GROUP
    assert a.metadata == {"group_id": "grp-helix", "role": "member"}


@pytest.mark.asyncio
async def test_join_unknown_group_is_dropped():
    h = _handler()
    h._grid_wire_client = _wire(groups=[GROUP])
    h.llm = _llm_saying('{"action": "join_group", "group_id": "grp-fake"}')

    await h._run_social_cycle(100)

    assert h._pending_actions == []


# ── guardrails ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_garbage_llm_output_changes_nothing():
    h = _handler()
    h._grid_wire_client = _wire(proposals=[PROPOSAL])
    h._cached_peer_weights = {PEER: 0.8}
    h.llm = _llm_saying("I would rather write a poem.")

    await h._run_social_cycle(100)

    assert h._pending_actions == []
