"""Ananke loader — per-connection AnankeRuntime factory (Phase 10a).

Cloned shape from `noesis_brain/psyche/loader.py` (the canonical subsystem
loader pattern in the Brain). The loader is instantiated ONCE per Brain
process; the RPC handler holds it as an attribute and calls
`loader.build(seed=<derived>)` lazily, on first `on_tick` from a given DID.

Per-DID independence invariant (T-09-02 inherited):
    Each call to `build()` returns a FRESH AnankeRuntime instance — the loader
    never caches. The handler above is responsible for memoising one runtime
    per DID in its own `dict[str, AnankeRuntime]` keyed by the connecting DID.

Seed contract (D-10a-01 / T-10a-14):
    The caller derives the seed from the DID via a pure hash so replay with
    the same DID sequence reproduces the same runtime trace byte-for-byte.
    The loader itself is seed-agnostic — it simply threads the integer
    through to the AnankeRuntime constructor. No wall-clock reads.
"""

from __future__ import annotations

from dataclasses import dataclass

from noesis_brain.ananke.runtime import AnankeRuntime


@dataclass
class AnankeLoader:
    """Factory for per-connection AnankeRuntime instances.

    The loader holds no per-DID state; all state lives in the AnankeRuntime
    instances it produces and in the caller's own did→runtime map (see
    `BrainHandler._ananke_runtimes`). This keeps the loader a pure function
    object and simplifies testing.
    """

    def build(self, *, seed: int) -> AnankeRuntime:
        """Construct a new AnankeRuntime seeded deterministically.

        Args:
            seed: A deterministic integer (typically derived from the DID
                via SHA-256; see handler._get_or_create_ananke). In 10a the
                seed is reserved but unused by the drive math — see
                AnankeRuntime.seed docstring.

        Returns:
            A fresh AnankeRuntime at baseline state, never cached.
        """
        return AnankeRuntime(seed=seed)
