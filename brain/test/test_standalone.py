"""
Phase 43 D-43-06 — BRAIN_DATA_DIR env var threading tests.

Verifies that create_brain_app wires MemoryStore to an on-disk SQLite file
when data_dir is supplied, and falls back to ":memory:" when data_dir is None.

Wave 0 stubs for Plan 43-02 (Brain standalone mode) are also included here
as it.skip equivalents (pytest.mark.skip).
"""
from __future__ import annotations

import os
import pytest
from pathlib import Path

from noesis_brain.__main__ import create_brain_app, BRAIN_DATA_DIR_ENV, BRAIN_STANDALONE_ENV


# ── Minimal Nous config for factory calls ─────────────────────────────────────

_CONFIG = {
    "identity": {"name": "TestNous", "archetype": "Tester", "birth_date": "2026-01-01"},
    "psyche": {
        "personality": {
            "openness": "medium",
            "conscientiousness": "medium",
            "extraversion": "medium",
            "agreeableness": "medium",
            "resilience": "medium",
            "ambition": "medium",
        },
        "values": ["testing"],
        "communication_style": "direct",
    },
    "thymos": {"baseline_mood": "neutral", "emotional_intensity": "low"},
    "telos": {"short_term": [], "medium_term": [], "long_term": []},
    "llm": {"provider": "ollama", "models": {"primary": "qwen3:4b"}},
}


class TestBrainDataDir:
    """D-43-06: BRAIN_DATA_DIR env var threading into MemoryStore."""

    def test_default_uses_memory(self):
        """Without data_dir, MemoryStore is created with ':memory:'."""
        app = create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=None)
        # MemoryStore._db_path is ':memory:' when no data_dir supplied.
        assert app.handler.memory._store._db_path == ":memory:"

    def test_data_dir_creates_db_file(self, tmp_path: Path):
        """When data_dir is set, MemoryStore writes nous.db inside that directory."""
        app = create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=str(tmp_path))
        expected = str(tmp_path / "nous.db")
        assert app.handler.memory._store._db_path == expected
        # The file must actually exist on disk (SQLite creates it on connect).
        assert (tmp_path / "nous.db").exists()

    def test_data_dir_creates_missing_parent_dirs(self, tmp_path: Path):
        """data_dir path is created with mkdir(parents=True) if it does not exist."""
        nested = tmp_path / "deep" / "nested" / "dir"
        assert not nested.exists()
        app = create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=str(nested))
        assert nested.exists()
        assert (nested / "nous.db").exists()


# ── Wave 0 stubs: Plan 43-02 (Brain standalone mode) ─────────────────────────
# These will be implemented in Plan 43-02. Kept here as skip-stubs so the
# test file exists and the plan has a clearly-marked starting point.

@pytest.mark.skip(reason="Plan 43-02: standalone --import subcommand not yet implemented")
def test_standalone_import_extracts_memory_db(tmp_path: Path):
    """standalone --import extracts memory/nous.db into BRAIN_DATA_DIR."""
    ...


@pytest.mark.skip(reason="Plan 43-02: standalone --import subcommand not yet implemented")
def test_standalone_import_verifies_manifest_hash(tmp_path: Path):
    """standalone --import fails with clear error when export_hash mismatch."""
    ...


@pytest.mark.skip(reason="Plan 43-02: BRAIN_STANDALONE env var disables Grid wire not yet implemented")
def test_brain_standalone_skips_wire_init():
    """When BRAIN_STANDALONE=1, GridWireClient/WssSubscriber are not initialized."""
    ...


@pytest.mark.skip(reason="Plan 43-02: standalone civic actions return grid_unavailable not yet implemented")
def test_standalone_civic_action_returns_grid_unavailable():
    """In standalone mode, civic RPC calls return grid_unavailable error dict."""
    ...
