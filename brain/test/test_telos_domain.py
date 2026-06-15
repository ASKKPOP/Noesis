"""Economic goal — Task 1: GoalDomain + Goal.domain (orthogonal to GoalType horizon)."""
from __future__ import annotations

from noesis_brain.telos.types import Goal, GoalDomain, GoalType


def test_goal_defaults_to_general_domain() -> None:
    g = Goal(description="Learn philosophy", goal_type=GoalType.LONG_TERM)
    assert g.domain == GoalDomain.GENERAL


def test_goal_can_be_economic() -> None:
    g = Goal(
        description="Earn a living through compute-labor",
        goal_type=GoalType.LONG_TERM,
        domain=GoalDomain.ECONOMIC,
    )
    assert g.domain == GoalDomain.ECONOMIC
    assert g.goal_type == GoalType.LONG_TERM  # domain is orthogonal to horizon


def test_domain_is_string_enum() -> None:
    assert GoalDomain.ECONOMIC.value == "economic"
    assert GoalDomain.GENERAL.value == "general"
