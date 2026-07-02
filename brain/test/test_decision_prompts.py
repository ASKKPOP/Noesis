"""W-A1/A2 — decision + planning prompt builders and tolerant parsers.

Small-model discipline: one tiny JSON object per decision, parsed tolerantly,
every value validated Brain-side (mirrors the W3b economic-decision protocol).
"""
from noesis_brain.prompts.decision import (
    build_decision_prompt,
    build_planning_prompt,
    parse_decision,
    parse_task_list,
)

GOAL = "Map the energy needs of the residential ring"


# ── builders ─────────────────────────────────────────────────────────────────
def test_planning_prompt_names_goal_and_asks_for_json_tasks():
    p = build_planning_prompt(GOAL, memories_text="saw a brownout", reflections=["power is scarce"])
    assert GOAL in p
    assert '"tasks"' in p
    assert "saw a brownout" in p
    assert "power is scarce" in p


def test_decision_prompt_includes_goal_task_and_lessons():
    p = build_decision_prompt(GOAL, "survey parcels", lessons=["Lesson: bids over budget get rejected"])
    assert GOAL in p and "survey parcels" in p
    assert "bids over budget" in p
    assert "work_task" in p and "speak" in p and "rest" in p


def test_decision_prompt_without_task_offers_no_work_task():
    p = build_decision_prompt(GOAL, None, lessons=[])
    assert "work_task" not in p  # can't work a task that doesn't exist
    assert "speak" in p and "rest" in p


# ── parse_task_list ──────────────────────────────────────────────────────────
def test_parse_task_list_happy_path():
    out = parse_task_list('{"tasks": ["a", "b", "c"]}')
    assert out == ["a", "b", "c"]


def test_parse_task_list_tolerates_prose_and_caps_at_four():
    text = 'Sure! Here is my plan:\n{"tasks": ["1", "2", "3", "4", "5", ""]}\nDone.'
    out = parse_task_list(text)
    assert out == ["1", "2", "3", "4"]


def test_parse_task_list_rejects_garbage():
    assert parse_task_list("no json here") is None
    assert parse_task_list('{"tasks": "not a list"}') is None
    assert parse_task_list('{"tasks": []}') is None


# ── parse_decision ───────────────────────────────────────────────────────────
def test_parse_decision_happy_path():
    d = parse_decision('{"action": "work_task", "note": "counted 24 parcels", "completed": true}')
    assert d["action"] == "work_task"
    assert d["completed"] is True


def test_parse_decision_tolerates_surrounding_prose():
    d = parse_decision('I think...\n{"action": "speak", "text": "hello agora"}\nthanks')
    assert d["action"] == "speak"
    assert d["text"] == "hello agora"


def test_parse_decision_rejects_unknown_action_and_garbage():
    assert parse_decision('{"action": "hack_the_grid"}') is None
    assert parse_decision("") is None
    assert parse_decision("not json") is None
