"""Skills-by-hash HTTP endpoint handler.

Serves GET /skills/{hash} — returns name and description for a skill given its
sha256(instructions) hash. Used by Grid portal Skills tab proxy (D-07/D-15).

Response contract — exactly 2 keys:
    { "description": str, "name": str }

Auth: X-Brain-Secret header must equal shared secret (same pattern as cognitive_snapshot).
Returns 404 JSON {"error": "not_found"} if hash not found.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from aiohttp import web

from ..skills.store import SkillStore

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler


async def handle_skills_lookup(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    # Auth gate — same as cognitive_snapshot.py
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()

    skill_hash = request.match_info["hash"]

    # Access SkillStore via handler.memory._store._conn (same as cognitive_snapshot pattern)
    memory = getattr(handler, "memory", None)
    if memory is None:
        return web.json_response({"error": "unavailable"}, status=503)
    store_conn = getattr(getattr(memory, "_store", None), "_conn", None)
    if store_conn is None:
        return web.json_response({"error": "unavailable"}, status=503)

    skill_store = SkillStore(store_conn)
    skill = skill_store.get_by_hash(skill_hash)
    if skill is None:
        return web.json_response({"error": "not_found"}, status=404)

    # Exactly 2 keys — alphabetical order matches Grid's closed-key validation
    return web.json_response({
        "description": skill.description,
        "name": skill.name,
    })
