"""Tier-1 Local Nous Manager chat endpoint (D-V3-36, D-V3-42).

    POST /local/chat   {"text": "..."}  →  {"reply": "..."}

The operator talking to their OWN Nous on their OWN machine. The message goes through
the same path as any message the Nous hears (emotions, memory, the system prompt, the
model), but it is marked local: the reply is returned to the caller only and is never
forwarded to the Grid, and no Grid event is emitted. Gated by X-Brain-Secret like every
other Brain HTTP route.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from aiohttp import web

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

# One chat message, in characters.
CHAT_TEXT_MAX = 4000

# Messages starting with "__" are peer-protocol frames (skill and lore exchange), not talk.
_PROTOCOL_PREFIX = "__"


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

    actions = await handler.on_message(
        {"sender_name": "Your human", "sender_did": "", "channel": "direct", "text": text, "local": True}
    )
    reply = next((a.get("text", "") for a in actions if a.get("action_type") == "speak"), "")
    return web.json_response({"reply": reply})
