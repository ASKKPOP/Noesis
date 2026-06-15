"""ToolRegistry — names → (ToolSpec, handler), with money-axiom guards."""
from __future__ import annotations

import inspect
import re
from collections.abc import Awaitable, Callable
from typing import Any

from noesis_brain.llm.types import ToolSpec

ToolHandler = Callable[[dict[str, Any]], "str | Awaitable[str]"]

# Money axiom (D-MONEY-01): no tool may move funds / hold keys in this phase.
# A tool whose name hints at economic mutation is rejected at registration.
_ECONOMIC_MUTATION = re.compile(r"trade|transfer|wallet|treasury|account", re.IGNORECASE)


class ToolRegistry:
    """Holds the tools a ToolRunner may execute."""

    def __init__(self) -> None:
        self._tools: dict[str, tuple[ToolSpec, ToolHandler]] = {}

    def register(self, spec: ToolSpec, handler: ToolHandler) -> None:
        if spec.name in self._tools:
            raise ValueError(f"duplicate tool name: {spec.name!r}")
        if _ECONOMIC_MUTATION.search(spec.name):
            raise ValueError(
                f"refusing to register economic-mutation tool {spec.name!r} "
                "(money axiom D-MONEY-01: no tool moves funds in Phase 72)"
            )
        self._tools[spec.name] = (spec, handler)

    def specs(self) -> list[ToolSpec]:
        return [spec for spec, _ in self._tools.values()]

    def has(self, name: str) -> bool:
        return name in self._tools

    async def execute(self, name: str, tool_input: dict[str, Any]) -> str:
        if name not in self._tools:
            raise KeyError(f"unknown tool: {name!r}")
        _, handler = self._tools[name]
        result = handler(tool_input)
        if inspect.isawaitable(result):
            result = await result
        return str(result)
