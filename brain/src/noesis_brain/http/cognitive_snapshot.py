"""Cognitive-snapshot HTTP endpoint handler.

Serves GET /cognitive-snapshot/{did} — a scrubbed, read-only view of
Brain-internal cognitive metadata for a single Nous.

Response contract (D-25a-03) — exactly 5 keys:
    {
        "drive_levels":      { hunger, curiosity, safety, boredom, loneliness } -> float,
        "last_sleep_tick":   int,
        "reflexion_count":   int,
        "rule_count":        int,
        "skill_titles_topk": [str, ...]   # up to K=10, sorted by last_used_at DESC
    }

Plaintext gate (D-25a-05):
    NEVER include: reflexion_text, rule_text, creed_text, skill_body,
                   lore_body, whisper_plaintext
    PERMITTED exception: skill_titles_topk values (titles only, NOT instructions/body)

Auth: X-Brain-Secret header must equal the shared secret configured at startup.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from aiohttp import web

from ..ananke.types import DriveName
from ..memory.types import MemoryType, WikiCategory
from ..skills.store import SkillStore

if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

# Maximum number of skill titles returned (D-25a-03 + UI-SPEC).
SKILL_TITLES_TOPK = 10

# Prefix that self-model rules use in the wiki title field.
_RULE_TITLE_PREFIX = "self_model_rule_"


async def handle_cognitive_snapshot(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    """Handle GET /cognitive-snapshot/{did}.

    Returns a JSON object with exactly 5 keys (see module docstring).
    Raises 401 Unauthorized if the X-Brain-Secret header does not match.
    """
    # ── Auth gate (T-25a-03-01) ───────────────────────────────────────────────
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()

    did = request.match_info["did"]

    # ── Drive levels — always all 5 DriveName keys ────────────────────────────
    drive_levels: dict[str, float] = {d.value: 0.0 for d in DriveName}
    runtime = handler._ananke_runtimes.get(did)
    if runtime is not None:
        for drive_name, value in runtime.state.values.items():
            drive_levels[drive_name.value] = float(value)

    # ── Skill titles — top-K by recency, TITLES ONLY (never instructions) ─────
    skill_titles_topk: list[str] = _get_skill_titles_topk(handler)

    # ── Reflexion count ───────────────────────────────────────────────────────
    reflexion_count = _count_reflexions(handler)

    # ── Rule count — self_model wiki pages with self_model_rule_ prefix ───────
    rule_count = _count_rules(handler)

    return web.json_response({
        "drive_levels": drive_levels,
        "last_sleep_tick": handler._last_sleep_tick,
        "reflexion_count": reflexion_count,
        "rule_count": rule_count,
        "skill_titles_topk": skill_titles_topk,
    })


def _get_skill_titles_topk(handler: "BrainHandler") -> list[str]:
    """Return up to SKILL_TITLES_TOPK skill TITLE strings, sorted by last_used_at DESC.

    Constructs a transient SkillStore from the shared SQLite connection if
    handler.memory is available. Returns an empty list if unavailable.

    INVARIANT: Only the .name field is accessed — never .instructions.
    """
    memory = getattr(handler, "memory", None)
    if memory is None:
        return []
    store_conn = getattr(getattr(memory, "_store", None), "_conn", None)
    if store_conn is None:
        return []
    skill_store = SkillStore(store_conn)
    # list_all() returns skills already sorted by last_used_at DESC (see store.py).
    skills = skill_store.list_all()
    return [s.name for s in skills[:SKILL_TITLES_TOPK]]


def _count_reflexions(handler: "BrainHandler") -> int:
    """Count MemoryType.REFLECTION entries in the memory store.

    Uses a direct SQL COUNT to avoid loading all rows into memory.
    Falls back to 0 if memory is unavailable.
    """
    memory = getattr(handler, "memory", None)
    if memory is None:
        return 0
    store = getattr(memory, "_store", None)
    if store is None:
        return 0
    conn = getattr(store, "_conn", None)
    if conn is None:
        return 0
    row = conn.execute(
        "SELECT COUNT(*) FROM memories WHERE memory_type = ?",
        (MemoryType.REFLECTION.value,),
    ).fetchone()
    return int(row[0]) if row else 0


def _count_rules(handler: "BrainHandler") -> int:
    """Count self-model rule wiki pages (title prefix 'self_model_rule_').

    Uses wiki_pages_by_category to enumerate SELF_MODEL pages, then filters
    by title prefix. Falls back to 0 if memory is unavailable.
    """
    memory = getattr(handler, "memory", None)
    if memory is None:
        return 0
    store = getattr(memory, "_store", None)
    if store is None:
        return 0
    pages = store.wiki_pages_by_category(WikiCategory.SELF_MODEL)
    return sum(1 for p in pages if p.title.startswith(_RULE_TITLE_PREFIX))
