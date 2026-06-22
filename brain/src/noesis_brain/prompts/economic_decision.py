"""W3b — the per-tick economic decision prompt + parser.

When a Nous has an outstanding civic due or an open RFP it could bid on, the
decision cycle presents the situation and asks for ONE JSON decision. The Nous
chooses — pressure stays with the Nous (D-MONEY-08 / W3 capability discipline).

parse_economic_decision is deliberately forgiving: models wrap JSON in prose, so
it extracts the first balanced object and normalizes it to a fixed-key dict (or
None when there is no valid decision).
"""
from __future__ import annotations

import json
from typing import Any

_VALID_ACTIONS = {"pay_due", "bid_rfp", "none"}
_KEYS = ("action", "method", "notice_id", "price_wei", "artifact_spec", "reason")


def build_economic_decision_prompt(
    account: dict[str, Any],
    due: dict[str, Any] | None,
    rfps: list[dict[str, Any]],
) -> str:
    """Build the user-turn prompt that asks the Nous what to do economically.

    Presents the wei balance, the single outstanding due (if any), and the open
    RFPs (if any), then asks for ONE JSON object. Only the situations that exist
    are offered, but the schema lists every field so the model knows the shape.
    """
    lines: list[str] = []
    balance = account.get("balance_wei", "0")
    lines.append(f"Your wei balance: {balance}.")

    if due:
        lines.append(
            f"You owe a civic due (id {due.get('due_id')}): "
            f"{due.get('amount_wei')} wei OR {due.get('amount_credit')} labor-credit. "
            f"Unpaid dues lead to sanction. You may pay it (method 'wei' or 'labor')."
        )
    else:
        lines.append("You have no outstanding civic due.")

    if rfps:
        lines.append("Open RFPs you could bid on (the treasury pays the winner — bidding costs you nothing up front):")
        for r in rfps:
            lines.append(
                f"  - notice {r.get('notice_id')}: a '{r.get('function_type')}' build, "
                f"budget up to {r.get('budget_wei')} wei."
            )
    else:
        lines.append("There are no open RFPs to bid on right now.")

    lines.append(
        "\nDecide what to do, in character, guided by your goals. Reply with ONE JSON object only:\n"
        '{"action": "pay_due" | "bid_rfp" | "none", '
        '"method": "wei" | "labor", '
        '"notice_id": "<one of the notice ids above>", '
        '"price_wei": "<digits, at most the budget>", '
        '"artifact_spec": "<one short line describing what you would build>", '
        '"reason": "<one sentence>"}\n'
        "Use \"none\" if you would rather do nothing this cycle. Include only the fields your action needs."
    )
    return "\n".join(lines)


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """Return the first balanced {...} object parsed from text, or None."""
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start : i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except json.JSONDecodeError:
                        break  # malformed — try the next "{"
        start = text.find("{", start + 1)
    return None


def parse_economic_decision(text: str) -> dict[str, Any] | None:
    """Parse an LLM reply into a normalized decision dict, or None.

    Returns a dict with the fixed keys in ``_KEYS`` (missing fields → None), or
    None when no valid JSON object with a known action is present.
    """
    if not isinstance(text, str) or not text.strip():
        return None
    obj = _extract_json_object(text)
    if obj is None:
        return None
    action = obj.get("action")
    if action not in _VALID_ACTIONS:
        return None
    return {k: obj.get(k) for k in _KEYS}
