"""
Phase 40 — Brain startup settings tests (LOCAL-01, LOCAL-03)
Tests _fetch_operator_settings() + 3-tier ModelRouter wiring (D-40-01).
Wave 0 stubs for recovery detection implemented in Plan 04.
"""
from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from noesis_brain.llm.router import ModelRouter
from noesis_brain.llm.types import ModelTier


DEFAULT_SETTINGS = {
    "local_ai": {
        "small_model": "qwen3:4b",
        "primary_model": "qwen3:4b",
        "large_model": "qwen3:4b",
        "temperature": 0.7,
        "max_tokens": 2048,
        "_version": 2,
    },
    "_version": 2,
}


class TestFetchOperatorSettings:
    @pytest.mark.asyncio
    async def test_returns_settings_on_200(self) -> None:
        """_fetch_operator_settings() returns parsed settings dict on HTTP 200."""
        from noesis_brain.__main__ import _fetch_operator_settings

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = DEFAULT_SETTINGS

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await _fetch_operator_settings("https://grid.example.com", "test-token")

        assert result == DEFAULT_SETTINGS
        mock_client.get.assert_called_once_with(
            "https://grid.example.com/api/v1/operator/me/brain-settings",
            headers={"Authorization": "Bearer test-token"},
            timeout=10.0,
        )

    @pytest.mark.asyncio
    async def test_exits_on_non_200(self) -> None:
        """_fetch_operator_settings() calls sys.exit(1) when Grid returns non-200."""
        from noesis_brain.__main__ import _fetch_operator_settings

        mock_resp = MagicMock()
        mock_resp.status_code = 503

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(SystemExit) as exc_info:
                await _fetch_operator_settings("https://grid.example.com", "test-token")

        assert exc_info.value.code == 1

    @pytest.mark.asyncio
    async def test_exits_on_network_error(self) -> None:
        """_fetch_operator_settings() calls sys.exit(1) when Grid is unreachable."""
        import httpx
        from noesis_brain.__main__ import _fetch_operator_settings

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.ConnectError("connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(SystemExit) as exc_info:
                await _fetch_operator_settings("https://grid.example.com", "test-token")

        assert exc_info.value.code == 1


class TestRecoveryDetection:
    @pytest.mark.asyncio
    async def test_logs_recovered_after_unavailable(self, caplog: pytest.LogCaptureFixture) -> None:
        """When is_available() returns True after a False period, logs 'local_ai_recovered'."""
        import logging
        from unittest.mock import AsyncMock
        from noesis_brain.llm.types import LLMConfig

        config = LLMConfig(
            provider="ollama",
            models={"small": "qwen3:4b", "primary": "qwen3:4b", "large": "qwen3:4b"},
            temperature=0.7,
            max_tokens=2048,
        )
        router = ModelRouter(config)

        # Make primary unavailable so it enters fallback mode
        from unittest.mock import MagicMock
        primary = MagicMock()
        primary.provider_name = "ollama"
        primary.is_available = AsyncMock(return_value=False)
        primary._model = "qwen3:4b"

        from noesis_brain.llm.base import LLMError
        primary.generate = AsyncMock(side_effect=LLMError("ollama", "unavailable"))
        primary.list_models = AsyncMock(return_value=[])

        cloud = MagicMock()
        cloud.provider_name = "claude"
        cloud.is_available = AsyncMock(return_value=True)
        cloud.generate = AsyncMock(return_value=MagicMock(
            text="cloud response", model="claude", provider="claude",
            usage={}, latency_ms=100.0,
        ))

        router.register_tier(ModelTier.SMALL, primary)
        router.register_tier(ModelTier.PRIMARY, primary)
        router.register_tier(ModelTier.LARGE, primary)
        router.set_fallback(cloud)

        # First generate falls through to cloud — triggers fallback mode
        await router.generate("test")
        assert router._in_fallback_mode is True

        # Now primary recovers
        primary.is_available = AsyncMock(return_value=True)

        with caplog.at_level(logging.INFO, logger="noesis_brain.llm.router"):
            result = await router.check_recovery()

        assert result is True
        assert "local_ai_recovered" in caplog.text
