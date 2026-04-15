"""Telos manager — manages goals from YAML config and runtime updates."""

from __future__ import annotations

from typing import Any

from noesis_brain.telos.types import Goal, GoalStatus, GoalType


class TelosManager:
    """Manages the goal system for a Nous."""

    def __init__(self) -> None:
        self._goals: list[Goal] = []

    def add_goal(self, description: str, goal_type: GoalType, priority: float = 0.5) -> Goal:
        goal = Goal(description=description, goal_type=goal_type, priority=priority)
        self._goals.append(goal)
        return goal

    def active_goals(self) -> list[Goal]:
        return [g for g in self._goals if g.is_active()]

    def goals_by_type(self, goal_type: GoalType) -> list[Goal]:
        return [g for g in self._goals if g.goal_type == goal_type and g.is_active()]

    def all_goals(self) -> list[Goal]:
        return list(self._goals)

    def top_priority(self, n: int = 3) -> list[Goal]:
        """Return top N active goals by priority."""
        active = self.active_goals()
        return sorted(active, key=lambda g: g.priority, reverse=True)[:n]

    def describe(self) -> str:
        """Natural-language description of active goals for prompts."""
        lines = []
        for gt in GoalType:
            goals = self.goals_by_type(gt)
            if goals:
                label = gt.value.replace("_", "-")
                lines.append(f"{label}:")
                for g in sorted(goals, key=lambda x: x.priority, reverse=True):
                    progress = f" [{g.progress:.0%}]" if g.progress > 0 else ""
                    lines.append(f"  - {g.description}{progress}")
        return "\n".join(lines) if lines else "No active goals."

    @classmethod
    def from_yaml(cls, data: dict[str, Any]) -> TelosManager:
        """Create from the telos section of a Nous YAML."""
        manager = cls()
        type_map = {
            "short_term": GoalType.SHORT_TERM,
            "medium_term": GoalType.MEDIUM_TERM,
            "long_term": GoalType.LONG_TERM,
        }
        for type_key, goal_type in type_map.items():
            goals = data.get(type_key, [])
            for i, desc in enumerate(goals):
                # Higher priority for shorter-term goals
                base_priority = {"short_term": 0.8, "medium_term": 0.5, "long_term": 0.3}
                priority = base_priority.get(type_key, 0.5) - (i * 0.05)
                manager.add_goal(desc, goal_type, priority=max(0.1, priority))
        return manager
