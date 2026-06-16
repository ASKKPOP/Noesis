"""Reminder & Wake-Up (spec §3) — a Nous never sits idle.

A Nous can schedule a reminder for a future world tick; on each tick the Brain
fires any that are due, surfacing them into perception so the Nous "wakes" to
act on them. Reminder notes stay Brain-local (privacy, like reflections).

Tick-scheduled only for now; condition-based reminders are a deferred follow-up.
"""

from noesis_brain.reminders.store import Reminder, ReminderStore

__all__ = ["Reminder", "ReminderStore"]
