"""Phase 73 — sandbox executor.

Split: argv-assembly tests verify the isolation flags by construction (run
everywhere, no Docker needed). Real-container tests are skipped without Docker
and must be run on a Docker host to confirm isolation behaves.
"""
from __future__ import annotations

import pytest

from noesis_brain.sandbox.executor import build_docker_argv, docker_available, run_python
from noesis_brain.sandbox.types import SandboxConfig

requires_docker = pytest.mark.skipif(not docker_available(), reason="Docker not available")


# ── argv assembly: isolation flags present by construction (no Docker) ──

def test_argv_enforces_isolation_flags() -> None:
    argv = build_docker_argv(SandboxConfig())
    joined = " ".join(argv)
    assert argv[:4] == ["docker", "run", "--rm", "-i"]
    assert "--network" in argv and argv[argv.index("--network") + 1] == "none"
    assert "--memory" in argv and "256m" in argv
    assert "--pids-limit" in argv
    assert "--read-only" in argv
    assert "--cap-drop" in argv and "ALL" in argv
    assert "no-new-privileges" in joined
    # no host bind mount (code arrives via stdin); program read from stdin
    assert not any(":/sandbox" in a for a in argv)
    assert argv[-3:] == ["python", "-"] or argv[-1] == "-"


def test_argv_disables_swap_so_memory_cap_is_real() -> None:
    argv = build_docker_argv(SandboxConfig(memory_mb=128))
    assert "--memory" in argv and "128m" in argv
    assert "--memory-swap" in argv  # equal to --memory → no swap escape hatch


def test_argv_uses_in_container_cpu_timeout() -> None:
    argv = build_docker_argv(SandboxConfig(cpu_timeout_s=5))
    assert "timeout" in argv
    assert "5" in argv


# ── real execution (Docker required) ──

@requires_docker
async def test_run_python_returns_stdout() -> None:
    r = await run_python("print('hello from sandbox')")
    assert r.exit_code == 0
    assert "hello from sandbox" in r.stdout
    assert len(r.output_sha256) == 64


@requires_docker
async def test_run_python_kills_infinite_loop() -> None:
    r = await run_python("while True: pass", SandboxConfig(wall_timeout_s=3, cpu_timeout_s=2))
    assert r.timed_out or r.exit_code != 0


@requires_docker
async def test_run_python_has_no_network() -> None:
    code = (
        "import socket\n"
        "try:\n"
        "    socket.create_connection(('1.1.1.1', 80), timeout=3)\n"
        "    print('NET_OK')\n"
        "except Exception:\n"
        "    print('NET_BLOCKED')\n"
    )
    r = await run_python(code)
    assert "NET_BLOCKED" in r.stdout
