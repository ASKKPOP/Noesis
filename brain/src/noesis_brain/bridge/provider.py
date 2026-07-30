"""Bridge provider protocol + registry.

A `BridgeProvider` binds one `BridgeCapability` to a real-machine capability.
The `BridgeRegistry` is the assembled bridge: it holds the consent gate + the
local journal, registers only *granted* providers, and hands a provider to a
caller only when it is both granted and currently `available()` (its optional
system library is present). Every provider routes its audit through the
registry's journal.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from noesis_brain.bridge.consent import ConsentGate
from noesis_brain.bridge.journal import BridgeJournal
from noesis_brain.bridge.types import BridgeCapability, BridgeDeed


@runtime_checkable
class BridgeProvider(Protocol):
    """A real-machine capability behind a consent grant."""

    capability: BridgeCapability

    def available(self) -> bool:
        """True when the provider can actually run here (its optional system
        library is present). A granted-but-unavailable provider is a safe no-op.
        """
        ...


class BridgeRegistry:
    """The assembled operator bridge for one Nous."""

    def __init__(self, gate: ConsentGate, journal: BridgeJournal | None = None) -> None:
        self.gate = gate
        self.journal = journal if journal is not None else BridgeJournal()
        self._providers: dict[BridgeCapability, BridgeProvider] = {}

    def register(self, provider: BridgeProvider) -> bool:
        """Register a provider iff its capability is granted. Returns whether it
        was registered (ungranted providers are silently dropped — off-by-default).
        """
        if not self.gate.allows(provider.capability):
            return False
        self._providers[provider.capability] = provider
        return True

    def get(self, capability: BridgeCapability) -> BridgeProvider | None:
        """The provider for a capability, only if granted AND available."""
        provider = self._providers.get(capability)
        if provider is None or not provider.available():
            return None
        return provider

    def has(self, capability: BridgeCapability) -> bool:
        return self.get(capability) is not None

    def record(self, deed: BridgeDeed) -> None:
        self.journal.record(deed)

    def snapshot(self) -> dict[str, Any]:
        caps: dict[str, dict[str, bool]] = {}
        for cap in BridgeCapability:
            provider = self._providers.get(cap)
            caps[cap.value] = {
                "granted": self.gate.allows(cap),
                "registered": provider is not None,
                "available": bool(provider is not None and provider.available()),
            }
        return {
            "gate": self.gate.snapshot(),
            "capabilities": caps,
            "journal_count": self.journal.count(),
            "journal_by_capability": self.journal.count_by_capability(),
            "recent": [
                {
                    "capability": d.capability,
                    "verb": d.verb,
                    "tick": d.tick,
                    "ok": d.ok,
                    "digest": d.digest,
                    "reason": d.reason,
                }
                for d in self.journal.recent(limit=10)
            ],
        }
