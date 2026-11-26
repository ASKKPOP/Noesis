"""A Nous's part in a Work — which step is its own, and what it may send.

A Work goes round nine stages on one card kept by the Grid
(grid/src/work/work-logic.ts). A person sets it up (goal, define, plan). From
there it belongs to Nous: the builder answers the request, builds, tests,
deploys and announces; another Nous verifies. This module is the Brain's side
of that, as pure functions:

  my_step(card, me)    which step is this Nous's to take on this card now
  next_plan_step, next_check
                       what exactly the step is about
  parse_*              turn whatever the model said into the body of the
                       Grid route, or into nothing

Nothing here calls the model or the Grid. The Grid decides again when a write
arrives; this only keeps the Brain from sending what would be refused.

Verified under the Triple Verification Rule as P-NOUSWORK-01..03
(verification/PROPERTIES.md).
"""

from __future__ import annotations

import json
from typing import Any

# The Grid's limits (WORK_LIMITS in grid/src/work/work-logic.ts), in characters.
FIELD_MAX = 1000
NOTICE_MAX = 4000

# step -> the path of its write route under /api/v1/works/:id/
STEP_ROUTE = {
    "answer": "answer",
    "build": "build",
    "test": "test",
    "verify": "verify",
    "deploy": "deploy",
    "notice": "notice",
}

# stage -> the step a builder takes in it
_BUILDER_STEP = {
    "goal": "answer",
    "build": "build",
    "test": "test",
    "deploy": "deploy",
    "notice": "notice",
}


def _is_did(value: Any) -> bool:
    return isinstance(value, str) and len(value) > 0


def card_version(card: Any) -> int | None:
    """The version a write on this card must name, or None when the card has none."""
    if not isinstance(card, dict):
        return None
    version = card.get("version")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        return None
    return version


def my_step(card: Any, me: str) -> str | None:
    """The step that is this Nous's to take on this card now, or None.

    The builder answers, builds, tests, deploys and announces its own Work. A
    Nous verifies only a Work it does not build. Define and Plan are the
    owner's to set and are left alone. A card that is not well-formed gives
    None.
    """
    if not _is_did(me) or not isinstance(card, dict):
        return None
    stage = card.get("stage")
    builder = card.get("builder")
    if not isinstance(stage, str) or not _is_did(builder):
        return None
    if not isinstance(card.get("work_id"), str) or card_version(card) is None:
        return None
    if stage == "verify":
        return "verify" if builder != me else None
    if builder != me:
        return None
    return _BUILDER_STEP.get(stage)


def next_plan_step(card: Any) -> dict[str, Any] | None:
    """The first plan step that is not done: {"step": n, "do": text}, or None."""
    plan = card.get("plan") if isinstance(card, dict) else None
    if not isinstance(plan, list):
        return None
    for index, item in enumerate(plan):
        if not isinstance(item, dict):
            return None
        if item.get("done") is True:
            continue
        todo = item.get("do")
        if not isinstance(todo, str) or not todo.strip():
            return None
        return {"step": index + 1, "do": todo}
    return None


def next_check(card: Any) -> dict[str, Any] | None:
    """The first check with no passed result: {"check": n, "text": text}, or None."""
    if not isinstance(card, dict):
        return None
    checks = card.get("checks")
    results = card.get("results")
    if not isinstance(checks, list) or not isinstance(results, list) or len(checks) != len(results):
        return None
    for index, text in enumerate(checks):
        result = results[index]
        if isinstance(result, dict) and result.get("passed") is True:
            continue
        if not isinstance(text, str) or not text.strip():
            return None
        return {"check": index + 1, "text": text}
    return None


# ── What the model said → the body of a route ────────────────────────────────


def _answer_of(text: Any) -> dict[str, Any] | None:
    """The JSON object in the model's answer, or None. Words around it are ignored."""
    if not isinstance(text, str):
        return None
    for candidate in (text, text[text.find("{"): text.rfind("}") + 1] if "{" in text and "}" in text else ""):
        if not candidate:
            continue
        try:
            value = json.loads(candidate)
        except (ValueError, RecursionError):
            continue
        if isinstance(value, dict):
            return value
    return None


def _text(value: Any, limit: int) -> str | None:
    """A non-empty text, trimmed and cut to the Grid's limit; or None."""
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return trimmed[:limit].strip() or None


def parse_answer(text: Any) -> dict[str, Any] | None:
    """{"accept": bool, "reason": str}. Declining needs a reason; accepting may give one."""
    said = _answer_of(text)
    if said is None or not isinstance(said.get("accept"), bool):
        return None
    reason = _text(said.get("reason"), FIELD_MAX)
    if said["accept"]:
        return {"accept": True, "reason": reason or ""}
    if reason is None:
        return None
    return {"accept": False, "reason": reason}


def build_body(step: int, outcome: Any) -> dict[str, Any] | None:
    """{"step": n, "note": str} for a step the Nous says it did, with what it did.

    The model is told to begin with CANNOT when it could not do the step; then,
    and when it said nothing, there is no body: the step is not marked done.
    """
    if isinstance(step, bool) or not isinstance(step, int) or step < 1:
        return None
    note = _text(outcome, FIELD_MAX)
    if note is None or note.upper().startswith("CANNOT"):
        return None
    return {"step": step, "note": note}


def parse_test(text: Any, check: int) -> dict[str, Any] | None:
    """{"check": n, "passed": bool, "evidence": str}."""
    if isinstance(check, bool) or not isinstance(check, int) or check < 1:
        return None
    said = _answer_of(text)
    if said is None or not isinstance(said.get("passed"), bool):
        return None
    evidence = _text(said.get("evidence"), FIELD_MAX)
    if evidence is None:
        return None
    return {"check": check, "passed": said["passed"], "evidence": evidence}


def parse_verify(text: Any) -> dict[str, Any] | None:
    """{"confirm": bool, "reason": str}. A reason is needed either way."""
    said = _answer_of(text)
    if said is None or not isinstance(said.get("confirm"), bool):
        return None
    reason = _text(said.get("reason"), FIELD_MAX)
    if reason is None:
        return None
    return {"confirm": said["confirm"], "reason": reason}


def parse_deploy(text: Any) -> dict[str, Any] | None:
    """{"where": str, "changed": str}."""
    said = _answer_of(text)
    if said is None:
        return None
    where = _text(said.get("where"), FIELD_MAX)
    changed = _text(said.get("changed"), FIELD_MAX)
    if where is None or changed is None:
        return None
    return {"where": where, "changed": changed}


def parse_notice(text: Any) -> dict[str, Any] | None:
    """{"goal_info": str, "guide": str, "presentation": str}."""
    said = _answer_of(text)
    if said is None:
        return None
    parts = {key: _text(said.get(key), NOTICE_MAX) for key in ("goal_info", "guide", "presentation")}
    if any(value is None for value in parts.values()):
        return None
    return parts


# ── What the Nous is shown ────────────────────────────────────────────────────


def card_brief(card: dict[str, Any]) -> str:
    """The card as plain lines, for a prompt. Only what is on the card."""
    lines = [f"Goal: {card.get('goal', '')}", f"For whom: {card.get('for_whom', '')}"]
    if card.get("for_what"):
        lines += [f"For what: {card.get('for_what')}", f"How: {card.get('how')}"]
    which = card.get("which")
    if isinstance(which, list) and which:
        lines.append("Which: " + ", ".join(str(w) for w in which))
    checks = card.get("checks")
    results = card.get("results")
    if isinstance(checks, list) and checks:
        lines.append("Checks:")
        for index, check in enumerate(checks):
            result = results[index] if isinstance(results, list) and index < len(results) else None
            if isinstance(result, dict):
                verdict = "passed" if result.get("passed") is True else "failed"
                lines.append(f"  {index + 1}. {check} — {verdict}: {result.get('evidence', '')}")
            else:
                lines.append(f"  {index + 1}. {check}")
    plan = card.get("plan")
    if isinstance(plan, list) and plan:
        lines.append("Plan:")
        for item in plan:
            if isinstance(item, dict):
                mark = "done" if item.get("done") is True else "to do"
                note = f" — {item.get('note')}" if item.get("note") else ""
                lines.append(f"  {item.get('step')}. {item.get('do')} ({mark}){note}")
    refusal = card.get("last_refusal")
    if isinstance(refusal, dict):
        lines.append(f"A verifier sent this back to Test: {refusal.get('reason', '')}")
    result = card.get("result")
    if isinstance(result, dict):
        lines += [f"Where it lives: {result.get('where', '')}", f"What it changed: {result.get('changed', '')}"]
    return "\n".join(lines)


ABILITIES = (
    "What you can really do: think, search the web, read web pages, and run code in a sandbox. "
    "You cannot yet buy land, build structures or move things in the Grid through this work."
)


def prompt_for(step: str, card: dict[str, Any], detail: dict[str, Any] | None = None) -> str:
    """What the Nous is asked for one step. The answer format is the body its parser reads."""
    brief = card_brief(card)
    if step == "answer":
        return (
            "A member of your Grid asks you to build this:\n\n" + brief + "\n\n" + ABILITIES + "\n"
            "It is a request, not an order. Accept only what you can do and want to do.\n"
            'Answer with JSON only: {"accept": true or false, "reason": "why"}'
        )
    if step == "build":
        todo = (detail or {}).get("do", "")
        return (
            "You are building this Work:\n\n" + brief + "\n\n"
            f"Do this step now, using your tools where they help: {todo}\n" + ABILITIES + "\n"
            "Then say in a few sentences what you did and what came of it. "
            "If you could not do the step, begin your answer with the word CANNOT and say why."
        )
    if step == "test":
        check = (detail or {}).get("text", "")
        return (
            "You built this Work and now test it:\n\n" + brief + "\n\n"
            f"Check this, honestly, using your tools where they help: {check}\n"
            "A check you cannot show to hold has failed.\n"
            'End with JSON only: {"passed": true or false, "evidence": "what you saw"}'
        )
    if step == "verify":
        return (
            "Another Nous built this Work and asks for verification. You did not build it.\n\n" + brief + "\n\n"
            "Judge it against its checks and the evidence given. Confirm only if the evidence shows the checks hold; "
            "otherwise refuse, and it goes back to be tested again. Give your reasons either way.\n"
            'Answer with JSON only: {"confirm": true or false, "reason": "your reasons"}'
        )
    if step == "deploy":
        return (
            "Your Work was verified:\n\n" + brief + "\n\n"
            "Say where the result now lives and what it changed, going only by what you did above. "
            "Unless one of your tools really stored it somewhere, it lives on this Work Card, in your build notes: "
            "do not name a file, a repository or a place you did not write to.\n"
            'Answer with JSON only: {"where": "…", "changed": "…"}'
        )
    return (
        "Your Work is deployed:\n\n" + brief + "\n\n"
        "Announce it so a newcomer can follow: what the goal was and what now exists, how to use it, "
        "and how it was made.\n"
        'Answer with JSON only: {"goal_info": "…", "guide": "…", "presentation": "…"}'
    )
