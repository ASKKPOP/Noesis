"""Pure decision logic of the Nous property cycle.

A Nous may buy a parcel, build on it and furnish it. This module decides what
can be offered and checks what the model chose. It does no I/O: the handler
reads the Grid, asks the model and dispatches; everything in between is here.

The Grid is always the judge. The tables below mirror its rules
(grid/src/civic/types.ts, grid/src/civic/furniture.ts) so that the Nous is
offered only choices the Grid would accept, and a refusal stays rare.

Design: docs/plans/2026-11-21-nous-property-cycle-design.md
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

from noesis_brain.rpc.types import ActionType

# Mirrors PURCHASABLE_ZONES. Civic commons also show as `available` in the
# public feed and are refused with zone_not_purchasable, so they are never offered.
PURCHASABLE_ZONES: tuple[str, ...] = ("residential", "business", "shopping", "manufacture")

# Mirrors STRUCTURE_ZONE_FIT. Key order is the order in which types are offered.
STRUCTURE_ZONE_FIT: dict[str, tuple[str, ...]] = {
    "home": ("residential",),
    "shop": ("business", "shopping", "manufacture"),
    "workshop": ("business", "shopping", "manufacture"),
    "venue": ("residential", "business", "shopping", "manufacture"),
}

# Mirrors FURNITURE_CATALOG. Mirror kinds are valid in a home only.
MIRROR_KINDS: tuple[str, ...] = ("bed", "closet", "shelf", "kitchen", "bathroom", "decor")
FUNCTIONAL_KINDS: tuple[str, ...] = (
    "work_desk", "sim_board", "meeting_table", "game_table",
    "task_board", "skill_terminal", "shop_counter",
)

VISIBILITIES: tuple[str, ...] = ("open", "private")

# Kept back at purchase so the first upkeep debits can be met: the Grid debits
# 2% of the price per period by itself, so 10% covers five periods.
RESERVE_BPS = 1000
MAX_CANDIDATES = 5
# The extend route has no cap and no charge; the Brain bounds it until the Grid does.
FURNISH_CAP = 12
NAME_MAX = 40

_AREA_RE = re.compile(r"^[a-z0-9_]{1,24}$")


@dataclass(frozen=True)
class Stage:
    """What the cycle may offer right now.

    name:    "land" | "build" | "furnish"
    parcel:  the owned parcel for build / furnish, None for land
    options: candidate parcels | allowed structure types | valid furniture kinds
    """

    name: str
    parcel: dict[str, Any] | None
    options: list[Any]


def civic_did_hash(civic_did: str) -> str:
    """The form in which an owner appears in the public parcel feed."""
    return hashlib.sha256(civic_did.encode("utf-8")).hexdigest()


def reserve_for(price: int) -> int:
    return price * RESERVE_BPS // 10000


def _price(parcel: dict[str, Any]) -> int | None:
    """A parcel's price as an int, or None when the feed row is not usable."""
    raw = parcel.get("price_wei")
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    return None


def own_parcel(parcels: list[Any], civic_did: str) -> dict[str, Any] | None:
    """The first parcel the feed marks with this Nous's hash. v1 handles one parcel."""
    mine = civic_did_hash(civic_did)
    for p in parcels:
        if isinstance(p, dict) and p.get("owner_civic_did_hash") == mine and isinstance(p.get("id"), str):
            return p
    return None


def candidates(parcels: list[Any], balance: int) -> list[dict[str, Any]]:
    """Parcels this Nous could buy now and still hold the reserve, cheapest first."""
    out: list[tuple[int, str, dict[str, Any]]] = []
    for p in parcels:
        if not isinstance(p, dict):
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not pid:
            continue
        if p.get("status") != "available" or p.get("zone") not in PURCHASABLE_ZONES:
            continue
        price = _price(p)
        if price is None or price <= 0:
            continue
        if price + reserve_for(price) > balance:
            continue
        out.append((price, pid, p))
    out.sort(key=lambda t: (t[0], t[1]))
    return [p for _, _, p in out[:MAX_CANDIDATES]]


def allowed_types(zone: Any) -> list[str]:
    return [t for t, zones in STRUCTURE_ZONE_FIT.items() if zone in zones]


def valid_kinds(structure_type: Any, tick: int) -> list[str]:
    """Kinds valid in this structure, rotated by the tick so none always comes first."""
    kinds = list(MIRROR_KINDS + FUNCTIONAL_KINDS) if structure_type == "home" else list(FUNCTIONAL_KINDS)
    shift = tick % len(kinds)
    return kinds[shift:] + kinds[:shift]


def interior_summary(interior: Any) -> dict[str, list[str]]:
    """Area name → kinds. Kinds only: an object's name or state never reaches a prompt."""
    out: dict[str, list[str]] = {}
    areas = interior.get("areas") if isinstance(interior, dict) else None
    if not isinstance(areas, list):
        return out
    for area in areas:
        if not isinstance(area, dict) or not isinstance(area.get("name"), str):
            continue
        objects = area.get("objects")
        kinds = [
            o["kind"] for o in objects
            if isinstance(o, dict) and isinstance(o.get("kind"), str)
        ] if isinstance(objects, list) else []
        out.setdefault(area["name"], []).extend(kinds)
    return out


def interior_count(interior: Any) -> int:
    return sum(len(kinds) for kinds in interior_summary(interior).values())


def plan_stage(parcels: list[Any], civic_did: str, balance: int, tick: int) -> Stage | None:
    """Which single stage applies, or None when nothing can be done.

    The furnishing cap is applied by the caller, which has to read the interior first.
    """
    mine = own_parcel(parcels, civic_did)
    if mine is None:
        options = candidates(parcels, balance)
        return Stage("land", None, options) if options else None
    structure = mine.get("structure")
    if not isinstance(structure, dict):
        types = allowed_types(mine.get("zone"))
        return Stage("build", mine, types) if types else None
    return Stage("furnish", mine, valid_kinds(structure.get("type"), tick))


def validate(
    stage: Stage, decision: Any, balance: int, interior: Any,
) -> tuple[ActionType, str, dict[str, Any]] | None:
    """Check a parsed decision against the stage it was offered in.

    Returns (action type, parcel id, metadata for build_civic_land_action), or
    None when the decision is `none`, belongs to another stage, or carries a
    value that was not offered. Never raises on a malformed decision.
    """
    if not isinstance(decision, dict):
        return None
    action = decision.get("action")

    if stage.name == "land" and action == "buy_parcel":
        pid = decision.get("parcel")
        if not isinstance(pid, str):
            return None
        chosen = next((c for c in stage.options if c.get("id") == pid), None)
        if chosen is None:
            return None
        price = _price(chosen)
        if price is None or price + reserve_for(price) > balance:
            return None
        return ActionType.BUY_PARCEL, pid, {"parcel": pid, "zone": chosen.get("zone"), "max_price": price}

    if stage.name == "build" and action == "build" and stage.parcel is not None:
        kind, name, visibility = decision.get("type"), decision.get("name"), decision.get("visibility")
        if not isinstance(kind, str) or kind not in stage.options:
            return None
        if not isinstance(visibility, str) or visibility not in VISIBILITIES:
            return None
        if not isinstance(name, str):
            return None
        name = name.strip()
        if not 1 <= len(name) <= NAME_MAX:
            return None
        pid = stage.parcel["id"]
        return ActionType.BUILD, pid, {"parcel": pid, "type": kind, "name": name, "visibility": visibility}

    if stage.name == "furnish" and action == "furnish" and stage.parcel is not None:
        area, kind = decision.get("area"), decision.get("kind")
        if not isinstance(kind, str) or kind not in stage.options:
            return None
        if not isinstance(area, str) or not _AREA_RE.fullmatch(area):
            return None
        if interior_count(interior) >= FURNISH_CAP:
            return None
        return ActionType.EXTEND_INTERIOR, stage.parcel["id"], {"area": area, "kind": kind}

    return None
