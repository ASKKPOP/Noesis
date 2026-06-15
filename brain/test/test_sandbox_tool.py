"""Phase 73 — run_code tool bundle + Docker-absent availability gate."""
from __future__ import annotations

from noesis_brain.sandbox import tool as sandbox_tool
from noesis_brain.sandbox.tool import build_code_tool
from noesis_brain.sandbox.types import SandboxResult
from noesis_brain.tools.registry import ToolRegistry


def test_no_docker_means_tool_is_off(monkeypatch) -> None:
    # DECISION: no weak fallback — without Docker the tool is simply not registered.
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: False)
    assert build_code_tool() is None


def test_tool_present_when_docker_available(monkeypatch) -> None:
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)
    bundle = build_code_tool()
    assert bundle is not None
    assert bundle.spec.name == "run_code"
    assert "code" in bundle.spec.input_schema["properties"]


async def test_handler_runs_code_and_reports(monkeypatch) -> None:
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)

    async def fake_run(code, config=None):
        return SandboxResult(
            stdout="42\n", stderr="", exit_code=0, timed_out=False, output_sha256="b" * 64
        )

    monkeypatch.setattr(sandbox_tool, "run_python", fake_run)
    bundle = build_code_tool()
    out = await bundle.handler({"code": "print(6*7)"})
    assert "42" in out
    assert "exit 0" in out


async def test_registers_and_runs_through_registry(monkeypatch) -> None:
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)

    async def fake_run(code, config=None):
        return SandboxResult(
            stdout="ok", stderr="", exit_code=0, timed_out=False, output_sha256="c" * 64
        )

    monkeypatch.setattr(sandbox_tool, "run_python", fake_run)
    reg = ToolRegistry()
    bundle = build_code_tool()
    reg.register(bundle.spec, bundle.handler)
    assert reg.has("run_code")
    result = await reg.execute("run_code", {"code": "print('ok')"})
    assert "ok" in result


async def test_handler_reports_timeout(monkeypatch) -> None:
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)

    async def fake_run(code, config=None):
        return SandboxResult(
            stdout="", stderr="(killed)", exit_code=-1, timed_out=True, output_sha256="d" * 64
        )

    monkeypatch.setattr(sandbox_tool, "run_python", fake_run)
    bundle = build_code_tool()
    out = await bundle.handler({"code": "while True: pass"})
    assert "timed out" in out.lower()
