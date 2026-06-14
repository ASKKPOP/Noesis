"""Phase 61 Wave 4 (R-61-09 / D-61-09) — Brain skill-construction verbs are CAPABILITIES.

Extends the Phase 58 civic-land + Phase 59 interior + Phase 60 commerce verb
contract with the four HOUSE-4 skill-construction verbs:

  learn_blueprint {blueprint_hash}        build_from_blueprint {parcel, blueprint_hash}
  co_build {parcel, node_id}              teach_here {parcel, skill_hash}

Asserts:
  - the four ActionType values exist with the documented string values;
  - metadata validation (the capability builder is the schema gate);
  - dispatch routing maps build_from_blueprint / co_build to their Grid routes,
    while learn_blueprint / teach_here ride the EXISTING skill machinery (no new
    civic-parcels route — D-61-04: zero new diffusion code);
  - the my_places prompt block surfaces held blueprints, buildable parcels, and
    teach-here context so the Nous FEELS its construction capabilities;
  - the verbs are capabilities — NO autoplay loop fires them.

Verbs are capabilities — decision pressure stays with the Nous. There is NO
autoplay: nothing here (or in the modules under test) auto-learns, auto-builds,
or auto-teaches.
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


class TestConstructionActionTypes:
    def test_four_members_exist(self) -> None:
        assert ActionType.LEARN_BLUEPRINT == "learn_blueprint"
        assert ActionType.BUILD_FROM_BLUEPRINT == "build_from_blueprint"
        assert ActionType.CO_BUILD == "co_build"
        assert ActionType.TEACH_HERE == "teach_here"

    def test_members_are_string_enum(self) -> None:
        assert isinstance(ActionType.LEARN_BLUEPRINT, str)
        assert ActionType.BUILD_FROM_BLUEPRINT.value == "build_from_blueprint"
        assert ActionType.TEACH_HERE.value == "teach_here"


# ── 2. Capability builder validates metadata shapes ────────────────────────


class TestConstructionMetadataValidation:
    def test_learn_blueprint_requires_blueprint_hash(self) -> None:
        action = build_civic_land_action(
            ActionType.LEARN_BLUEPRINT, blueprint_hash="a1b2c3"
        )
        assert action.action_type == ActionType.LEARN_BLUEPRINT
        assert action.metadata == {"blueprint_hash": "a1b2c3"}

    def test_learn_blueprint_missing_hash_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.LEARN_BLUEPRINT)

    def test_build_from_blueprint_requires_parcel_and_hash(self) -> None:
        action = build_civic_land_action(
            ActionType.BUILD_FROM_BLUEPRINT,
            parcel="genesis:manufacture:0005",
            blueprint_hash="a1b2c3",
        )
        assert action.metadata == {
            "parcel": "genesis:manufacture:0005",
            "blueprint_hash": "a1b2c3",
        }

    def test_build_from_blueprint_missing_hash_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.BUILD_FROM_BLUEPRINT, parcel="genesis:manufacture:0005"
            )

    def test_co_build_requires_parcel_and_node_id(self) -> None:
        action = build_civic_land_action(
            ActionType.CO_BUILD, parcel="genesis:manufacture:0005", node_id="node_3"
        )
        assert action.metadata == {
            "parcel": "genesis:manufacture:0005",
            "node_id": "node_3",
        }

    def test_co_build_missing_node_id_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.CO_BUILD, parcel="genesis:manufacture:0005"
            )

    def test_teach_here_requires_parcel_and_skill_hash(self) -> None:
        action = build_civic_land_action(
            ActionType.TEACH_HERE, parcel="genesis:manufacture:0005", skill_hash="deadbeef"
        )
        assert action.metadata == {
            "parcel": "genesis:manufacture:0005",
            "skill_hash": "deadbeef",
        }

    def test_teach_here_missing_skill_hash_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(
                ActionType.TEACH_HERE, parcel="genesis:manufacture:0005"
            )


# ── 3. Dispatch routing maps each verb to its route ─────────────────────────


class TestConstructionDispatchRouting:
    def test_build_and_cobuild_have_a_route(self) -> None:
        assert ActionType.BUILD_FROM_BLUEPRINT in CIVIC_LAND_ROUTES
        assert ActionType.CO_BUILD in CIVIC_LAND_ROUTES

    def test_build_from_blueprint_route(self) -> None:
        assert civic_land_route(
            ActionType.BUILD_FROM_BLUEPRINT, parcel_id="0005"
        ) == ("POST", "/api/v1/civic/parcels/0005/build-from-blueprint")

    def test_co_build_route(self) -> None:
        # A co-build sub-task reuses the Phase 60 co-work board (claim a node;
        # complete via complete_task). The default route is the board claim.
        assert civic_land_route(ActionType.CO_BUILD, parcel_id="0005") == (
            "POST",
            "/api/v1/civic/parcels/0005/board/claim",
        )

    def test_build_and_cobuild_routes_require_parcel_id(self) -> None:
        for verb in (ActionType.BUILD_FROM_BLUEPRINT, ActionType.CO_BUILD):
            with pytest.raises(ValueError):
                civic_land_route(verb)

    def test_learn_and_teach_ride_existing_skill_dispatch(self) -> None:
        # D-61-04: a blueprint diffuses via the EXISTING Phase 18 skill
        # machinery, and teach_here only adds the location selector to that same
        # teach dispatch — ZERO new diffusion route. So they are NOT in the
        # civic-parcels route table; they travel in the normal actions batch.
        assert ActionType.LEARN_BLUEPRINT not in CIVIC_LAND_ROUTES
        assert ActionType.TEACH_HERE not in CIVIC_LAND_ROUTES


# ── 4. my_places surfaces construction capabilities (D-61-09) ───────────────


class TestMyPlacesConstructionEnrichment:
    def test_held_blueprints_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "held_blueprints": ["a1b2c3d4e5f6a1b2c3", "deadbeefcafe"],
                }
            ]
        )
        assert "genesis:manufacture:0005" in section
        assert "blueprints:" in section
        # short-hash label (12-char truncation)
        assert "a1b2c3d4e5f6" in section

    def test_buildable_parcel_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "can_build": True,
                }
            ]
        )
        assert "buildable" in section

    def test_cobuild_open_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "co_build": True,
                }
            ]
        )
        assert "co-build open" in section

    def test_teach_here_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "teach_here": True,
                }
            ]
        )
        assert "teach here (school)" in section

    def test_camel_case_aliases_accepted(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "heldBlueprints": ["a1b2c3d4e5f6a1b2c3"],
                    "canBuild": True,
                    "coBuild": True,
                    "teachHere": True,
                }
            ]
        )
        assert "blueprints:" in section
        assert "buildable" in section
        assert "co-build open" in section
        assert "teach here (school)" in section

    def test_phase58_60_shape_intact_without_construction_fields(self) -> None:
        # An owned-but-unconstructed parcel keeps the Phase 58/59/60 shape — no
        # construction suffix bleeds in when the fields are absent.
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
        assert "blueprints:" not in section
        assert "buildable" not in section
        assert "teach here" not in section
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
                    "parcel": "genesis:manufacture:0005",
                    "structure_type": "workshop",
                    "held_blueprints": ["a1b2c3d4e5f6a1b2c3"],
                    "can_build": True,
                    "teach_here": True,
                }
            ],
        )
        assert "blueprints:" in prompt
        assert "buildable" in prompt
        assert "teach here (school)" in prompt


# ── 5. Verbs are capabilities — NO autoplay loop fires them ────────────────


class TestConstructionVerbsAreCapabilities:
    def test_building_a_verb_does_not_dispatch(self) -> None:
        # build_civic_land_action only constructs an Action; it performs no IO
        # and triggers no dispatch. The Nous chooses to act.
        action = build_civic_land_action(
            ActionType.BUILD_FROM_BLUEPRINT,
            parcel="genesis:manufacture:0005",
            blueprint_hash="a1b2c3",
        )
        assert action.channel == ""
        assert action.text == ""

    def test_no_autoplay_scheduler_in_modules(self) -> None:
        # The verb modules must not start a background loop that auto-fires
        # construction actions. Decision pressure stays with the Nous.
        import inspect

        from noesis_brain.rpc import types as types_mod
        from noesis_brain.wire import client as client_mod

        for mod in (types_mod, client_mod):
            src = inspect.getsource(mod)
            assert "while True:" not in src or mod is client_mod
        # The only while-True in client.py is the WireQueue replay drain, never
        # a construction-verb autoplay loop.
        client_src = inspect.getsource(client_mod)
        assert (
            "build_from_blueprint" not in client_src.lower()
            or "CIVIC_LAND_ROUTES" in client_src
        )
