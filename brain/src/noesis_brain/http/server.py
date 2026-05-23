"""Brain HTTP server — aiohttp-based read-only observability server.

Serves a single read-only endpoint:
    GET /cognitive-snapshot/{did}

Runs alongside RPCServer on the same asyncio event loop (no threading).
Port is configurable via BRAIN_HTTP_PORT (default 8090).
Auth is enforced via X-Brain-Secret header.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from aiohttp import web

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

log = logging.getLogger(__name__)


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
        self._app = web.Application()

        # Import handlers here to keep circular-import surface minimal.
        from .cognitive_snapshot import handle_cognitive_snapshot  # noqa: PLC0415
        from .skills_lookup import handle_skills_lookup  # noqa: PLC0415

        # Use async wrappers so aiohttp does not emit the bare-function deprecation.
        _h = self._handler
        _s = self._secret

        async def _cognitive_snapshot_route(req: web.Request) -> web.Response:
            return await handle_cognitive_snapshot(req, _h, _s)

        async def _skills_lookup_route(req: web.Request) -> web.Response:
            return await handle_skills_lookup(req, _h, _s)

        self._app.router.add_get("/cognitive-snapshot/{did}", _cognitive_snapshot_route)
        self._app.router.add_get("/skills/{hash}", _skills_lookup_route)

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
