"""Tests for BrainHttpServer lifecycle (Task 1).

These tests verify that:
- aiohttp can be imported (dep declared correctly)
- BrainHttpServer starts and stops cleanly
- BrainHttpServer stop() is idempotent (safe to call twice)
"""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from aiohttp import web

from noesis_brain.http.server import BrainHttpServer


def _make_mock_handler() -> MagicMock:
    """Return a minimal mock BrainHandler for lifecycle tests."""
    handler = MagicMock()
    handler._ananke_runtimes = {}
    handler._last_sleep_tick = 0
    handler._skill_store = MagicMock()
    handler._skill_store.list_all.return_value = []
    handler.memory = MagicMock()
    return handler


class TestAiohttpImport:
    def test_aiohttp_import(self) -> None:
        """Verify aiohttp dependency is declared and importable."""
        # If this passes, the dep is installed.
        assert web.Application is not None


class TestBrainHttpServerLifecycle:
    async def test_start_and_stop(self) -> None:
        """BrainHttpServer starts on an ephemeral port and stops cleanly."""
        handler = _make_mock_handler()
        server = BrainHttpServer(handler=handler, secret="test-secret", port=0)

        await server.start()
        # After start(), runner and site should be set
        assert server._runner is not None
        assert server._site is not None

        await server.stop()
        # After stop(), runner and site should be cleared
        assert server._runner is None
        assert server._site is None

    async def test_stop_before_start_is_safe(self) -> None:
        """Calling stop() before start() must not raise."""
        handler = _make_mock_handler()
        server = BrainHttpServer(handler=handler, secret="test-secret", port=0)
        await server.stop()  # should not raise

    async def test_stop_is_idempotent(self) -> None:
        """Calling stop() twice must not raise."""
        handler = _make_mock_handler()
        server = BrainHttpServer(handler=handler, secret="test-secret", port=0)
        await server.start()
        await server.stop()
        await server.stop()  # second stop must be a no-op
