"""Prompt + parser of the Nous property cycle. One stage's verbs at a time."""
from noesis_brain import property_logic as pl
from noesis_brain.prompts.property_decision import (
    build_property_decision_prompt,
    parse_property_decision,
)

CANDIDATES = [
    {"id": "genesis:residential:0001", "zone": "residential", "price_wei": 400, "status": "available"},
    {"id": "genesis:business:0001", "zone": "business", "price_wei": 900, "status": "available"},
]
LAND = pl.Stage("land", None, CANDIDATES)
BARE = {"id": "genesis:business:0004", "zone": "business", "price_wei": 900, "structure": None}
BUILD = pl.Stage("build", BARE, pl.allowed_types("business"))
SHOP = dict(BARE, structure={"type": "shop", "visibility": "open"})
FURNISH = pl.Stage("furnish", SHOP, pl.valid_kinds("shop", 0))
INTERIOR = {"areas": [{"name": "front_room", "objects": [{"kind": "shop_counter"}, {"kind": "work_desk"}]}]}


def test_land_prompt_lists_candidates_balance_and_none():
    p = build_property_decision_prompt(LAND, 1000)
    assert "1000" in p
    for c in CANDIDATES:
        assert c["id"] in p and str(c["price_wei"]) in p
    assert '"buy_parcel"' in p and '"none"' in p
    assert '"build"' not in p and '"furnish"' not in p
    assert 'Choosing "none" is a real choice.' in p


def test_build_prompt_offers_only_types_that_fit_the_zone():
    p = build_property_decision_prompt(BUILD, 50)
    assert "genesis:business:0004" in p
    for t in ("shop", "workshop", "venue"):
        assert t in p
    assert "home" not in p
    assert "open" in p and "private" in p
    assert '"build"' in p and '"none"' in p
    assert '"buy_parcel"' not in p and '"furnish"' not in p


def test_furnish_prompt_lists_kinds_and_current_interior():
    p = build_property_decision_prompt(FURNISH, 50, INTERIOR)
    for k in pl.FUNCTIONAL_KINDS:
        assert k in p
    assert "bed" not in p
    assert "front_room: shop_counter, work_desk" in p
    assert '"furnish"' in p and '"none"' in p
    assert '"buy_parcel"' not in p and '"build"' not in p


def test_furnish_prompt_says_when_the_place_is_empty():
    p = build_property_decision_prompt(FURNISH, 50, {"areas": []})
    assert "nothing in it yet" in p


def test_parse_takes_first_json_object_from_prose():
    text = 'Sure. {"action": "buy_parcel", "parcel": "genesis:residential:0001", "reason": "a home"} Done.'
    got = parse_property_decision(text)
    assert got["action"] == "buy_parcel"
    assert got["parcel"] == "genesis:residential:0001"
    assert got["reason"] == "a home"


def test_parse_none_is_a_decision():
    assert parse_property_decision('{"action": "none", "reason": "saving"}')["action"] == "none"


def test_parse_rejects_unknown_action_and_non_json():
    assert parse_property_decision('{"action": "sell"}') is None
    assert parse_property_decision("I would rather wait.") is None
    assert parse_property_decision("") is None
    assert parse_property_decision(None) is None
    assert parse_property_decision("[1, 2]") is None
    assert parse_property_decision('{"action": ["buy_parcel"]}') is None  # unhashable action
    assert parse_property_decision('{"action": {"a": 1}}') is None
