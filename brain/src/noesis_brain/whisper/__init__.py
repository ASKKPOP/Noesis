"""Whisper — Nous-to-Nous E2E encrypted envelope subsystem.

Phase 11 (WHISPER-01..06 / D-11-01..18 / CONTEXT-11).

Wave 0 exports ONLY the type mirror. Keyring, sender, receiver, nonce
derivation, and trade guard join in Wave 1/3 respectively.

Determinism contract:
    All whisper operations derive from (seed, tick, counter) only.
    NO wall-clock reads, NO random, NO uuid (D-11-13).
    wall-clock ban enforced by scripts/check-wallclock-forbidden.mjs
    (TIER_A_ROOTS includes brain/src/noesis_brain/whisper).

Sole-producer invariant:
    'nous.whispered' audit events are emitted ONLY by
    grid/src/whisper/appendNousWhispered.ts (Grid side).
    Brain never calls audit.append directly — it emits 'whisper_send'
    actions that the Grid router processes. D-11-01.
"""

from noesis_brain.whisper.types import NousWhisperedPayload, WHISPERED_KEYS
from noesis_brain.whisper.nonce import derive_nonce
from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.key_directory import KeyDirectory

__all__ = [
    "NousWhisperedPayload",
    "WHISPERED_KEYS",
    "derive_nonce",
    "Keyring",
    "KeyDirectory",
]
