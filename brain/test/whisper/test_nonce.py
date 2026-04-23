"""brain/test/whisper/test_nonce.py

Phase 11 Wave 1 tests for brain/src/noesis_brain/whisper/nonce.py.

Tests:
    - derive_nonce returns exactly 24 bytes
    - Determinism: same (seed, tick, counter) → same output
    - Tick scope: different tick → different nonce at same counter
    - Counter scope: different counter → different nonce at same tick
    - Seed scope: different seed → different nonce
    - Input validation: rejects seed != 32 bytes, negative tick, negative counter
"""
import pytest
import hashlib
from noesis_brain.whisper.nonce import derive_nonce


SEED_A = bytes(range(32))  # 0x00..0x1f — deterministic 32-byte seed
SEED_B = bytes(range(1, 33))  # 0x01..0x20 — distinct seed


class TestDeriveNonce:
    def test_output_length_is_24(self) -> None:
        result = derive_nonce(SEED_A, tick=0, counter=0)
        assert len(result) == 24

    def test_output_type_is_bytes(self) -> None:
        result = derive_nonce(SEED_A, tick=0, counter=0)
        assert isinstance(result, bytes)

    def test_deterministic_same_inputs_same_output(self) -> None:
        n1 = derive_nonce(SEED_A, tick=42, counter=0)
        n2 = derive_nonce(SEED_A, tick=42, counter=0)
        assert n1 == n2

    def test_tick_scope_different_tick_different_nonce(self) -> None:
        n42 = derive_nonce(SEED_A, tick=42, counter=0)
        n43 = derive_nonce(SEED_A, tick=43, counter=0)
        assert n42 != n43

    def test_counter_scope_different_counter_different_nonce(self) -> None:
        n0 = derive_nonce(SEED_A, tick=42, counter=0)
        n1 = derive_nonce(SEED_A, tick=42, counter=1)
        assert n0 != n1

    def test_seed_scope_different_seed_different_nonce(self) -> None:
        na = derive_nonce(SEED_A, tick=42, counter=0)
        nb = derive_nonce(SEED_B, tick=42, counter=0)
        assert na != nb

    def test_tick_zero_counter_zero_produces_valid_nonce(self) -> None:
        result = derive_nonce(SEED_A, tick=0, counter=0)
        assert len(result) == 24

    def test_large_tick_value(self) -> None:
        result = derive_nonce(SEED_A, tick=2**32, counter=0)
        assert len(result) == 24

    def test_large_counter_value(self) -> None:
        result = derive_nonce(SEED_A, tick=0, counter=2**16)
        assert len(result) == 24

    # ── Input validation ──────────────────────────────────────────────────────

    def test_rejects_seed_shorter_than_32_bytes(self) -> None:
        with pytest.raises(ValueError, match="32 bytes"):
            derive_nonce(b"\x00" * 31, tick=0, counter=0)

    def test_rejects_seed_longer_than_32_bytes(self) -> None:
        with pytest.raises(ValueError, match="32 bytes"):
            derive_nonce(b"\x00" * 33, tick=0, counter=0)

    def test_rejects_empty_seed(self) -> None:
        with pytest.raises(ValueError, match="32 bytes"):
            derive_nonce(b"", tick=0, counter=0)

    def test_rejects_negative_tick(self) -> None:
        with pytest.raises(ValueError, match="non-negative"):
            derive_nonce(SEED_A, tick=-1, counter=0)

    def test_rejects_negative_counter(self) -> None:
        with pytest.raises(ValueError, match="non-negative"):
            derive_nonce(SEED_A, tick=0, counter=-1)

    # ── Cross-reference: verify formula matches expected bytes ────────────────

    def test_formula_matches_expected_bytes(self) -> None:
        """Verify the blake2b formula manually against a known input."""
        seed = SEED_A
        tick = 42
        counter = 7
        buf = seed + tick.to_bytes(8, "little") + counter.to_bytes(4, "little")
        expected = hashlib.blake2b(buf, digest_size=24).digest()
        result = derive_nonce(seed, tick=tick, counter=counter)
        assert result == expected
