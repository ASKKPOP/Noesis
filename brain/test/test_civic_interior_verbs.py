"""Phase 59 Wave 5 (R-59-10 / D-59-10) — Brain interior verbs are CAPABILITIES.

Extends the Phase 58 civic-land verb contract (test_civic_land_verbs.py) with
the two HOUSE-2 interior verbs:
  extend_interior {area, kind}   view_interior {parcel}

Asserts:
  - the two ActionType values exist with the documented string values;
  - metadata validation (extend_interior requires area+kind; view_interior
    requires parcel) — the capability builder is the schema gate;
  - dispatch routing maps extend_interior -> POST :id/interior/extend and
    view_interior -> GET :id/interior;
  - the my_places prompt block surfaces each owned house's condition
    (maintained/worn/derelict) + pending upkeep cost so the Nous feels pressure.

Verbs are capabilities — the decision pressure stays with the Nous. There is
NO autoplay: nothing here (or in the modules under test) auto-furnishes.
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


class TestInteriorActionTypes:
    def test_two_members_exist(self) -> None:
        assert ActionType.EXTEND_INTERIOR == "extend_interior"
        assert ActionType.VIEW_INTERIOR == "view_interior"

    def test_members_are_string_enum(self) -> None:
        assert isinstance(ActionType.EXTEND_INTERIOR, str)
        assert ActionType.VIEW_INTERIOR.value == "view_interior"


# ── 2. Capability builder validates metadata shapes ────────────────────────


class TestInteriorMetadataValidation:
    def test_extend_interior_requires_area_and_kind(self) -> None:
        action = build_civic_land_action(
            ActionType.EXTEND_INTERIOR, area="living", kind="bed"
        )
        assert action.action_type == ActionType.EXTEND_INTERIOR
        assert action.metadata == {"area": "living", "kind": "bed"}

    def test_extend_interior_missing_area_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.EXTEND_INTERIOR, kind="bed")

    def test_extend_interior_missing_kind_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.EXTEND_INTERIOR, area="living")

    def test_view_interior_requires_parcel(self) -> None:
        action = build_civic_land_action(
            ActionType.VIEW_INTERIOR, parcel="genesis:residential:0007"
        )
        assert action.metadata == {"parcel": "genesis:residential:0007"}

    def test_view_interior_missing_parcel_rejected(self) -> None:
        with pytest.raises(ValueError):
            build_civic_land_action(ActionType.VIEW_INTERIOR)


# ── 3. Dispatch routing maps each verb to the interior route ───────────────


class TestInteriorDispatchRouting:
    def test_both_verbs_have_a_route(self) -> None:
        assert ActionType.EXTEND_INTERIOR in CIVIC_LAND_ROUTES
        assert ActionType.VIEW_INTERIOR in CIVIC_LAND_ROUTES

    def test_extend_interior_route(self) -> None:
        method, path = civic_land_route(ActionType.EXTEND_INTERIOR, parcel_id="0007")
        assert (method, path) == (
            "POST",
            "/api/v1/civic/parcels/0007/interior/extend",
        )

    def test_view_interior_route(self) -> None:
        method, path = civic_land_route(ActionType.VIEW_INTERIOR, parcel_id="0007")
        assert (method, path) == ("GET", "/api/v1/civic/parcels/0007/interior")

    def test_interior_routes_require_parcel_id(self) -> None:
        with pytest.raises(ValueError):
            civic_land_route(ActionType.EXTEND_INTERIOR)
        with pytest.raises(ValueError):
            civic_land_route(ActionType.VIEW_INTERIOR)


# ── 4. my_places surfaces condition + upkeep pressure (D-59-10) ────────────


class TestMyPlacesUpkeepPressure:
    def test_renders_condition_and_upkeep(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:residential:0007",
                    "structure_type": "home",
                    "condition": "worn",
                    "upkeepDue": 8,
                }
            ]
        )
        assert "genesis:residential:0007" in section
        assert "worn" in section
        assert "upkeep due: 8 Bios" in section

    def test_accepts_snake_case_upkeep_due(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:business:0003",
                    "structure_type": "shop",
                    "structure_name": "Bazaar",
                    "condition": "maintained",
                    "upkeep_due": 12,
                }
            ]
        )
        assert "maintained" in section
        assert "upkeep due: 12 Bios" in section
        assert "Bazaar" in section

    def test_derelict_condition_surfaced(self) -> None:
        section = build_my_places_section(
            [
                {
                    "parcel": "genesis:residential:0009",
                    "structure_type": "home",
                    "condition": "derelict",
                    "upkeep_due": 8,
                }
            ]
        )
        assert "derelict" in section

    def test_no_upkeep_keeps_phase58_line_shape(self) -> None:
        # An owned-but-unfurnished/commons parcel without condition/upkeep keeps
        # the Phase 58 shape (no trailing pressure suffix).
        section = build_my_places_section(
            [{"parcel": "genesis:residential:0007", "structure_type": "home"}]
        )
        assert "upkeep due" not in section
        assert "genesis:residential:0007" in section

    def test_empty_when_no_land(self) -> None:
        assert build_my_places_section([]) == ""
        assert build_my_places_section(None) == ""

    def test_pressure_integrates_into_system_prompt(self) -> None:
        psyche, thymos, telos = _load_full()
        prompt = build_system_prompt(
            psyche,
            thymos.mood,
            telos,
            my_places=[
                {
                    "parcel": "genesis:residential:0007",
                    "structure_type": "home",
                    "condition": "worn",
                    "upkeepDue": 8,
                }
            ],
        )
        assert "worn" in prompt
        assert "upkeep due: 8 Bios" in prompt
