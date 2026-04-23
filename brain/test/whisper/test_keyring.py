"""brain/test/whisper/test_keyring.py

Phase 11 Wave 1 tests for brain/src/noesis_brain/whisper/keyring.py.

Tests:
    - Keypair determinism: same DID → same public bytes
    - Distinct DIDs → distinct keypairs
    - Golden pub-byte fixture: Python pub matches JS-derived pub (cross-lang compat proof)
    - Encrypt + decrypt round-trip
    - MAC failure raises CryptoError
    - evict() zeroes _pub and _priv entries

Golden pub-byte fixture derivation:
    JS: keypairFromDid('did:noesis:alice_test').publicKey
        → 64d82bca2c149c01c3606a919b5d7ba0b75c1abe84717db3d2964742fffe407c
    Python: hashlib.sha256('did:noesis:alice_test'.encode()).digest()
          → seed; nacl.bindings.crypto_box_seed_keypair(seed)[0]
          → must equal the JS hex above.
    Generated via: node grid/scripts/gen-whisper-jsfixture.mjs (Wave 1).
"""
import hashlib
import pytest
from nacl.exceptions import CryptoError  # type: ignore[import]
from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.nonce import derive_nonce

# DIDs used in all tests (synthetic test DIDs — NOT real Nous identities)
ALICE_DID = "did:noesis:alice_test"
BOB_DID = "did:noesis:bob_test"

# Golden public key bytes produced by grid/src/whisper/crypto.ts keypairFromDid().
# If this fixture fails, JS↔Python byte-compat is broken (RESEARCH §2.2 A2).
# Regenerate: node -e "import('./grid/src/whisper/crypto.ts').then(m => m.keypairFromDid('did:noesis:alice_test'))"
ALICE_PUB_HEX = "64d82bca2c149c01c3606a919b5d7ba0b75c1abe84717db3d2964742fffe407c"
BOB_PUB_HEX = "87bc47cd478f147d3e143b6e05f2a58c749bbde2734398dd10caecc2f5bb9617"


class TestKeyringDeterminism:
    def test_same_did_produces_same_pub_bytes(self) -> None:
        kr = Keyring()
        pub1 = kr.pub_for(ALICE_DID)
        pub2 = kr.pub_for(ALICE_DID)
        assert pub1 == pub2

    def test_distinct_dids_produce_distinct_pub_bytes(self) -> None:
        kr = Keyring()
        alice_pub = kr.pub_for(ALICE_DID)
        bob_pub = kr.pub_for(BOB_DID)
        assert alice_pub != bob_pub

    def test_pub_key_length_is_32_bytes(self) -> None:
        kr = Keyring()
        pub = kr.pub_for(ALICE_DID)
        assert len(pub) == 32

    def test_fresh_keyring_same_did_same_bytes(self) -> None:
        """Two separate Keyring instances derive identical pub bytes from same DID."""
        kr1 = Keyring()
        kr2 = Keyring()
        assert kr1.pub_for(ALICE_DID) == kr2.pub_for(ALICE_DID)


class TestKeyringGoldenFixture:
    """Cross-lang compat: Python pub bytes must match JS keypairFromDid output."""

    def test_alice_pub_matches_js_golden(self) -> None:
        """CRITICAL: If this fails, A2 assumption is violated — nacl.bindings path diverges."""
        kr = Keyring()
        alice_pub = kr.pub_for(ALICE_DID)
        expected = bytes.fromhex(ALICE_PUB_HEX)
        assert alice_pub == expected, (
            f"Python pub {alice_pub.hex()!r} != JS golden {ALICE_PUB_HEX!r}. "
            "Verify nacl.bindings.crypto_box_seed_keypair is used (NOT PrivateKey(seed))."
        )

    def test_bob_pub_matches_js_golden(self) -> None:
        kr = Keyring()
        bob_pub = kr.pub_for(BOB_DID)
        expected = bytes.fromhex(BOB_PUB_HEX)
        assert bob_pub == expected, (
            f"Python pub {bob_pub.hex()!r} != JS golden {BOB_PUB_HEX!r}. "
            "Verify nacl.bindings.crypto_box_seed_keypair is used (NOT PrivateKey(seed))."
        )

    def test_seed_derivation_matches_sha256(self) -> None:
        """Seed = sha256(did.encode('utf-8')) — matches JS sha256(from_string(did))."""
        kr = Keyring()
        expected_seed = hashlib.sha256(ALICE_DID.encode("utf-8")).digest()
        assert kr.seed_for(ALICE_DID) == expected_seed


class TestKeyringEncryptDecrypt:
    def test_encrypt_decrypt_roundtrip(self) -> None:
        kr = Keyring()
        alice_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(alice_seed, tick=1, counter=0)
        plaintext = b"hello whisper"
        ciphertext = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        decrypted = kr.decrypt_from(BOB_DID, kr.pub_for(ALICE_DID), ciphertext, nonce)
        assert decrypted == plaintext

    def test_ciphertext_length_is_plaintext_plus_16(self) -> None:
        kr = Keyring()
        alice_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(alice_seed, tick=1, counter=0)
        plaintext = b"hello whisper"
        ciphertext = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        assert len(ciphertext) == len(plaintext) + 16

    def test_mac_failure_raises_crypto_error(self) -> None:
        """Corrupted ciphertext must raise CryptoError — not return garbage."""
        kr = Keyring()
        alice_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(alice_seed, tick=1, counter=0)
        plaintext = b"hello whisper"
        ciphertext = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        corrupted = bytearray(ciphertext)
        corrupted[0] ^= 0xFF  # flip bits in MAC region
        with pytest.raises(CryptoError):
            kr.decrypt_from(BOB_DID, kr.pub_for(ALICE_DID), bytes(corrupted), nonce)

    def test_wrong_nonce_raises_crypto_error(self) -> None:
        """Wrong nonce must raise CryptoError during decryption."""
        kr = Keyring()
        alice_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(alice_seed, tick=1, counter=0)
        wrong_nonce = derive_nonce(alice_seed, tick=2, counter=0)
        plaintext = b"hello whisper"
        ciphertext = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        with pytest.raises(CryptoError):
            kr.decrypt_from(BOB_DID, kr.pub_for(ALICE_DID), ciphertext, wrong_nonce)

    def test_encrypt_is_deterministic(self) -> None:
        """Same inputs → byte-identical ciphertext."""
        kr = Keyring()
        alice_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(alice_seed, tick=1, counter=0)
        plaintext = b"hello whisper"
        ct1 = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        ct2 = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        assert ct1 == ct2


class TestKeyringEvict:
    def test_evict_removes_pub_entry(self) -> None:
        kr = Keyring()
        kr.pub_for(ALICE_DID)  # cache it
        assert ALICE_DID in kr._pub
        kr.evict(ALICE_DID)
        assert ALICE_DID not in kr._pub

    def test_evict_removes_priv_entry(self) -> None:
        kr = Keyring()
        kr.pub_for(ALICE_DID)  # cache it (also caches priv)
        assert ALICE_DID in kr._priv
        kr.evict(ALICE_DID)
        assert ALICE_DID not in kr._priv

    def test_evict_unknown_did_is_noop(self) -> None:
        """Evicting an unknown DID must not raise."""
        kr = Keyring()
        kr.evict("did:noesis:never_seen")  # must not raise

    def test_re_derive_after_evict_produces_same_pub(self) -> None:
        """After evict, the next call re-derives the same deterministic keypair."""
        kr = Keyring()
        pub_before = kr.pub_for(ALICE_DID)
        kr.evict(ALICE_DID)
        pub_after = kr.pub_for(ALICE_DID)
        assert pub_before == pub_after
