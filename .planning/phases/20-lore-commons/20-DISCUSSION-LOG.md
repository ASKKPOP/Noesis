# Phase 20: Lore Commons — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 20 — lore-commons
**Areas discussed:** LoreStore Brain design, Category tag system, Lore discovery flow, Content forwarding, Citation deduplication, LoreStore capacity, Whisper budget, REST index filtering

---

## LoreStore Brain design

| Option | Description | Selected |
|--------|-------------|----------|
| New `lore_entries` table | New lore/store.py module with its own SQLite table, mirrors SkillStore FTS5 | ✓ |
| WikiPages with LORE_COMMONS category | Reuse existing MemoryStore wiki_pages with a new WikiCategory constant | |
| Claude's Discretion | Let Claude pick the best approach | |

**User's choice:** New `lore_entries` table (SkillStore mirror)

---

## LoreStore FTS5

| Option | Description | Selected |
|--------|-------------|----------|
| FTS5 — semantic retrieval | Top-k lore injected at prompt-build using FTS5, same as SkillStore | ✓ |
| Hash-only lookup | Lore only retrieved by content_hash, no semantic search at prompt-build | |

**User's choice:** FTS5 — semantic retrieval

---

## Category tag system

| Option | Description | Selected |
|--------|-------------|----------|
| Closed enum, TOML-configurable | Default set in lore/types.py, rig-overridable via lore_categories TOML key; Grid validates at boundary | ✓ |
| Hardcoded closed enum only | Fixed set in code, no rig override | |
| Claude's Discretion | Let Claude decide the category design | |

**User's choice:** Closed enum, TOML-configurable

---

## Default category values

| Option | Description | Selected |
|--------|-------------|----------|
| 5 default categories | observation, synthesis, skill_guide, historical, cultural | |
| 3 minimal categories | observation, synthesis, cultural | |
| Claude's Discretion | Let Claude finalize based on Phase 21 Dashboard needs | ✓ |

**User's choice:** Claude's Discretion
**Notes:** Claude chose 4 categories: observation, synthesis, historical, cultural — omitting skill_guide to avoid overlap with SkillStore.

---

## Lore discovery flow

| Option | Description | Selected |
|--------|-------------|----------|
| Query Grid REST index, then whisper | Nous calls GET /api/v1/grid/lore → selects entries → sends __lore_request: whisper to contributor_did | ✓ |
| Contributor broadcasts __lore_announce: on publish | Contributor sends __lore_announce: to all known peers on publish | |
| Grid pushes a lore.available event | New allowlist event notifies Brains — breaks ROADMAP allowlist budget | |

**User's choice:** Query Grid REST index, then whisper

---

## Discovery cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Background task, every sleep epoch | asyncio.create_task, polls every 30 ticks aligned with Phase 16 sleep epoch | ✓ |
| At prompt-build if cache is stale | Local lore-index cache with TTL; async refresh triggered at prompt-build | |

**User's choice:** Background task, every sleep epoch (30 ticks)

---

## Content forwarding

| Option | Description | Selected |
|--------|-------------|----------|
| Any Nous holding the content can respond | Viral propagation — any Nous with the entry in lore_entries responds to __lore_request: | ✓ |
| Only the contributor can respond | Stricter trust model; lore becomes unreachable if contributor goes offline/dead | |

**User's choice:** Any Nous holding the content can respond

---

## Citation deduplication

| Option | Description | Selected |
|--------|-------------|----------|
| Every injection at prompt-build | lore.cited fires each time the entry is included; citation_count = usage frequency | ✓ |
| Only on first citation per Nous | Deduped per (citing_did, content_hash); citation_count = unique reach | |

**User's choice:** Every injection at prompt-build

---

## LoreStore capacity

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cap, evict by age | Cap = 50 entries, FIFO eviction by received_tick; configurable via lore_capacity TOML | ✓ |
| Uncapped | No limit; Brain SQLite grows without bound in long-running Grids | |
| Cap by citation frequency | Keep top-N by citation_count; complex sort on every insert | |

**User's choice:** Soft cap = 50, FIFO eviction (configurable)

---

## Whisper budget

| Option | Description | Selected |
|--------|-------------|----------|
| Count against shared budget | Lore whispers consume Phase 11 B=10/N=100-ticks budget alongside all other whispers | ✓ |
| Separate dedicated lore budget | Own rate limit; more surgical control but more config complexity | |

**User's choice:** Count against shared Phase 11 budget

---

## REST index filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Category + limit | ?category=&limit= — minimal, sufficient for Brain polling and Phase 21 Dashboard | ✓ |
| Full filter set | ?category=&contributor_did=&min_citations=&limit=&offset= — rich but more surface | |
| No query params | Always returns full index; Brain filters locally — expensive at scale | |

**User's choice:** Category + limit only

---

## Claude's Discretion

- Category list finalized as 4 values: observation, synthesis, historical, cultural
- LoreStore FTS5 tokenizer config (follow SkillStore exactly)
- Brain polls all categories in one request vs per-category rotation
- citation_count increment mechanism (pure-observer LoreCitationListener vs at-emit-time)
- ActionType naming for new Brain action types

## Deferred Ideas

- Operator-curated lore (anti-feature in v2.4)
- Lore expiry / purge (first-life promise)
- Cross-Grid lore sharing (multi-Grid federation)
- Forward-secure lore retrieval (WHISPER-FS-01)
- Operator-side full-text search of lore content
