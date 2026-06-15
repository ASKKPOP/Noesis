"""Phase 72 — tool-use types (ToolSpec, ToolCall) + LLMResponse tool fields."""
from __future__ import annotations

from noesis_brain.llm.types import LLMResponse, ToolCall, ToolSpec


def test_toolspec_to_anthropic_schema() -> None:
    spec = ToolSpec(
        name="web_search",
        description="Search the live web.",
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    )
    d = spec.to_anthropic()
    assert d["name"] == "web_search"
    assert d["description"] == "Search the live web."
    assert d["input_schema"]["required"] == ["query"]


def test_llmresponse_carries_tool_calls_and_stop_reason() -> None:
    r = LLMResponse(
        text="",
        model="m",
        provider="claude",
        tool_calls=[ToolCall(id="t1", name="web_search", input={"query": "x"})],
        stop_reason="tool_use",
    )
    assert r.stop_reason == "tool_use"
    assert r.tool_calls[0].name == "web_search"
    assert r.tool_calls[0].input == {"query": "x"}


def test_llmresponse_defaults_are_empty() -> None:
    # Existing call sites that never pass tool fields must keep working unchanged.
    r = LLMResponse(text="hi", model="m", provider="ollama")
    assert r.tool_calls == []
    assert r.stop_reason is None
