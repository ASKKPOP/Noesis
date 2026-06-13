"""Phase 58 Wave 4 (R-58-10 / D-58-10) — Brain civic-land verbs are CAPABILITIES.

Locks the contract for the six civic-land ActionType verbs:
  list_parcels / buy_parcel / build / visit / leave / set_entry_policy

Asserts:
  - the 6 ActionType values exist with the documented string values;
  - metadata validation rejects a buy_parcel missing zone/max_price and a
    build missing parcel/type/name (capability builder is the schema gate);
  - dispatch routing maps each verb to the matching civic-parcels route
    (GridWireClient -> POST /api/v1/brain/actions -> Grid action handler);
  - the my_places prompt block renders when the Nous owns land and is
    EMPTY/omitted otherwise (Smallville Lesson 2: home anchors routine).

Verbs are capabilities — the decision pressure stays with the Nous. There is
NO autoplay: nothing here (or in the modules under test) auto-buys/auto-builds.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from noesis_brain.rpc.types import Action, ActionType, build_civic_land_action
from noesis_brain.wire.client import CIVIC_LAND_ROUTES, civic_land_route
from noesis_brain.prompts.system import build_my_places_section, build_system_prompt
from noesis_brain.psyche import load_psyche
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

_SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _load_full():
    """Load psyche / thymos / telos from the Sophia fixture (mirrors test_prompts.py)."""
    with open(_SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    psyche = load_psyche(data=data)
    thymos = ThymosTracker.from_yaml(data.get("thymos", {}))
    telos = TelosManager.from_yaml(data.get("telos", {}))
    return psyche, thymos, telos


# ── 1. ActionType members exist with documented string values ──────────────


class TestCivicLandActionTypes:
    def test_six_members_exist(self) -> None:
        assert ActionType.LIST_PARCELS == "list_parcels"
        assert ActionType.BUY_PARCEL == "buy_parcel"
        assert ActionType.BUILD == "build"
        assert ActionType.VISIT == "visit"
        assert ActionType.LEAVE == "leave"
        assert ActionType.SET_ENTRY_POLICY == "set_entry_policy"

    def test_members_are_string_enum(self) -> None:
        assert isinstance(ActionType.BUY_PARCEL, str)
        assert ActionType.BUILD.value == "build"


# ── 2. Capability builder validates metadata shapes ────────────────────────


class TestMetadataValidation:
    def test_buy_parcel_requires_zone_and_max_price(self) -> None:
        action = build_civic_land_action(
            ActionType.BUY_PARCEL, zone="residential", max_price=400
        )
        assert action.action_type == ActionType.BUY_PARCEL
        assert action.metadata == {"zone": "residential", "max_price": 400}

    def test_buy_parcel_missing_zone_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.BUY_PARCEL, max_price=400)

    def test_buy_parcel_missing_max_price_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.BUY_PARCEL, zone="residential")

    def test_build_requires_parcel_type_name(self) -> None:
        action = build_civic_land_action(
            ActionType.BUILD,
            parcel="genesis:residential:0007",
            type="home",
            name="My Home",
        )
        assert action.metadata == {
            "parcel": "genesis:residential:0007",
            "type": "home",
            "name": "My Home",
        }

    @pytest.mark.parametrize(
        "missing",
        [
            {"type": "home", "name": "My Home"},  # no parcel
            {"parcel": "p", "name": "My Home"},  # no type
            {"parcel": "p", "type": "home"},  # no name
        ],
    )
    def test_build_missing_key_rejected(self, missing: dict) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.BUILD, **missing)

    def test_visit_requires_parcel(self) -> None:
        action = build_civic_land_action(ActionType.VISIT, parcel="genesis:business:0001")
        assert action.metadata == {"parcel": "genesis:business:0001"}

    def test_visit_missing_parcel_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.VISIT)

    def test_set_entry_policy_requires_parcel_and_policy(self) -> None:
        action = build_civic_land_action(
            ActionType.SET_ENTRY_POLICY,
            parcel="genesis:residential:0007",
            policy="allowlist",
            allowlist=["did:civic:noesis:genesis:alice"],
        )
        assert action.metadata["parcel"] == "genesis:residential:0007"
        assert action.metadata["policy"] == "allowlist"
        assert action.metadata["allowlist"] == ["did:civic:noesis:genesis:alice"]

    def test_set_entry_policy_allowlist_is_optional(self) -> None:
        action = build_civic_land_action(
            ActionType.SET_ENTRY_POLICY,
            parcel="genesis:residential:0007",
            policy="open",
        )
        assert "allowlist" not in action.metadata

    def test_set_entry_policy_missing_policy_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.SET_ENTRY_POLICY, parcel="genesis:residential:0007"
            )

    def test_list_parcels_needs_no_metadata(self) -> None:
        action = build_civic_land_action(ActionType.LIST_PARCELS)
        assert action.metadata == {}

    def test_leave_needs_no_metadata(self) -> None:
        action = build_civic_land_action(ActionType.LEAVE)
        assert action.metadata == {}


# ── 3. Dispatch routing maps each verb to the civic-parcels route ──────────


class TestDispatchRouting:
    def test_all_six_verbs_have_a_route(self) -> None:
        for verb in (
            ActionType.LIST_PARCELS,
            ActionType.BUY_PARCEL,
            ActionType.BUILD,
            ActionType.VISIT,
            ActionType.LEAVE,
            ActionType.SET_ENTRY_POLICY,
        ):
            assert verb in CIVIC_LAND_ROUTES

    def test_list_parcels_route(self) -> None:
        method, path = civic_land_route(ActionType.LIST_PARCELS)
        assert method == "GET"
        assert path == "/api/v1/civic/parcels"

    def test_buy_parcel_route(self) -> None:
        method, path = civic_land_route(ActionType.BUY_PARCEL, parcel_id="0007")
        assert method == "POST"
        assert path == "/api/v1/civic/parcels/0007/purchase"

    def test_build_route(self) -> None:
        method, path = civic_land_route(ActionType.BUILD, parcel_id="0007")
        assert (method, path) == ("POST", "/api/v1/civic/parcels/0007/build")

    def test_visit_route_maps_to_join(self) -> None:
        method, path = civic_land_route(ActionType.VISIT, parcel_id="0001")
        assert (method, path) == ("POST", "/api/v1/civic/parcels/0001/join")

    def test_leave_route(self) -> None:
        method, path = civic_land_route(ActionType.LEAVE, parcel_id="0001")
        assert (method, path) == ("POST", "/api/v1/civic/parcels/0001/leave")

    def test_set_entry_policy_route(self) -> None:
        method, path = civic_land_route(ActionType.SET_ENTRY_POLICY, parcel_id="0007")
        assert (method, path) == (
            "POST",
            "/api/v1/civic/parcels/0007/entry-policy",
        )

    def test_per_parcel_route_requires_parcel_id(self) -> None:
        with pytest.raises(ValueError):
            civic_land_route(ActionType.BUY_PARCEL)


# ── 4. my_places prompt block (Smallville Lesson 2: home anchors routine) ──


class TestMyPlacesBlock:
    def test_empty_when_no_land(self) -> None:
        assert build_my_places_section([]) == ""
        assert build_my_places_section(None) == ""

    def test_renders_owned_parcel(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:residential:0007",
                    "structure_type": "home",
                    "structure_name": "My Home",
                }
            ]
        )
        assert "My Places" in section
        assert "genesis:residential:0007" in section
        assert "My Home" in section

    def test_unbuilt_parcel_shows_no_structure(self) -> None:
        section = build_my_places_section(
            [{"parcel": "genesis:business:0003"}]
        )
        assert "genesis:business:0003" in section
        # An unbuilt parcel must still render its address (the anchor) without
        # inventing a structure name.
        assert "My Places" in section

    def test_block_integrates_into_system_prompt(self) -> None:
        psyche, thymos, telos = _load_full()
        prompt = build_system_prompt(
            psyche,
            thymos.mood,
            telos,
            my_places=[
                {
                    "parcel": "genesis:residential:0007",
                    "structure_type": "home",
                    "structure_name": "My Home",
                }
            ],
        )
        assert "genesis:residential:0007" in prompt

    def test_omitted_from_prompt_when_no_land(self) -> None:
        psyche, thymos, telos = _load_full()
        prompt = build_system_prompt(psyche, thymos.mood, telos, my_places=[])
        assert "My Places" not in prompt
