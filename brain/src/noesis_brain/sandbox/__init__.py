"""Phase 73 — local code sandbox ("Nous Can Program Locally", spec §5).

A Nous can call the `run_code` tool (through the Phase 72 ToolRunner) to write,
run, and test Python locally. Execution is isolated in a Docker container with
NO network, a scoped ephemeral filesystem, and CPU/memory/time/output caps.
If Docker is unavailable the tool is not registered (no weak fallback).

Raw program output never crosses the Grid audit boundary — only an
output_sha256 digest (same discipline as the web tools + Whisper).
"""

from noesis_brain.sandbox.types import SandboxConfig, SandboxResult

__all__ = ["SandboxConfig", "SandboxResult"]
