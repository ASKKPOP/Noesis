"""Phase 72b — agentic registry composes research + sandbox tools."""
from __future__ import annotations

from noesis_brain.sandbox import tool as sandbox_tool
from noesis_brain.tools.agentic import build_agentic_registry


def test_registry_has_research_tools():
    reg = build_agentic_registry()
    assert reg.has("web_search")
    assert reg.has("web_fetch")


def test_run_code_present_only_with_docker(monkeypatch):
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)
    assert build_agentic_registry().has("run_code")
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: False)
    assert not build_agentic_registry().has("run_code")


def test_include_code_false_skips_sandbox(monkeypatch):
    monkeypatch.setattr(sandbox_tool, "docker_available", lambda: True)
    reg = build_agentic_registry(include_code=False)
    assert reg.has("web_search")
    assert not reg.has("run_code")
