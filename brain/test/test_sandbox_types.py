"""Phase 73 — sandbox config/result types (safe defaults)."""
from __future__ import annotations

from noesis_brain.sandbox.types import SandboxConfig, SandboxResult


def test_config_defaults_are_safe() -> None:
    c = SandboxConfig()
    assert c.network is False          # no network by decision
    assert c.image == "python:3.12-slim"
    assert c.wall_timeout_s > 0
    assert c.memory_mb > 0
    assert c.max_output_bytes > 0
    assert c.pids_limit > 0


def test_result_carries_digest_and_status() -> None:
    r = SandboxResult(
        stdout="hello",
        stderr="",
        exit_code=0,
        timed_out=False,
        output_sha256="a" * 64,
    )
    assert r.exit_code == 0
    assert r.timed_out is False
    assert len(r.output_sha256) == 64
