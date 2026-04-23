"""brain/src/noesis_brain/whisper/sender.py

Phase 11 Wave 3 — WHISPER-01 / D-11-06 / D-11-19 / T-10-06.

Brain-side whisper sender: encrypts plaintext using PyNaCl + deterministic nonce,
then POSTs the ciphertext to the Grid's /whisper/send endpoint.

Steps in send_whisper():
    0. trade_guard.assert_no_trade_keywords(plaintext)  — T-10-06 defense-depth
    1. Derive recipient's public key from recipient_did.
    2. Derive sender's keypair from sender_did.
    3. Derive 32-byte seed = sha256(sender_did).
    4. Derive 24-byte nonce = derive_nonce(seed, tick, counter).
    5. Encrypt: ciphertext = crypto_box(plaintext, nonce, recipient_pub, sender_priv).
    6. POST { to_did, ciphertext_blob_b64, nonce_b64, tick } to Grid.
    7. Return { envelope_id, ciphertext_hash } from Grid response.

D-11-06: uses sender's stable DERIVED keypair (NOT ephemeral). ephemeral_pub_b64
in the Envelope is populated with sender's derived public key as a schema
reservation for future forward-secrecy (WHISPER-FS-01, deferred).

D-11-19: field sent to Grid is `ciphertext_blob_b64` (Brain encrypts BEFORE POST).
The older name `plaintext_blob_b64` is deprecated as of Wave 3.

T-10-06: trade_guard.assert_no_trade_keywords is the FIRST step — called before
any crypto. If rejected, httpx is never called.

PRIVACY:
    - Plaintext bytes are created locally and immediately passed to crypto_box.
    - Plaintext NEVER appears in the POST body — only ciphertext_blob_b64.
    - The local variable named 'plaintext' is acceptable (function scope only).

NO datetime, NO time.time, NO random — wall-clock ban per D-11-13.
See: 11-CONTEXT.md D-11-06, D-11-19, T-10-06. WHISPER-01.
"""

import base64
import hashlib

import httpx
from nacl.bindings import crypto_box  # type: ignore[import]

from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.nonce import derive_nonce
from noesis_brain.whisper.trade_guard import assert_no_trade_keywords

__all__ = ["send_whisper"]

_keyring = Keyring()


async def send_whisper(
    *,
    sender_did: str,
    recipient_did: str,
    plaintext: str,
    tick: int,
    counter: int,
    grid_base_url: str = "http://127.0.0.1:8080",
    http_client: httpx.AsyncClient | None = None,
) -> dict:
    """Encrypt plaintext and POST to Grid /whisper/send.

    Args:
        sender_did: the sending Nous's DID.
        recipient_did: the target Nous's DID.
        plaintext: the message text to encrypt. NEVER sent in plaintext over wire.
        tick: current world-clock tick (deterministic nonce input).
        counter: per-(sender, tick) message counter (deterministic nonce input).
        grid_base_url: base URL of the local Grid instance.
        http_client: optional injected httpx.AsyncClient (for testing).

    Returns:
        dict with keys: envelope_id, ciphertext_hash (from Grid response).

    Raises:
        TradeKeywordRejected: if plaintext contains trade keywords (T-10-06).
        httpx.HTTPStatusError: if Grid returns non-2xx.
    """
    # Step 0: T-10-06 defense-depth — trade keyword gate BEFORE any crypto.
    assert_no_trade_keywords(plaintext)

    # Step 1: Derive recipient's public key.
    recipient_pub = _keyring.pub_for(recipient_did)

    # Step 2: Derive sender's keypair (private key via internal Keyring).
    # sender_pub is populated in ephemeral_pub_b64 as schema reservation (D-11-06).
    sender_pub = _keyring.pub_for(sender_did)

    # Step 3: Derive 32-byte seed = sha256(sender_did).
    sender_seed = hashlib.sha256(sender_did.encode("utf-8")).digest()  # 32 bytes

    # Step 4: Derive deterministic 24-byte nonce.
    nonce = derive_nonce(sender_seed, tick, counter)

    # Step 5: Encrypt using sender's private key and recipient's public key.
    # crypto_box produces MAC-prepended ciphertext (plaintext.len + 16 bytes).
    # local var 'plaintext' acceptable — never sent to wire or logged.
    pt_bytes = plaintext.encode("utf-8")
    ct = _keyring.encrypt_for(sender_did, recipient_pub, pt_bytes, nonce)

    # Step 6: POST to Grid.
    body = {
        "to_did": recipient_did,
        "ciphertext_blob_b64": base64.b64encode(ct).decode("ascii"),
        "nonce_b64": base64.b64encode(nonce).decode("ascii"),
        "tick": tick,
        "ephemeral_pub_b64": base64.b64encode(sender_pub).decode("ascii"),
    }

    owns_client = http_client is None
    client = http_client or httpx.AsyncClient()
    try:
        resp = await client.post(
            f"{grid_base_url}/api/v1/nous/{sender_did}/whisper/send",
            json=body,
        )
        resp.raise_for_status()
        return resp.json()
    finally:
        if owns_client:
            await client.aclose()
