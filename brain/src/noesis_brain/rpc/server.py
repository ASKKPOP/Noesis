"""JSON-RPC 2.0 server over Unix domain socket."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Callable, Awaitable

from noesis_brain.rpc.types import (
    RPCRequest,
    RPCResponse,
    RPCError,
    ERR_PARSE,
    ERR_METHOD_NOT_FOUND,
    ERR_INTERNAL,
    ERR_INVALID_REQUEST,
)

log = logging.getLogger(__name__)

# Method handler type: async fn(params) -> result
MethodHandler = Callable[[dict[str, Any]], Awaitable[Any]]


class RPCServer:
    """JSON-RPC 2.0 server over Unix domain socket.

    Usage:
        server = RPCServer("/tmp/noesis-nous-sophia.sock")
        server.register("brain.onMessage", handler.on_message)
        server.register("brain.onTick", handler.on_tick)
        await server.start()
    """

    def __init__(self, socket_path: str) -> None:
        self._socket_path = socket_path
        self._methods: dict[str, MethodHandler] = {}
        self._server: asyncio.Server | None = None

    def register(self, method: str, handler: MethodHandler) -> None:
        """Register a method handler."""
        self._methods[method] = handler

    async def start(self) -> None:
        """Start the Unix socket server."""
        # Remove stale socket file
        path = Path(self._socket_path)
        if path.exists():
            path.unlink()

        self._server = await asyncio.start_unix_server(
            self._handle_connection,
            path=self._socket_path,
        )
        log.info("RPC server listening on %s", self._socket_path)

    async def stop(self) -> None:
        """Stop the server and clean up."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        path = Path(self._socket_path)
        if path.exists():
            path.unlink()

    async def _handle_connection(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle a single client connection (newline-delimited JSON)."""
        try:
            while True:
                line = await reader.readline()
                if not line:
                    break  # Client disconnected

                response = await self._process_line(line)
                if response:
                    writer.write(json.dumps(response).encode() + b"\n")
                    await writer.drain()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            log.error("Connection error: %s", e)
        finally:
            writer.close()
            await writer.wait_closed()

    async def _process_line(self, line: bytes) -> dict[str, Any] | None:
        """Process a single JSON-RPC request line."""
        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            return RPCResponse(
                error=RPCError(ERR_PARSE, f"Parse error: {e}"),
            ).to_dict()

        if not isinstance(data, dict) or "method" not in data:
            return RPCResponse(
                id=data.get("id") if isinstance(data, dict) else None,
                error=RPCError(ERR_INVALID_REQUEST, "Invalid request"),
            ).to_dict()

        request = RPCRequest.from_dict(data)

        # Notifications (no id) → fire and forget
        if request.id is None:
            await self._dispatch(request)
            return None

        # Requests (with id) → return response
        try:
            result = await self._dispatch(request)
            return RPCResponse(id=request.id, result=result).to_dict()
        except Exception as e:
            log.error("Method %s failed: %s", request.method, e)
            return RPCResponse(
                id=request.id,
                error=RPCError(ERR_INTERNAL, str(e)),
            ).to_dict()

    async def _dispatch(self, request: RPCRequest) -> Any:
        """Dispatch a request to the registered handler."""
        handler = self._methods.get(request.method)
        if handler is None:
            raise ValueError(f"Method not found: {request.method}")
        return await handler(request.params)
