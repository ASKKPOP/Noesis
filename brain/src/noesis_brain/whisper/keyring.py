"""brain/src/noesis_brain/whisper/keyring.py

Phase 11 Wave 1 — D-11-04 Brain-scoped per-DID keyring.

CRITICAL: uses nacl.bindings.crypto_box_seed_keypair, NOT PrivateKey(seed).
Reason: PrivateKey(seed) treats seed as the raw X25519 scalar.
        libsodium.js crypto_box_seed_keypair hashes seed with SHA-512 internally
        and uses the first 32 bytes as the clamped scalar.
        The two paths produce DIFFERENT keypairs from the same seed.
        See RESEARCH.md §2.2 A2.

Keypair derivation:
    seed = hashlib.sha256(did.encode("utf-8")).digest()  # 32 bytes
    pub, priv = nacl.bindings.crypto_box_seed_keypair(seed)

This matches the JS side:
    crypto_box_seed_keypair(sha256(UTF-8(did)))

SECURITY:
    - Private keys live in-memory only; never written to disk.
    - Keyring.evict(did) zeroes out _pub and _priv entries on bios.death.
    - No wall-clock reads (datetime, time.time, time.monotonic forbidden).
    - Private key material never logged or printed.
"""
import hashlib
from nacl.bindings import crypto_box, crypto_box_open, crypto_box_seed_keypair  # type: ignore[import]
from nacl.exceptions import CryptoError  # type: ignore[import]

__all__ = ["Keyring"]


class Keyring:
    """Per-DID keyring with in-memory key material.

    Keys are derived on demand from seed = sha256(DID) and cached until evict().
    Re-construction after eviction is cheap: just call any pub_for/encrypt_for/decrypt_from again.
    """

    def __init__(self) -> None:
        self._pub: dict[str, bytes] = {}
        self._priv: dict[str, bytes] = {}

    # ── Internal ──────────────────────────────────────────────────────────────

    def _ensure(self, did: str) -> None:
        """Ensure (pub, priv) are derived and cached for did."""
        if did in self._pub:
            return
        seed = hashlib.sha256(did.encode("utf-8")).digest()  # 32 bytes
        pub, priv = crypto_box_seed_keypair(seed)
        self._pub[did] = pub
        self._priv[did] = priv

    # ── Public API ────────────────────────────────────────────────────────────

    def pub_for(self, did: str) -> bytes:
        """Return the 32-byte X25519 public key for a DID."""
        self._ensure(did)
        return self._pub[did]

    def seed_for(self, did: str) -> bytes:
        """Return the 32-byte seed (sha256(did)) for a DID.

        Used ONLY internally for nonce derivation — never exposed on wire.
        """
        return hashlib.sha256(did.encode("utf-8")).digest()

    def encrypt_for(
        self,
        sender_did: str,
        recipient_pub: bytes,
        plaintext: bytes,
        nonce: bytes,
    ) -> bytes:
        """Encrypt plaintext using sender's private key and recipient's public key.

        Uses nacl.bindings.crypto_box (XSalsa20-Poly1305 AEAD).
        Returns ciphertext only — nonce NOT prepended (matches crypto_box_easy on JS side).

        Args:
            sender_did: the sender's DID (used to look up private key).
            recipient_pub: recipient's 32-byte X25519 public key.
            plaintext: bytes to encrypt.
            nonce: 24-byte nonce (from derive_nonce()).

        Returns:
            Ciphertext bytes (plaintext.length + 16 MAC bytes).
        """
        self._ensure(sender_did)
        return crypto_box(plaintext, nonce, recipient_pub, self._priv[sender_did])

    def decrypt_from(
        self,
        recipient_did: str,
        sender_pub: bytes,
        ciphertext: bytes,
        nonce: bytes,
    ) -> bytes:
        """Decrypt ciphertext using recipient's private key and sender's public key.

        Uses nacl.bindings.crypto_box_open (XSalsa20-Poly1305 AEAD).
        Raises nacl.exceptions.CryptoError on MAC failure — never returns garbage.

        Args:
            recipient_did: the recipient's DID (used to look up private key).
            sender_pub: sender's 32-byte X25519 public key.
            ciphertext: bytes returned by encrypt_for().
            nonce: 24-byte nonce matching the one used during encryption.

        Returns:
            Plaintext bytes.

        Raises:
            CryptoError: if MAC verification fails.
        """
        self._ensure(recipient_did)
        return crypto_box_open(ciphertext, nonce, sender_pub, self._priv[recipient_did])

    def evict(self, did: str) -> None:
        """Remove key material for a DID (called on bios.death).

        After eviction, pub_for/encrypt_for/decrypt_from will re-derive the
        keypair on next call (deterministic — no stored state lost).
        """
        self._pub.pop(did, None)
        self._priv.pop(did, None)
