"""Docker-isolated Python executor. No network, scoped temp FS, hard limits.

Isolation is provided entirely by `docker run` flags (see build_docker_argv).
If Docker is unavailable, callers must not use this module — the run_code tool
is simply not registered (no weak fallback, per the Phase 73 decision).
"""
from __future__ import annotations

import asyncio
import hashlib
import shutil
import subprocess

from noesis_brain.sandbox.types import SandboxConfig, SandboxResult

_docker_available: bool | None = None


def docker_available() -> bool:
    """True only if the docker CLI exists AND the daemon answers (cached)."""
    global _docker_available
    if _docker_available is None:
        if shutil.which("docker") is None:
            _docker_available = False
        else:
            try:
                proc = subprocess.run(
                    ["docker", "info"], capture_output=True, timeout=5, check=False
                )
                _docker_available = proc.returncode == 0
            except Exception:
                _docker_available = False
    return _docker_available


def build_docker_argv(config: SandboxConfig) -> list[str]:
    """Assemble the `docker run` argv that isolates one Python run.

    Code is fed to the container's stdin (``python -``) rather than a host bind
    mount — no host filesystem is exposed, and it works across Docker backends
    (colima/Docker Desktop) where arbitrary host paths aren't mounted into the VM.
    Pure function (no I/O) so the isolation flags are unit-testable without Docker.
    """
    return [
        "docker", "run", "--rm", "-i",              # -i: keep stdin open for the program
        "--network", "none" if not config.network else "bridge",
        "--memory", f"{config.memory_mb}m",
        "--memory-swap", f"{config.memory_mb}m",   # == --memory ⇒ no swap escape
        "--cpus", "1.0",
        "--pids-limit", str(config.pids_limit),
        "--read-only",                              # root fs read-only
        "--tmpfs", "/tmp:size=64m",                 # only writable surface
        "--security-opt", "no-new-privileges",
        "--cap-drop", "ALL",
        "-e", "PYTHONDONTWRITEBYTECODE=1",
        config.image,
        "timeout", str(config.cpu_timeout_s), "python", "-",   # read program from stdin
    ]


async def run_python(code: str, config: SandboxConfig | None = None) -> SandboxResult:
    """Run `code` inside an isolated container (program delivered via stdin)."""
    config = config or SandboxConfig()
    argv = build_docker_argv(config)
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    timed_out = False
    try:
        out, err = await asyncio.wait_for(
            proc.communicate(input=code.encode("utf-8")), timeout=config.wall_timeout_s
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        out, err, timed_out = b"", b"(killed: wall-clock timeout)", True

    stdout = out.decode("utf-8", errors="replace")[: config.max_output_bytes]
    stderr = err.decode("utf-8", errors="replace")[: config.max_output_bytes]
    digest = hashlib.sha256(stdout.encode("utf-8")).hexdigest()
    return SandboxResult(
        stdout=stdout,
        stderr=stderr,
        exit_code=proc.returncode if proc.returncode is not None else -1,
        timed_out=timed_out,
        output_sha256=digest,
    )
