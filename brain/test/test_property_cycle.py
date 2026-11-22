"""The property decision cycle: buy a parcel, build on it, furnish it — by choice.

Cost-gated (no model call when nothing can be done), cooldown-gated, one stage's
verbs at a time, and every model-chosen value checked Brain-side before dispatch.
Civic-land actions go through post_civic_land_action, never post_actions.
"""
import hashlib
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
ME = "did:civic:noesis:sophia"
MY_HASH = hashlib.sha256(ME.encode()).hexdigest()
RES = "genesis:residential:0001"
BIZ = "genesis:business:0004"


def _handler(llm_text: str | None = None) -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=AsyncMock(),
        did=ME,
    )
    h.memory = MagicMock()
    if llm_text is not None:
        h.llm.generate = AsyncMock(
            return_value=LLMResponse(text=llm_text, model="m", provider="mock", usage={})
        )
    return h


def _parcel(pid, zone="residential", price=400, owner=None, structure=None):
    return {
        "id": pid, "zone": zone, "price_wei": price,
        "status": "owned" if owner else "available",
        "owner_civic_did_hash": owner, "structure": structure,
    }


def _wire(*, parcels, balance="1000", interior=None, post=(True, None)):
    w = MagicMock()
    w.civic_did = ME
    w.fetch_parcels = AsyncMock(return_value=parcels)
    w.fetch_account = AsyncMock(return_value={"balance_wei": balance})
    w.fetch_interior = AsyncMock(return_value=interior)
    w.post_civic_land_action = AsyncMock(return_value=post)
    w.post_actions = AsyncMock()
    return w


def _memories(h) -> list[str]:
    return [c.kwargs["content"] for c in h.memory.record_event.call_args_list]


FOR_SALE = [_parcel(RES), _parcel("genesis:business:0001", zone="business", price=900)]
BARE = [_parcel(BIZ, zone="business", price=900, owner=MY_HASH)]
SHOP = [_parcel(BIZ, zone="business", price=900, owner=MY_HASH, structure={"type": "shop", "visibility": "open"})]


# ── gate ─────────────────────────────────────────────────────────────────────
def test_gate_false_without_wire_client():
    h = _handler()
    h._grid_wire_client = None
    assert h._should_run_property_cycle(1000) is False


def test_gate_false_inside_cooldown_true_after():
    h = _handler()
    h._grid_wire_client = _wire(parcels=[])
    h._last_property_tick = 100
    assert h._should_run_property_cycle(199) is False
    assert h._should_run_property_cycle(200) is True


def test_gate_true_when_the_grid_tick_went_backwards():
    # The Grid's tick restarts from 0 when the Grid restarts.
    h = _handler()
    h._grid_wire_client = _wire(parcels=[])
    h._last_property_tick = 5000
    assert h._should_run_property_cycle(3) is True


def test_gate_true_on_a_fresh_handler():
    h = _handler()
    h._grid_wire_client = _wire(parcels=[])
    assert h._should_run_property_cycle(0) is True


# ── nothing to decide → no model call ───────────────────────────────────────
async def test_no_model_call_when_nothing_is_affordable():
    h = _handler('{"action":"buy_parcel","parcel":"%s"}' % RES)
    h._grid_wire_client = _wire(parcels=FOR_SALE, balance="439")
    await h._run_property_cycle(100)
    h.llm.generate.assert_not_awaited()
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()


async def test_no_model_call_when_the_interior_is_at_the_cap():
    full = {"areas": [{"name": "floor", "objects": [{"kind": "work_desk"}] * 12}]}
    h = _handler('{"action":"furnish","area":"floor","kind":"work_desk"}')
    h._grid_wire_client = _wire(parcels=SHOP, interior=full)
    await h._run_property_cycle(100)
    h.llm.generate.assert_not_awaited()


async def test_no_model_call_when_the_interior_cannot_be_read():
    h = _handler('{"action":"furnish","area":"floor","kind":"work_desk"}')
    h._grid_wire_client = _wire(parcels=SHOP, interior=None)
    await h._run_property_cycle(100)
    h.llm.generate.assert_not_awaited()


# ── land ─────────────────────────────────────────────────────────────────────
async def test_buys_a_listed_parcel_when_the_model_chooses_it():
    h = _handler('{"action":"buy_parcel","parcel":"%s","reason":"a home"}' % RES)
    h._grid_wire_client = _wire(parcels=FOR_SALE, balance="1000")
    await h._run_property_cycle(100)

    w = h._grid_wire_client
    w.post_civic_land_action.assert_awaited_once()
    action, parcel_id = w.post_civic_land_action.await_args[0]
    assert action.action_type == ActionType.BUY_PARCEL
    assert parcel_id == RES
    assert action.metadata == {"parcel": RES, "zone": "residential", "max_price": 400}
    w.post_actions.assert_not_awaited()                      # never the batch path
    assert any(m.startswith(f"Bought parcel {RES} for 400") for m in _memories(h))


async def test_an_unlisted_parcel_is_never_dispatched():
    h = _handler('{"action":"buy_parcel","parcel":"genesis:residential:9999"}')
    h._grid_wire_client = _wire(parcels=FOR_SALE)
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()


async def test_wrong_typed_values_dispatch_nothing_and_do_not_raise():
    h = _handler('{"action":"buy_parcel","parcel":7}')
    h._grid_wire_client = _wire(parcels=FOR_SALE)
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()


async def test_none_is_respected_and_remembered():
    h = _handler('{"action":"none","reason":"saving for later"}')
    h._grid_wire_client = _wire(parcels=FOR_SALE)
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()
    assert any("chose to wait" in m and "saving for later" in m for m in _memories(h))


async def test_unparseable_reply_dispatches_nothing():
    h = _handler("I am not sure what to do.")
    h._grid_wire_client = _wire(parcels=FOR_SALE)
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()
    assert _memories(h) == []


# ── build ────────────────────────────────────────────────────────────────────
async def test_builds_on_an_owned_bare_parcel():
    h = _handler('{"action":"build","type":"shop","name":"Agora Books","visibility":"open"}')
    h._grid_wire_client = _wire(parcels=BARE, balance="0")
    await h._run_property_cycle(100)

    action, parcel_id = h._grid_wire_client.post_civic_land_action.await_args[0]
    assert action.action_type == ActionType.BUILD
    assert parcel_id == BIZ
    assert action.metadata == {"parcel": BIZ, "type": "shop", "name": "Agora Books", "visibility": "open"}
    assert any(m.startswith("Built a shop named Agora Books") for m in _memories(h))


async def test_a_type_that_does_not_fit_the_zone_is_never_dispatched():
    h = _handler('{"action":"build","type":"home","name":"Oikos","visibility":"private"}')
    h._grid_wire_client = _wire(parcels=BARE)
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()


# ── furnish ──────────────────────────────────────────────────────────────────
async def test_furnishes_an_owned_structure():
    h = _handler('{"action":"furnish","area":"front_room","kind":"shop_counter"}')
    h._grid_wire_client = _wire(parcels=SHOP, interior={"areas": []})
    await h._run_property_cycle(100)

    w = h._grid_wire_client
    w.fetch_interior.assert_awaited_once_with(BIZ)
    action, parcel_id = w.post_civic_land_action.await_args[0]
    assert action.action_type == ActionType.EXTEND_INTERIOR
    assert parcel_id == BIZ
    assert action.metadata == {"area": "front_room", "kind": "shop_counter"}
    assert any(m.startswith("Placed a shop_counter in the front_room") for m in _memories(h))


async def test_a_kind_not_valid_for_the_structure_is_never_dispatched():
    h = _handler('{"action":"furnish","area":"front_room","kind":"bed"}')
    h._grid_wire_client = _wire(parcels=SHOP, interior={"areas": []})
    await h._run_property_cycle(100)
    h._grid_wire_client.post_civic_land_action.assert_not_awaited()


# ── refusal → lesson ─────────────────────────────────────────────────────────
async def test_a_refusal_becomes_a_lesson_and_counts_toward_reflection():
    h = _handler('{"action":"buy_parcel","parcel":"%s"}' % RES)
    h._grid_wire_client = _wire(parcels=FOR_SALE, post=(False, "insufficient_funds"))
    before = h._failed_since_reflection
    await h._run_property_cycle(100)
    assert h._failed_since_reflection == before + 1
    lessons = [m for m in _memories(h) if m.startswith("Lesson:")]
    assert len(lessons) == 1
    assert "buy_parcel" in lessons[0] and "insufficient_funds" in lessons[0]
    assert not any(m.startswith("Bought parcel") for m in _memories(h))


# ── never fatal ──────────────────────────────────────────────────────────────
async def test_a_failing_read_does_not_raise_out_of_the_cycle():
    h = _handler('{"action":"none"}')
    w = _wire(parcels=FOR_SALE)
    w.fetch_parcels = AsyncMock(side_effect=RuntimeError("feed down"))
    h._grid_wire_client = w
    await h._run_property_cycle(100)   # must not raise
    h.llm.generate.assert_not_awaited()


async def test_a_junk_balance_is_treated_as_zero():
    h = _handler('{"action":"buy_parcel","parcel":"%s"}' % RES)
    h._grid_wire_client = _wire(parcels=FOR_SALE, balance="lots")
    await h._run_property_cycle(100)
    h.llm.generate.assert_not_awaited()


# ── prompt carries the stage only ────────────────────────────────────────────
async def test_the_model_is_asked_with_json_mode_and_a_small_budget():
    h = _handler('{"action":"none"}')
    h._grid_wire_client = _wire(parcels=FOR_SALE)
    await h._run_property_cycle(100)
    prompt, options = h.llm.generate.await_args[0]
    assert RES in prompt and '"buy_parcel"' in prompt
    assert options.json_mode is True
    assert options.max_tokens == 256
    assert options.purpose == "property_decision"
