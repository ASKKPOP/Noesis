"""Decision + planning prompts (W-A1/A2) — the mind's two timescales.

Slow planner (every ~200 ticks): decompose the top-priority goal into 2–4
concrete tasks, informed by recent memories and reflections.

Fast actor (every ~20 ticks): given the goal, the next ledger task, and recent
Reflexion lessons, choose ONE small action: work_task · speak · rest.

Small-model discipline (see the W3b economic protocol): the model returns one
tiny JSON object; parsing is tolerant (first JSON object found); every value is
validated Brain-side before anything is executed.
"""

from __future__ import annotations

import json
import re
from typing import Any

_MAX_TASKS = 4
_DECISION_ACTIONS = {"work_task", "speak", "rest"}

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _first_json_object(text: str) -> dict[str, Any] | None:
    """Extract the first JSON object from possibly-prose-wrapped model output."""
    if not text:
        return None
    match = _JSON_RE.search(text)
    if match is None:
        return None
    try:
        obj = json.loads(match.group(0))
    except (json.JSONDecodeError, ValueError):
        return None
    return obj if isinstance(obj, dict) else None


def build_planning_prompt(
    goal_desc: str,
    memories_text: str = "",
    reflections: list[str] | None = None,
) -> str:
    lines = [
        "You are planning how to pursue one of your goals.",
        "",
        f"GOAL: {goal_desc}",
    ]
    if memories_text:
        lines += ["", "Recent experiences:", memories_text]
    if reflections:
        lines += ["", "Your recent reflections:"]
        lines += [f"- {r}" for r in reflections]
    lines += [
        "",
        "Break this goal into 2-4 small, concrete tasks you can act on yourself,",
        "in order. Respond with ONLY a JSON object:",
        '{"tasks": ["first task", "second task"]}',
    ]
    return "\n".join(lines)


def build_decision_prompt(
    goal_desc: str,
    task_desc: str | None,
    lessons: list[str] | None = None,
) -> str:
    lines = [
        "Decide what to do right now, in one small step.",
        "",
        f"CURRENT GOAL: {goal_desc}",
    ]
    if task_desc:
        lines.append(f"NEXT TASK: {task_desc}")
    if lessons:
        lines += ["", "Lessons from past failures:"]
        lines += [f"- {l}" for l in lessons]
    if task_desc:
        options = (
            '- {"action": "work_task", "note": "<what you did / concluded>", "completed": <true if the task is now done>}\n'
            '- {"action": "speak", "text": "<something short worth saying publicly>"}\n'
            '- {"action": "rest", "note": "<why>"}'
        )
    else:
        options = (
            '- {"action": "speak", "text": "<something short worth saying publicly>"}\n'
            '- {"action": "rest", "note": "<why>"}'
        )
    lines += [
        "",
        "Choose exactly ONE and respond with ONLY that JSON object:",
        options,
    ]
    return "\n".join(lines)


def parse_task_list(text: str) -> list[str] | None:
    """Parse {"tasks": [...]} → list of 1-4 non-empty task strings, or None."""
    obj = _first_json_object(text)
    if obj is None:
        return None
    tasks = obj.get("tasks")
    if not isinstance(tasks, list):
        return None
    cleaned = [t.strip() for t in tasks if isinstance(t, str) and t.strip()]
    if not cleaned:
        return None
    return cleaned[:_MAX_TASKS]


def parse_decision(text: str) -> dict[str, Any] | None:
    """Parse a decision object; unknown/missing action → None (guardrail)."""
    obj = _first_json_object(text)
    if obj is None:
        return None
    if obj.get("action") not in _DECISION_ACTIONS:
        return None
    return obj
