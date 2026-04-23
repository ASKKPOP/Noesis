"""brain/src/noesis_brain/whisper/decrypt.py

Phase 11 Wave 3 — WHISPER-06 / D-11-06.

Decrypts a whisper Envelope dict received from GET /api/v1/nous/:did/whispers/pending.

Steps:
    1. Verify ciphertext_hash matches the received ciphertext bytes.
    2. Derive our keypair from our_did (recipient).
    3. Re-derive sender's public key from envelope['from_did'].
       (D-11-06: use sender's stable derived keypair, NOT ephemeral_pub_b64.
        ephemeral_pub_b64 is reserved for future forward-secrecy — ignored here.)
    4. Decode nonce from nonce_b64.
    5. Call nacl.bindings.crypto_box_open to decrypt ciphertext.
    6. Return plaintext UTF-8 string.

SECURITY:
    - Raises DecryptVerificationError on hash mismatch (tampered ciphertext).
    - Raises nacl.exceptions.CryptoError on MAC failure (corrupted / wrong key).
    - Receiver catches both and drops the envelope without crashing.
    - local variable named 'plaintext' is acceptable (local scope only).
      It is NEVER logged, never returned as a wire key, never written to disk.

NO datetime, NO time.time, NO random — wall-clock ban per D-11-13.
See: 11-CONTEXT.md D-11-06. receiver.py for the call site.
"""

import base64
import hashlib

from nacl.bindings import crypto_box_open  # type: ignore[import]

from noesis_brain.whisper.keyring import Keyring

__all__ = ["DecryptVerificationError", "decrypt_envelope"]

_keyring = Keyring()


class DecryptVerificationError(Exception):
    """Raised when ciphertext_hash verification fails before decryption.

    Indicates the envelope may have been tampered with in transit.
    Receiver must drop this envelope without crashing.
    """


def decrypt_envelope(envelope: dict, *, our_did: str) -> str:
    """Decrypt a whisper envelope and return the plaintext string.

    Args:
        envelope: dict with keys from the Envelope wire format:
            ciphertext_b64, ciphertext_hash, nonce_b64, from_did, envelope_id.
        our_did: the recipient's DID (used to derive our private key).

    Returns:
        Plaintext string (UTF-8 decoded).

    Raises:
        DecryptVerificationError: if ciphertext_hash does not match the
            decoded ciphertext bytes.
        nacl.exceptions.CryptoError: if NaCl MAC verification fails
            (corrupted or wrong sender key).
    """
    ct = base64.b64decode(envelope["ciphertext_b64"])

    # Step 1: Verify hash before attempting decryption.
    expected_hash = hashlib.sha256(ct).hexdigest()
    if expected_hash != envelope["ciphertext_hash"]:
        raise DecryptVerificationError(
            f"ciphertext_hash mismatch for envelope_id={envelope.get('envelope_id')}"
        )

    # Step 2: Derive our keypair (recipient).
    our_pub = _keyring.pub_for(our_did)
    _ = our_pub  # pub not needed directly; keyring uses our_did for priv lookup

    # Step 3: Re-derive sender's public key from from_did (D-11-06).
    # ephemeral_pub_b64 is ignored — single source of truth.
    sender_pub = _keyring.pub_for(envelope["from_did"])

    # Step 4: Decode nonce.
    nonce = base64.b64decode(envelope["nonce_b64"])

    # Step 5: Decrypt using recipient's private key and sender's public key.
    # nacl.bindings.crypto_box_open raises CryptoError on MAC failure.
    plaintext_bytes = _keyring.decrypt_from(our_did, sender_pub, ct, nonce)

    # Step 6: Decode to string. (local var 'plaintext' is intentional — not a wire key)
    return plaintext_bytes.decode("utf-8")
