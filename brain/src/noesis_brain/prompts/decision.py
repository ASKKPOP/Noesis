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


def build_skill_distill_prompt(goal_desc: str, done_tasks: list[str]) -> str:
    """W-A6 (Voyager verify-then-add): distill a COMPLETED goal's task
    trajectory into one reusable text skill. Runs at sleep-time only."""
    lines = [
        "You just completed a goal. Distill HOW you did it into one reusable skill",
        "another future situation could reuse.",
        "",
        f"COMPLETED GOAL: {goal_desc}",
        "Tasks you completed, in order:",
    ]
    lines += [f"{i + 1}. {t}" for i, t in enumerate(done_tasks)]
    lines += [
        "",
        "Respond with ONLY a JSON object:",
        '{"name": "<short_snake_case_slug>", "description": "<≤200 chars, what this skill achieves>",'
        ' "instructions": "<≤1000 chars, how to do it step by step>", "triggers": ["<keyword>", "<keyword>"]}',
    ]
    return "\n".join(lines)


_SLUG_RE = re.compile(r"[^a-z0-9_]+")


def parse_skill(text: str) -> dict[str, Any] | None:
    """Parse a distilled skill; requires name + instructions; sanitizes the
    name into a slug that passes Skill.validate() (alnum + underscore)."""
    obj = _first_json_object(text)
    if obj is None:
        return None
    name = obj.get("name")
    instructions = obj.get("instructions")
    if not isinstance(name, str) or not name.strip():
        return None
    if not isinstance(instructions, str) or not instructions.strip():
        return None
    slug = _SLUG_RE.sub("_", name.strip().lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)
    if not slug:
        return None
    description = obj.get("description")
    triggers = obj.get("triggers")
    return {
        "name": slug,
        "description": description.strip() if isinstance(description, str) else slug,
        "instructions": instructions.strip(),
        "triggers": [t.strip() for t in triggers if isinstance(t, str) and t.strip()][:5]
        if isinstance(triggers, list) else [],
    }


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
