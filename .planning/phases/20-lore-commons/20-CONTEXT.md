# Phase 20: Lore Commons — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 20 delivers a Grid-side hash index for shared Nous knowledge — a collective memory that no single Nous owns. Nous publish lore via a `LORE_CONTRIBUTE` Brain action; peers discover available lore by querying the Grid REST index; retrieval is Nous-to-Nous via whisper; citation fires at prompt-build when retrieved lore is injected. The Grid records only hashes, never content.

**What Phase 20 must build:**
1. Wave 0: Extend `FORBIDDEN_KEY_PATTERN` with lore-specific forbidden keys. Assert allowlist count is 41 before lore events land.
2. Wave 1: MySQL migration for `lore_commons` table (hash index only). `lore/store.py` Brain module with `lore_entries` SQLite table (FTS5).
3. Wave 2: `LORE_CONTRIBUTE` Brain action → `lore.contributed` sole-producer emitter (pos 42). `LORE_DISCOVER` background task (polls GET /api/v1/grid/lore every 30 ticks). `__lore_request:` / `__lore_response:` whisper dispatch in BrainHandler. `lore.cited` firing at prompt-build injection.
4. Wave 3: Contribution quota enforcement at NousRunner boundary. `lore.cited` sole-producer emitter (pos 43). REST endpoint `/api/v1/grid/lore`. citation_count incremented by a pure-observer Grid listener on `lore.cited` events.
5. Tests: zero-diff, closed-tuple payloads, sole-producer, category validation, quota enforcement, cross-lineage citation observable.

**Allowlist additions:** +2 events → positions 42 (`lore.contributed`) and 43 (`lore.cited`). Running total: 41 → 43.

</domain>

<decisions>
## Implementation Decisions

### LoreStore Brain Architecture (LORE-01)

- **D-20-01:** Brain-local lore content lives in a **new `lore_entries` SQLite table** in a new module `brain/src/noesis_brain/lore/store.py`. Mirrors SkillStore (`brain/src/noesis_brain/skills/store.py`) — FTS5 index on title + content for semantic retrieval at prompt-build. Clean separation from WikiPages and SkillStore; independent evolvability. Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS lore_entries (
      content_hash TEXT PRIMARY KEY,
      contributor_did TEXT NOT NULL,
      category_tag TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      received_tick INTEGER NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS lore_entries_fts USING fts5(
      content_hash UNINDEXED,
      title,
      content,
      content='lore_entries',
      content_rowid='rowid'
  );
  ```

- **D-20-02:** Top-k lore entries (by FTS5 semantic relevance) injected into Nous prompt at prompt-build time — mirrors SkillStore injection pattern from Phase 15. `lore.cited` fires for each injected entry (see D-20-08).

### Category Tag System (LORE-01)

- **D-20-03:** `category_tag` is a **closed enum, TOML-configurable**. Default categories defined in `brain/src/noesis_brain/lore/types.py` as `LORE_CATEGORIES: frozenset[str]`. Grid validates `category_tag` at the `appendLoreContributed` sole-producer boundary — unknown tag is rejected (does not emit event). Follows NORM_THRESHOLD / rig-configurable constant pattern from Phase 19.

  TOML config key: `lore_categories` (list of strings). When present, overrides the Brain default set. Grid receives the valid category set from GenesisLauncher config at startup.

- **D-20-04 (Claude's Discretion):** Default category set — 4 values chosen for clear separation from SkillStore (which owns procedural how-to knowledge):
  - `observation` — something a Nous witnessed or perceived
  - `synthesis` — a conclusion drawn across multiple events or knowledge sources
  - `historical` — notable past events in the Grid worth preserving
  - `cultural` — norms, customs, values, or patterns of the collective

  `skill_guide` excluded — SkillStore covers procedural knowledge; duplicating it in LoreCommons creates semantic overlap.

### Lore Discovery Flow (LORE-02)

- **D-20-05:** Lore discovery is **Grid REST query → whisper retrieval**. No new allowlist events.
  1. Brain polls `GET /api/v1/grid/lore?category={cat}&limit=20` every 30 ticks (aligned with sleep epoch from Phase 16) via `asyncio.create_task` — never blocks tick path (mirrors AAU Learner pattern from Phase 15).
  2. Poll result: hash index entries `{contributor_did, tick, content_hash, category_tag, citation_count}`. Brain selects entries not yet in `lore_entries` (by content_hash).
  3. Brain sends `__lore_request:{content_hash}` whisper to the `contributor_did` from the index entry. If a closer peer is known to hold the same entry (via a local peer-lore-cache), that peer may be preferred.
  4. On receiving `__lore_response:{content_hash}:{base64_content}` whisper, Brain decrypts (Phase 11 envelope), verifies `sha256(content) == content_hash`, stores in `lore_entries`. Stores up to LORE_CAPACITY before evicting (D-20-09).

- **D-20-06:** Background poll cadence = **every 30 ticks** (sleep epoch boundary). Configurable via `lore_poll_interval_ticks` TOML key. Default 30.

### Content Forwarding (LORE-02)

- **D-20-07:** **Any Nous holding the content can respond** to `__lore_request:` whispers — not just the original contributor. If Nous B has stored entry X in its `lore_entries` table, it responds to `__lore_request:{X.content_hash}` from any peer. Enables organic viral propagation. `lore.cited` fires identically regardless of which Nous served the response. The Grid hash index `contributor_did` field records the original author (used for requester routing); the serving Nous is not tracked.

### Citation Semantics (LORE-02)

- **D-20-08:** `lore.cited` fires **every time** a lore entry is injected at prompt-build — no deduplication per (citing_did, content_hash). `citation_count` in the Grid hash index reflects usage frequency (total injections), making it a meaningful cultural signal for Phase 21: heavily-cited lore is actively influential, not merely known.

### LoreStore Capacity (LORE-01)

- **D-20-09:** Brain-local `lore_entries` has a **soft cap = 50** entries per Nous. When full, evict the oldest-received entry by `received_tick` (FIFO). Configurable via `lore_capacity` TOML key. Prevents unbounded Brain SQLite growth in long-running Grids. Mirrors SkillStore discipline (cap=10 for skills; lore entries are larger, hence 50).

### Whisper Rate Budget (LORE-02)

- **D-20-10:** `__lore_request:` and `__lore_response:` messages **count against the shared Phase 11 whisper rate limit** (B=10 per N=100-ticks per sender). No separate budget. A Nous heavy on lore retrieval trades off against other whisper activity naturally — consistent with Phase 11 philosophy, no new rate-limiter config.

### REST API Design (LORE-03)

- **D-20-11:** `GET /api/v1/grid/lore` supports **two query params only**: `?category={tag}&limit={n}`. Both optional. No pagination, no contributor_did filter, no min_citations. Response: `{ entries: [{contributor_did, tick, content_hash, category_tag, citation_count}], total: N }`. Minimal surface, sufficient for Brain polling and Phase 21 Culture Dashboard.

### Allowlist Events (Locked from ROADMAP.md)

- **D-20-12:** Two new events, positions 42 and 43 (alphabetical key order, `Object.keys().sort()` strict equality at sole-producer boundaries):
  - `lore.contributed` (pos 42): `{category_tag, content_hash, contributor_did, tick}` — 4 keys
  - `lore.cited` (pos 43): `{citing_did, content_hash, tick}` — 3 keys
  
  Assert `ALLOWLIST_MEMBERS.length === 41` in Wave 0 before adding these two events.

### Wave 0 Safety Gate

- **D-20-13:** Wave 0 must:
  1. Extend `FORBIDDEN_KEY_PATTERN` with lore-specific forbidden keys: `lore_body`, `lore_content`, `title_text`, `summary_text` (per T-20-01 from ROADMAP.md risk table)
  2. Export `LORE_FORBIDDEN_KEYS` constant (follows `SKILL_FORBIDDEN_KEYS` / `NORM_FORBIDDEN_KEYS` pattern)
  3. Add `__lore_request:` and `__lore_response:` prefixes to `WHISPER_FORBIDDEN_KEYS` check — lore content MUST NOT enter the audit chain via whisper (T-20-02)
  4. Assert `ALLOWLIST_MEMBERS.length === 41` before `lore.contributed` / `lore.cited` are added

### Claude's Discretion

- Exact `lore/store.py` FTS5 tokenizer configuration (follow SkillStore exactly).
- Whether the Brain polls all categories in one request or one category per poll cycle (recommend: all at once with `limit=20` to stay under whisper budget).
- `citation_count` increment mechanism in Grid (pure-observer listener on `lore.cited` OR increment at `appendLoreCited` time — recommend: pure-observer `LoreCitationListener` following RelationshipListener Phase 9 pattern).
- `ActionType` naming for new Brain action types: `LORE_CONTRIBUTE`, `LORE_DISCOVER`, `LORE_REQUEST`, `LORE_RESPONSE` — follow Phase 18 naming pattern.
- Exact `lore_entries` table schema beyond the 6 required columns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §LORE-01..03 — authoritative acceptance criteria for Phase 20
- `.planning/STATE.md` §v2.4 Critical Invariants — FORBIDDEN_KEY_PATTERN additions, allowlist budget (41 at Phase 20 open)
- `.planning/ROADMAP.md` §Phase 20 — goal, success criteria, risk table (T-20-01..03), allowlist additions

### Existing Brain Modules (read before touching)
- `brain/src/noesis_brain/skills/store.py` — SkillStore (template for LoreStore architecture)
- `brain/src/noesis_brain/rpc/handler.py` — BrainHandler on_message + on_tick (integration points for `__lore_request:` dispatch and background poll)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum (add LORE_CONTRIBUTE, LORE_DISCOVER, LORE_REQUEST, LORE_RESPONSE here)
- `brain/src/noesis_brain/learning/aau/learner.py` — AAU Learner async background task pattern (template for lore discovery poll)
- `brain/src/noesis_brain/whisper/keyring.py` — Whisper keyring (lore responses are whispered — decryption uses Phase 11 envelope handling)

### Grid Patterns (read before implementing emitters)
- `grid/src/audit/broadcast-allowlist.ts` — FORBIDDEN_KEY_PATTERN + WHISPER_FORBIDDEN_KEYS + ALLOWLIST_MEMBERS (extend all three in Wave 0)
- `grid/src/integration/nous-runner.ts` — NousRunner action dispatch (add LORE_CONTRIBUTE + quota enforcement here)
- `grid/src/whisper/router.ts` — WhisperRouter (add `__lore_request:` / `__lore_response:` prefix routing)
- `grid/src/norms/NormDetector.ts` + `grid/src/norms/appendNormCrystallized.ts` — Phase 19 pure-observer + sole-producer template (copy for LoreCommonsListener / appendLoreContributed / appendLoreCited)
- `grid/src/skills/appendSkillTaught.ts` — Phase 18 sole-producer emitter template

### Phase Context (pattern references)
- `.planning/phases/18-skill-diffusion/18-CONTEXT.md` — D-18-07 allowlist sequencing, D-18-08 FORBIDDEN_KEY_PATTERN extension wave, sole-producer emitter pattern, NousRunner dispatch cases
- `.planning/phases/19-norm-crystallization/19-CONTEXT.md` — D-19-05 startup rebuild pattern, D-19-11 Wave 0 safety gate, REST API endpoint design
- `.planning/phases/11-mesh-whisper/11-CONTEXT.md` — D-11-05 envelope shape, D-11-06 recipient-pull delivery, D-11-07 rate limit, WHISPER_FORBIDDEN_KEYS pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `brain/src/noesis_brain/skills/store.py` (SkillStore) — copy as `lore/store.py`; replace `skills`/`skill` with `lore_entries`/`lore`; same FTS5 schema shape
- `SKILL_FORBIDDEN_KEYS` / `NORM_FORBIDDEN_KEYS` in `broadcast-allowlist.ts` — copy pattern for `LORE_FORBIDDEN_KEYS`
- `WHISPER_FORBIDDEN_KEYS` in `broadcast-allowlist.ts` — extend with `__lore_request:` / `__lore_response:` prefix detection
- Phase 19 `NormDetector.ts` + `appendNormCandidate.ts` — pure-observer + sole-producer template for `LoreCommonsListener.ts` + `appendLoreContributed.ts` + `appendLoreCited.ts`
- Phase 15 AAU Learner `asyncio.create_task` background poll pattern — copy for `lore_discovery_task()` in BrainHandler

### Established Patterns
- Wave 0 = FORBIDDEN_KEY_PATTERN extension + WHISPER_FORBIDDEN_KEYS extension + allowlist baseline assertion FIRST, every v2.4 phase
- Brain metadata: 1-3 keys from Brain, `{nous_did, tick}` injected by Grid (3-keys-not-5); lore events follow same discipline
- `asyncio.create_task()` for all async Brain work in tick path (never `await` in tick entry point)
- Sole-producer boundary: one emitter file per event type, emitter imported only by NousRunner or sole designated caller
- TOML rig config pattern for all thresholds (NORM_THRESHOLD, NORM_WINDOW_TICKS, quarantine_ticks → lore_capacity, lore_poll_interval_ticks, lore_categories)
- MigrationRunner for all new MySQL tables; migrations follow existing pattern in `grid/src/db/migrations/`

### Integration Points
- `BrainHandler.on_message()` — detect `text.startswith("__lore_response:")` → strip prefix → verify sha256 → store in LoreStore
- `BrainHandler.on_tick()` — background lore discovery task (every 30 ticks, asyncio.create_task), top-k lore injection at prompt-build (before action selection), `lore.cited` action dispatch for each injected entry
- `NousRunner.executeActions()` — new `case 'lore_contribute'`: quota check → `appendLoreContributed`; `case 'lore_cited'`: `appendLoreCited`
- `WhisperRouter.route()` — `__lore_request:` prefix → look up in sender's LoreStore by hash → package as `__lore_response:` envelope

</code_context>

<specifics>
## Specific Ideas

- **Cross-lineage citation test:** Success criterion LORE-02 requires that Nous B can cite lore by Nous A without direct prior interaction. Integration test: 4-Nous rig — A contributes (lore.contributed pos 42), B retrieves via Grid REST → whisper from A, C retrieves via Grid REST → whisper from B (not A), C cites at prompt-build (lore.cited pos 43). SQL query on `lore_commons` table shows `citation_count ≥ 2` for A's entry. Cross-lineage confirmed.
- **Quota cooldown pattern:** K=3 per 30-tick epoch enforced at NousRunner boundary (same as established whisper rate limit pattern — tick-indexed, not wall-clock). After quota exhaustion, Brain receives `LORE_CONTRIBUTE` action rejection; `lore.contributed` is NOT emitted. Mirrors Phase 11 over-budget FIFO queue behavior.
- **citation_count increment:** Pure-observer `LoreCitationListener.ts` in `grid/src/lore/` that subscribes to `AuditChain.onAppend` for `lore.cited` events and increments the `citation_count` column in `lore_commons` table. Zero `AuditChain.append` calls inside listener body. Follows RelationshipListener (Phase 9) pattern exactly.
</specifics>

<deferred>
## Deferred Ideas

- **Operator-curated lore** — explicitly an anti-feature in v2.4 Agora; culture is Nous-initiated only. Any future operator curation model is its own phase.
- **Lore expiry / purge** — PHILOSOPHY §1 first-life promise; all lore entries retained forever in Grid hash index. Brain-local eviction (FIFO by received_tick, D-20-09) is Brain-private, not auditable.
- **Cross-Grid lore sharing** — multi-Grid federation deferred per ROADMAP.md Out of Scope.
- **Forward-secure lore retrieval** — lore whispers use Phase 11 crypto (XChaCha20-Poly1305); forward secrecy (Signal Double Ratchet) deferred per WHISPER-FS-01.
- **Lore search for operators** — `GET /api/v1/grid/lore` is hash-index-only (no content server). Operator-side full-text search would require a separate index with content access — post-v2.4.

</deferred>

---

*Phase: 20-lore-commons*
*Context gathered: 2026-05-16*
