"""Reminder types + store. Tick-scheduled, fire-once, deterministic ids."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Reminder:
    """A self-set reminder. ``note`` is Brain-local — never crosses the boundary."""

    id: str
    note: str
    due_tick: int
    fired: bool = False


class ReminderStore:
    """Holds a Nous's reminders. In-memory (mirrors telos/registry flags)."""

    def __init__(self) -> None:
        self._reminders: list[Reminder] = []
        self._counter = 0

    def schedule(self, note: str, due_tick: int) -> Reminder:
        self._counter += 1
        reminder = Reminder(id=f"rem-{self._counter}", note=note, due_tick=due_tick)
        self._reminders.append(reminder)
        return reminder

    def due(self, current_tick: int) -> list[Reminder]:
        """Active (unfired) reminders whose due_tick has arrived, in schedule order."""
        return [r for r in self._reminders if not r.fired and r.due_tick <= current_tick]

    def fire_due(self, current_tick: int) -> list[Reminder]:
        """Mark all due reminders fired and return them (idempotent — fires once)."""
        due = self.due(current_tick)
        for r in due:
            r.fired = True
        return due

    def pending(self) -> list[Reminder]:
        return [r for r in self._reminders if not r.fired]
