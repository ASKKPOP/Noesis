"""ToolRunner — drives the Anthropic tool loop over a ToolRegistry.

The trace stores only a sha256 digest of each tool's output, never the raw
output: raw tool output is free text/content that must not cross the Grid audit
boundary (FORBIDDEN_KEY_PATTERN). Raw output is fed back to the model in-memory
only, mirroring the Whisper plaintext-stays-local discipline.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

from noesis_brain.llm.base import LLMAdapter
from noesis_brain.llm.types import GenerateOptions


@dataclass(frozen=True)
class ToolTrace:
    """One executed tool call — auditable (digest only, no raw output)."""

    tool_name: str
    input: dict[str, Any]
    output_sha256: str
    is_error: bool = False


@dataclass
class RunResult:
    final_text: str
    trace: list[ToolTrace] = field(default_factory=list)
    truncated: bool = False


class ToolRunner:
    """Runs an LLM tool-use conversation to completion."""

    def __init__(
        self,
        adapter: LLMAdapter,
        registry: "ToolRegistry",
        max_iterations: int = 8,
    ) -> None:
        self._adapter = adapter
        self._registry = registry
        self._max_iterations = max_iterations

    async def run(self, *, system: str, user: str) -> RunResult:
        messages: list[dict] = [{"role": "user", "content": user}]
        opts = GenerateOptions(system_prompt=system, purpose="tool_loop")
        trace: list[ToolTrace] = []

        for _ in range(self._max_iterations):
            resp = await self._adapter.generate_with_tools(
                messages, self._registry.specs(), opts
            )
            if resp.stop_reason != "tool_use":
                return RunResult(final_text=resp.text, trace=trace, truncated=False)

            # Echo the assistant's tool-use turn back into the conversation.
            messages.append(
                {
                    "role": "assistant",
                    "content": [
                        {"type": "tool_use", "id": c.id, "name": c.name, "input": c.input}
                        for c in resp.tool_calls
                    ],
                }
            )
            tool_results = []
            for call in resp.tool_calls:
                try:
                    output = await self._registry.execute(call.name, call.input)
                    is_error = False
                except Exception as e:  # tool failures are reported, not fatal
                    output = f"tool error: {e}"
                    is_error = True
                trace.append(
                    ToolTrace(
                        tool_name=call.name,
                        input=call.input,
                        output_sha256=hashlib.sha256(output.encode("utf-8")).hexdigest(),
                        is_error=is_error,
                    )
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": output,
                        "is_error": is_error,
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        return RunResult(final_text="", trace=trace, truncated=True)


# Imported lazily for the type hint above without a hard import cycle.
from noesis_brain.tools.registry import ToolRegistry  # noqa: E402
