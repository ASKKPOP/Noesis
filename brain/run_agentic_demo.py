#!/usr/bin/env python3
"""Run a real Nous through the agentic loop — live LLM + Docker sandbox.

Demonstrates Phase 72/73/74 end-to-end: the model decides to call web_search,
web_fetch, and run_code on its own, then a plan->build->QA task over the sandbox.

Requires:
  - ANTHROPIC_API_KEY in the environment (tool use needs a tool-capable model)
  - Docker running (for the run_code sandbox)

Usage:  .venv/bin/python run_agentic_demo.py
"""
from __future__ import annotations

import asyncio
import os
import sys

from noesis_brain.sandbox.executor import docker_available
from noesis_brain.tasks.runner import TaskRunner
from noesis_brain.tools.agentic import build_agentic_registry
from noesis_brain.tools.runner import ToolRunner


def _make_adapter():
    """Pick the LLM: NOESIS_LLM=ollama → local qwen3 (free); else Claude if a key
    is set; default to Ollama so testing doesn't bill the Claude API."""
    choice = os.environ.get("NOESIS_LLM", "").lower()
    if choice == "claude" or (choice != "ollama" and os.environ.get("ANTHROPIC_API_KEY")):
        from noesis_brain.llm.claude import ClaudeAdapter
        return ClaudeAdapter(model="claude-sonnet-4-6"), "claude"
    from noesis_brain.llm.ollama import OllamaAdapter
    return OllamaAdapter(model=os.environ.get("OLLAMA_MODEL", "qwen3:4b")), "ollama"


async def main() -> int:
    adapter, name = _make_adapter()
    registry = build_agentic_registry()
    tools = [s.name for s in registry.specs()]
    print(f"🧠 Nous online · adapter={name} · docker={docker_available()} · tools={tools}\n")

    # 1) Interactive research + compute loop (model chooses the tools).
    print("── Agentic research+compute loop ───────────────────────────────")
    runner = ToolRunner(adapter, registry, max_iterations=8)
    result = await runner.run(
        system="You are an autonomous Nous. Use tools to answer concretely.",
        user=(
            "Use web_search + web_fetch to find one current fact about the Python "
            "programming language, then use run_code to compute and print 6*7. "
            "Report the fact and the computed number."
        ),
    )
    for t in result.trace:
        flag = " (error)" if t.is_error else ""
        print(f"  · tool={t.tool_name}{flag}  digest={t.output_sha256[:12]}…")
    print(f"\n  final answer:\n  {result.final_text}\n")

    # 2) Plan -> build -> QA task over the sandbox (Phase 74).
    print("── Plan → build → QA task ──────────────────────────────────────")
    report = await TaskRunner(adapter, registry).run(
        "Write a Python function is_prime(n) and test it on a few values."
    )
    print(report.render())
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
