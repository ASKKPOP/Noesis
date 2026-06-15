"""TaskRunner — drives a task through plan → build → QA over the tool loop.

Each phase is one ToolRunner conversation with a phase-specific system prompt;
the run_code sandbox (when registered) is available throughout build + QA so the
mind writes and tests real code. The result is an ActivityReport of digests.
"""
from __future__ import annotations

import hashlib

from noesis_brain.llm.base import LLMAdapter
from noesis_brain.tasks.types import ActivityReport, TaskPhase, TaskStep
from noesis_brain.tools.registry import ToolRegistry
from noesis_brain.tools.runner import RunResult, ToolRunner

_PLAN_SYS = (
    "You are planning a software task. Produce a short, concrete plan: the steps "
    "to build it and how you will test it. Do not write code yet."
)
_BUILD_SYS = (
    "You are building the task. Write the code and run it with the run_code tool "
    "to check it executes. Summarise what you built."
)
_QA_SYS = (
    "You are testing the task. Write and run tests with the run_code tool. End your "
    "reply with exactly 'QA: PASS' if everything passes, or 'QA: FAIL <reason>'."
)


def _summary(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:120]
    return "(no output)"


def _step(phase: TaskPhase, result: RunResult, ok: bool) -> TaskStep:
    digest = hashlib.sha256(result.final_text.encode("utf-8")).hexdigest()
    return TaskStep(phase=phase, summary=_summary(result.final_text), output_sha256=digest, ok=ok)


class TaskRunner:
    """Runs one task through the plan→build→QA lifecycle."""

    def __init__(self, adapter: LLMAdapter, registry: ToolRegistry, max_iterations: int = 6) -> None:
        self._loop = ToolRunner(adapter, registry, max_iterations)

    async def run(self, task: str) -> ActivityReport:
        plan = await self._loop.run(system=_PLAN_SYS, user=task)
        build = await self._loop.run(
            system=_BUILD_SYS, user=f"{task}\n\nPlan:\n{plan.final_text}"
        )
        qa = await self._loop.run(
            system=_QA_SYS, user=f"{task}\n\nBuilt:\n{build.final_text}"
        )

        qa_ok = "FAIL" not in qa.final_text.upper()
        steps = [
            _step(TaskPhase.PLAN, plan, ok=True),
            _step(TaskPhase.BUILD, build, ok=True),
            _step(TaskPhase.QA, qa, ok=qa_ok),
        ]
        status = TaskPhase.DONE if qa_ok else TaskPhase.FAILED
        return ActivityReport(task=task, steps=steps, status=status)
