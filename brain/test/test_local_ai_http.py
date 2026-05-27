"""
Phase 40 — Brain HTTP local-ai endpoint tests (LOCAL-01, LOCAL-03)
Tests GET /local-ai/models + GET /local-ai/status endpoints (D-40-03, D-40-04).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web

from noesis_brain.llm.base import LLMError
from noesis_brain.http.local_ai import handle_local_ai_models, handle_local_ai_status


SECRET = "test-brain-secret"


def _make_handler(models: list[str] | Exception, is_available_result: bool = True) -> MagicMock:
    """Create a minimal BrainHandler mock with just the llm attribute needed."""
    handler = MagicMock()
    llm = AsyncMock()
    llm.provider_name = "ollama"

    if isinstance(models, Exception):
        llm.list_models = AsyncMock(side_effect=models)
    else:
        llm.list_models = AsyncMock(return_value=models)

    llm.is_available = AsyncMock(return_value=is_available_result)
    # No fallback by default
    llm._fallback = None
    handler.llm = llm
    return handler


def _make_app(handler: MagicMock, secret: str = SECRET) -> web.Application:
    """Build a minimal aiohttp app with the two local-ai routes."""
    app = web.Application()
    _h = handler
    _s = secret

    async def _models_route(req: web.Request) -> web.Response:
        return await handle_local_ai_models(req, _h, _s)

    async def _status_route(req: web.Request) -> web.Response:
        return await handle_local_ai_status(req, _h, _s)

    app.router.add_get("/local-ai/models", _models_route)
    app.router.add_get("/local-ai/status", _status_route)
    return app


class TestLocalAiModelsEndpoint:
    @pytest.mark.asyncio
    async def test_returns_model_list_when_ollama_available(self) -> None:
        """GET /local-ai/models with valid X-Brain-Secret returns
        {"models": ["qwen3:4b", ...], "ollama_available": true}."""
        handler = _make_handler(["qwen3:4b", "qwen3:14b"])
        app = _make_app(handler)

        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/local-ai/models",
                headers={"X-Brain-Secret": SECRET},
            )
            assert resp.status == 200
            data = await resp.json()
            assert data["models"] == ["qwen3:4b", "qwen3:14b"]
            assert data["ollama_available"] is True

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_ollama_offline(self) -> None:
        """GET /local-ai/models returns {"models": [], "ollama_available": false} (not 500)
        when OllamaAdapter.list_models() raises LLMError (Pitfall 4)."""
        handler = _make_handler(LLMError("ollama", "connection refused"))
        app = _make_app(handler)

        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/local-ai/models",
                headers={"X-Brain-Secret": SECRET},
            )
            assert resp.status == 200  # NOT 500
            data = await resp.json()
            assert data["models"] == []
            assert data["ollama_available"] is False

    @pytest.mark.asyncio
    async def test_returns_401_with_wrong_secret(self) -> None:
        """GET /local-ai/models returns 401 when X-Brain-Secret header is wrong."""
        handler = _make_handler(["qwen3:4b"])
        app = _make_app(handler)

        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/local-ai/models",
                headers={"X-Brain-Secret": "wrong-secret"},
            )
            assert resp.status == 401


class TestLocalAiStatusEndpoint:
    @pytest.mark.asyncio
    async def test_returns_ok_when_ollama_available(self) -> None:
        """GET /local-ai/status returns {"status": "ok", "provider": "ollama",
        "fallback_provider": null} when is_available() returns True."""
        handler = _make_handler([], is_available_result=True)
        app = _make_app(handler)

        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/local-ai/status",
                headers={"X-Brain-Secret": SECRET},
            )
            assert resp.status == 200
            data = await resp.json()
            assert data["status"] == "ok"
            assert data["provider"] == "ollama"
            assert data["fallback_provider"] is None

    @pytest.mark.asyncio
    async def test_returns_degraded_when_ollama_unavailable(self) -> None:
        """GET /local-ai/status returns {"status": "degraded"} when is_available() returns False."""
        handler = _make_handler([], is_available_result=False)
        app = _make_app(handler)

        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/local-ai/status",
                headers={"X-Brain-Secret": SECRET},
            )
            assert resp.status == 200
            data = await resp.json()
            assert data["status"] == "degraded"
