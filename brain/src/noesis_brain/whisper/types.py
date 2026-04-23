"""
SYNC: mirrors grid/src/whisper/types.ts (NousWhisperedPayload, WHISPERED_KEYS)
SYNC: mirrors dashboard/src/lib/protocol/whisper-types.ts

Whisper type definitions — Brain-side mirror.

Phase 11 (WHISPER-03 / D-11-01).

NO datetime, NO time.time, NO random — wall-clock ban per D-11-13 and
scripts/check-wallclock-forbidden.mjs (TIER_A_ROOTS includes
brain/src/noesis_brain/whisper).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class NousWhisperedPayload:
    """Closed 4-key audit payload for the 'nous.whispered' event.

    Keys alphabetical — matches WHISPERED_KEYS tuple and
    grid/src/whisper/types.ts NousWhisperedPayload.

    PRIVACY: ciphertext_hash is an opaque SHA-256 hex digest (64 chars).
    Plaintext NEVER appears in this dataclass or any derived value.
    """

    ciphertext_hash: str
    from_did: str
    tick: int
    to_did: str


# Alphabetical tuple matching grid/src/whisper/types.ts WHISPERED_KEYS.
# Used at the sole-producer boundary for closed-tuple enforcement.
WHISPERED_KEYS = ("ciphertext_hash", "from_did", "tick", "to_did")
