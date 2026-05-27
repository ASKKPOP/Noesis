"""
Phase 40 — Brain HTTP local-ai endpoint tests (LOCAL-01, LOCAL-03)
Tests GET /local-ai/models + GET /local-ai/status endpoints (D-40-03, D-40-04).
Wave 0 stubs — implemented in Plan 04.
"""
from __future__ import annotations
import pytest


class TestLocalAiModelsEndpoint:
    @pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 04")
    async def test_returns_model_list_when_ollama_available(self) -> None:
        """GET /local-ai/models with valid X-Brain-Secret returns
        {"models": ["qwen3:4b", ...], "ollama_available": true}."""
        pass

    @pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 04")
    async def test_returns_empty_list_when_ollama_offline(self) -> None:
        """GET /local-ai/models returns {"models": [], "ollama_available": false} (not 500)
        when OllamaAdapter.list_models() raises LLMError (Pitfall 4)."""
        pass

    @pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 04")
    async def test_returns_401_with_wrong_secret(self) -> None:
        """GET /local-ai/models returns 401 when X-Brain-Secret header is wrong."""
        pass


class TestLocalAiStatusEndpoint:
    @pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 04")
    async def test_returns_ok_when_ollama_available(self) -> None:
        """GET /local-ai/status returns {"status": "ok", "provider": "ollama",
        "fallback_provider": null} when is_available() returns True."""
        pass

    @pytest.mark.skip(reason="Wave 0 stub — implemented in Plan 04")
    async def test_returns_degraded_when_ollama_unavailable(self) -> None:
        """GET /local-ai/status returns {"status": "degraded"} when is_available() returns False."""
        pass
