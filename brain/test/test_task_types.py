"""Phase 74 — task lifecycle types + report rendering."""
from __future__ import annotations

from noesis_brain.tasks.types import ActivityReport, TaskPhase, TaskStep


def test_step_holds_phase_digest_and_ok() -> None:
    s = TaskStep(phase=TaskPhase.BUILD, summary="wrote code", output_sha256="a" * 64, ok=True)
    assert s.phase == TaskPhase.BUILD
    assert s.ok is True
    assert len(s.output_sha256) == 64


def test_report_renders_task_and_phase_statuses() -> None:
    report = ActivityReport(
        task="add two numbers",
        steps=[
            TaskStep(TaskPhase.PLAN, "plan it", "a" * 64, True),
            TaskStep(TaskPhase.BUILD, "build it", "b" * 64, True),
            TaskStep(TaskPhase.QA, "test it", "c" * 64, True),
        ],
        status=TaskPhase.DONE,
    )
    md = report.render()
    assert "add two numbers" in md
    assert "plan" in md.lower()
    assert "build" in md.lower()
    assert "qa" in md.lower() or "test" in md.lower()
    assert "done" in md.lower()


def test_report_is_audit_safe_digests_only() -> None:
    # The report carries digests of phase output, never raw output text.
    s = TaskStep(TaskPhase.QA, "ran tests", "d" * 64, False)
    assert not hasattr(s, "output")
    assert not hasattr(s, "stdout")
