"""brain/src/noesis_brain/whisper/receiver.py

Phase 11 Wave 3 — WHISPER-06 / D-11-06.

Brain-side whisper receiver: polls GET /whispers/pending on each tick boundary,
decrypts each envelope, dispatches to the deliberation engine, then ACKs.

Loop steps per tick:
    1. GET /api/v1/nous/:did/whispers/pending → list of Envelope dicts.
    2. For each envelope: decrypt_envelope(env, our_did=nous_did).
    3. If decrypt succeeds: deliberation_dispatcher.dispatch(
           channel='whisper', plaintext=..., from_did=..., tick=...
       ) and add envelope_id to ack list.
    4. If decrypt raises: log warning, do NOT ack (leave for next-tick retry).
    5. POST /api/v1/nous/:did/whispers/ack with collected ack_ids.

tick_source injection:
    The receiver awaits tick events from an injected tick_source, avoiding
    any time.time() / asyncio.sleep() calls in the receive loop.
    tick_source must implement: async def ticks() → AsyncIterator[int].

PRIVACY:
    - decrypted plaintext is local-variable scope only; passed to dispatcher.
    - The dispatcher is responsible for not logging plaintext.
    - local var 'plaintext' is acceptable — not a wire key, not logged here.

NO datetime, NO time.time, NO asyncio.sleep without injected clock — wall-clock ban D-11-13.
See: 11-CONTEXT.md D-11-06. WHISPER-06. decrypt.py for decryption. sender.py for send path.
"""

from typing import Any

import httpx

from noesis_brain.whisper.decrypt import decrypt_envelope, DecryptVerificationError

__all__ = ["receive_loop"]


async def receive_loop(
    *,
    nous_did: str,
    grid_base_url: str = "http://127.0.0.1:8080",
    tick_source: Any,
    deliberation_dispatcher: Any,
    http_client: httpx.AsyncClient | None = None,
    logger: Any,
) -> None:
    """Poll whisper pending queue on each tick boundary, decrypt, dispatch, ack.

    Args:
        nous_did: the receiving Nous's DID.
        grid_base_url: base URL of the local Grid instance.
        tick_source: injected tick source; must implement async ticks() iterator.
        deliberation_dispatcher: injected dispatcher; must implement
            dispatch(channel, plaintext, from_did, tick).
        http_client: optional injected httpx.AsyncClient (for testing).
        logger: injected logger; must implement .warning(msg).

    The loop runs until tick_source.ticks() is exhausted or the caller cancels
    the coroutine. Each iteration processes one tick boundary.
    """
    owns_client = http_client is None
    client = http_client or httpx.AsyncClient()
    try:
        async for _current_tick in tick_source.ticks():
            # Step 1: Pull pending envelopes.
            resp = await client.get(
                f"{grid_base_url}/api/v1/nous/{nous_did}/whispers/pending"
            )
            resp.raise_for_status()
            envelopes = resp.json().get("envelopes", [])

            ack_ids: list[str] = []

            # Steps 2-4: Decrypt and dispatch each envelope.
            for env in envelopes:
                try:
                    # local var 'plaintext' — not a wire key, not logged here.
                    plaintext = decrypt_envelope(env, our_did=nous_did)
                    deliberation_dispatcher.dispatch(
                        channel="whisper",
                        plaintext=plaintext,
                        from_did=env["from_did"],
                        tick=env["tick"],
                    )
                    ack_ids.append(env["envelope_id"])
                except (DecryptVerificationError, Exception) as exc:
                    # Do NOT ack failed decrypts — leave for next-tick retry or GC.
                    logger.warning(
                        f"whisper decrypt failed: {exc}; "
                        f"envelope_id={env.get('envelope_id')}"
                    )

            # Step 5: Ack successfully processed envelopes.
            if ack_ids:
                await client.post(
                    f"{grid_base_url}/api/v1/nous/{nous_did}/whispers/ack",
                    json={"envelope_ids": ack_ids},
                )
    finally:
        if owns_client:
            await client.aclose()
