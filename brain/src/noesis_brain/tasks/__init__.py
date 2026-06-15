"""Phase 74 — task lifecycle (plan → build → QA) + activity reporting (spec §3).

A TaskRunner drives a task through three named phases over the Phase-73 run_code
sandbox, producing an ActivityReport. The report carries only digests of each
phase's output (audit-safe); raw output stays Brain-local.

Grid-side visualization of the report rides the Phase-72b producer pipeline.
"""

from noesis_brain.tasks.types import ActivityReport, TaskPhase, TaskStep

__all__ = ["ActivityReport", "TaskPhase", "TaskStep"]
