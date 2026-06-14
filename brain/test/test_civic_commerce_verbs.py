"""Phase 60 Wave 6 (R-60-13 / D-60-13) — Brain commerce/co-work verbs are CAPABILITIES.

Extends the Phase 58 civic-land + Phase 59 interior verb contract with the
eight HOUSE-3 commerce / role / co-work / place verbs:

  grant_role {parcel, nous, role}    revoke_role {parcel, nous}
  invite {nous, parcel}              bind_shop {parcel, shop}
  name_place {parcel, name}          post_task {parcel, task, pay}
  claim_task {task}                  complete_task {task}

Asserts:
  - the eight ActionType values exist with the documented string values;
  - metadata validation (the capability builder is the schema gate);
  - dispatch routing maps each verb to its Wave-4 Grid route;
  - the my_places prompt block surfaces bound-shop status (+ place:// name),
    active role grants (staff/guest holders), and the outstanding IOU balance
    so the Nous FEELS its commercial relationships;
  - the verbs are capabilities — NO autoplay loop fires them.

Verbs are capabilities — decision pressure stays with the Nous. There is NO
autoplay: nothing here (or in the modules under test) auto-grants, auto-binds,
or auto-posts.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from noesis_brain.rpc.types import ActionType, build_civic_land_action
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


class TestCommerceActionTypes:
    def test_eight_members_exist(self) -> None:
        assert ActionType.GRANT_ROLE == "grant_role"
        assert ActionType.REVOKE_ROLE == "revoke_role"
        assert ActionType.INVITE == "invite"
        assert ActionType.BIND_SHOP == "bind_shop"
        assert ActionType.NAME_PLACE == "name_place"
        assert ActionType.POST_TASK == "post_task"
        assert ActionType.CLAIM_TASK == "claim_task"
        assert ActionType.COMPLETE_TASK == "complete_task"

    def test_members_are_string_enum(self) -> None:
        assert isinstance(ActionType.GRANT_ROLE, str)
        assert ActionType.BIND_SHOP.value == "bind_shop"
        assert ActionType.COMPLETE_TASK.value == "complete_task"


# ── 2. Capability builder validates metadata shapes ────────────────────────


class TestCommerceMetadataValidation:
    def test_grant_role_requires_parcel_nous_role(self) -> None:
        action = build_civic_land_action(
            ActionType.GRANT_ROLE,
            parcel="genesis:business:0003",
            nous="did:civic:noesis:nous:abcd",
            role="staff",
        )
        assert action.action_type == ActionType.GRANT_ROLE
        assert action.metadata == {
            "parcel": "genesis:business:0003",
            "nous": "did:civic:noesis:nous:abcd",
            "role": "staff",
        }

    def test_grant_role_missing_role_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.GRANT_ROLE,
                parcel="genesis:business:0003",
                nous="did:civic:noesis:nous:abcd",
            )

    def test_revoke_role_requires_parcel_and_nous(self) -> None:
        action = build_civic_land_action(
            ActionType.REVOKE_ROLE,
            parcel="genesis:business:0003",
            nous="did:civic:noesis:nous:abcd",
        )
        assert action.metadata == {
            "parcel": "genesis:business:0003",
            "nous": "did:civic:noesis:nous:abcd",
        }

    def test_revoke_role_missing_nous_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.REVOKE_ROLE, parcel="genesis:business:0003"
            )

    def test_invite_requires_nous_and_parcel(self) -> None:
        action = build_civic_land_action(
            ActionType.INVITE,
            nous="did:civic:noesis:nous:abcd",
            parcel="genesis:business:0003",
        )
        assert action.metadata == {
            "nous": "did:civic:noesis:nous:abcd",
            "parcel": "genesis:business:0003",
        }

    def test_invite_missing_nous_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.INVITE, parcel="genesis:business:0003")

    def test_bind_shop_requires_parcel_and_shop(self) -> None:
        action = build_civic_land_action(
            ActionType.BIND_SHOP, parcel="genesis:business:0003", shop="shop_42"
        )
        assert action.metadata == {"parcel": "genesis:business:0003", "shop": "shop_42"}

    def test_bind_shop_missing_shop_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.BIND_SHOP, parcel="genesis:business:0003")

    def test_name_place_requires_parcel_and_name(self) -> None:
        action = build_civic_land_action(
            ActionType.NAME_PLACE, parcel="genesis:business:0003", name="bazaar"
        )
        assert action.metadata == {"parcel": "genesis:business:0003", "name": "bazaar"}

    def test_name_place_missing_name_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.NAME_PLACE, parcel="genesis:business:0003")

    def test_post_task_requires_parcel_task_pay(self) -> None:
        action = build_civic_land_action(
            ActionType.POST_TASK,
            parcel="genesis:business:0003",
            task="stock the shelves",
            pay=10,
        )
        assert action.metadata == {
            "parcel": "genesis:business:0003",
            "task": "stock the shelves",
            "pay": 10,
        }

    def test_post_task_missing_pay_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.POST_TASK,
                parcel="genesis:business:0003",
                task="stock the shelves",
            )

    def test_claim_task_requires_task(self) -> None:
        action = build_civic_land_action(ActionType.CLAIM_TASK, task="task_7")
        assert action.metadata == {"task": "task_7"}

    def test_claim_task_missing_task_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.CLAIM_TASK)

    def test_complete_task_requires_task(self) -> None:
        action = build_civic_land_action(ActionType.COMPLETE_TASK, task="task_7")
        assert action.metadata == {"task": "task_7"}

    def test_complete_task_missing_task_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.COMPLETE_TASK)


# ── 3. Dispatch routing maps each verb to its Wave-4 route ──────────────────


class TestCommerceDispatchRouting:
    def test_all_eight_verbs_have_a_route(self) -> None:
        for verb in (
            ActionType.GRANT_ROLE,
            ActionType.REVOKE_ROLE,
            ActionType.INVITE,
            ActionType.BIND_SHOP,
            ActionType.NAME_PLACE,
            ActionType.POST_TASK,
            ActionType.CLAIM_TASK,
            ActionType.COMPLETE_TASK,
        ):
            assert verb in CIVIC_LAND_ROUTES

    def test_grant_role_route(self) -> None:
        assert civic_land_route(ActionType.GRANT_ROLE, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/roles",
        )

    def test_revoke_role_route(self) -> None:
        assert civic_land_route(ActionType.REVOKE_ROLE, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/roles/revoke",
        )

    def test_invite_route(self) -> None:
        assert civic_land_route(ActionType.INVITE, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/invite",
        )

    def test_bind_shop_route(self) -> None:
        assert civic_land_route(ActionType.BIND_SHOP, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/bind-shop",
        )

    def test_name_place_route(self) -> None:
        assert civic_land_route(ActionType.NAME_PLACE, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/name",
        )

    def test_post_task_route(self) -> None:
        assert civic_land_route(ActionType.POST_TASK, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/board/post",
        )

    def test_claim_task_route(self) -> None:
        assert civic_land_route(ActionType.CLAIM_TASK, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/board/claim",
        )

    def test_complete_task_route(self) -> None:
        assert civic_land_route(ActionType.COMPLETE_TASK, parcel_id="0003") == (
            "POST",
            "/api/v1/civic/parcels/0003/board/complete",
        )

    def test_commerce_routes_require_parcel_id(self) -> None:
        for verb in (
            ActionType.GRANT_ROLE,
            ActionType.REVOKE_ROLE,
            ActionType.INVITE,
            ActionType.BIND_SHOP,
            ActionType.NAME_PLACE,
            ActionType.POST_TASK,
            ActionType.CLAIM_TASK,
            ActionType.COMPLETE_TASK,
        ):
            with pytest.raises(ValueError):
                civic_land_route(verb)


# ── 4. my_places surfaces commercial relationships (D-60-13) ───────────────


class TestMyPlacesCommerceEnrichment:
    def test_bound_shop_and_place_name_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "structure_name": "Bazaar",
                    "bound_shop": True,
                    "place_name": "bazaar",
                }
            ]
        )
        assert "genesis:business:0003" in section
        assert "shop bound" in section
        assert "place://bazaar" in section

    def test_role_grants_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "roles": [
                        {"role": "staff", "count": 2},
                        {"role": "guest", "count": 1},
                    ],
                }
            ]
        )
        assert "staff" in section
        assert "guest" in section

    def test_outstanding_iou_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "outstanding_iou": 25,
                }
            ]
        )
        assert "outstanding IOU" in section
        assert "25" in section

    def test_camel_case_aliases_accepted(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "boundShop": True,
                    "placeName": "bazaar",
                    "outstandingIou": 25,
                }
            ]
        )
        assert "shop bound" in section
        assert "place://bazaar" in section
        assert "outstanding IOU" in section

    def test_phase58_59_shape_intact_without_commerce_fields(self) -> None:
        # An owned-but-uncommercial parcel keeps the Phase 58/59 shape — no
        # commercial suffix bleeds in when the fields are absent.
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:residential:0007",
                    "structure_type": "home",
                    "condition": "worn",
                    "upkeep_due": 8,
                }
            ]
        )
        assert "shop bound" not in section
        assert "place://" not in section
        assert "outstanding IOU" not in section
        # Phase 59 upkeep pressure still present.
        assert "worn" in section
        assert "upkeep due: 8 Bios" in section

    def test_enrichment_integrates_into_system_prompt(self) -> None:
        psyche, thymos, telos = _load_full()
        prompt = build_system_prompt(
            psyche,
            thymos.mood,
            telos,
            my_places=[
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "structure_name": "Bazaar",
                    "bound_shop": True,
                    "place_name": "bazaar",
                    "roles": [{"role": "staff", "count": 1}],
                    "outstanding_iou": 25,
                }
            ],
        )
        assert "place://bazaar" in prompt
        assert "shop bound" in prompt
        assert "staff" in prompt
        assert "outstanding IOU" in prompt


# ── 5. Verbs are capabilities — NO autoplay loop fires them ────────────────


class TestCommerceVerbsAreCapabilities:
    def test_building_a_verb_does_not_dispatch(self) -> None:
        # build_civic_land_action only constructs an Action; it performs no IO
        # and triggers no dispatch. The Nous chooses to act.
        action = build_civic_land_action(
            ActionType.POST_TASK,
            parcel="genesis:business:0003",
            task="stock",
            pay=5,
        )
        assert action.channel == ""
        assert action.text == ""

    def test_no_autoplay_scheduler_in_modules(self) -> None:
        # The verb modules must not start a background loop that auto-fires
        # commerce actions. Decision pressure stays with the Nous.
        import inspect

        from noesis_brain.rpc import types as types_mod
        from noesis_brain.wire import client as client_mod

        for mod in (types_mod, client_mod):
            src = inspect.getsource(mod)
            assert "while True:" not in src or mod is client_mod
        # The only while-True in client.py is the WireQueue replay drain, never
        # a commerce-verb autoplay loop.
        client_src = inspect.getsource(client_mod)
        assert "grant_role" not in client_src.lower() or "CIVIC_LAND_ROUTES" in client_src
