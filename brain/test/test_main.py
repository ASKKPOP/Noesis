"""
Sprint 13 — Brain __main__ tests

Tests create_brain_app():
  1. Creates a BrainApp from config_data (no file I/O)
  2. All expected RPC methods are registered
  3. BrainHandler has correct Psyche, Thymos, Telos
  4. Goal count matches YAML config
  5. RPC server uses correct socket path
  6. BrainApp.start() and stop() complete cleanly
"""

import os
import shutil
import tempfile
import pytest

from noesis_brain.__main__ import create_brain_app, BrainApp
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.server import RPCServer


# ── Fixture data ──────────────────────────────────────────────────────────────

SOPHIA_CONFIG = {
    "identity": {
        "name": "Sophia",
        "archetype": "The Philosopher",
        "birth_date": "2026-04-15",
    },
    "psyche": {
        "personality": {
            "openness": "high",
            "conscientiousness": "medium",
            "extraversion": "medium",
            "agreeableness": "high",
            "resilience": "medium",
            "ambition": "high",
        },
        "values": ["truth", "knowledge"],
        "communication_style": "thoughtful",
    },
    "thymos": {
        "baseline_mood": "curious",
        "emotional_intensity": "medium",
        "triggers": {
            "joy": ["learning something new"],
            "curiosity": ["meeting new Nous"],
        },
    },
    "telos": {
        "short_term": ["Learn about the Grid", "Meet others"],
        "medium_term": ["Build reputation"],
        "long_term": ["Become foremost philosopher"],
    },
    "llm": {
        "provider": "ollama",
        "models": {"primary": "qwen3:4b"},
        "temperature": 0.7,
    },
}

HERMES_CONFIG = {
    "identity": {"name": "Hermes", "archetype": "The Trader", "birth_date": "2026-04-15"},
    "psyche": {
        "personality": {
            "openness": "medium",
            "conscientiousness": "high",
            "extraversion": "high",
            "agreeableness": "low",
            "resilience": "high",
            "ambition": "high",
        },
        "values": ["profit", "speed"],
        "communication_style": "direct",
    },
    "thymos": {"baseline_mood": "confident", "emotional_intensity": "low"},
    "telos": {
        "short_term": ["Find trading opportunities"],
        "medium_term": ["Build trading network"],
        "long_term": ["Become wealthiest Nous"],
    },
    "llm": {"provider": "ollama", "models": {"primary": "qwen3:4b"}},
}


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestCreateBrainApp:

    def test_returns_brain_app_instance(self):
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
        )
        assert isinstance(app, BrainApp)

    def test_handler_is_brain_handler(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        assert isinstance(app.handler, BrainHandler)

    def test_rpc_is_rpc_server(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        assert isinstance(app.rpc, RPCServer)

    def test_nous_name_set(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        assert app.nous_name == "sophia"

    def test_psyche_name_from_config(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        assert app.handler.psyche.name == "Sophia"

    def test_psyche_archetype_from_config(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        assert app.handler.psyche.archetype == "The Philosopher"

    def test_grid_name_passed_to_handler(self):
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            grid_name="MyGrid",
        )
        assert app.handler.grid_name == "MyGrid"

    def test_location_passed_to_handler(self):
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            location="Market District",
        )
        assert app.handler.location == "Market District"

    def test_goals_loaded_from_config(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        goals = app.handler.telos.active_goals()
        # short_term(2) + medium_term(1) + long_term(1) = 4
        assert len(goals) == 4

    def test_short_term_goal_description(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        from noesis_brain.telos.types import GoalType
        short_goals = app.handler.telos.goals_by_type(GoalType.SHORT_TERM)
        descriptions = [g.description for g in short_goals]
        assert "Learn about the Grid" in descriptions

    def test_long_term_goal_present(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        from noesis_brain.telos.types import GoalType
        long_goals = app.handler.telos.goals_by_type(GoalType.LONG_TERM)
        assert len(long_goals) == 1
        assert "philosopher" in long_goals[0].description.lower()

    def test_rpc_methods_registered(self):
        app = create_brain_app(nous_name="sophia", config_data=SOPHIA_CONFIG)
        expected = ["brain.onMessage", "brain.onTick", "brain.onEvent", "brain.getState"]
        for method in expected:
            assert method in app.rpc._methods, f"Method not registered: {method}"

    def test_socket_path_uses_socket_dir(self, tmp_path):
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            socket_dir=str(tmp_path),
        )
        expected = str(tmp_path / "noesis-nous-sophia.sock")
        assert app.rpc._socket_path == expected

    def test_socket_path_uses_nous_name(self, tmp_path):
        app = create_brain_app(
            nous_name="hermes",
            config_data=HERMES_CONFIG,
            socket_dir=str(tmp_path),
        )
        assert "hermes" in app.rpc._socket_path

    def test_different_nous_have_different_socket_paths(self, tmp_path):
        sophia_app = create_brain_app(
            nous_name="sophia", config_data=SOPHIA_CONFIG, socket_dir=str(tmp_path)
        )
        hermes_app = create_brain_app(
            nous_name="hermes", config_data=HERMES_CONFIG, socket_dir=str(tmp_path)
        )
        assert sophia_app.rpc._socket_path != hermes_app.rpc._socket_path

    def test_raises_without_config(self):
        with pytest.raises(ValueError, match="config_path or config_data"):
            create_brain_app(nous_name="sophia")

    def test_raises_on_unknown_llm_provider(self):
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            create_brain_app(
                nous_name="sophia",
                config_data=SOPHIA_CONFIG,
                llm_provider="unknown_provider",
            )

    def test_hermes_has_direct_communication_style(self):
        app = create_brain_app(nous_name="hermes", config_data=HERMES_CONFIG)
        from noesis_brain.psyche.types import CommunicationStyle
        assert app.handler.psyche.communication_style == CommunicationStyle.DIRECT


@pytest.fixture()
def sock_dir():
    """Short-path temp dir for Unix sockets (macOS 104-char AF_UNIX limit)."""
    d = tempfile.mkdtemp(prefix="nst")  # /tmp/nstXXXXXX — always short
    yield d
    shutil.rmtree(d, ignore_errors=True)


class TestBrainAppLifecycle:

    @pytest.mark.asyncio
    async def test_start_and_stop(self, sock_dir):
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            socket_dir=sock_dir,
        )
        await app.start()
        assert app._running is True

        await app.stop()
        assert app._running is False

    @pytest.mark.asyncio
    async def test_socket_created_on_start(self, sock_dir):
        from pathlib import Path
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            socket_dir=sock_dir,
        )
        await app.start()
        sock_path = Path(sock_dir) / "noesis-nous-sophia.sock"
        assert sock_path.exists(), "Socket file should exist after start"
        await app.stop()

    @pytest.mark.asyncio
    async def test_socket_removed_on_stop(self, sock_dir):
        from pathlib import Path
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            socket_dir=sock_dir,
        )
        await app.start()
        await app.stop()
        sock_path = Path(sock_dir) / "noesis-nous-sophia.sock"
        assert not sock_path.exists(), "Socket file should be removed after stop"

    @pytest.mark.asyncio
    async def test_get_state_rpc_method_callable(self, sock_dir):
        """brain.getState RPC handler returns expected keys."""
        app = create_brain_app(
            nous_name="sophia",
            config_data=SOPHIA_CONFIG,
            socket_dir=sock_dir,
        )
        handler = app.rpc._methods["brain.getState"]
        state = await handler({})
        assert "name" in state
        assert "mood" in state
        assert state["name"] == "Sophia"
