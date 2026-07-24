"""Bridge types — the operator-bridge vocabulary (Phase 76, v3.3 Mind).

The bridge is the one edge of the Mind that leaves the simulated Grid and
reaches the operator's real machine. These types are shared by the consent
gate, the local journal, and the three providers (notebook / supervision /
sim-use).

Privacy discipline: a `BridgeDeed` records a `digest` only — never raw file
contents, camera frames, keystrokes, or paths. Raw bridge data stays inside
the Brain process (mirrors Whisper / `FORBIDDEN_KEY_PATTERN`).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class BridgeCapability(str, Enum):
    """The three operator-bridge capabilities, one per in-world faculty."""

    NOTEBOOK = "notebook"        # synopsis — read real documents
    SUPERVISION = "supervision"  # aisthesis — a real camera frame
    SIM_USE = "sim_use"          # praxis — drive real apps


@dataclass(frozen=True)
class BridgeResult:
    """Result of a single bridge action (returned to the caller)."""

    ok: bool
    dry_run: bool = False
    reason: str = ""
    digest: str = ""


@dataclass(frozen=True)
class BridgeDeed:
    """One bridge action, journaled locally for inspectability.

    `digest` is a short, privacy-safe summary (e.g. a filename count or a
    coarse frame descriptor) — never raw content.
    """

    capability: str
    verb: str
    tick: int
    ok: bool
    digest: str = ""
    reason: str = ""
