"""Reminder types + store. Tick-scheduled and/or condition-based, fire-once."""
from __future__ import annotations

import operator
from dataclasses import dataclass

_OPS = {
    ">=": operator.ge,
    "<=": operator.le,
    ">": operator.gt,
    "<": operator.lt,
    "==": operator.eq,
}


@dataclass(frozen=True)
class ReminderCondition:
    """Fires when ``context[signal] <op> value`` holds (e.g. curiosity >= 0.7)."""

    signal: str
    op: str
    value: float

    def matches(self, context: dict[str, float]) -> bool:
        if self.signal not in context:
            return False
        fn = _OPS.get(self.op)
        return bool(fn(context[self.signal], self.value)) if fn else False


@dataclass
class Reminder:
    """A self-set reminder. ``note`` is Brain-local — never crosses the boundary.

    Fires when its tick arrives OR its condition is met (whichever first).
    """

    id: str
    note: str
    due_tick: int | None = None
    condition: ReminderCondition | None = None
    fired: bool = False

    def is_due(self, current_tick: int, context: dict[str, float] | None) -> bool:
        if self.fired:
            return False
        if self.due_tick is not None and current_tick >= self.due_tick:
            return True
        if self.condition is not None and context is not None and self.condition.matches(context):
            return True
        return False


class ReminderStore:
    """Holds a Nous's reminders. In-memory (mirrors telos/registry flags)."""

    def __init__(self) -> None:
        self._reminders: list[Reminder] = []
        self._counter = 0

    def schedule(
        self,
        note: str,
        due_tick: int | None = None,
        condition: ReminderCondition | None = None,
    ) -> Reminder:
        self._counter += 1
        reminder = Reminder(
            id=f"rem-{self._counter}", note=note, due_tick=due_tick, condition=condition
        )
        self._reminders.append(reminder)
        return reminder

    def due(self, current_tick: int, context: dict[str, float] | None = None) -> list[Reminder]:
        """Active reminders whose tick arrived or condition is met, in schedule order."""
        return [r for r in self._reminders if r.is_due(current_tick, context)]

    def fire_due(
        self, current_tick: int, context: dict[str, float] | None = None
    ) -> list[Reminder]:
        """Mark all due reminders fired and return them (idempotent — fires once)."""
        due = self.due(current_tick, context)
        for r in due:
            r.fired = True
        return due

    def pending(self) -> list[Reminder]:
        return [r for r in self._reminders if not r.fired]
