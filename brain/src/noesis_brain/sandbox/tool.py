"""The `run_code` tool bundle — registers into the Phase 72 ToolRegistry.

If Docker is unavailable the bundle is None (capability off, no weak fallback).
Output returned to the model is truncated; on the audit boundary only an
output_sha256 digest is recorded (Phase 72b `tool.code_run`).
"""
from __future__ import annotations

from dataclasses import dataclass

from noesis_brain.llm.types import ToolSpec
from noesis_brain.sandbox.executor import docker_available, run_python
from noesis_brain.sandbox.types import SandboxConfig
from noesis_brain.tools.registry import ToolHandler

# Keep returned output bounded so the tool loop's context stays manageable.
_REPLY_CHAR_CAP = 8000


@dataclass(frozen=True)
class CodeTool:
    spec: ToolSpec
    handler: ToolHandler


def build_code_tool(config: SandboxConfig | None = None) -> CodeTool | None:
    """Build the run_code tool, or None if Docker isolation is unavailable."""
    if not docker_available():
        return None
    cfg = config or SandboxConfig()

    async def run_code(tool_input: dict) -> str:
        code = str(tool_input.get("code", "")).strip()
        if not code:
            return "(empty code)"
        result = await run_python(code, cfg)
        parts: list[str] = []
        if result.timed_out:
            parts.append("[timed out]")
        parts.append(f"[exit {result.exit_code}]")
        if result.stdout:
            parts.append("stdout:\n" + result.stdout)
        if result.stderr:
            parts.append("stderr:\n" + result.stderr)
        return "\n".join(parts)[:_REPLY_CHAR_CAP]

    spec = ToolSpec(
        name="run_code",
        description=(
            "Run Python code locally in an isolated sandbox (no network, ephemeral "
            "filesystem, time/memory limits) and get back its stdout/stderr. Use this "
            "to compute, test, and verify your own work."
        ),
        input_schema={
            "type": "object",
            "properties": {"code": {"type": "string", "description": "Python source to run."}},
            "required": ["code"],
        },
    )
    return CodeTool(spec=spec, handler=run_code)
