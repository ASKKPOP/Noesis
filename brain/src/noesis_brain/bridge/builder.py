"""Assemble a BridgeRegistry from a Nous's ``bridge`` config section.

One call site (``__main__.create_brain_app``). Off-by-default falls straight
out of the gate: with no ``bridge`` section, nothing is granted, no provider
registers, and the registry is an inert shell.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from noesis_brain.bridge.consent import ConsentGate
from noesis_brain.bridge.journal import BridgeJournal
from noesis_brain.bridge.provider import BridgeRegistry
from noesis_brain.bridge.providers.notebook import NotebookProvider
from noesis_brain.bridge.providers.sim_use import SimUseProvider
from noesis_brain.bridge.providers.supervision import SupervisionProvider


def build_registry(
    config: dict[str, Any] | None,
    *,
    data_dir: str | Path | None = None,
    nous_did: str = "",
) -> BridgeRegistry:
    """Build the operator bridge for one Nous. Always returns a registry;
    ungranted providers simply never register (off-by-default)."""
    gate = ConsentGate(config)
    journal = BridgeJournal(db_path=data_dir or ":memory:", nous_did=nous_did)
    registry = BridgeRegistry(gate, journal)
    # register() no-ops on any capability the gate does not grant.
    registry.register(NotebookProvider(notebook_dir=gate.notebook_dir))
    registry.register(SupervisionProvider())  # real cv2 source is a future wiring
    registry.register(SimUseProvider(live=gate.sim_use_live))
    return registry
