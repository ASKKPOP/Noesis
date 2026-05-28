"""Phase 43 — standalone BrainApp factory (D-43-05, FORK-03).

Constructs a BrainApp configured for offline/standalone operation. No Grid wire,
no WSS subscriber, no heartbeat task. Full Ollama + memory + reflection retained.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


async def create_brain_app_standalone(import_dir: Path) -> Any:
    """Factory for standalone forked Brain — no Grid wire.

    Caller must have already called verify_and_unpack to populate import_dir,
    or the import_dir must contain a valid manifest.json.
    """
    from noesis_brain.__main__ import create_brain_app_from_env

    manifest_path = import_dir / "manifest.json"
    if not manifest_path.exists():
        raise ValueError(
            f"Standalone import directory missing manifest.json: {import_dir}"
        )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    # ── Configure environment for standalone mode ──
    os.environ["BRAIN_DATA_DIR"] = str(import_dir / "memory")
    os.environ["BRAIN_STANDALONE"] = "1"
    os.environ["NOUS_DID"] = manifest["nous_existence_did"]
    # Defense in depth: even if operator left these set, standalone wins.
    for var in ("GRID_URL", "CIVIC_DID"):
        os.environ.pop(var, None)

    # Use the standard factory — its `if grid_url:` branches will be skipped
    # because GRID_URL is unset. Handler._grid_wire_client remains None,
    # and every wire call is guarded by `if self._grid_wire_client is not None:`.
    app = await create_brain_app_from_env()
    return app
