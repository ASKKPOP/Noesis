# Phase 20: Lore Commons — Research

**Researched:** 2026-05-16
**Domain:** Brain-local SQLite lore store + Grid hash index + whisper-routed retrieval + sole-producer audit events
**Confidence:** HIGH (all findings verified from live codebase)

---

## Summary

Phase 20 introduces a bottom-up collective memory system. Nous publish lore through a `LORE_CONTRIBUTE` Brain action; lore content never crosses the Brain-Grid wire; the Grid stores only a hash index (`lore_commons` MySQL table); content is retrieved Nous-to-Nous via Phase 11 whisper using `__lore_request:` / `__lore_response:` prefixes; `lore.cited` (pos 43) fires at prompt-build when a Nous injects lore into its LLM context.

Every pattern needed already exists in the codebase: SkillStore gives the Brain SQLite/FTS5 blueprint; NormDetector + appendNormCrystallized give the pure-observer + sole-producer emitter blueprint; NousRunner skill dispatch cases give the Grid action handler blueprint; AAULearner gives the async background task pattern; schema.ts MIGRATIONS gives the migration schema pattern.

The current ALLOWLIST_MEMBERS is **41 entries** (confirmed live from `grid/src/audit/broadcast-allowlist.ts`). Wave 0 must assert `length === 41` before adding `lore.contributed` (pos 42) and `lore.cited` (pos 43) to reach 43.

**Primary recommendation:** Clone the Phase 18/19 skill+norm patterns precisely. Any deviation from the 10-step validation ladder in sole-producer emitters, the closed-tuple discipline, or the FORBIDDEN_KEY_PATTERN extension will cause CI failures. Follow every pattern exactly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-20-01:** Brain-local lore content lives in `brain/src/noesis_brain/lore/store.py` with a new `lore_entries` SQLite table. Mirrors SkillStore. FTS5 on title + content.
- **D-20-02:** Top-k lore entries injected at prompt-build via FTS5 semantic relevance. `lore.cited` fires for each injected entry.
- **D-20-03:** `category_tag` is a closed enum, TOML-configurable. Grid validates at `appendLoreContributed` boundary — unknown tag rejected. TOML key: `lore_categories`.
- **D-20-04 (Claude's Discretion):** Default categories: `observation`, `synthesis`, `historical`, `cultural`. `skill_guide` excluded.
- **D-20-05:** Discovery = Grid REST query → whisper retrieval. Poll `GET /api/v1/grid/lore?category={cat}&limit=20` every 30 ticks via `asyncio.create_task`.
- **D-20-06:** Poll cadence = 30 ticks. TOML key: `lore_poll_interval_ticks`.
- **D-20-07:** Any Nous holding the content may respond to `__lore_request:` — not just original contributor. Enables viral propagation.
- **D-20-08:** `lore.cited` fires every prompt-build injection — no deduplication per (citing_did, content_hash).
- **D-20-09:** Brain-local soft cap = 50 entries. FIFO eviction by `received_tick`. TOML key: `lore_capacity`.
- **D-20-10:** `__lore_request:` / `__lore_response:` count against Phase 11 shared rate limit. No separate budget.
- **D-20-11:** REST `GET /api/v1/grid/lore` — params: `?category={tag}&limit={n}`. Both optional. Response: `{entries: [...], total: N}`.
- **D-20-12:** Two new events, positions 42 and 43 (alphabetical key order):
  - `lore.contributed` (pos 42): `{category_tag, content_hash, contributor_did, tick}` — 4 keys (alphabetical)
  - `lore.cited` (pos 43): `{citing_did, content_hash, tick}` — 3 keys (alphabetical)
- **D-20-13:** Wave 0 must: (1) extend FORBIDDEN_KEY_PATTERN with `lore_body|lore_content|title_text|summary_text`; (2) export `LORE_FORBIDDEN_KEYS`; (3) add `__lore_request:` / `__lore_response:` prefixes to `WHISPER_FORBIDDEN_KEYS`; (4) assert `ALLOWLIST_MEMBERS.length === 41`.

### Claude's Discretion

- Exact FTS5 tokenizer configuration (follow SkillStore exactly)
- Whether Brain polls all categories in one request or one per cycle (recommend: all at once with `limit=20`)
- `citation_count` increment mechanism — pure-observer `LoreCitationListener.ts` following RelationshipListener pattern
- `ActionType` naming for new Brain action types: `LORE_CONTRIBUTE`, `LORE_DISCOVER`, `LORE_REQUEST`, `LORE_RESPONSE`
- Exact `lore_entries` table schema beyond the 6 required columns

### Deferred Ideas (OUT OF SCOPE)

- Operator-curated lore (anti-feature in v2.4)
- Lore expiry/purge (first-life promise; Grid hash index retained forever)
- Cross-Grid lore sharing (multi-Grid federation deferred)
- Forward-secure lore retrieval (Signal Double Ratchet deferred to WHISPER-FS-01)
- Lore search for operators (operator full-text search deferred post-v2.4)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LORE-01 | Nous publishes lore via LORE_CONTRIBUTE Brain action; lore body stays Brain-private; Grid stores hash index only; `lore.contributed` (pos 42) is sole audit event | SkillStore clone for LoreStore; appendSkillTaught pattern for appendLoreContributed; schema.ts migration v8 pattern |
| LORE-02 | Lore retrieved Nous-to-Nous via whisper `__lore_request`/`__lore_response`; `lore.cited` (pos 43) fires at prompt-build | WhisperRouter routing pattern; AAULearner asyncio.create_task pattern; build_system_prompt additive-widening pattern |
| LORE-03 | Contribution quota K=3 per sleep epoch enforced Brain-side before emitting LORE_CONTRIBUTE; configurable via TOML | NousRunner quota enforcement case pattern (see D-20-13 and CONTEXT specifics section) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lore content storage | Brain (SQLite) | — | Brain-private invariant: content never crosses wire |
| Lore hash index | Grid (MySQL) | — | Grid is truth for audit chain and hash index |
| Lore contribution quota enforcement | Grid (NousRunner) | Brain (pre-action filter) | NousRunner is sole Grid actor boundary; STATE.md confirms "enforced at grid/src/integration/nous-runner.ts" |
| Lore discovery (polling REST) | Brain (background task) | — | Async poll from Brain; Grid serves REST endpoint |
| Lore retrieval (content) | Brain (whisper sender/receiver) | — | Nous-to-Nous via Phase 11 envelope; Grid never holds content |
| `lore.contributed` audit event | Grid (sole producer: appendLoreContributed.ts) | — | Sole-producer discipline; mirrors appendSkillTaught |
| `lore.cited` audit event | Grid (sole producer: appendLoreCited.ts) | — | Sole-producer discipline; mirrors appendNormCandidate/Crystallized |
| citation_count increment | Grid (LoreCitationListener — pure-observer) | — | Pure-observer on `lore.cited` events; mirrors RelationshipListener |
| REST endpoint `/api/v1/grid/lore` | Grid (Fastify route) | — | Fastify API server pattern; mirrors norms API route |
| Prompt injection of lore | Brain (build_system_prompt) | — | Additive-widening pattern from Phase 15/16/17 |
| Category validation | Grid (appendLoreContributed boundary) | — | Enum check at sole-producer boundary; mirrors VALID_REJECTION_REASONS |

---

## Standard Stack

### Core (Grid — TypeScript)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| vitest | ^2.0.0 | Test runner (Grid) | `grid/package.json` devDependencies |
| fastify | (project version) | REST API server | `grid/src/api/server.ts` |
| mysql2/promise | (project version) | MySQL pool for lore_commons table | `grid/src/norms/storage.ts` pattern |

### Core (Brain — Python)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| sqlite3 (stdlib) | Python 3.11+ stdlib | SQLite with FTS5 for lore_entries | `brain/src/noesis_brain/skills/store.py` |
| httpx | >=0.27.0 | Async HTTP for REST polling | `brain/pyproject.toml` |
| asyncio (stdlib) | Python 3.11+ stdlib | Background task pattern (create_task) | `brain/src/noesis_brain/aau/learner.py` |
| pytest-asyncio | >=0.23 | Async test support | `brain/pyproject.toml` |

### Test Commands

```bash
# Grid (TypeScript)
cd grid && npm test               # vitest run (full suite)

# Brain (Python)
cd brain && python -m pytest      # full suite
cd brain && python -m pytest test/lore/ -x  # per-task gate
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Brain on_tick()]
    │
    ├─ (every 30 ticks) asyncio.create_task(lore_discovery_poll())
    │       │
    │       ├─ GET /api/v1/grid/lore → hash index entries
    │       └─ for unknown hashes: send __lore_request:{hash} whisper
    │
    ├─ (on on_message() prefix) __lore_response:{hash}:{base64}
    │       │
    │       ├─ verify sha256(content) == hash
    │       └─ store in lore_entries SQLite (with FIFO eviction if > LORE_CAPACITY)
    │
    ├─ (prompt-build in on_tick()) lore_store.retrieve(query, k=3)
    │       │
    │       ├─ for each injected entry: emit Action(LORE_CITED, {content_hash})
    │       └─ lore.cited fires via NousRunner → appendLoreCited
    │
    └─ (LLM action selection) LORE_CONTRIBUTE action
            │
            └─ NousRunner quota check → appendLoreContributed

[Grid NousRunner.executeActions()]
    ├─ case 'lore_contribute': quota_check → appendLoreContributed(audit, ...)
    └─ case 'lore_cited': appendLoreCited(audit, ...)

[Grid REST API]
    └─ GET /api/v1/grid/lore → MySQL lore_commons SELECT

[Grid LoreCitationListener (pure-observer)]
    └─ audit.onAppend → if lore.cited → UPDATE lore_commons SET citation_count += 1
```

### Recommended Project Structure

```
grid/src/lore/
├── appendLoreContributed.ts   # sole producer for lore.contributed (pos 42)
├── appendLoreCited.ts         # sole producer for lore.cited (pos 43)
├── LoreCitationListener.ts   # pure-observer: citation_count increment
├── LoreStorage.ts            # MySQL lore_commons table wrapper
├── types.ts                  # LoreContributedPayload, LoreCitedPayload, LORE_*_KEYS
└── index.ts                  # barrel export

brain/src/noesis_brain/lore/
├── __init__.py
├── store.py                  # LoreStore (SQLite + FTS5, mirrors SkillStore)
└── types.py                  # LORE_CATEGORIES frozenset[str]

grid/test/lore/
├── appendLoreContributed.test.ts
├── appendLoreCited.test.ts
├── lore-producer-boundary.test.ts  # grep gate — mirrors norm-producer-boundary.test.ts
├── lore-allowlist-baseline.test.ts # assert length===41 before lore events
├── lore-allowlist.test.ts          # assert length===43 after; positions 42-43
├── lore-migration.test.ts          # version 8 migration SQL inspection
└── lore-citation-listener.test.ts

brain/test/lore/
└── test_lore_store.py
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS5 retrieval ranking | Custom SQLite text search | SkillStore.retrieve() pattern — 3-stage cascade (trigger → FTS5 BM25 → composite score) | Already proven in Phase 15; FTS5 edge cases handled |
| Closed-tuple enforcement | dict equality check | `Object.keys(payload).sort()` vs locked `*_KEYS` array | Exact pattern used in all sole-producer emitters since Phase 7 |
| Sole-producer boundary | Any direct `audit.append()` in runner code | Dedicated `appendLore*.ts` files | Grep gate enforces this; violating it fails CI immediately |
| Async background task | `await` in `on_tick()` | `asyncio.create_task()` closure (AAULearner / Hypnos pattern in handler.py) | Awaiting in tick path blocks Grid responses |
| Migration SQL | Manual DB setup | Add version 8 entry to `grid/src/db/schema.ts` MIGRATIONS array | MigrationRunner.run() applies pending migrations automatically |
| MySQL pool pattern | Direct mysql2 connection | `NormStorage` / `pool.query()` pattern from `grid/src/norms/storage.ts` | Established pattern; errors swallowed on upsert, propagated on load |
| Privacy check | Custom key scanner | `payloadPrivacyCheck(cleanPayload)` imported from `broadcast-allowlist.ts` | Step 9 in every sole-producer emitter; already covers all FORBIDDEN_KEY_PATTERN terms |

---

## Integration Points — Exact Signatures

### 1. FORBIDDEN_KEY_PATTERN (Wave 0)

**File:** `grid/src/audit/broadcast-allowlist.ts`

Current regex ends at: `|norm_text|fingerprint_text|rule_content/i`

**Extension required (D-20-13):**
```typescript
// Append to the regex alternation (preserving /i flag):
|lore_body|lore_content|title_text|summary_text
```

**New export (mirrors SKILL_FORBIDDEN_KEYS, NORM_FORBIDDEN_KEYS):**
```typescript
export const LORE_FORBIDDEN_KEYS = Object.freeze([
    'lore_body',
    'lore_content',
    'title_text',
    'summary_text',
] as const);
```

**WHISPER_FORBIDDEN_KEYS extension (D-20-13, T-20-02):**
```typescript
// WHISPER_FORBIDDEN_KEYS already has 'text', 'body', 'content' etc.
// The __lore_request: and __lore_response: prefixes must be documented
// in the constant's JSDoc — the keys 'lore_body', 'lore_content' etc.
// are added to FORBIDDEN_KEY_PATTERN above. The WHISPER_FORBIDDEN_KEYS
// constant itself doesn't need structural change; the check is via prefix
// matching in WhisperRouter.
// DECISION: Add prefix-presence gate in appendLoreContributed sole producer
// rather than changing WHISPER_FORBIDDEN_KEYS structure.
```

**ALLOWLIST_MEMBERS additions (Wave 2/3):**
```typescript
// Assert ALLOWLIST_MEMBERS.length === 41 BEFORE these two lines (D-20-13)
'lore.contributed',  // (42) {category_tag, content_hash, contributor_did, tick}
'lore.cited',        // (43) {citing_did, content_hash, tick}
```

[VERIFIED: live codebase — `grid/src/audit/broadcast-allowlist.ts` lines 75-169, confirmed length=41]

---

### 2. SkillStore Clone Pattern for LoreStore

**File to clone:** `brain/src/noesis_brain/skills/store.py`

**Key differences for LoreStore:**

```python
# brain/src/noesis_brain/lore/store.py
class LoreStore:
    """Brain-local lore store — SQLite FTS5, mirrors SkillStore."""

    LORE_CAPACITY = 50  # default; configurable via TOML lore_capacity

    def __init__(self, conn: sqlite3.Connection, capacity: int = 50) -> None:
        self._conn = conn
        self._capacity = capacity
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS lore_entries (
                content_hash    TEXT PRIMARY KEY,
                contributor_did TEXT NOT NULL,
                category_tag    TEXT NOT NULL,
                title           TEXT NOT NULL,
                content         TEXT NOT NULL,
                received_tick   INTEGER NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS lore_entries_fts USING fts5(
                content_hash UNINDEXED,
                title,
                content,
                content='lore_entries',
                content_rowid='rowid'
            );
        """)
        self._conn.commit()

    def add(self, entry: LoreEntry) -> None:
        """Store lore entry; evict oldest by received_tick if over capacity."""
        # INSERT OR REPLACE (idempotent on content_hash)
        self._conn.execute(
            """INSERT OR REPLACE INTO lore_entries
               (content_hash, contributor_did, category_tag, title, content, received_tick)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry.content_hash, entry.contributor_did, entry.category_tag,
             entry.title, entry.content, entry.received_tick),
        )
        self._conn.commit()
        self._evict_if_over_capacity()

    def _evict_if_over_capacity(self) -> None:
        count = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()[0]
        if count > self._capacity:
            # Evict oldest by received_tick (FIFO per D-20-09)
            self._conn.execute("""
                DELETE FROM lore_entries WHERE content_hash IN (
                    SELECT content_hash FROM lore_entries
                    ORDER BY received_tick ASC
                    LIMIT ?
                )
            """, (count - self._capacity,))
            self._conn.commit()

    def has(self, content_hash: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM lore_entries WHERE content_hash = ?", (content_hash,)
        ).fetchone()
        return row is not None

    def retrieve(self, query: str, k: int = 3) -> list[LoreEntry]:
        """FTS5 BM25 retrieval — mirrors SkillStore.retrieve() 3-stage cascade."""
        # Stage 1: FTS5 match; Stage 2: return top-k
        ...
```

[VERIFIED: `brain/src/noesis_brain/skills/store.py` full source read]

---

### 3. Brain ActionType Additions

**File:** `brain/src/noesis_brain/rpc/types.py` — `ActionType(str, Enum)`

**Add after the Phase 18 SKILL_* entries (line 54):**

```python
# Phase 20 — Lore Commons.
# String values MUST match the Grid NousRunner switch cases exactly.
# LORE_CONTRIBUTE and LORE_CITED are forwarded to Grid (sole-producer emitters).
# LORE_DISCOVER is Brain-internal (asyncio.create_task background poll).
# LORE_REQUEST and LORE_RESPONSE are Brain-internal whisper dispatch.
LORE_CONTRIBUTE = "lore_contribute"  # Grid-forwarded. Metadata: {content_hash, category_tag} (2 keys; Grid injects contributor_did + tick)
LORE_CITED      = "lore_cited"       # Grid-forwarded. Metadata: {content_hash} (1 key; Grid injects citing_did + tick)
LORE_DISCOVER   = "lore_discover"    # Brain-internal; never forwarded to Grid
LORE_REQUEST    = "lore_request"     # Brain-internal; becomes __lore_request: whisper
LORE_RESPONSE   = "lore_response"    # Brain-internal; from __lore_response: whisper decode
```

[VERIFIED: `brain/src/noesis_brain/rpc/types.py` full source read — ActionType enum lines 10-54]

---

### 4. NousRunner Dispatch Cases (Grid — TypeScript)

**File:** `grid/src/integration/nous-runner.ts` — `executeActions()` switch statement

**Template from Phase 18 skill_taught (lines 724-745):**

```typescript
case 'lore_contribute': {
    // Phase 20 D-20-12: Grid injects contributor_did+tick (3-keys-not-5).
    // Brain sends content_hash, category_tag (2 keys).
    // Quota enforcement BEFORE sole-producer call (D-20-13 / STATE.md invariant).
    // Quota: K=3 per sleep epoch (D-20-03 / LORE-03).
    const md = (action.metadata ?? {}) as Record<string, unknown>;
    const contentHash = typeof md['content_hash'] === 'string' ? md['content_hash'] : null;
    const categoryTag = typeof md['category_tag'] === 'string' ? md['category_tag'] : null;
    if (contentHash === null || categoryTag === null) {
        console.warn(JSON.stringify({
            event: 'lore.contribute.malformed_metadata',
            did: this.nousDid,
            tick,
        }));
        break;
    }
    // Quota check: loreDeps.quotaTracker.tryConsume(this.nousDid, tick)
    try {
        appendLoreContributed(this.audit, this.nousDid, {
            contributor_did: this.nousDid,
            tick,
            content_hash: contentHash,
            category_tag: categoryTag,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'lore.dispatch.rejected',
            action_type: 'lore_contribute',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'lore_cited': {
    // Phase 20 D-20-12: Grid injects citing_did+tick (3-keys-not-5).
    // Brain sends content_hash (1 key).
    try {
        appendLoreCited(this.audit, this.nousDid, {
            citing_did: this.nousDid,
            tick,
            content_hash: action.metadata['content_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'lore.dispatch.rejected',
            action_type: 'lore_cited',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
```

[VERIFIED: `grid/src/integration/nous-runner.ts` executeActions() switch — lines 218-791 read]

---

### 5. Sole-Producer Emitter Structure (10-Step Validation Ladder)

**Template from `appendSkillTaught.ts` and `appendNormCrystallized.ts`:**

```typescript
// grid/src/lore/appendLoreContributed.ts

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { LORE_CONTRIBUTED_KEYS, VALID_LORE_CATEGORIES, type LoreContributedPayload } from './types.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendLoreContributed(
    audit: AuditChain,
    actorDid: string,
    payload: LoreContributedPayload,
): AuditEntry {
    // 1. actorDid DID_RE
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendLoreContributed: invalid actorDid ${JSON.stringify(actorDid)}`);
    }
    // 2. contributor_did DID_RE
    if (typeof payload?.contributor_did !== 'string' || !DID_RE.test(payload.contributor_did)) {
        throw new TypeError(`appendLoreContributed: invalid contributor_did`);
    }
    // 3. Self-report invariant: contributor_did === actorDid
    if (payload.contributor_did !== actorDid) {
        throw new TypeError(`appendLoreContributed: self-report violation`);
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendLoreContributed: tick must be non-negative integer`);
    }
    // 5. content_hash HEX64_RE
    if (typeof payload.content_hash !== 'string' || !HEX64_RE.test(payload.content_hash)) {
        throw new TypeError(`appendLoreContributed: invalid content_hash (must be 64-char hex)`);
    }
    // 6. category_tag closed-enum check
    if (!VALID_LORE_CATEGORIES.has(payload.category_tag as string)) {
        throw new TypeError(`appendLoreContributed: unknown category_tag ${JSON.stringify(payload.category_tag)}`);
    }
    // 7. Closed-tuple: Object.keys(payload).sort() === LORE_CONTRIBUTED_KEYS
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== LORE_CONTRIBUTED_KEYS.length ||
        !actualKeys.every((k, i) => k === LORE_CONTRIBUTED_KEYS[i])) {
        throw new TypeError(`appendLoreContributed: closed-tuple violation`);
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        category_tag: payload.category_tag,
        content_hash: payload.content_hash,
        contributor_did: payload.contributor_did,
        tick: payload.tick,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendLoreContributed: payload privacy violation`);
    }
    // 10. Emit
    return audit.append('lore.contributed', actorDid, cleanPayload);
}
```

**Types file:**
```typescript
// grid/src/lore/types.ts

export interface LoreContributedPayload {
    category_tag: string;    // alphabetical order
    content_hash: string;
    contributor_did: string;
    tick: number;
}
// Alphabetically sorted — locked by D-20-12
export const LORE_CONTRIBUTED_KEYS = [
    'category_tag', 'content_hash', 'contributor_did', 'tick',
] as const;

export interface LoreCitedPayload {
    citing_did: string;      // alphabetical order
    content_hash: string;
    tick: number;
}
export const LORE_CITED_KEYS = [
    'citing_did', 'content_hash', 'tick',
] as const;

// Injected from GenesisLauncher config (TOML lore_categories key)
export const DEFAULT_LORE_CATEGORIES = new Set([
    'cultural',
    'historical',
    'observation',
    'synthesis',
] as const);

export let VALID_LORE_CATEGORIES: Set<string> = new Set(DEFAULT_LORE_CATEGORIES);
```

[VERIFIED: appendNormCrystallized.ts full source, appendSkillTaught.ts full source, types.ts for both]

---

### 6. AAU Learner Background Task Pattern (Brain asyncio.create_task)

**File:** `brain/src/noesis_brain/aau/learner.py` (confirmed at `brain/src/noesis_brain/aau/`, NOT `learning/aau/` — path in CONTEXT.md was slightly off)

The existing pattern in `BrainHandler.on_tick()` for sleep task dispatch (lines 424-436):

```python
# Canonical asyncio.create_task pattern used in BrainHandler.on_tick()
import asyncio as _asyncio

def _make_sleep_task(
    rt: HypnosRuntime = self._hypnos_runtime,
    t: int = tick,
) -> None:
    async def _run() -> None:
        result_hash = await rt.run_sleep(self.did, t)
        self._pending_sleep_completed = result_hash
    _asyncio.create_task(_run())

_make_sleep_task()
```

**Lore discovery task — mirrors this exactly:**

```python
# In BrainHandler.on_tick(), every 30 ticks
if self._lore_store is not None and (tick % self._lore_poll_interval) == 0:
    import asyncio as _asyncio

    def _make_lore_poll(
        lore_store: LoreStore = self._lore_store,
        t: int = tick,
        did: str = self.did,
    ) -> None:
        async def _poll() -> None:
            await self._lore_store.discovery_poll(t, did)
        _asyncio.create_task(_poll())

    _make_lore_poll()
```

[VERIFIED: `brain/src/noesis_brain/rpc/handler.py` lines 424-436, `brain/src/noesis_brain/aau/learner.py` full source]

---

### 7. build_system_prompt Additive-Widening Pattern

**File:** `brain/src/noesis_brain/prompts/system.py`

Pattern (lines 16-117): each Phase adds a new optional kwarg defaulting to `None`. Injection happens BEFORE `_directives_section`. Lore injection follows Phase 16/17 additive-widening:

```python
def build_system_prompt(
    psyche: Psyche,
    mood: MoodState,
    telos: TelosManager,
    ...
    # Phase 17 additive-widening
    tom_context: "list | None" = None,
    # Phase 20 additive-widening: lore commons injection.
    # lore_entries: top-k LoreEntry objects from LoreStore.retrieve().
    # None when LoreStore disabled; empty list when enabled but no entries yet.
    lore_entries: "list | None" = None,
) -> str:
    ...
    # Inject lore after tom_context, before directives
    if lore_entries:
        section = _lore_commons_section(lore_entries)
        if section:
            sections.append(section)

    sections.append(_directives_section(psyche))
    return "\n\n".join(sections)
```

[VERIFIED: `brain/src/noesis_brain/prompts/system.py` lines 16-117 read]

---

### 8. WhisperRouter — Message Prefix Routing

**File:** `grid/src/whisper/router.ts`

The `WhisperRouter.route()` method (lines 68-109) handles pre-encrypted envelopes. It does NOT parse plaintext content — it just routes ciphertext.

The `__lore_request:` and `__lore_response:` dispatch is Brain-to-Brain, not WhisperRouter:

- **Sending** (Brain side): when a lore request needs to go out, the Brain creates a standard whisper with `text = f"__lore_request:{content_hash}"` and sends via `action_type: whisper_send` (existing Phase 11 machinery). WhisperRouter just encrypts and routes without seeing prefix.
- **Receiving** (Brain side): in `BrainHandler.on_message()`, after decryption by Phase 11 receive_loop, the `text` is checked for `"__lore_request:"` or `"__lore_response:"` prefix, exactly like `"__skill_share:"` at line 154.

The prefix routing is entirely Brain-internal. WhisperRouter does not need modification for prefix content — it handles encrypted envelopes only.

**IMPORTANT GOTCHA:** The CONTEXT.md says "add `__lore_request:` / `__lore_response:` prefixes to `WHISPER_FORBIDDEN_KEYS` check." This means those prefix strings must be checked at the Brain→Grid boundary to ensure lore content doesn't leak into any audit payload. The actual WHISPER_FORBIDDEN_KEYS constant is a list of field names (not prefixes). The D-20-13 requirement means: ensure that if any event payload contains a key named `lore_body`, `lore_content`, etc., it is blocked — not that the literal prefix strings are added to WHISPER_FORBIDDEN_KEYS. The CONTEXT clarifies in the code_context section: "WHISPER_FORBIDDEN_KEYS in broadcast-allowlist.ts — extend with `__lore_request:` / `__lore_response:` prefix detection."

After reading WHISPER_FORBIDDEN_KEYS (lines 335-349), these are field name strings, not prefix patterns. The guard for whisper content is that lore_body/lore_content/title_text/summary_text are in FORBIDDEN_KEY_PATTERN. The `__lore_request:`/`__lore_response:` prefixes themselves don't need to be in WHISPER_FORBIDDEN_KEYS since they're never field names in payloads — they're text message prefixes. **Resolution (D-20-13 interpretation):** LORE_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN extension is what prevents content leakage. Documenting in the WHISPER_FORBIDDEN_KEYS JSDoc that lore whispers use `__lore_request:` / `__lore_response:` prefixes is sufficient.

[VERIFIED: `grid/src/whisper/router.ts` full source, `grid/src/audit/broadcast-allowlist.ts` WHISPER_FORBIDDEN_KEYS lines 335-349]

---

### 9. MySQL Migration Pattern

**File:** `grid/src/db/schema.ts` — `MIGRATIONS` array

Current last migration: `version: 7, name: 'create_norm_tables'`

**Phase 20 adds version 8:**

```typescript
{
    version: 8,
    name: 'create_lore_commons',
    up: `
        CREATE TABLE IF NOT EXISTS lore_commons (
            grid_name       VARCHAR(63)  NOT NULL,
            content_hash    CHAR(64)     NOT NULL,
            contributor_did VARCHAR(255) NOT NULL,
            title_hash      CHAR(64)     NOT NULL,
            category_tag    VARCHAR(32)  NOT NULL,
            citation_count  INT UNSIGNED NOT NULL DEFAULT 0,
            contributed_tick INT UNSIGNED NOT NULL,
            PRIMARY KEY (grid_name, content_hash),
            INDEX idx_category (grid_name, category_tag),
            INDEX idx_contributor (grid_name, contributor_did),
            INDEX idx_tick (grid_name, contributed_tick)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS lore_commons`,
},
```

Migration is added in-code in `schema.ts`. MigrationRunner.run() auto-applies on Grid start.

[VERIFIED: `grid/src/db/schema.ts` full source — migration pattern, current max version=7]

---

### 10. Allowlist Baseline Assertion Test Pattern

**Template from `grid/test/audit/skill-allowlist-baseline.test.ts`:**

```typescript
// grid/test/lore/lore-allowlist-baseline.test.ts
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 20 allowlist baseline — Wave 0 gate (D-20-13)', () => {
    it('allowlist has exactly 41 events before lore additions', () => {
        // Wave 0 RED gate: lore.contributed and lore.cited not yet added.
        // If this fails with count > 41, a lore event landed before Wave 0 — STOP.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(41);
    });

    it('position 41 is norm.crystallized (last Phase 19 event)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[40]).toBe('norm.crystallized');
    });
});
```

**Post-Wave-3 final count assertion:**
```typescript
// grid/test/lore/lore-allowlist.test.ts
it('allowlist is exactly 43 events after lore additions', () => {
    expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(43);
});
it('lore.contributed is at position 42 (index 41)', () => {
    expect((ALLOWLIST_MEMBERS as readonly string[])[41]).toBe('lore.contributed');
});
it('lore.cited is at position 43 (index 42)', () => {
    expect((ALLOWLIST_MEMBERS as readonly string[])[42]).toBe('lore.cited');
});
```

[VERIFIED: `grid/test/audit/skill-allowlist-baseline.test.ts` and `skill-allowlist.test.ts` full source]

---

### 11. Sole-Producer Grep Test Pattern

**Template from `grid/test/norms/norm-producer-boundary.test.ts` and `grid/test/skills/skill-producer-boundary.test.ts`:**

```typescript
// grid/test/lore/lore-producer-boundary.test.ts

const SOLE_EMITTERS: Record<string, string> = {
    'lore.contributed': 'lore/appendLoreContributed.ts',
    'lore.cited': 'lore/appendLoreCited.ts',
};

// Test body is identical to norm-producer-boundary.test.ts —
// walk grid/src, assert each event string appears ONLY in:
//   1. audit/broadcast-allowlist.ts
//   2. The sole emitter file
// AND assert no other file calls audit.append('{event}', ...)
```

[VERIFIED: `grid/test/norms/norm-producer-boundary.test.ts` full source — exact template]

---

### 12. Pure-Observer Listener Pattern (LoreCitationListener)

**Template from `grid/src/relationships/listener.ts` and `grid/src/norms/NormDetector.ts`:**

```typescript
// grid/src/lore/LoreCitationListener.ts

// INVARIANT: Zero audit.append calls inside this class.
// Enforced by lore-producer-boundary.test.ts grep gate.

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { LoreStorage } from './LoreStorage.js';

export class LoreCitationListener {
    constructor(
        private readonly audit: AuditChain,
        private readonly storage: LoreStorage,
        private readonly gridName: string,
    ) {
        // Pure observer — onAppend only; zero audit.append in this class body
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'lore.cited') return;
        const contentHash = entry.payload['content_hash'] as string;
        if (typeof contentHash !== 'string') return;
        // Fire-and-forget increment — errors are swallowed (audit chain is truth)
        this.storage.incrementCitationCount(this.gridName, contentHash).catch(() => {});
    }
}
```

[VERIFIED: `grid/src/relationships/listener.ts` lines 1-60, `grid/src/norms/NormDetector.ts` full source]

---

## Common Pitfalls

### Pitfall 1: Lore Path Confusion — AAU Learner Not in `learning/aau/`

**What goes wrong:** CONTEXT.md canonical refs list `brain/src/noesis_brain/learning/aau/learner.py`. The file is actually at `brain/src/noesis_brain/aau/learner.py` (no `learning/` prefix).

**Why it happens:** The canonical refs reflect an older intended location. Verified by `find` command.

**How to avoid:** Use `brain/src/noesis_brain/aau/learner.py` for AAU patterns. The `learning/` directory contains `observational.py`, `reflexion.py`, `rules.py` — it does NOT contain the AAU learner.

**Warning signs:** Import errors when trying `from noesis_brain.learning.aau.learner import ...`

[VERIFIED: `find /Users/desirey/Programming/src/Noesis/brain/src/noesis_brain/learning -type f -name "*.py"` — AAU learner is at `aau/`, not `learning/aau/`]

---

### Pitfall 2: Handler.py Has Duplicate Methods (Dead Code — Read-Only Warning)

**What goes wrong:** `BrainHandler` in `handler.py` has `query_memory` and `force_telos` methods defined TWICE (at lines 940-989 and again at lines 1161-1250). `hash_state` is also defined twice (lines 876-890 and 899-913).

**Why it happens:** Historical dead code from incomplete refactoring. Python uses the last definition, so the second definition wins.

**How to avoid:** When adding lore integration to `BrainHandler.__init__`, scroll to the end of `__init__` (around line 135) and add lore-related instance variables there. When adding lore handling to `on_message()` and `on_tick()`, add to the existing unique methods. Do not add new duplicate method definitions.

**Warning signs:** Any method that appears twice in handler.py is a symptom of this pattern.

[VERIFIED: `brain/src/noesis_brain/rpc/handler.py` lines 940-1250 read — duplicate `query_memory`, `force_telos`, `hash_state` confirmed]

---

### Pitfall 3: WHISPER_FORBIDDEN_KEYS vs. FORBIDDEN_KEY_PATTERN Distinction

**What goes wrong:** Interpreting D-20-13's "add `__lore_request:` / `__lore_response:` to WHISPER_FORBIDDEN_KEYS" as adding the literal prefix strings to the `WHISPER_FORBIDDEN_KEYS` constant array.

**Why it happens:** WHISPER_FORBIDDEN_KEYS contains field names like `'text'`, `'body'`, not message prefixes. Adding `'__lore_request:'` as a field name would be semantically wrong and would never trigger since no payload would have a key named `'__lore_request:'`.

**How to avoid:** The correct implementation is:
1. Add `lore_body`, `lore_content`, `title_text`, `summary_text` to `FORBIDDEN_KEY_PATTERN` (prevents content field names in any payload)
2. Add `LORE_FORBIDDEN_KEYS` constant export
3. Document the `__lore_request:` / `__lore_response:` prefixes in the WHISPER_FORBIDDEN_KEYS JSDoc for traceability
4. The Brain-side prefix stripping in `on_message()` is the actual guard preventing lore plaintext from entering audit payloads

[VERIFIED: `grid/src/audit/broadcast-allowlist.ts` WHISPER_FORBIDDEN_KEYS lines 335-349 — confirmed field name semantics]

---

### Pitfall 4: 3-Keys-Not-5 Invariant for lore.contributed vs. lore.cited

**What goes wrong:** Including `contributor_did` and `tick` in the Brain metadata for LORE_CONTRIBUTE action (which would then cause a 4-key metadata dict rather than the 2-key Brain contribution).

**Why it happens:** Confusion between Brain metadata (what Brain sends in Action.metadata) and Grid audit payload (what Grid emits with injected fields).

**How to avoid:**
- Brain LORE_CONTRIBUTE metadata: `{content_hash, category_tag}` — 2 keys only
- Grid injects: `contributor_did = this.nousDid` + `tick` → 4-key audit payload
- Brain LORE_CITED metadata: `{content_hash}` — 1 key only
- Grid injects: `citing_did = this.nousDid` + `tick` → 3-key audit payload

[VERIFIED: ActionType comments in `brain/src/noesis_brain/rpc/types.py` lines 50-54 — same discipline for SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED]

---

### Pitfall 5: Quota Enforcement Location

**What goes wrong:** Implementing quota enforcement only in the Brain (before emitting the LORE_CONTRIBUTE action). STATE.md invariant says "enforced at `grid/src/integration/nous-runner.ts`."

**Why it happens:** LORE-03 says "enforced Brain-side before emitting LORE_CONTRIBUTE" but STATE.md critical invariants say "Lore contribution quota K=3 per Nous per sleep epoch enforced at `grid/src/integration/nous-runner.ts` before `appendLoreContributed` call."

**How to avoid:** Enforce at NousRunner (Grid boundary), not exclusively Brain-side. The NousRunner `case 'lore_contribute':` block must check quota before calling `appendLoreContributed`. Brain-side is advisory/optimization; Grid-side is the authoritative enforcement boundary.

**Warning signs:** If quota is checked only in Brain, a malicious or buggy Brain can flood lore events.

[VERIFIED: `.planning/STATE.md` v2.4 Critical Invariants section, confirmed "enforced at grid/src/integration/nous-runner.ts"]

---

### Pitfall 6: content_hash vs title_hash in lore_commons

**What goes wrong:** Confusing `content_hash` (sha256 of full lore body — the linking key across Brain and Grid) with `title_hash` (sha256 of title only — stored in Grid for operator reference, never used for verification).

**Why it happens:** LORE-01 REQUIREMENTS.md says `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}` in the Grid hash index, but D-20-12 (CONTEXT.md) says the `lore.contributed` audit payload is `{category_tag, content_hash, contributor_did, tick}` — 4 keys, no `title_hash`.

**How to avoid:** 
- `lore_commons` MySQL table: stores `title_hash` as a column (never in audit payload)
- `lore.contributed` audit payload: 4 keys only — `{category_tag, content_hash, contributor_did, tick}` — NO `title_hash`
- The closed-tuple test will catch any extra key at the `appendLoreContributed` boundary

[VERIFIED: CONTEXT.md D-20-12 payload shape confirmed vs REQUIREMENTS.md LORE-01 table schema]

---

### Pitfall 7: FTS5 Virtual Table and `lore_entries` Shared Connection

**What goes wrong:** Creating a separate SQLite connection for lore vs. using the shared MemoryStore connection.

**Why it happens:** SkillStore uses the shared MemoryStore `_conn`, not a new connection.

**How to avoid:** LoreStore should accept `conn: sqlite3.Connection` (same MemoryStore connection) in `__init__`. Creating a separate DB file would mean a second SQLite file per Nous. The SkillStore pattern shows the correct approach.

[VERIFIED: `brain/src/noesis_brain/skills/store.py` `__init__` signature — `conn: sqlite3.Connection` (shared)]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Grid) | vitest ^2.0.0 |
| Config file (Grid) | `grid/vitest.config.ts` (not found but implied by package.json `"test": "vitest run"`) |
| Quick run command (Grid) | `cd grid && npm test` |
| Full suite command (Grid) | `cd grid && npm test` |
| Framework (Brain) | pytest >=8.0 + pytest-asyncio >=0.23 |
| Config file (Brain) | `brain/pyproject.toml` `[tool.pytest.ini_options] testpaths = ["test"]` |
| Quick run command (Brain) | `cd brain && python -m pytest test/lore/ -x` |
| Full suite command (Brain) | `cd brain && python -m pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LORE-01 | LoreStore add/retrieve/evict | unit | `cd brain && python -m pytest test/lore/ -x` | ❌ Wave 0 |
| LORE-01 | appendLoreContributed validation ladder | unit | `cd grid && npm test -- test/lore/appendLoreContributed` | ❌ Wave 0 |
| LORE-01 | lore.contributed sole producer | grep | `cd grid && npm test -- test/lore/lore-producer-boundary` | ❌ Wave 0 |
| LORE-01 | Migration v8 SQL inspection | unit | `cd grid && npm test -- test/lore/lore-migration` | ❌ Wave 0 |
| LORE-01 | Allowlist baseline (length===41) | unit | `cd grid && npm test -- test/lore/lore-allowlist-baseline` | ❌ Wave 0 |
| LORE-02 | lore.cited sole producer | grep | `cd grid && npm test -- test/lore/lore-producer-boundary` | ❌ Wave 0 |
| LORE-02 | appendLoreCited validation ladder | unit | `cd grid && npm test -- test/lore/appendLoreCited` | ❌ Wave 0 |
| LORE-02 | LoreCitationListener increments citation_count | unit | `cd grid && npm test -- test/lore/lore-citation-listener` | ❌ Wave 0 |
| LORE-02 | Allowlist final count (length===43) | unit | `cd grid && npm test -- test/lore/lore-allowlist` | ❌ Wave 3 |
| LORE-03 | Quota enforcement: K=3 per epoch | unit | `cd grid && npm test -- test/lore/lore-quota` | ❌ Wave 3 |

### Sampling Rate

- **Per task commit:** `cd grid && npm test -- test/lore/ && cd ../brain && python -m pytest test/lore/ -x`
- **Per wave merge:** `cd grid && npm test && cd ../brain && python -m pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `brain/test/lore/__init__.py` — lore test package
- [ ] `brain/test/lore/test_lore_store.py` — LoreStore unit tests
- [ ] `grid/test/lore/lore-allowlist-baseline.test.ts` — Wave 0 RED gate (length===41)
- [ ] `grid/test/lore/lore-producer-boundary.test.ts` — sole producer grep gate
- [ ] `grid/test/lore/appendLoreContributed.test.ts` — validation ladder
- [ ] `grid/test/lore/appendLoreCited.test.ts` — validation ladder
- [ ] `grid/test/lore/lore-migration.test.ts` — version 8 SQL inspection
- [ ] `grid/src/lore/types.ts` — locked key tuples before test can import
- [ ] `grid/src/lore/appendLoreContributed.ts` — sole producer stub
- [ ] `grid/src/lore/appendLoreCited.ts` — sole producer stub
- [ ] Wave 0: extend FORBIDDEN_KEY_PATTERN and assert count===41

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A for intra-Grid comms |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | NousRunner quota enforcement; category_tag validation at emitter boundary |
| V5 Input Validation | yes | 10-step sole-producer validation ladder; HEX64_RE hash format; category enum check |
| V6 Cryptography | yes | sha256 content hash (Python hashlib); Phase 11 XChaCha20-Poly1305 for whisper envelope |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lore body leaks into audit chain | Information Disclosure | FORBIDDEN_KEY_PATTERN extension; closed-tuple check at emitter |
| Forged content_hash (corrupt lore body) | Tampering | sha256 verification in Brain on_message() before LoreStore.add() |
| Lore flooding (quota bypass) | Denial of Service | NousRunner quota check before appendLoreContributed; K=3 per epoch |
| Category injection (unknown tag) | Tampering | VALID_LORE_CATEGORIES closed enum at appendLoreContributed boundary |
| `__lore_response:` whisper carries malformed content | Tampering | sha256 verification on Brain receive path |
| Prototype pollution in payload | Tampering | Explicit reconstruction (step 8) in all sole-producer emitters |
| Duplicate lore event from wrong actor | Tampering | Self-report invariant (step 3) in appendLoreContributed |

---

## Sources

### Primary (HIGH confidence — live codebase verified)

- `brain/src/noesis_brain/skills/store.py` — LoreStore blueprint (full read)
- `brain/src/noesis_brain/rpc/handler.py` — BrainHandler integration points (full read)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum (full read)
- `brain/src/noesis_brain/aau/learner.py` — asyncio.create_task background task pattern (full read)
- `brain/src/noesis_brain/prompts/system.py` — additive-widening prompt pattern (lines 1-117)
- `grid/src/audit/broadcast-allowlist.ts` — ALLOWLIST_MEMBERS (confirmed 41), FORBIDDEN_KEY_PATTERN, WHISPER_FORBIDDEN_KEYS (full read)
- `grid/src/integration/nous-runner.ts` — executeActions() switch cases (lines 218-791)
- `grid/src/whisper/router.ts` — WhisperRouter.route() (full read)
- `grid/src/norms/NormDetector.ts` — pure-observer pattern (full read)
- `grid/src/norms/appendNormCrystallized.ts` — 10-step validation ladder (full read)
- `grid/src/norms/appendNormCandidate.ts` — system-actor-DID emitter pattern (full read)
- `grid/src/skills/appendSkillTaught.ts` — self-report emitter pattern (full read)
- `grid/src/skills/types.ts` — locked key tuple pattern (full read)
- `grid/src/norms/types.ts` — NormConfig, locked key tuples (full read)
- `grid/src/db/schema.ts` — MIGRATIONS array, version 7 as last entry (full read)
- `grid/src/db/migration-runner.ts` — MigrationRunner.run() pattern (full read)
- `grid/test/norms/norm-producer-boundary.test.ts` — grep gate template (full read)
- `grid/test/skills/skill-producer-boundary.test.ts` — grep gate template (full read)
- `grid/test/audit/skill-allowlist-baseline.test.ts` — baseline assertion template (full read)
- `grid/test/audit/skill-allowlist.test.ts` — final count assertion template (full read)
- `grid/test/norms/norm-migration.test.ts` — migration SQL inspection template (partial read)
- `.planning/phases/20-lore-commons/20-CONTEXT.md` — all decisions (full read)
- `.planning/STATE.md` — critical invariants, allowlist ledger (partial read)
- `.planning/REQUIREMENTS.md` — LORE-01..03 acceptance criteria (full read)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lore_poll_interval_ticks = 30` aligns with Phase 16 sleep epoch boundary | Lore Discovery Flow | Quota enforcement calculation would be misaligned — low risk, config is TOML-adjustable |
| A2 | `VALID_LORE_CATEGORIES` should be a module-level mutable `Set` that GenesisLauncher overwrites at startup (like NormConfig injection) | Category Tag System | If injection mechanism differs, category validation at emitter boundary may use wrong set |

**If this table is short:** All other claims verified from live codebase reads. No training-data-only claims.

---

## Open Questions

1. **LoreCitationListener wiring in GenesisLauncher**
   - What we know: NormDetector is constructed in `genesis/launcher.ts` with `rebuildFromChain()` called at startup
   - What's unclear: Exact constructor signature and startup wiring location for LoreCitationListener
   - Recommendation: Read `grid/src/genesis/launcher.ts` at plan time for NormDetector wiring pattern; mirror it exactly for LoreCitationListener

2. **NousRunner loreDeps injection**
   - What we know: `NousRunnerConfig` has optional `governanceDeps?: {audit, store}` — same pattern needed for `loreDeps?: {store, quotaTracker}`
   - What's unclear: Whether quota tracker is a new class or a simple Map<did, count[]> in NousRunner
   - Recommendation: Use tick-indexed epoch counting (same approach as Phase 11 rate limiter); read `grid/src/whisper/rate-limit.ts` at plan time

3. **Fastify route registration for `/api/v1/grid/lore`**
   - What we know: Norms API has a route; governance has `api/governance/routes.ts`
   - What's unclear: Whether norms REST endpoint lives in `api/` or is wired differently
   - Recommendation: Read `grid/src/norms/` + `grid/src/api/server.ts` at plan time to find norms route registration — mirror for lore

---

## Environment Availability

Step 2.6: SKIPPED — Phase 20 is code-only additions to existing stack. No new external dependencies beyond what Phases 11-19 already require (Node.js, Python 3.11+, MySQL, SQLite — all confirmed present by Phase 19 shipping).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from live codebase
- Architecture: HIGH — all integration points confirmed via source reads
- Pitfalls: HIGH — discovered from live code inspection (duplicate methods, path confusion, key name semantics)
- Test patterns: HIGH — exact templates read from Phase 18/19 tests

**Research date:** 2026-05-16
**Valid until:** 2026-07-01 (stable codebase; patterns unlikely to change within v2.4 milestone)
