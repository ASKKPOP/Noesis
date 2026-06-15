"""Sandbox config + result types."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SandboxConfig:
    """Limits + policy for one sandboxed run. Defaults are deliberately strict."""

    wall_timeout_s: float = 10.0      # hard wall-clock kill (subprocess.communicate timeout)
    cpu_timeout_s: int = 8            # in-container `timeout` for cpu-bound runaways
    memory_mb: int = 256             # --memory
    max_output_bytes: int = 64 * 1024  # stdout/stderr captured up to this, then truncated
    pids_limit: int = 128            # --pids-limit (fork-bomb guard)
    network: bool = False            # DECISION: no network; web access is via web_* tools
    image: str = "python:3.12-slim"


@dataclass(frozen=True)
class SandboxResult:
    """Outcome of a sandboxed run. output_sha256 is the only audit-safe field."""

    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    output_sha256: str
