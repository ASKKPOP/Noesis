"""Economic goal — Task 3: the standing economic target is salient in the prompt."""
from __future__ import annotations

from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType


def test_describe_marks_economic_goal_as_standing():
    mgr = TelosManager.from_yaml({"short_term": ["Wake up"]})
    text = mgr.describe()
    # The economic goal is present and flagged as an ongoing target, not a to-do.
    assert "compute-labor" in text
    assert "standing economic target" in text


def test_describe_has_no_economic_marker_when_opted_out():
    mgr = TelosManager.from_yaml({"earn_money": False, "short_term": ["Wake up"]})
    text = mgr.describe()
    assert "standing economic target" not in text


def test_general_goals_are_not_marked():
    mgr = TelosManager()
    mgr.add_goal("Learn the Grid", GoalType.SHORT_TERM)
    text = mgr.describe()
    assert "standing economic target" not in text
