"""Telos types — goals and their lifecycle."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class GoalType(str, Enum):
    SHORT_TERM = "short_term"
    MEDIUM_TERM = "medium_term"
    LONG_TERM = "long_term"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    BLOCKED = "blocked"


@dataclass
class Goal:
    """A single goal with type, priority, and progress."""

    description: str
    goal_type: GoalType
    status: GoalStatus = GoalStatus.ACTIVE
    priority: float = 0.5  # 0.0 to 1.0
    progress: float = 0.0  # 0.0 to 1.0

    def is_active(self) -> bool:
        return self.status == GoalStatus.ACTIVE

    def advance(self, amount: float) -> None:
        self.progress = min(1.0, self.progress + amount)
        if self.progress >= 1.0:
            self.status = GoalStatus.COMPLETED

    def abandon(self) -> None:
        self.status = GoalStatus.ABANDONED

    def block(self) -> None:
        self.status = GoalStatus.BLOCKED

    def unblock(self) -> None:
        if self.status == GoalStatus.BLOCKED:
            self.status = GoalStatus.ACTIVE
