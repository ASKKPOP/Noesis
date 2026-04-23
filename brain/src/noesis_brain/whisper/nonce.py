"""brain/src/noesis_brain/whisper/nonce.py

Phase 11 Wave 1 — D-11-13 deterministic nonce derivation.

Produces a 24-byte blake2b nonce identical to the JS side:
    grid/src/whisper/crypto.ts deriveNonce(senderPrivSeed, tick, counter)

Formula:
    nonce_24 = hashlib.blake2b(
        sender_priv_seed_32 || tick_le64 || counter_le32,
        digest_size=24,
    ).digest()

SECURITY:
    - No wall-clock reads (datetime, time.time, time.monotonic forbidden).
    - Input validated: seed must be exactly 32 bytes; tick and counter non-negative.
    - blake2b is used via hashlib (stdlib) — no third-party dep.
    - Output is always exactly 24 bytes.
"""
import hashlib


def derive_nonce(sender_priv_seed: bytes, tick: int, counter: int) -> bytes:
    """Derive a deterministic 24-byte nonce.

    Args:
        sender_priv_seed: 32-byte seed (SHA256(DID)[:32]).
        tick: non-negative integer tick index.
        counter: non-negative per-(sender, tick) message counter.

    Returns:
        24-byte blake2b digest.

    Raises:
        ValueError: if sender_priv_seed is not exactly 32 bytes,
                    or tick is negative, or counter is negative.
    """
    if len(sender_priv_seed) != 32:
        raise ValueError(
            f"sender_priv_seed must be exactly 32 bytes, got {len(sender_priv_seed)}"
        )
    if tick < 0:
        raise ValueError(f"tick must be non-negative, got {tick}")
    if counter < 0:
        raise ValueError(f"counter must be non-negative, got {counter}")

    buf = (
        sender_priv_seed
        + tick.to_bytes(8, "little")      # tick_le64 — matches JS DataView.setBigUint64(LE)
        + counter.to_bytes(4, "little")   # counter_le32 — matches JS DataView.setUint32(LE)
    )
    return hashlib.blake2b(buf, digest_size=24).digest()
