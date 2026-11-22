"""Pure decision logic of the Nous property cycle (no I/O, no model).

Design: docs/plans/2026-11-21-nous-property-cycle-design.md
"""
import hashlib

import pytest

from noesis_brain import property_logic as pl
from noesis_brain.rpc.types import ActionType

ME = "did:civic:noesis:sophia"
MY_HASH = hashlib.sha256(ME.encode()).hexdigest()


def _p(pid, zone="residential", price=400, status="available", owner=None, structure=None):
    return {
        "id": pid, "zone": zone, "status": status, "price_wei": price,
        "owner_civic_did_hash": owner, "structure": structure,
    }


FEED = [
    _p("genesis:government_quarter:0001", zone="government_quarter", price=0),
    _p("genesis:infrastructure:0001", zone="infrastructure", price=0),
    _p("genesis:residential:0002"),
    _p("genesis:residential:0001"),
    _p("genesis:business:0001", zone="business", price=900),
    _p("genesis:residential:0003", status="owned", owner="f" * 64),
]


# ── identity ────────────────────────────────────────────────────────────────
def test_civic_did_hash_is_sha256_hex():
    assert pl.civic_did_hash(ME) == MY_HASH


def test_own_parcel_matches_by_hash():
    feed = FEED + [_p("genesis:residential:0009", status="owned", owner=MY_HASH)]
    assert pl.own_parcel(feed, ME)["id"] == "genesis:residential:0009"
    assert pl.own_parcel(FEED, ME) is None


# ── candidates ──────────────────────────────────────────────────────────────
def test_reserve_is_ten_percent():
    assert pl.reserve_for(400) == 40
    assert pl.reserve_for(900) == 90


def test_candidates_skip_commons_owned_and_unaffordable():
    got = [c["id"] for c in pl.candidates(FEED, 440)]
    assert got == ["genesis:residential:0001", "genesis:residential:0002"]  # sorted by (price, id)


def test_candidates_need_price_plus_reserve():
    assert pl.candidates(FEED, 439) == []
    assert len(pl.candidates(FEED, 990)) == 3  # the 900 business parcel is now affordable


def test_candidates_skip_malformed_rows():
    bad = [
        {"id": "x1", "zone": "residential", "status": "available", "price_wei": "abc"},
        {"id": "x2", "status": "available", "price_wei": 400},  # no zone
        {"zone": "residential", "status": "available", "price_wei": 400},  # no id
        "not a dict",
        {"id": "x3", "zone": "residential", "status": "available", "price_wei": True},
    ]
    assert pl.candidates(bad, 10_000) == []


def test_candidates_accept_numeric_string_price():
    row = {"id": "x1", "zone": "residential", "status": "available", "price_wei": "400"}
    assert [c["id"] for c in pl.candidates([row], 440)] == ["x1"]


def test_candidates_capped_at_five():
    feed = [_p(f"genesis:residential:{i:04d}") for i in range(1, 10)]
    got = pl.candidates(feed, 10_000)
    assert len(got) == 5
    assert got[0]["id"] == "genesis:residential:0001"


# ── types and kinds ─────────────────────────────────────────────────────────
def test_allowed_types_follow_zone_fit():
    assert pl.allowed_types("residential") == ["home", "venue"]
    assert pl.allowed_types("business") == ["shop", "workshop", "venue"]
    assert pl.allowed_types("shopping") == ["shop", "workshop", "venue"]
    assert pl.allowed_types("manufacture") == ["shop", "workshop", "venue"]
    assert pl.allowed_types("government_quarter") == []


def test_valid_kinds_home_has_all_thirteen():
    kinds = pl.valid_kinds("home", 0)
    assert len(kinds) == 13
    assert kinds[0] == "bed"
    assert "work_desk" in kinds


def test_valid_kinds_elsewhere_functional_only():
    assert pl.valid_kinds("shop", 0) == list(pl.FUNCTIONAL_KINDS)
    assert "bed" not in pl.valid_kinds("venue", 3)


def test_valid_kinds_rotate_with_tick():
    assert pl.valid_kinds("home", 1)[0] == "closet"
    assert sorted(pl.valid_kinds("home", 7)) == sorted(pl.valid_kinds("home", 0))
    assert pl.valid_kinds("home", 13) == pl.valid_kinds("home", 0)


# ── interior ────────────────────────────────────────────────────────────────
INTERIOR = {"areas": [
    {"name": "bedroom", "objects": [{"kind": "bed", "class": "mirror"}, {"kind": "closet", "class": "mirror"}]},
    {"name": "study", "objects": [{"kind": "work_desk", "class": "functional"}]},
]}


def test_interior_summary_and_count():
    assert pl.interior_summary(INTERIOR) == {"bedroom": ["bed", "closet"], "study": ["work_desk"]}
    assert pl.interior_count(INTERIOR) == 3
    assert pl.interior_summary(None) == {}
    assert pl.interior_count({"areas": "junk"}) == 0


# ── stage ───────────────────────────────────────────────────────────────────
def test_stage_none_when_nothing_affordable():
    assert pl.plan_stage(FEED, ME, 439, 0) is None


def test_stage_land_when_affordable():
    st = pl.plan_stage(FEED, ME, 440, 0)
    assert st.name == "land" and st.parcel is None
    assert [c["id"] for c in st.options] == ["genesis:residential:0001", "genesis:residential:0002"]


def test_stage_build_when_owning_bare_parcel():
    feed = FEED + [_p("genesis:residential:0009", status="owned", owner=MY_HASH)]
    st = pl.plan_stage(feed, ME, 0, 0)
    assert st.name == "build" and st.parcel["id"] == "genesis:residential:0009"
    assert st.options == ["home", "venue"]


def test_stage_furnish_when_owning_structure():
    feed = [_p("genesis:business:0004", zone="business", price=900, status="owned", owner=MY_HASH,
               structure={"type": "shop", "visibility": "open"})]
    st = pl.plan_stage(feed, ME, 0, 2)
    assert st.name == "furnish"
    assert st.options == pl.valid_kinds("shop", 2)


def test_owner_is_never_offered_a_second_parcel():
    feed = FEED + [_p("genesis:residential:0009", status="owned", owner=MY_HASH,
                      structure={"type": "home", "visibility": "private"})]
    assert pl.plan_stage(feed, ME, 100_000, 0).name == "furnish"


# ── validate ────────────────────────────────────────────────────────────────
LAND = pl.Stage("land", None, pl.candidates(FEED, 440))
BARE = _p("genesis:business:0004", zone="business", price=900, status="owned", owner=MY_HASH)
BUILD = pl.Stage("build", BARE, pl.allowed_types("business"))
SHOP = dict(BARE, structure={"type": "shop", "visibility": "open"})
FURNISH = pl.Stage("furnish", SHOP, pl.valid_kinds("shop", 0))


def test_validate_buy_ok():
    got = pl.validate(LAND, {"action": "buy_parcel", "parcel": "genesis:residential:0001"}, 440, None)
    assert got == (
        ActionType.BUY_PARCEL, "genesis:residential:0001",
        {"parcel": "genesis:residential:0001", "zone": "residential", "max_price": 400},
    )


@pytest.mark.parametrize("decision", [
    {"action": "buy_parcel", "parcel": "genesis:residential:9999"},   # not offered
    {"action": "buy_parcel", "parcel": 7},                            # wrong type
    {"action": "buy_parcel"},                                         # missing
    {"action": "build", "type": "home", "name": "x", "visibility": "open"},  # wrong stage
    {"action": "none", "reason": "saving"},
    {"action": "sell"},
    {},
])
def test_validate_land_refusals(decision):
    assert pl.validate(LAND, decision, 440, None) is None


def test_validate_build_ok_and_trims_name():
    got = pl.validate(BUILD, {"action": "build", "type": "shop", "name": "  Agora Books ", "visibility": "open"}, 0, None)
    assert got == (
        ActionType.BUILD, "genesis:business:0004",
        {"parcel": "genesis:business:0004", "type": "shop", "name": "Agora Books", "visibility": "open"},
    )


@pytest.mark.parametrize("decision", [
    {"action": "build", "type": "home", "name": "Oikos", "visibility": "open"},      # home not in business
    {"action": "build", "type": "shop", "name": "Oikos", "visibility": "secret"},
    {"action": "build", "type": "shop", "name": "", "visibility": "open"},
    {"action": "build", "type": "shop", "name": "   ", "visibility": "open"},
    {"action": "build", "type": "shop", "name": "x" * 41, "visibility": "open"},
    {"action": "build", "type": "shop", "name": ["a"], "visibility": "open"},
    {"action": "build", "type": ["shop"], "name": "Oikos", "visibility": "open"},
    {"action": "buy_parcel", "parcel": "genesis:residential:0001"},
])
def test_validate_build_refusals(decision):
    assert pl.validate(BUILD, decision, 0, None) is None


def test_validate_furnish_ok():
    got = pl.validate(FURNISH, {"action": "furnish", "area": "front_room", "kind": "shop_counter"}, 0, {"areas": []})
    assert got == (ActionType.EXTEND_INTERIOR, "genesis:business:0004", {"area": "front_room", "kind": "shop_counter"})


@pytest.mark.parametrize("decision", [
    {"action": "furnish", "area": "front_room", "kind": "bed"},          # mirror kind in a shop
    {"action": "furnish", "area": "Living Room", "kind": "work_desk"},  # bad area
    {"action": "furnish", "area": "", "kind": "work_desk"},
    {"action": "furnish", "area": "a" * 25, "kind": "work_desk"},
    {"action": "furnish", "area": 3, "kind": "work_desk"},
    {"action": "furnish", "area": "front_room\n", "kind": "work_desk"},  # trailing newline
    {"action": "furnish", "area": "front_room", "kind": {"k": 1}},
])
def test_validate_furnish_refusals(decision):
    assert pl.validate(FURNISH, decision, 0, {"areas": []}) is None


def test_validate_furnish_refused_at_cap():
    full = {"areas": [{"name": "a", "objects": [{"kind": "work_desk"}] * 12}]}
    assert pl.validate(FURNISH, {"action": "furnish", "area": "front_room", "kind": "shop_counter"}, 0, full) is None


def test_candidates_show_every_zone_the_nous_can_afford():
    # 24 homes at 400 must not hide the 900 business land: a shortlist of the five
    # cheapest would choose "a home" for the Nous before it was ever asked.
    feed = [_p(f"genesis:residential:{i:04d}") for i in range(1, 25)]
    for zone in ("business", "shopping", "manufacture"):
        feed += [_p(f"genesis:{zone}:{i:04d}", zone=zone, price=900) for i in range(1, 9)]
    got = pl.candidates(feed, 1000)
    assert len(got) == 5
    assert {c["zone"] for c in got} == {"residential", "business", "shopping", "manufacture"}
    assert [c["id"] for c in got] == [
        "genesis:residential:0001", "genesis:residential:0002",
        "genesis:business:0001", "genesis:manufacture:0001", "genesis:shopping:0001",
    ]


def test_candidates_only_affordable_zones_are_shown():
    feed = [_p(f"genesis:residential:{i:04d}") for i in range(1, 25)]
    feed += [_p("genesis:business:0001", zone="business", price=900)]
    got = pl.candidates(feed, 500)          # 900 + 90 is out of reach
    assert {c["zone"] for c in got} == {"residential"}
    assert len(got) == 5
