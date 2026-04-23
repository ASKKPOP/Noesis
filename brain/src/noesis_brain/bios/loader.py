"""Bios loader — per-connection BiosRuntime factory.

Clone of ananke/loader.py. The loader holds no per-DID state; the handler
memoises one BiosRuntime per DID in its own dict.
"""

from __future__ import annotations

from dataclasses import dataclass

from noesis_brain.bios.runtime import BiosRuntime


@dataclass
class BiosLoader:
    """Factory for per-connection BiosRuntime instances."""

    def build(self, *, seed: int, birth_tick: int = 0) -> BiosRuntime:
        """Construct a new BiosRuntime seeded deterministically.

        Args:
            seed: Deterministic integer derived from the DID via SHA-256.
            birth_tick: The Grid tick at which this Nous was spawned —
                used by epoch_since_spawn() for subjective-age in prompts.

        Returns:
            A fresh BiosRuntime at baseline state, never cached.
        """
        return BiosRuntime(seed=seed, birth_tick=birth_tick)
