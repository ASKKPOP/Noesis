"""Brain HTTP server — aiohttp-based read-only observability server.

Serves a single read-only endpoint:
    GET /cognitive-snapshot/{did}

Runs alongside RPCServer on the same asyncio event loop (no threading).
Port is configurable via BRAIN_HTTP_PORT (default 8090).
Auth is enforced via X-Brain-Secret header.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from aiohttp import web

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

log = logging.getLogger(__name__)

# Phase 43 D-43-01 + RESEARCH.md Pitfall 6:
# In standalone mode (BRAIN_STANDALONE=1), civic-action endpoints MUST return 503 grid_unavailable
# at the HTTP boundary. Handler-internal `if self._grid_wire_client is not None:` guards make
# wire calls no-ops, but without this gate the HTTP response would silently succeed.
#
# No civic-action endpoints exist on Brain HTTP today — this gate is wired as forward-compatible
# infrastructure. Phase 44/46/49 endpoints (when added) automatically receive standalone protection
# by registering their paths in this set.
CIVIC_ACTION_PATHS: set[str] = set()


def _is_standalone() -> bool:
    """Return True when Brain is running in standalone mode (BRAIN_STANDALONE=1)."""
    return os.environ.get("BRAIN_STANDALONE") == "1"


def _civic_unavailable_response() -> web.Response:
    """Return 503 grid_unavailable JSON response for civic actions in standalone mode."""
    return web.json_response(
        {
            "error": "grid_unavailable",
            "detail": "This Nous is running standalone — civic features require Grid connection.",
        },
        status=503,
    )


@web.middleware
async def civic_action_gate(request: web.Request, handler) -> web.StreamResponse:  # type: ignore[type-arg]
    """Intercept civic-action requests in standalone mode and return 503.

    Phase 43 D-43-01: CIVIC_ACTION_PATHS is currently empty (no civic endpoints on Brain HTTP
    today). Middleware is wired so future civic endpoints receive protection automatically.
    """
    if _is_standalone() and request.path in CIVIC_ACTION_PATHS:
        return _civic_unavailable_response()
    return await handler(request)


class BrainHttpServer:
    """aiohttp HTTP server exposing read-only observability endpoints.

    Lifecycle:
        server = BrainHttpServer(handler, secret="...", port=8090)
        await server.start()   # binds 0.0.0.0:port
        ...
        await server.stop()    # graceful shutdown
    """

    def __init__(self, handler: "BrainHandler", secret: str, port: int) -> None:
        self._handler = handler
        self._secret = secret
        self._port = port
        self._app = web.Application(middlewares=[civic_action_gate])

        # Import handlers here to keep circular-import surface minimal.
        from .cognitive_snapshot import handle_cognitive_snapshot  # noqa: PLC0415
        from .skills_lookup import handle_skills_lookup  # noqa: PLC0415
        from .local_ai import handle_local_ai_models, handle_local_ai_status  # noqa: PLC0415

        # Use async wrappers so aiohttp does not emit the bare-function deprecation.
        _h = self._handler
        _s = self._secret

        async def _cognitive_snapshot_route(req: web.Request) -> web.Response:
            return await handle_cognitive_snapshot(req, _h, _s)

        async def _skills_lookup_route(req: web.Request) -> web.Response:
            return await handle_skills_lookup(req, _h, _s)

        async def _local_ai_models_route(req: web.Request) -> web.Response:
            return await handle_local_ai_models(req, _h, _s)

        async def _local_ai_status_route(req: web.Request) -> web.Response:
            return await handle_local_ai_status(req, _h, _s)

        self._app.router.add_get("/cognitive-snapshot/{did}", _cognitive_snapshot_route)
        self._app.router.add_get("/skills/{hash}", _skills_lookup_route)
        self._app.router.add_get("/local-ai/models", _local_ai_models_route)
        self._app.router.add_get("/local-ai/status", _local_ai_status_route)

        self._runner: web.AppRunner | None = None
        self._site: web.TCPSite | None = None

    async def start(self) -> None:
        """Start the HTTP server on 0.0.0.0:{port}."""
        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, "0.0.0.0", self._port)
        await self._site.start()
        log.info("[BrainHttpServer] Listening on 0.0.0.0:%d", self._port)

    async def stop(self) -> None:
        """Graceful shutdown — idempotent."""
        if self._site is not None:
            await self._site.stop()
            self._site = None
        if self._runner is not None:
            await self._runner.cleanup()
            self._runner = None
        log.info("[BrainHttpServer] Stopped")
