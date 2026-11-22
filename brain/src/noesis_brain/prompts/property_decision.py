"""The property decision prompt + parser.

When a Nous could buy a parcel, build on one it owns, or furnish a structure it
has built, the property cycle presents that one situation and asks for ONE JSON
decision. Only the verbs of the current stage are offered, so the list a small
model chooses from stays short. The Nous chooses: "none" is always valid and
nothing is bought, built or placed on its behalf (D-58-10).

Parsing is as forgiving as the economic parser (first balanced JSON object);
every value is then checked by property_logic.validate before anything is sent.

Design: docs/plans/2026-11-21-nous-property-cycle-design.md
"""
from __future__ import annotations

from typing import Any

from noesis_brain.prompts.economic_decision import _extract_json_object
from noesis_brain.property_logic import VISIBILITIES, Stage, interior_summary, reserve_for

_VALID_ACTIONS = {"buy_parcel", "build", "furnish", "none"}
_KEYS = ("action", "parcel", "type", "name", "visibility", "area", "kind", "reason")
_CLOSING = 'Choosing "none" is a real choice.'


def build_property_decision_prompt(
    stage: Stage, balance: int, interior: dict[str, Any] | None = None,
) -> str:
    """Build the user-turn prompt for the one stage that applies."""
    lines: list[str] = [f"Your wei balance: {balance}."]

    if stage.name == "land":
        lines.append(
            "You own no land in this Grid. These parcels are for sale and within your means "
            "(upkeep is charged every period, so part of your balance is kept back):"
        )
        for c in stage.options:
            price = c.get("price_wei")
            lines.append(
                f"  - {c.get('id')}: zone '{c.get('zone')}', price {price} wei "
                f"(reserve {reserve_for(int(price))} wei)."
            )
        lines.append(
            "\nDecide, in character, guided by your goals. Reply with ONE JSON object only:\n"
            '{"action": "buy_parcel", "parcel": "<one of the ids above>", "reason": "<one sentence>"}\n'
            'or {"action": "none", "reason": "<one sentence>"}'
        )

    elif stage.name == "build":
        parcel = stage.parcel or {}
        lines.append(
            f"You own the parcel {parcel.get('id')} in zone '{parcel.get('zone')}'. Nothing is built on it yet."
        )
        lines.append("You may build one structure there. Types allowed in this zone: " + ", ".join(stage.options) + ".")
        lines.append("Visibility: " + " or ".join(VISIBILITIES) + ".")
        lines.append(
            "\nDecide, in character, guided by your goals. Reply with ONE JSON object only:\n"
            '{"action": "build", "type": "<one of the types above>", "name": "<a short name, at most 40 characters>", '
            '"visibility": "open" | "private", "reason": "<one sentence>"}\n'
            'or {"action": "none", "reason": "<one sentence>"}'
        )

    else:  # furnish
        parcel = stage.parcel or {}
        structure = parcel.get("structure") if isinstance(parcel.get("structure"), dict) else {}
        lines.append(f"You own a {structure.get('type')} on the parcel {parcel.get('id')}.")
        summary = interior_summary(interior)
        if summary:
            lines.append("What is inside now:")
            for area, kinds in summary.items():
                lines.append(f"  - {area}: {', '.join(kinds)}")
        else:
            lines.append("There is nothing in it yet.")
        lines.append("You may place one object. Kinds you can place here: " + ", ".join(stage.options) + ".")
        lines.append("An area is a room name you choose: lower-case letters, digits and _ only, at most 24 characters.")
        lines.append(
            "\nDecide, in character, guided by your goals. Reply with ONE JSON object only:\n"
            '{"action": "furnish", "area": "<room name>", "kind": "<one of the kinds above>", "reason": "<one sentence>"}\n'
            'or {"action": "none", "reason": "<one sentence>"}'
        )

    lines.append(_CLOSING)
    return "\n".join(lines)


def parse_property_decision(text: Any) -> dict[str, Any] | None:
    """Parse a model reply into a fixed-key decision dict, or None."""
    if not isinstance(text, str) or not text.strip():
        return None
    obj = _extract_json_object(text)
    if obj is None:
        return None
    action = obj.get("action")
    if not isinstance(action, str) or action not in _VALID_ACTIONS:
        return None
    return {k: obj.get(k) for k in _KEYS}
