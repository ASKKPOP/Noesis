"""Compose the full agentic tool set a Nous can call (Phase 72b activation).

Bundles the research tools (web_search, web_fetch) + the code sandbox (run_code)
into one ToolRegistry. run_code is included only when Docker is available
(Phase 73 decision: no weak fallback).
"""
from __future__ import annotations

from noesis_brain.aau.config import AAUConfig
from noesis_brain.sandbox.tool import build_code_tool
from noesis_brain.sandbox.types import SandboxConfig
from noesis_brain.tools.registry import ToolRegistry
from noesis_brain.tools.research import build_research_tools


def build_agentic_registry(
    aau_config: AAUConfig | None = None,
    sandbox_config: SandboxConfig | None = None,
    *,
    include_code: bool = True,
) -> ToolRegistry:
    """Build a registry with web_search + web_fetch (+ run_code if Docker is up)."""
    registry = ToolRegistry()
    for bundle in build_research_tools(aau_config or AAUConfig()):
        registry.register(bundle.spec, bundle.handler)
    if include_code:
        code = build_code_tool(sandbox_config)  # None if Docker unavailable
        if code is not None:
            registry.register(code.spec, code.handler)
    return registry
