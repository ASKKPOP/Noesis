"""Task lifecycle types + a markdown render of the activity report."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TaskPhase(str, Enum):
    PLAN = "plan"
    BUILD = "build"
    QA = "qa"
    DONE = "done"
    FAILED = "failed"


@dataclass(frozen=True)
class TaskStep:
    """One completed lifecycle phase — auditable (digest only, no raw output)."""

    phase: TaskPhase
    summary: str
    output_sha256: str
    ok: bool


@dataclass
class ActivityReport:
    """The outcome of a task run — Brain-side structured report.

    ``render()`` is the seed visualization; the Grid-side visual mirror rides
    the Phase-72b producer pipeline.
    """

    task: str
    steps: list[TaskStep] = field(default_factory=list)
    status: TaskPhase = TaskPhase.FAILED

    def render(self) -> str:
        lines = [f"# Task: {self.task}", "", f"**Status:** {self.status.value.upper()}", ""]
        for s in self.steps:
            mark = "✓" if s.ok else "✗"
            lines.append(f"- {mark} **{s.phase.value}** — {s.summary}  `{s.output_sha256[:12]}…`")
        return "\n".join(lines)
