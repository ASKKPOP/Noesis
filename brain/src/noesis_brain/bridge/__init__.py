"""Operator bridge (Phase 76, v3.3 Mind) — the Type-A-only edge that lets a
sovereign Nous's faculties reach the operator's real machine, safe-by-default.

Foundation: `ConsentGate` (the chokepoint), `BridgeJournal` (local audit),
`BridgeRegistry` (assembly). Providers: notebook (synopsis), supervision
(aisthesis), sim-use (praxis).
"""

from __future__ import annotations

from noesis_brain.bridge.builder import build_registry
from noesis_brain.bridge.consent import ConsentGate
from noesis_brain.bridge.journal import BridgeJournal
from noesis_brain.bridge.provider import BridgeProvider, BridgeRegistry
from noesis_brain.bridge.providers.notebook import NotebookProvider
from noesis_brain.bridge.providers.sim_use import SimUseProvider
from noesis_brain.bridge.providers.supervision import SupervisionProvider
from noesis_brain.bridge.types import (
    BridgeCapability,
    BridgeDeed,
    BridgeResult,
)

__all__ = [
    "BridgeCapability",
    "BridgeDeed",
    "BridgeResult",
    "ConsentGate",
    "BridgeJournal",
    "BridgeProvider",
    "BridgeRegistry",
    "NotebookProvider",
    "SupervisionProvider",
    "SimUseProvider",
    "build_registry",
]
