"""Tier-1 Local Nous Manager inspect endpoints (v3.3 Mind, Phase 75).

Serves the operator-LOCAL inspect surface consumed by the Local Nous Manager
desktop app (D-V3-36 Tier 1: "Brain config, Local AI settings, memory
inspector"):

    GET /local/state                 — full BrainHandler.get_state()
    GET /local/memory/recent?limit=N — recent episodic memories (full content)
    GET /local/wiki/pages?category=C — personal-wiki (episteme) pages

Boundary note: the D-25a-05 plaintext gate protects the *Grid-facing*
cognitive-snapshot contract. These routes are the sanctioned Tier-1 memory
inspector — the operator reading their OWN Nous on their OWN machine — and are
gated by the same X-Brain-Secret as every other Brain HTTP route. They emit no
Grid events.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from aiohttp import web

from ..memory.types import WikiCategory

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

# Hard cap on one memory page — the inspector paginates, it never dumps.
MEMORY_LIMIT_MAX = 200
MEMORY_LIMIT_DEFAULT = 50


def _auth(request: web.Request, secret: str) -> None:
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()


async def handle_local_state(
    request: web.Request, handler: "BrainHandler", secret: str
) -> web.Response:
    """GET /local/state — the full dashboard-inspector state, locally."""
    _auth(request, secret)
    return web.json_response(handler.get_state())


async def handle_local_memory_recent(
    request: web.Request, handler: "BrainHandler", secret: str
) -> web.Response:
    """GET /local/memory/recent?limit=N — recent episodic memories."""
    _auth(request, secret)
    memory = getattr(handler, "memory", None)
    if memory is None:
        return web.json_response({"count": 0, "memories": []})
    try:
        limit = int(request.query.get("limit", MEMORY_LIMIT_DEFAULT))
    except ValueError:
        limit = MEMORY_LIMIT_DEFAULT
    limit = max(1, min(limit, MEMORY_LIMIT_MAX))
    memories = memory.recent(limit=limit)
    out = [
        {
            "memory_type": m.memory_type.value,
            "content": m.content,
            "importance": m.importance,
            "source_did": m.source_did,
            "location": m.location,
            "tick": m.tick,
            "created_at": m.created_at.isoformat(),
        }
        for m in memories
    ]
    return web.json_response({"count": len(out), "memories": out})


async def handle_local_wiki_pages(
    request: web.Request, handler: "BrainHandler", secret: str
) -> web.Response:
    """GET /local/wiki/pages?category=C — personal-wiki pages (episteme)."""
    _auth(request, secret)
    memory = getattr(handler, "memory", None)
    store = getattr(memory, "_store", None) if memory is not None else None
    if store is None:
        return web.json_response({"count": 0, "pages": []})
    category_raw = request.query.get("category", "")
    if category_raw:
        try:
            category = WikiCategory(category_raw)
        except ValueError:
            raise web.HTTPBadRequest(text=f"unknown category: {category_raw}")
        pages = store.wiki_pages_by_category(category)
    else:
        pages = store.all_wiki_pages()
    out = [
        {
            "title": p.title,
            "category": p.category.value,
            "content": p.content,
            "confidence": p.confidence,
            "source": p.source,
            "version": p.version,
            "updated_at": p.updated_at.isoformat(),
        }
        for p in pages
    ]
    return web.json_response({"count": len(out), "pages": out})
