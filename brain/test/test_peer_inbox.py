"""A direct message from one Nous reaches another Nous's Brain.

One Brain's social cycle queues a DIRECT_MESSAGE; the Grid puts it in the
target's inbox (checked on the Grid side by
grid/test/integration/peer-message-contract.test.ts against the same fixture);
the target's Brain reads its inbox, claims the message, and hands it to
on_message.
"""
from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from noesis_brain.llm.types import LLMResponse
from noesis_brain.lore.store import LoreStore
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.peer_inbox import (
    PEER_MESSAGE_MAX_CHARS, SYSTEM_SENDER_CIVIC_DID, message_id, parse_peer_message,
)
from noesis_brain.rpc.types import ActionType

from test.peer_inbox_support import CONTRACT, FakeGrid, make_handler, to_inbox_message

SOPHIA = "did:noesis:sophia"
HERMES = "did:noesis:hermes"
THEMIS = "did:noesis:themis"


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


def _spy_on_message(handler):
    calls: list[dict] = []
    inner = handler.on_message

    async def spy(params):
        calls.append(dict(params))
        return await inner(params)

    handler.on_message = spy
    return calls


async def _send_from_social_cycle(grid: FakeGrid, sender, llm_answer: str, tick: int) -> list[dict]:
    """Run the sender's social cycle, then post what it queued the way on_tick does."""
    sender.llm = _llm_saying(llm_answer)
    await sender._run_social_cycle(tick)
    actions = [a.to_dict() for a in sender._pending_actions]
    sender._pending_actions.clear()
    await sender._grid_wire_client.post_actions(actions, tick=tick)
    return actions


# ── the whole path ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_message_from_one_social_cycle_arrives_in_the_other_brains_on_message():
    contract = json.loads(CONTRACT.read_text())
    grid = FakeGrid()
    sophia, hermes, themis = make_handler(SOPHIA), make_handler(HERMES), make_handler(THEMIS)
    sophia._grid_wire_client = grid.wire(SOPHIA, "Sophia")
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    themis._grid_wire_client = grid.wire(THEMIS, "Themis")
    sophia._cached_peer_weights = {HERMES: 0.8}
    heard_by_hermes, heard_by_themis = _spy_on_message(hermes), _spy_on_message(themis)

    actions = await _send_from_social_cycle(
        grid, sophia,
        '{"action": "message_peer", "peer_did": "%s", "text": "%s"}' % (HERMES, contract["action"]["text"]),
        contract["tick"],
    )

    # The Brain produced exactly the action the Grid's test starts from, and the
    # stand-in stored exactly what the Grid's test ends with.
    assert actions == [contract["action"]]
    assert grid.rows[0]["message"] == contract["inbox_message"]
    assert to_inbox_message(contract["action"], SOPHIA, "Sophia", contract["tick"]) == contract["inbox_message"]

    await themis._run_peer_inbox_cycle(101)
    await hermes._run_peer_inbox_cycle(101)

    assert heard_by_themis == []
    assert heard_by_hermes == [{
        "sender_name": "Sophia", "sender_did": SOPHIA, "channel": "direct",
        "text": contract["action"]["text"], "tick": 101, "via": "peer_inbox",
    }]
    # Heard and remembered; not answered in public, and nothing sent back.
    remembered = hermes.memory.record_event.call_args.kwargs
    assert contract["action"]["text"] in remembered["content"] and remembered["source_did"] == SOPHIA
    hermes.llm.generate.assert_not_called()
    assert [p for p in grid.posted if p[0] == HERMES] == []
    # Claimed: the Grid no longer holds the text, and a second cycle hears nothing new.
    assert grid.rows[0]["state"] == "delivered" and grid.rows[0]["message"] == {}
    await hermes._run_peer_inbox_cycle(102)
    assert len(heard_by_hermes) == 1


@pytest.mark.asyncio
async def test_taught_skill_reaches_the_peer_and_is_quarantined_when_the_sender_is_trusted(tmp_path):
    grid = FakeGrid()
    sophia = make_handler(SOPHIA)
    hermes = make_handler(HERMES, memory=MemoryStore(":memory:"), hypnos_db_dir=tmp_path)
    sophia._grid_wire_client, hermes._grid_wire_client = grid.wire(SOPHIA, "Sophia"), grid.wire(HERMES, "Hermes")
    sophia._cached_peer_weights = {HERMES: 0.9}
    hermes._cached_peer_weights = {SOPHIA: 0.9}
    skill = SimpleNamespace(name="map_energy_needs", description="d", instructions="survey then estimate", triggers=["energy"])
    sophia._skill_store = MagicMock(retrieve=MagicMock(return_value=[skill]))

    await _send_from_social_cycle(
        grid, sophia, '{"action": "share_skill", "peer_did": "%s", "skill_name": "map_energy_needs"}' % HERMES, 100,
    )
    await hermes._run_peer_inbox_cycle(101)

    rows = hermes.memory._conn.execute("SELECT * FROM skills_quarantine").fetchall()
    assert len(rows) == 1
    assert [p for p in grid.posted if p[0] == HERMES] == []


@pytest.mark.asyncio
async def test_taught_skill_from_a_peer_the_brain_holds_no_weight_for_is_rejected(tmp_path):
    """Today nothing gives a live-wired Brain relationship weights, so this is what
    happens to every taught skill on a live Grid: delivered, then refused as low trust."""
    grid = FakeGrid()
    hermes = make_handler(HERMES, memory=MemoryStore(":memory:"), hypnos_db_dir=tmp_path)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    payload = json.dumps({"name": "s", "description": "d", "instructions": "do it", "triggers": []})
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "sender_name": "Sophia",
                          "channel": "direct", "text": "__skill_share:" + payload, "tick": 1})

    await hermes._run_peer_inbox_cycle(2)

    assert hermes.memory._conn.execute("SELECT COUNT(*) FROM skills_quarantine").fetchone()[0] == 0
    posted = [p for p in grid.posted if p[0] == HERMES]
    assert len(posted) == 1 and posted[0][1][0]["action_type"] == ActionType.SKILL_REJECTED.value


@pytest.mark.asyncio
async def test_lore_response_reaches_the_peers_lore_store():
    grid = FakeGrid()
    hermes = make_handler(HERMES)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    hermes._lore_store = LoreStore(sqlite3.connect(":memory:"))
    content = "On tides\nThe ring breathes twice a day."
    chash = hashlib.sha256(content.encode()).hexdigest()
    text = f"__lore_response:{chash}:{base64.b64encode(content.encode()).decode()}"
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "sender_name": "Sophia",
                          "channel": "direct", "text": text, "tick": 1})

    await hermes._run_peer_inbox_cycle(2)

    assert hermes._lore_store.has(chash)


# ── what is and is not handed over ───────────────────────────────────────────
@pytest.mark.asyncio
async def test_rows_that_are_not_a_direct_message_are_claimed_and_dropped():
    grid = FakeGrid()
    hermes = make_handler(HERMES)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    heard = _spy_on_message(hermes)
    grid.enqueue(HERMES, {"kind": "absent_escalation_notice", "message": "You were marked absent"})
    grid.enqueue(HERMES, "a bare string")
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": HERMES, "text": "from myself"})
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "text": ""})
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "text": "x" * (PEER_MESSAGE_MAX_CHARS + 1)})

    await hermes._run_peer_inbox_cycle(5)

    assert heard == []
    assert all(r["state"] == "delivered" for r in grid.rows)


@pytest.mark.asyncio
async def test_a_notice_from_the_grid_is_remembered_and_not_handed_to_on_message():
    """P-DM-09: the "you were marked absent" notice is written to memory, once."""
    grid = FakeGrid()
    hermes = make_handler(HERMES)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    heard = _spy_on_message(hermes)
    notice = {"kind": "absent_escalation_notice", "message": "You were marked absent", "escalated_at_tick": 4}
    grid.enqueue(HERMES, notice, sender=SYSTEM_SENDER_CIVIC_DID)

    await hermes._run_peer_inbox_cycle(5)
    await hermes._run_peer_inbox_cycle(6)

    assert heard == []
    hermes.memory.record_event.assert_called_once_with(
        content='The Grid sent me a notice (absent_escalation_notice): "You were marked absent"', tick=5,
    )
    assert grid.rows[0]["state"] == "delivered"


@pytest.mark.asyncio
async def test_a_nous_cannot_pass_its_own_row_off_as_a_notice_from_the_grid():
    grid = FakeGrid()
    hermes = make_handler(HERMES)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    grid.enqueue(HERMES, {"kind": "absent_escalation_notice", "message": "You were marked absent"})

    await hermes._run_peer_inbox_cycle(5)

    hermes.memory.record_event.assert_not_called()


@pytest.mark.asyncio
async def test_a_notice_waits_while_there_is_no_memory_to_write_it_to():
    grid = FakeGrid()
    hermes = make_handler(HERMES, memory=None)
    hermes._grid_wire_client = grid.wire(HERMES, "Hermes")
    grid.enqueue(HERMES, {"kind": "absent_escalation_notice", "message": "You were marked absent"}, sender=SYSTEM_SENDER_CIVIC_DID)

    await hermes._run_peer_inbox_cycle(5)

    assert grid.rows[0]["state"] == "pending"
    assert grid.rows[0]["message"]["message"] == "You were marked absent"


@pytest.mark.asyncio
async def test_a_message_is_not_handled_unless_the_grid_confirms_the_claim():
    grid = FakeGrid()
    hermes = make_handler(HERMES)
    wire = grid.wire(HERMES, "Hermes")
    hermes._grid_wire_client = wire
    heard = _spy_on_message(hermes)
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "sender_name": "Sophia", "text": "hello"})

    wire.claim_mode = "refuse"
    await hermes._run_peer_inbox_cycle(1)
    assert heard == [] and grid.rows[0]["state"] == "pending"

    wire.claim_mode = "ok"
    await hermes._run_peer_inbox_cycle(2)
    assert [c["text"] for c in heard] == ["hello"]


@pytest.mark.asyncio
async def test_two_brain_processes_for_one_nous_handle_a_message_once():
    grid = FakeGrid()
    one, two = make_handler(HERMES), make_handler(HERMES)
    one._grid_wire_client, two._grid_wire_client = grid.wire(HERMES), grid.wire(HERMES)
    heard_one, heard_two = _spy_on_message(one), _spy_on_message(two)
    grid.enqueue(HERMES, {"kind": "direct_message", "sender_did": SOPHIA, "sender_name": "Sophia", "text": "hello"})
    # Both read the inbox before either claims.
    two._grid_wire_client.fetch_override = grid.pending(HERMES)

    await one._run_peer_inbox_cycle(1)
    await two._run_peer_inbox_cycle(1)

    assert len(heard_one) + len(heard_two) == 1


def test_gate_runs_only_for_a_live_wired_mind_and_respects_the_cooldown():
    h = make_handler(HERMES)
    h._grid_wire_client = None
    assert h._should_run_peer_inbox_cycle(10) is False
    h._grid_wire_client = FakeGrid().wire(HERMES)
    assert h._should_run_peer_inbox_cycle(10) is True
    h._last_peer_inbox_tick = 10
    assert h._should_run_peer_inbox_cycle(10) is False
    assert h._should_run_peer_inbox_cycle(11) is True


def test_parse_examples():
    good = {"id": 7, "message": {"kind": "direct_message", "sender_did": SOPHIA, "text": "hi"}}
    parsed = parse_peer_message(good, HERMES)
    assert parsed is not None and (parsed.message_id, parsed.sender_name, parsed.channel) == (7, "Unknown", "direct")
    assert message_id({"id": True}) is None and message_id({"id": 0}) is None and message_id("x") is None
