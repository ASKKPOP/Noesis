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
import tempfile
from pathlib import Path

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


def build_docker_argv(code_dir: str, config: SandboxConfig) -> list[str]:
    """Assemble the `docker run` argv that isolates one Python run.

    Pure function (no I/O) so the isolation flags are unit-testable without Docker.
    """
    return [
        "docker", "run", "--rm",
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
        "-v", f"{code_dir}:/sandbox:ro",            # Nous code mounted read-only
        "-w", "/sandbox",
        config.image,
        "timeout", str(config.cpu_timeout_s), "python", "/sandbox/main.py",
    ]


async def run_python(code: str, config: SandboxConfig | None = None) -> SandboxResult:
    """Run `code` as /sandbox/main.py inside an isolated container."""
    config = config or SandboxConfig()
    tmpdir = tempfile.mkdtemp(prefix="noesis-sbx-")
    try:
        (Path(tmpdir) / "main.py").write_text(code, encoding="utf-8")
        argv = build_docker_argv(tmpdir, config)
        proc = await asyncio.create_subprocess_exec(
            *argv, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        timed_out = False
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=config.wall_timeout_s)
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
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
