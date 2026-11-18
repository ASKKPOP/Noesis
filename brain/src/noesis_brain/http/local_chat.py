"""Tier-1 Local Nous Manager chat endpoint (D-V3-36, D-V3-42).

    POST /local/chat   {"text": "...", "history": [{"role": "human"|"nous", "text": "..."}]}
                    →  {"reply": "..."}

The operator talking to their OWN Nous on their OWN machine. ``history`` is the
conversation so far (optional; the most recent messages are used), so the Nous answers
with it in view. The Nous keeps the exchange as a memory. The reply is returned to the
caller only: nothing is read from or sent to the Grid and no Grid event is emitted.
Gated by X-Brain-Secret like every other Brain HTTP route.

503 when the model cannot answer — the reason is returned, never a made-up reply.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from aiohttp import web

from ..llm.base import LLMError

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

# One chat message, in characters.
CHAT_TEXT_MAX = 4000
# Earlier messages shown to the Nous.
CHAT_HISTORY_MAX = 20

# Messages starting with "__" are peer-protocol frames (skill and lore exchange), not talk.
_PROTOCOL_PREFIX = "__"
_ROLES = ("human", "nous")


def _history(raw: Any) -> list[tuple[str, str]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise web.HTTPBadRequest(text="history must be a list")
    turns: list[tuple[str, str]] = []
    for item in raw:
        role = item.get("role") if isinstance(item, dict) else None
        text = item.get("text") if isinstance(item, dict) else None
        if role not in _ROLES or not isinstance(text, str) or len(text) > CHAT_TEXT_MAX:
            raise web.HTTPBadRequest(text="each history item needs role 'human' or 'nous' and text")
        turns.append((role, text))
    return turns[-CHAT_HISTORY_MAX:]


async def handle_local_chat(
    request: web.Request, handler: "BrainHandler", secret: str
) -> web.Response:
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()
    try:
        body = await request.json()
    except ValueError:
        raise web.HTTPBadRequest(text="body must be JSON")
    text = body.get("text") if isinstance(body, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise web.HTTPBadRequest(text="text is required")
    text = text.strip()
    if len(text) > CHAT_TEXT_MAX:
        raise web.HTTPBadRequest(text=f"text is longer than {CHAT_TEXT_MAX} characters")
    if text.startswith(_PROTOCOL_PREFIX):
        raise web.HTTPBadRequest(text="text may not start with '__'")
    history = _history(body.get("history"))

    try:
        reply = await handler.local_chat(text, history)
    except LLMError as exc:
        return web.json_response({"error": f"The model could not answer: {exc}"}, status=503)
    return web.json_response({"reply": reply})
