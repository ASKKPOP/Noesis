"""Phase 74 — TaskRunner drives plan→build→QA and produces an ActivityReport.

Fixture-verifiable: a queue adapter returns one final text per phase (no Docker,
no network). Real runs need a live LLM + the run_code sandbox.
"""
from __future__ import annotations

import hashlib

from noesis_brain.llm.base import LLMAdapter
from noesis_brain.llm.types import LLMResponse
from noesis_brain.tasks.runner import TaskRunner
from noesis_brain.tasks.types import TaskPhase
from noesis_brain.tools.registry import ToolRegistry


class _QueueAdapter(LLMAdapter):
    """Returns successive final texts — one per ToolRunner.run (phase)."""

    def __init__(self, texts: list[str]) -> None:
        self._texts = list(texts)

    @property
    def provider_name(self) -> str:
        return "queue"

    async def generate(self, prompt, options=None):  # pragma: no cover
        raise NotImplementedError

    async def generate_with_tools(self, messages, tools, options=None) -> LLMResponse:
        text = self._texts.pop(0) if self._texts else ""
        return LLMResponse(text=text, model="queue", provider="queue", stop_reason="end_turn")

    async def list_models(self):
        return ["queue"]

    async def is_available(self):
        return True


async def test_three_phases_success_marks_done():
    adapter = _QueueAdapter(["PLAN: add a function", "BUILD: wrote add()", "QA: PASS all green"])
    report = await TaskRunner(adapter, ToolRegistry()).run("add two numbers")

    assert [s.phase for s in report.steps] == [TaskPhase.PLAN, TaskPhase.BUILD, TaskPhase.QA]
    assert report.status == TaskPhase.DONE
    assert all(len(s.output_sha256) == 64 for s in report.steps)
    # digest is of the phase's final text (audit-safe)
    assert report.steps[0].output_sha256 == hashlib.sha256(b"PLAN: add a function").hexdigest()


async def test_qa_failure_marks_failed():
    adapter = _QueueAdapter(["PLAN: x", "BUILD: y", "QA: FAIL assertion error on line 3"])
    report = await TaskRunner(adapter, ToolRegistry()).run("buggy task")

    assert report.status == TaskPhase.FAILED
    assert report.steps[2].phase == TaskPhase.QA
    assert report.steps[2].ok is False


async def test_report_renders_markdown():
    adapter = _QueueAdapter(["PLAN: x", "BUILD: y", "QA: PASS"])
    report = await TaskRunner(adapter, ToolRegistry()).run("compute primes")
    md = report.render()
    assert "compute primes" in md
    assert "DONE" in md
