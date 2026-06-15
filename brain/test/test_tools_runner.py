"""Phase 72 — ToolRegistry + ToolRunner agentic loop (digest-only trace)."""
from __future__ import annotations

import hashlib

import pytest

from noesis_brain.llm.base import LLMAdapter
from noesis_brain.llm.types import GenerateOptions, LLMResponse, ToolCall, ToolSpec
from noesis_brain.tools.registry import ToolRegistry
from noesis_brain.tools.runner import ToolRunner


class _ScriptedAdapter(LLMAdapter):
    """Test-local adapter: replays scripted tool-call rounds, then a final text.

    Each entry in ``rounds`` is a list of (name, input) tuples for that turn;
    an empty list ends the loop with ``final_text``.
    """

    def __init__(self, rounds: list[list[tuple[str, dict]]], final_text: str) -> None:
        self._rounds = list(rounds)
        self._final_text = final_text
        self._counter = 0

    @property
    def provider_name(self) -> str:
        return "scripted"

    async def generate(self, prompt, options=None):  # pragma: no cover - unused
        raise NotImplementedError

    async def generate_with_tools(self, messages, tools, options=None) -> LLMResponse:
        round_calls = self._rounds.pop(0) if self._rounds else []
        if not round_calls:
            return LLMResponse(
                text=self._final_text, model="scripted", provider="scripted",
                stop_reason="end_turn",
            )
        calls = []
        for name, inp in round_calls:
            self._counter += 1
            calls.append(ToolCall(id=f"call_{self._counter}", name=name, input=inp))
        return LLMResponse(
            text="", model="scripted", provider="scripted",
            tool_calls=calls, stop_reason="tool_use",
        )

    async def list_models(self):
        return ["scripted"]

    async def is_available(self):
        return True


async def test_runner_executes_tool_then_returns_final():
    seen: list[dict] = []
    reg = ToolRegistry()
    reg.register(
        ToolSpec("echo", "echo", {"type": "object", "properties": {"q": {"type": "string"}}}),
        lambda inp: seen.append(inp) or f"echoed:{inp['q']}",
    )
    adapter = _ScriptedAdapter(rounds=[[("echo", {"q": "hi"})], []], final_text="all done")
    runner = ToolRunner(adapter, reg, max_iterations=5)

    result = await runner.run(system="s", user="please echo")

    assert seen == [{"q": "hi"}]                       # tool actually executed
    assert result.final_text == "all done"
    assert result.truncated is False
    assert result.trace[0].tool_name == "echo"
    assert result.trace[0].input == {"q": "hi"}
    # digest present; raw output is NOT stored on the (auditable) trace
    assert result.trace[0].output_sha256 == hashlib.sha256(b"echoed:hi").hexdigest()
    assert not hasattr(result.trace[0], "output")


async def test_runner_supports_async_handlers():
    reg = ToolRegistry()

    async def fetch(inp):
        return f"fetched:{inp['url']}"

    reg.register(ToolSpec("fetch", "f", {"type": "object", "properties": {}}), fetch)
    adapter = _ScriptedAdapter([[("fetch", {"url": "x"})], []], final_text="done")
    result = await ToolRunner(adapter, reg).run(system="s", user="u")
    assert result.final_text == "done"
    assert result.trace[0].tool_name == "fetch"


async def test_runner_truncates_at_max_iterations():
    reg = ToolRegistry()
    reg.register(ToolSpec("loop", "l", {"type": "object", "properties": {}}), lambda inp: "x")
    # adapter that always asks for the tool — never ends
    adapter = _ScriptedAdapter([[("loop", {})]] * 50, final_text="never")
    result = await ToolRunner(adapter, reg, max_iterations=3).run(system="s", user="u")
    assert result.truncated is True
    assert len(result.trace) == 3


async def test_registry_rejects_duplicate_name():
    reg = ToolRegistry()
    spec = ToolSpec("echo", "e", {"type": "object", "properties": {}})
    reg.register(spec, lambda inp: "x")
    with pytest.raises(ValueError, match="duplicate"):
        reg.register(spec, lambda inp: "y")


@pytest.mark.parametrize("bad", ["trade", "transfer_eth", "wallet_sign", "treasury", "account_open"])
async def test_registry_rejects_economic_mutation_tools(bad):
    # Money axiom (D-MONEY-01): no tool may move funds in this phase.
    reg = ToolRegistry()
    spec = ToolSpec(bad, "x", {"type": "object", "properties": {}})
    with pytest.raises(ValueError, match="economic"):
        reg.register(spec, lambda inp: "x")


async def test_runner_records_tool_error_without_crashing():
    reg = ToolRegistry()

    def boom(inp):
        raise RuntimeError("kaboom")

    reg.register(ToolSpec("boom", "b", {"type": "object", "properties": {}}), boom)
    adapter = _ScriptedAdapter([[("boom", {})], []], final_text="recovered")
    result = await ToolRunner(adapter, reg).run(system="s", user="u")
    assert result.final_text == "recovered"
    assert result.trace[0].is_error is True
