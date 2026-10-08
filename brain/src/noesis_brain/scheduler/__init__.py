"""Job Scheduler (spec §3) — a Nous queues work for its own future self.

A durable, per-Nous queue of self-scheduled tasks. Each task names a ``kind``, a
JSON payload, the world tick it becomes due, and a priority; on each tick the
Brain pops at most one due task and dispatches it by kind. Pending tasks live in
SQLite, so they survive a Brain restart. Payloads stay Brain-local (privacy,
like reminder notes).

Tick-driven only — no wall-clock, no randomness.
"""

from noesis_brain.scheduler.queue import MAX_PENDING, ScheduledTask, TaskQueue

__all__ = ["MAX_PENDING", "ScheduledTask", "TaskQueue"]
