"""Tests for JSON-RPC server over Unix domain socket."""

import asyncio
import json
import os
import tempfile

import pytest

from noesis_brain.rpc.server import RPCServer
from noesis_brain.rpc.types import ERR_PARSE, ERR_INVALID_REQUEST, ERR_INTERNAL


# ── Helpers ─────────────────────────────────────────────────

def _tmp_socket_path() -> str:
    """Return a temp socket path that doesn't exist yet."""
    fd, path = tempfile.mkstemp(suffix=".sock")
    os.close(fd)
    os.unlink(path)
    return path


async def _connect(path: str, timeout: float = 5.0):
    """Connect to Unix socket server."""
    return await asyncio.wait_for(
        asyncio.open_unix_connection(path),
        timeout=timeout,
    )


async def _send_recv(writer, reader, data: dict) -> dict:
    """Send JSON line and read JSON line response."""
    line = json.dumps(data).encode() + b"\n"
    writer.write(line)
    await writer.drain()
    resp_line = await asyncio.wait_for(reader.readline(), timeout=5.0)
    return json.loads(resp_line)


# ── Server lifecycle ────────────────────────────────────────

class TestServerLifecycle:
    @pytest.mark.asyncio
    async def test_start_creates_socket(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        try:
            await server.start()
            assert os.path.exists(path)
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_stop_removes_socket(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        await server.start()
        await server.stop()
        assert not os.path.exists(path)

    @pytest.mark.asyncio
    async def test_start_removes_stale_socket(self):
        path = _tmp_socket_path()
        # Create a stale socket file
        with open(path, "w") as f:
            f.write("")
        server = RPCServer(path)
        try:
            await server.start()
            assert os.path.exists(path)
        finally:
            await server.stop()


# ── Request/Response ────────────────────────────────────────

class TestRequestResponse:
    @pytest.mark.asyncio
    async def test_method_call_returns_result(self):
        path = _tmp_socket_path()
        server = RPCServer(path)

        async def echo(params):
            return {"echo": params.get("msg", "")}

        server.register("echo", echo)
        await server.start()

        try:
            reader, writer = await _connect(path)
            resp = await _send_recv(writer, reader, {
                "jsonrpc": "2.0",
                "method": "echo",
                "params": {"msg": "hello"},
                "id": 1,
            })
            assert resp["id"] == 1
            assert resp["result"]["echo"] == "hello"
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_notification_no_response(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        received = []

        async def on_event(params):
            received.append(params)

        server.register("event", on_event)
        await server.start()

        try:
            reader, writer = await _connect(path)
            # Notification: no id
            line = json.dumps({
                "jsonrpc": "2.0",
                "method": "event",
                "params": {"type": "test"},
            }).encode() + b"\n"
            writer.write(line)
            await writer.drain()

            # Give server time to process
            await asyncio.sleep(0.1)

            # Send a regular call to verify server is still responsive
            resp = await _send_recv(writer, reader, {
                "jsonrpc": "2.0",
                "method": "event",
                "params": {"type": "check"},
                "id": 99,
            })
            assert resp["id"] == 99
            # Notification was processed
            assert len(received) == 2
            assert received[0]["type"] == "test"

            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_multiple_calls_on_same_connection(self):
        path = _tmp_socket_path()
        server = RPCServer(path)

        async def add(params):
            return params.get("a", 0) + params.get("b", 0)

        server.register("add", add)
        await server.start()

        try:
            reader, writer = await _connect(path)
            for i in range(5):
                resp = await _send_recv(writer, reader, {
                    "jsonrpc": "2.0",
                    "method": "add",
                    "params": {"a": i, "b": 10},
                    "id": i,
                })
                assert resp["id"] == i
                assert resp["result"] == i + 10
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()


# ── Error handling ──────────────────────────────────────────

class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_parse_error(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        await server.start()

        try:
            reader, writer = await _connect(path)
            writer.write(b"not json\n")
            await writer.drain()
            resp_line = await asyncio.wait_for(reader.readline(), timeout=5.0)
            resp = json.loads(resp_line)
            assert resp["error"]["code"] == ERR_PARSE
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_invalid_request_missing_method(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        await server.start()

        try:
            reader, writer = await _connect(path)
            resp = await _send_recv(writer, reader, {
                "jsonrpc": "2.0",
                "id": 1,
            })
            assert resp["error"]["code"] == ERR_INVALID_REQUEST
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_method_not_found(self):
        path = _tmp_socket_path()
        server = RPCServer(path)
        await server.start()

        try:
            reader, writer = await _connect(path)
            resp = await _send_recv(writer, reader, {
                "jsonrpc": "2.0",
                "method": "nonexistent",
                "id": 1,
            })
            assert resp["error"]["code"] == ERR_INTERNAL  # ValueError wraps as internal
            assert "not found" in resp["error"]["message"].lower()
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_handler_exception(self):
        path = _tmp_socket_path()
        server = RPCServer(path)

        async def failing(params):
            raise RuntimeError("something broke")

        server.register("fail", failing)
        await server.start()

        try:
            reader, writer = await _connect(path)
            resp = await _send_recv(writer, reader, {
                "jsonrpc": "2.0",
                "method": "fail",
                "params": {},
                "id": 1,
            })
            assert resp["error"]["code"] == ERR_INTERNAL
            assert "something broke" in resp["error"]["message"]
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()

    @pytest.mark.asyncio
    async def test_server_continues_after_error(self):
        path = _tmp_socket_path()
        server = RPCServer(path)

        async def maybe_fail(params):
            if params.get("fail"):
                raise RuntimeError("boom")
            return "ok"

        server.register("test", maybe_fail)
        await server.start()

        try:
            reader, writer = await _connect(path)
            # Fail first
            resp1 = await _send_recv(writer, reader, {
                "jsonrpc": "2.0", "method": "test", "params": {"fail": True}, "id": 1,
            })
            assert "error" in resp1
            # Succeed after
            resp2 = await _send_recv(writer, reader, {
                "jsonrpc": "2.0", "method": "test", "params": {}, "id": 2,
            })
            assert resp2["result"] == "ok"
            writer.close()
            await writer.wait_closed()
        finally:
            await server.stop()
