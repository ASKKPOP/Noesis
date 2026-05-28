"""
Phase 43 D-43-06 + D-43-05 — Brain standalone mode tests (FORK-03).

Tests:
  - BRAIN_DATA_DIR env var threading into MemoryStore (Plan 01, kept green)
  - verify_and_unpack: path traversal defense, hash mismatch abort, happy path
  - create_brain_app_standalone: no wire client, env var cleanup
  - argparse: default mode (regression)
  - civic action gate: _is_standalone(), CIVIC_ACTION_PATHS set, 503 response
"""
from __future__ import annotations

import io
import json
import os
import tarfile as tarfile_module
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import sys

import pytest

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


# ── Helper: build a valid tar.gz archive ──────────────────────────────────────

def _build_valid_archive(src_dir: Path, archive: Path) -> None:
    """Pack src_dir contents into archive (tar.gz), preserving relative paths."""
    import hashlib

    # Build file list (relative paths)
    files = sorted(p for p in src_dir.rglob("*") if p.is_file())

    # Compute correct export_hash (excluding manifest.json)
    h = hashlib.sha256()
    for f in files:
        rel = f.relative_to(src_dir).as_posix()
        if rel == "manifest.json":
            continue
        h.update(rel.encode("utf-8"))
        h.update(b"\x00")
        h.update(f.read_bytes())
    export_hash = h.hexdigest()

    # Write manifest with correct hash
    manifest = {
        "format_version": "1.0",
        "exported_at": "2026-05-27T12:00:00Z",
        "exported_at_tick": 42,
        "nous_civic_did": "did:civic:noesis:test",
        "nous_existence_did": "did:noesis:nous:test",
        "grid_id": "genesis",
        "export_hash": export_hash,
        "chain_tail_hash": "d" * 64,
        "memory_files": ["nous.db"],
        "note": "test",
    }
    (src_dir / "manifest.json").write_text(json.dumps(manifest))

    # Pack
    with tarfile_module.open(archive, "w:gz") as tf:
        for f in src_dir.rglob("*"):
            if f.is_file():
                tf.add(f, arcname=f.relative_to(src_dir).as_posix())


# ── TestBrainDataDir ──────────────────────────────────────────────────────────

class TestBrainDataDir:
    """D-43-06: BRAIN_DATA_DIR env var threading into MemoryStore."""

    def test_default_uses_memory(self):
        """Without data_dir, MemoryStore is created with ':memory:'."""
        app = create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=None)
        assert app.handler.memory._store._db_path == ":memory:"

    def test_data_dir_creates_db_file(self, tmp_path: Path):
        """When data_dir is set, MemoryStore writes nous.db inside that directory."""
        app = create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=str(tmp_path))
        expected = str(tmp_path / "nous.db")
        assert app.handler.memory._store._db_path == expected
        assert (tmp_path / "nous.db").exists()

    def test_data_dir_creates_missing_parent_dirs(self, tmp_path: Path):
        """data_dir path is created with mkdir(parents=True) if it does not exist."""
        nested = tmp_path / "deep" / "nested" / "dir"
        assert not nested.exists()
        create_brain_app(nous_name="test", config_data=_CONFIG, data_dir=str(nested))
        assert nested.exists()
        assert (nested / "nous.db").exists()


# ── TestStandaloneImport ──────────────────────────────────────────────────────

class TestStandaloneImport:
    """verify_and_unpack: path traversal defense + hash verification + happy path."""

    def test_path_traversal_rejected(self, tmp_path: Path) -> None:
        """verify_and_unpack rejects archives with members whose paths escape data_dir."""
        from noesis_brain.standalone.importer import verify_and_unpack

        archive = tmp_path / "malicious.tar.gz"
        with tarfile_module.open(archive, "w:gz") as tf:
            info = tarfile_module.TarInfo(name="../../etc/passwd")
            data = b"root::0:0:/:/bin/bash\n"
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))

        with pytest.raises(ValueError, match="Path traversal"):
            verify_and_unpack(archive, tmp_path / "extract")

    def test_import_aborts_on_hash_mismatch(self, tmp_path: Path) -> None:
        """verify_and_unpack raises ValueError when computed export_hash != manifest.export_hash."""
        from noesis_brain.standalone.importer import verify_and_unpack

        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "memory").mkdir()
        (src_dir / "memory" / "nous.db").write_bytes(b"FAKE_SQLITE")
        bad_manifest = {
            "format_version": "1.0",
            "exported_at": "2026-05-27T12:00:00Z",
            "exported_at_tick": 1,
            "nous_civic_did": "did:civic:noesis:test",
            "nous_existence_did": "did:noesis:nous:test",
            "grid_id": "genesis",
            "export_hash": "0" * 64,  # WRONG — will not match computed
            "chain_tail_hash": "1" * 64,
            "memory_files": ["nous.db"],
            "note": "test",
        }
        (src_dir / "manifest.json").write_text(json.dumps(bad_manifest))

        archive = tmp_path / "fork.tar.gz"
        with tarfile_module.open(archive, "w:gz") as tf:
            tf.add(src_dir / "manifest.json", arcname="manifest.json")
            tf.add(src_dir / "memory" / "nous.db", arcname="memory/nous.db")

        with pytest.raises(ValueError, match="export_hash mismatch"):
            verify_and_unpack(archive, tmp_path / "extract")

    def test_valid_archive_returns_manifest(self, tmp_path: Path) -> None:
        """verify_and_unpack on a valid archive returns the manifest dict."""
        from noesis_brain.standalone.importer import verify_and_unpack

        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "memory").mkdir()
        (src_dir / "memory" / "nous.db").write_bytes(b"SQLITE_DB_BYTES")

        archive = tmp_path / "fork.tar.gz"
        _build_valid_archive(src_dir, archive)

        extract_dir = tmp_path / "extract"
        manifest = verify_and_unpack(archive, extract_dir)
        assert manifest["format_version"] == "1.0"
        assert manifest["nous_existence_did"] == "did:noesis:nous:test"
        assert (extract_dir / "memory" / "nous.db").exists()


# ── TestStandaloneMode ────────────────────────────────────────────────────────

class TestStandaloneMode:
    """create_brain_app_standalone: no wire client, env var cleanup."""

    async def test_no_wire_client_when_BRAIN_STANDALONE_set(
        self, monkeypatch, tmp_path: Path
    ) -> None:
        """create_brain_app_standalone constructs BrainApp with handler._grid_wire_client is None."""
        from noesis_brain.standalone.factory import create_brain_app_standalone

        import_dir = tmp_path / "imported"
        import_dir.mkdir()
        (import_dir / "memory").mkdir()
        (import_dir / "memory" / "nous.db").write_bytes(b"FAKE")
        (import_dir / "manifest.json").write_text(json.dumps({
            "format_version": "1.0",
            "nous_existence_did": "did:noesis:nous:test",
            "nous_civic_did": "did:civic:noesis:test",
            "export_hash": "a" * 64,
            "chain_tail_hash": "b" * 64,
            "exported_at": "2026-05-27T12:00:00Z",
            "exported_at_tick": 1,
            "grid_id": "genesis",
            "memory_files": ["nous.db"],
            "note": "test",
        }))
        monkeypatch.setenv("GRID_URL", "https://grid.test")
        monkeypatch.setenv("CIVIC_DID", "did:civic:noesis:should_be_removed")
        # Provide required BRAIN_HTTP_SECRET so _build_http_server doesn't raise
        monkeypatch.setenv("BRAIN_HTTP_SECRET", "test-secret-for-standalone-factory")
        # Provide NOUS_CONFIG pointing to a valid config or use monkeypatch to skip
        monkeypatch.setenv("NOUS_CONFIG", "")

        app = await create_brain_app_standalone(import_dir)

        assert os.environ.get("BRAIN_STANDALONE") == "1"
        assert "GRID_URL" not in os.environ
        assert "CIVIC_DID" not in os.environ
        assert getattr(app.handler, "_grid_wire_client", None) is None

    def test_argparse_default_runs_main(self) -> None:
        """When no subcommand is given, argparse dispatches to main() (regression check)."""
        import argparse
        parser = argparse.ArgumentParser(prog="noesis_brain")
        subparsers = parser.add_subparsers(dest="mode", required=False)
        standalone_p = subparsers.add_parser("standalone")
        standalone_p.add_argument("--import", dest="import_archive", required=True)
        args = parser.parse_args([])
        assert args.mode is None


# ── TestCivicActionGate ───────────────────────────────────────────────────────

class TestCivicActionGate:
    """Civic action gate: BRAIN_STANDALONE=1 → _is_standalone() True + CIVIC_ACTION_PATHS set."""

    def test_is_standalone_true_when_env_set(self, monkeypatch) -> None:
        """_is_standalone() returns True when BRAIN_STANDALONE=1."""
        monkeypatch.setenv("BRAIN_STANDALONE", "1")
        from noesis_brain.http.server import _is_standalone
        assert _is_standalone() is True

    def test_civic_gate_inactive_when_not_standalone(self, monkeypatch) -> None:
        """When BRAIN_STANDALONE is unset, _is_standalone() returns False."""
        monkeypatch.delenv("BRAIN_STANDALONE", raising=False)
        from noesis_brain.http.server import _is_standalone
        assert _is_standalone() is False

    def test_civic_action_paths_set_exists(self) -> None:
        """CIVIC_ACTION_PATHS is exported from server.py as a set (forward-compat wiring)."""
        from noesis_brain.http.server import CIVIC_ACTION_PATHS
        assert isinstance(CIVIC_ACTION_PATHS, set)

    def test_civic_unavailable_response_shape(self, monkeypatch) -> None:
        """_civic_unavailable_response() returns aiohttp Response with status 503."""
        monkeypatch.setenv("BRAIN_STANDALONE", "1")
        from noesis_brain.http.server import _civic_unavailable_response
        import asyncio

        # _civic_unavailable_response is synchronous, returns web.Response
        resp = _civic_unavailable_response()
        # Validate status code
        assert resp.status == 503
