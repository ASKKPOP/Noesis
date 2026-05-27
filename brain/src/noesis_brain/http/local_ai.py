"""
Phase 40 — Brain HTTP local-ai endpoints (LOCAL-01, LOCAL-03)
GET /local-ai/models  — returns installed Ollama model list for Steward Console dropdowns (D-40-04)
GET /local-ai/status  — returns Ollama availability state for Steward Console red banner (D-40-03)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from aiohttp import web

from noesis_brain.llm.base import LLMError

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler


async def handle_local_ai_models(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    """Return list of installed Ollama models.

    Auth: X-Brain-Secret header (same as cognitive-snapshot pattern).
    Returns: {"models": [...], "ollama_available": bool}
    On Ollama offline: returns {"models": [], "ollama_available": false} — NOT 500 (Pitfall 4).
    """
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()

    try:
        # handler.llm is a ModelRouter (Plan 03) or OllamaAdapter in tests.
        # Both satisfy LLMAdapter.list_models().
        models = await handler.llm.list_models()
        return web.json_response({"models": models, "ollama_available": True})
    except LLMError:
        return web.json_response({"models": [], "ollama_available": False})


async def handle_local_ai_status(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    """Return Ollama availability status for Steward Console red banner.

    Auth: X-Brain-Secret header.
    Returns: {"status": "ok"|"degraded", "provider": "ollama", "fallback_provider": str|null}
    """
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()

    available = await handler.llm.is_available()
    # Determine fallback_provider name if ModelRouter has a cloud fallback set.
    fallback_provider: str | None = None
    if hasattr(handler.llm, "_fallback") and handler.llm._fallback is not None:
        fallback_provider = getattr(handler.llm._fallback, "provider_name", None)

    return web.json_response({
        "status": "ok" if available else "degraded",
        "provider": "ollama",
        "fallback_provider": fallback_provider,
    })
