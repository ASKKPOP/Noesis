"""Consent gate — the single sovereignty chokepoint for the operator bridge.

The whole bridge is OFF unless the operator's *local* Nous YAML turns it on,
per capability. No provider ever acts without `gate.allows(...)` returning
true. Because the grant lives in the operator-owned config file on the
operator's own hardware, a hosted Type-B Nous (on Henry's substrate) can never
obtain one — there is no Grid path that injects a grant. `nous_type` is kept
for observability only and is never trusted as a security boundary.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from noesis_brain.bridge.types import BridgeCapability

_VALID = {c.value for c in BridgeCapability}


class ConsentGate:
    """Parses the ``bridge`` config section and answers the one question that
    matters: is capability X allowed right now?
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        config = config or {}
        self.enabled = bool(config.get("enabled", False))
        # Only recognized capability names survive; unknown grants are ignored.
        self.grants: frozenset[str] = frozenset(
            str(g) for g in (config.get("grants") or []) if str(g) in _VALID
        )
        raw_dir = config.get("notebook_dir")
        self.notebook_dir: Path | None = (
            Path(str(raw_dir)).expanduser() if raw_dir else None
        )
        # Even when sim_use is granted, execution is dry-run until this second
        # arming is explicitly set true by the operator.
        self.sim_use_live = bool(config.get("sim_use_live", False))
        # Observability hint only — NOT a security boundary.
        self.nous_type = str(config.get("nous_type", "A"))

    def allows(self, capability: BridgeCapability | str) -> bool:
        """True iff the bridge is enabled AND this capability is granted."""
        value = capability.value if isinstance(capability, BridgeCapability) else str(capability)
        return self.enabled and value in self.grants

    def snapshot(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "grants": sorted(self.grants),
            "sim_use_live": self.sim_use_live,
            "nous_type": self.nous_type,
        }
