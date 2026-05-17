# Phase 20: Lore Commons — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `brain/src/noesis_brain/lore/store.py` | service | CRUD + FTS5 retrieval | `brain/src/noesis_brain/skills/store.py` | exact |
| `brain/src/noesis_brain/lore/__init__.py` | config | — | `brain/src/noesis_brain/skills/__init__.py` | exact |
| `brain/src/noesis_brain/lore/types.py` | model | — | `brain/src/noesis_brain/skills/types.py` | role-match |
| `brain/src/noesis_brain/rpc/types.py` (modified) | model | — | self (existing ActionType enum, lines 49–54) | exact |
| `brain/src/noesis_brain/rpc/handler.py` (modified) | service | event-driven + request-response | self (existing on_message / on_tick, lines 139–459) | exact |
| `grid/src/lore/types.ts` | model | — | `grid/src/skills/types.ts` | exact |
| `grid/src/lore/appendLoreContributed.ts` | service | request-response | `grid/src/skills/appendSkillTaught.ts` | exact |
| `grid/src/lore/appendLoreCited.ts` | service | request-response | `grid/src/skills/appendSkillInferred.ts` | exact |
| `grid/src/lore/LoreCitationListener.ts` | service | event-driven | `grid/src/relationships/listener.ts` | exact |
| `grid/src/lore/LoreCommonsListener.ts` | service | event-driven | `grid/src/norms/NormDetector.ts` | role-match |
| `grid/src/audit/broadcast-allowlist.ts` (modified) | config | — | self (SKILL_FORBIDDEN_KEYS / NORM_FORBIDDEN_KEYS, lines 301–318) | exact |
| `grid/src/integration/nous-runner.ts` (modified) | service | request-response | self (skill_taught case, lines 724–744) | exact |
| `grid/src/db/schema.ts` (modified) | config | CRUD | self (version 7 create_norm_tables entry, lines 144–174) | exact |

---

## Pattern Assignments

### `brain/src/noesis_brain/lore/store.py` (service, CRUD + FTS5)

**Analog:** `brain/src/noesis_brain/skills/store.py`

**Module docstring pattern** (lines 1–10):
```python
"""LoreStore — SQLite-backed lore library with FTS5 retrieval (Phase 20).

Sole writer: BrainHandler.on_message() → __lore_response: prefix dispatch.
Reader: build_system_prompt() via retrieve().

Retrieval ranking (EvoAgent §4 three-stage cascade):
  1. Fast category filter (O(1)) — checked before FTS5.
  2. FTS5 BM25 match over title + content.
  3. Return top-k by BM25 score.
"""
```

**Imports pattern** (skills/store.py lines 14–19):
```python
from __future__ import annotations

import math
import sqlite3

from noesis_brain.lore.types import LoreEntry
```

**Constructor pattern** (skills/store.py lines 22–39):
```python
class LoreStore:
    """Wraps the shared MemoryStore SQLite connection for lore_entries table.

    Accepts the same sqlite3.Connection used by MemoryStore — one DB file per Nous.
    """

    LORE_CAPACITY = 50  # default; configurable via TOML lore_capacity (D-20-09)

    def __init__(self, conn: sqlite3.Connection, capacity: int = 50) -> None:
        self._conn = conn  # shared with MemoryStore (Pitfall 7 — NOT a new connection)
        self._capacity = capacity
        self._ensure_tables()
```

**Schema creation pattern** (adapt from skills/store.py — SkillStore creates tables via ALTER, LoreStore needs _ensure_tables):
```python
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
```

**Write pattern with capacity eviction** (adapt from skills/store.py lines 43–75):
```python
    def add(self, entry: LoreEntry) -> None:
        """Store lore entry; evict oldest by received_tick if over capacity (D-20-09)."""
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
```

**FTS5 retrieve pattern** (skills/store.py lines 96–154 — copy 3-stage cascade, adapting to title+content FTS):
```python
    def retrieve(self, query: str, k: int = 3) -> list[LoreEntry]:
        """Return top-k lore entries for the query using FTS5 BM25.

        Stage 1: fast category pre-filter (optional, by caller).
        Stage 2: FTS5 BM25 retrieval for top-20 candidates.
        Stage 3: return top-k.
        """
        if not query.strip():
            return []

        safe_query = " ".join(
            w for w in query.split() if w.isalnum() or "_" in w
        ) or query[:50]
        try:
            rows = self._conn.execute(
                """SELECT le.content_hash, le.contributor_did, le.category_tag,
                          le.title, le.content, le.received_tick
                   FROM lore_entries_fts
                   JOIN lore_entries le ON lore_entries_fts.rowid = le.rowid
                   WHERE lore_entries_fts MATCH ?
                   ORDER BY rank
                   LIMIT 20""",
                (safe_query,),
            ).fetchall()
            return [LoreEntry.from_row(r) for r in rows[:k]]
        except Exception:
            return []
```

**Scoring pattern** (skills/store.py lines 178–184 — adapt for lore, which has no usage_count):
```python
    def count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()
        return row[0]
```

---

### `brain/src/noesis_brain/lore/__init__.py` (config)

**Analog:** `brain/src/noesis_brain/skills/__init__.py` (lines 1–19)

**Pattern** (skills/__init__.py lines 1–19):
```python
"""Lore Commons — collective memory store with FTS5 retrieval (Phase 20).

A Nous stores lore entries received from peers via whisper. At prompt build time
the top-k entries most relevant to the current situation are retrieved via FTS5
and injected into the system prompt.

Phase 20: peer-contributed lore via LORE_CONTRIBUTE action.
Grid stores hash index only; content is Nous-to-Nous via whisper.
"""

from noesis_brain.lore.store import LoreStore
from noesis_brain.lore.types import LoreEntry, LORE_CATEGORIES

__all__ = ["LoreEntry", "LORE_CATEGORIES", "LoreStore"]
```

---

### `brain/src/noesis_brain/lore/types.py` (model)

**Analog:** `brain/src/noesis_brain/skills/types.py` (dataclass pattern, lines 1–87)

**Imports and dataclass pattern** (skills/types.py lines 1–11):
```python
"""Lore types — collective memory entry records (Phase 20)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
```

**Dataclass pattern** (adapt from skills/types.py lines 11–43):
```python
@dataclass
class LoreEntry:
    """A single lore entry stored in the brain-local lore library.

    content_hash: sha256 of full content body (linking key, never transmitted).
    contributor_did: DID of the Nous who originally authored this entry.
    category_tag: closed enum from LORE_CATEGORIES (D-20-03/04).
    title: Short title (not transmitted; hashed for Grid title_hash column).
    content: Full prose content (Brain-private, never crosses Brain↔Grid wire).
    received_tick: tick when this Nous received the entry (FIFO eviction key, D-20-09).
    """

    content_hash: str
    contributor_did: str
    category_tag: str
    title: str
    content: str
    received_tick: int

    @classmethod
    def from_row(cls, row: Any) -> "LoreEntry":
        return cls(
            content_hash=row["content_hash"] if hasattr(row, "__getitem__") else row[0],
            contributor_did=row["contributor_did"],
            category_tag=row["category_tag"],
            title=row["title"],
            content=row["content"],
            received_tick=row["received_tick"],
        )

    def to_prompt_block(self) -> str:
        """Format for injection into the system prompt."""
        return f"[{self.category_tag}] **{self.title}**: {self.content}"
```

**LORE_CATEGORIES frozenset** (D-20-03/04 — follows NormConfig pattern from grid/src/norms/types.ts):
```python
# Closed enum of valid category tags (D-20-04).
# TOML key: lore_categories (list of strings) overrides this at startup (D-20-03).
LORE_CATEGORIES: frozenset[str] = frozenset({
    "cultural",
    "historical",
    "observation",
    "synthesis",
})
```

---

### `brain/src/noesis_brain/rpc/types.py` (modified — ActionType additions)

**Analog:** self — existing ActionType enum, lines 49–54

**Addition pattern** (types.py lines 49–54 — Phase 18 block as template):
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
Insert after line 54 (`SKILL_REJECTED = "skill_rejected"`).

---

### `brain/src/noesis_brain/rpc/handler.py` (modified — on_message + on_tick)

**Analog:** self — on_message prefix dispatch (lines 153–181), asyncio.create_task pattern (lines 425–436)

**on_message prefix dispatch pattern** (handler.py lines 153–181 — __skill_share: template):
```python
        # Phase 20 LORE-02: lore response reception — runs BEFORE thymos/LLM (non-conversational).
        _LORE_RESPONSE_PREFIX = "__lore_response:"
        if text.startswith(_LORE_RESPONSE_PREFIX):
            if self._lore_store is not None:
                import hashlib as _hashlib
                rest = text[len(_LORE_RESPONSE_PREFIX):]
                # Format: {content_hash}:{base64_content}
                sep = rest.find(":")
                if sep > 0:
                    recv_hash = rest[:sep]
                    import base64 as _base64
                    try:
                        raw_bytes = _base64.b64decode(rest[sep + 1:])
                        raw_content = raw_bytes.decode("utf-8")
                    except Exception:
                        return []  # malformed — silent drop per Brain discipline
                    # Verify sha256(content) == content_hash (D-20-05)
                    computed = _hashlib.sha256(raw_bytes).hexdigest()
                    if computed != recv_hash:
                        return []  # hash mismatch — silent drop
                    # Store (split title from content; format is "{title}\n{body}")
                    # ... (LoreStore.add call)
            return []  # __lore_response is never a conversational reply

        _LORE_REQUEST_PREFIX = "__lore_request:"
        if text.startswith(_LORE_REQUEST_PREFIX):
            if self._lore_store is not None:
                requested_hash = text[len(_LORE_REQUEST_PREFIX):]
                # Serve from local store if held (D-20-07: any holder may serve)
                # ... (respond via whisper Action if lore_store.has(requested_hash))
            return []
```

**asyncio.create_task background task pattern** (handler.py lines 425–436 — canonical template):
```python
        # Phase 20 LORE-02: lore discovery poll — every 30 ticks (D-20-05/06).
        if self._lore_store is not None and (tick % self._lore_poll_interval) == 0:
            import asyncio as _asyncio

            def _make_lore_poll(
                lore_store: LoreStore = self._lore_store,
                t: int = tick,
                did: str = self.did,
            ) -> None:
                async def _poll() -> None:
                    await lore_store.discovery_poll(t, did)
                _asyncio.create_task(_poll())

            _make_lore_poll()
```
CRITICAL: Use the nested `_make_lore_poll()` closure pattern — NOT `asyncio.create_task(coroutine())` directly in the tick path. Mirrors lines 426–436 exactly.

**Prompt-build lore injection pattern** — mirrors Phase 15/16/17 additive-widening in build_system_prompt (system.py lines 16–117). Inject lore before `_directives_section`. For each injected entry emit `Action(ActionType.LORE_CITED, metadata={"content_hash": entry.content_hash})`.

---

### `grid/src/lore/types.ts` (model)

**Analog:** `grid/src/skills/types.ts` (lines 1–51)

**Imports and payload interfaces** (skills/types.ts lines 1–50):
```typescript
/**
 * Lore Grid types — Phase 20 D-20-12.
 * Payload interfaces and EXPECTED_KEYS tuples for lore.contributed + lore.cited sole-producer emitters.
 *
 * 3-keys-not-5 invariant: Brain metadata carries 1-2 keys;
 * Grid injects contributor_did/citing_did + tick at emit time.
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface LoreContributedPayload {
    category_tag: string;    // alphabetical — locked by D-20-12
    content_hash: string;
    contributor_did: string;
    tick: number;
}

export interface LoreCitedPayload {
    citing_did: string;      // alphabetical — locked by D-20-12
    content_hash: string;
    tick: number;
}

/** Alphabetically sorted key tuples — locked by D-20-12. */
export const LORE_CONTRIBUTED_KEYS = [
    'category_tag', 'content_hash', 'contributor_did', 'tick',
] as const;

export const LORE_CITED_KEYS = [
    'citing_did', 'content_hash', 'tick',
] as const;

/** Valid category tags — injected from GenesisLauncher TOML config (D-20-03). */
export const DEFAULT_LORE_CATEGORIES = new Set([
    'cultural',
    'historical',
    'observation',
    'synthesis',
] as const);

/** Mutable at startup — GenesisLauncher overwrites from TOML lore_categories (D-20-03). */
export let VALID_LORE_CATEGORIES: Set<string> = new Set(DEFAULT_LORE_CATEGORIES);
```

---

### `grid/src/lore/appendLoreContributed.ts` (service, request-response, sole producer)

**Analog:** `grid/src/skills/appendSkillTaught.ts` (lines 1–104)

**File header + imports** (appendSkillTaught.ts lines 1–27):
```typescript
/**
 * appendLoreContributed — Phase 20 sole producer for lore.contributed (pos 42).
 *
 * Closed-tuple: {category_tag, content_hash, contributor_did, tick} — 4 keys (D-20-12).
 * 3-keys-not-5: Brain sends {content_hash, category_tag} (2 keys); Grid injects contributor_did + tick.
 *
 * Validation discipline:
 *   1. DID regex: actorDid
 *   2. DID regex: payload.contributor_did
 *   3. Self-report invariant: payload.contributor_did === actorDid
 *   4. Tick: non-negative integer
 *   5. content_hash: HEX64_RE (64-char hex)
 *   6. category_tag: closed enum — VALID_LORE_CATEGORIES (D-20-03)
 *   7. Closed-tuple: Object.keys(payload).sort() === LORE_CONTRIBUTED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. Privacy gate: payloadPrivacyCheck
 *  10. Commit to chain (sole producer).
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { LORE_CONTRIBUTED_KEYS, VALID_LORE_CATEGORIES, type LoreContributedPayload } from './types.js';
```

**DID_RE + HEX64_RE declarations** (appendSkillTaught.ts lines 29–32):
```typescript
/** DID regex — locked project-wide (Phase 7 D-29). */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex (full sha256 hexdigest). */
export const HEX64_RE = /^[0-9a-f]{64}$/;
```

**10-step validation ladder** (appendSkillTaught.ts lines 34–104 — replace key names):
```typescript
export function appendLoreContributed(
    audit: AuditChain,
    actorDid: string,
    payload: LoreContributedPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendLoreContributed: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    // 2. contributor_did format
    if (typeof payload?.contributor_did !== 'string' || !DID_RE.test(payload.contributor_did)) {
        throw new TypeError(`appendLoreContributed: invalid contributor_did ${JSON.stringify(payload?.contributor_did)}`);
    }
    // 3. Self-report invariant
    if (payload.contributor_did !== actorDid) {
        throw new TypeError(`appendLoreContributed: self-report violation — contributor_did ${payload.contributor_did} !== actorDid ${actorDid}`);
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendLoreContributed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. content_hash 64-char hex
    if (typeof payload.content_hash !== 'string' || !HEX64_RE.test(payload.content_hash)) {
        throw new TypeError(`appendLoreContributed: invalid content_hash (must be 64-char lowercase hex)`);
    }
    // 6. category_tag closed enum
    if (!VALID_LORE_CATEGORIES.has(payload.category_tag as string)) {
        throw new TypeError(`appendLoreContributed: unknown category_tag ${JSON.stringify(payload.category_tag)}`);
    }
    // 7. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== LORE_CONTRIBUTED_KEYS.length || !actualKeys.every((k, i) => k === LORE_CONTRIBUTED_KEYS[i])) {
        throw new TypeError(`appendLoreContributed: closed-tuple violation — expected keys ${JSON.stringify(LORE_CONTRIBUTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
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
        throw new TypeError(`appendLoreContributed: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    // 10. Commit to chain (sole producer)
    return audit.append('lore.contributed', actorDid, cleanPayload);
}
```

---

### `grid/src/lore/appendLoreCited.ts` (service, request-response, sole producer)

**Analog:** `grid/src/skills/appendSkillInferred.ts` (lines 1–91)

**Import pattern** (appendSkillInferred.ts lines 24–27 — import DID_RE/HEX64_RE from sibling):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { LORE_CITED_KEYS, type LoreCitedPayload } from './types.js';
import { DID_RE, HEX64_RE } from './appendLoreContributed.js';
```

**Validation ladder** (appendSkillInferred.ts lines 28–91 — adapt for lore.cited 3-key payload):
```typescript
export function appendLoreCited(
    audit: AuditChain,
    actorDid: string,
    payload: LoreCitedPayload,
): AuditEntry {
    // 1. actorDid format
    // 2. citing_did format
    // 3. Self-report invariant: payload.citing_did === actorDid
    // 4. tick non-negative integer
    // 5. content_hash HEX64_RE
    // 6. Closed-tuple: Object.keys(payload).sort() === LORE_CITED_KEYS
    // 7. (no step 6b — only 3 fields, not 4+)
    // 8. Explicit reconstruction
    const cleanPayload = {
        citing_did: payload.citing_did,
        content_hash: payload.content_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate
    // 10. return audit.append('lore.cited', actorDid, cleanPayload)
}
```
Follow appendSkillInferred.ts exactly. Self-report field is `citing_did` (not `learner_did`). No step 6b (appendSkillInferred has source_event_hash; lore.cited has no second hash field — only content_hash).

---

### `grid/src/lore/LoreCitationListener.ts` (service, event-driven, pure-observer)

**Analog:** `grid/src/relationships/listener.ts` (lines 1–65) — pure-observer, zero audit.append

**Class header + constructor pattern** (relationships/listener.ts lines 1–44):
```typescript
// Phase 20 LORE-02: Pure-observer listener on lore.cited events.
// INVARIANT: Zero audit.append calls inside this class.
// Enforced by: grid/test/lore/lore-producer-boundary.test.ts grep gate.

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
Key difference from RelationshipListener: no `reset()`, no `rebuildFromChain()` — citation_count increment is a delta operation (no replay needed). Mirrors NormDetector's `this.audit.onAppend` constructor wiring pattern (NormDetector.ts line 30).

---

### `grid/src/lore/LoreCommonsListener.ts` (service, event-driven)

**Analog:** `grid/src/norms/NormDetector.ts` (lines 1–147) — for the REST endpoint data query path; this listener populates lore_commons MySQL from contributed events

**File header + invariant comment** (NormDetector.ts lines 1–11):
```typescript
// Phase 20 LORE-01: Observer on lore.contributed events — populates lore_commons MySQL table.
// INVARIANT: Zero audit.append calls inside this class.
// All DB writes go to LoreStorage.upsert() only.
// Enforced by: grid/test/lore/lore-producer-boundary.test.ts grep gate.
```

**Constructor pattern** (NormDetector.ts lines 25–31):
```typescript
export class LoreCommonsListener {
    constructor(
        private readonly audit: AuditChain,
        private readonly storage: LoreStorage,
        private readonly gridName: string,
    ) {
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'lore.contributed') return;
        const contentHash = entry.payload['content_hash'] as string;
        const contributorDid = entry.payload['contributor_did'] as string;
        const categoryTag = entry.payload['category_tag'] as string;
        const tick = entry.payload['tick'] as number;
        if (typeof contentHash !== 'string' || typeof contributorDid !== 'string') return;
        // Fire-and-forget upsert — errors swallowed (audit chain is truth)
        this.storage.upsertContribution(this.gridName, contentHash, contributorDid, categoryTag, tick).catch(() => {});
    }
}
```

---

### `grid/src/audit/broadcast-allowlist.ts` (modified — Wave 0 extension)

**Analog:** self — SKILL_FORBIDDEN_KEYS (lines 301–305), NORM_FORBIDDEN_KEYS (lines 314–318), FORBIDDEN_KEY_PATTERN (line 382)

**LORE_FORBIDDEN_KEYS pattern** (mirror SKILL_FORBIDDEN_KEYS lines 301–305 and NORM_FORBIDDEN_KEYS lines 314–318):
```typescript
/**
 * Phase 20 (LORE-01 / D-20-13): lore-leaf keys that MUST NOT appear in any
 * broadcast payload. Lore body text and title text are Brain-private and NEVER
 * cross the Brain↔Grid wire. Only content_hash (64-char hex) is permitted.
 * Per D-20-13 — exactly 4 keys. Do NOT add extras without a CONTEXT.md decision.
 *
 * NOTE: __lore_request: and __lore_response: are Brain-internal whisper prefixes;
 * they are never payload field names and are NOT added to WHISPER_FORBIDDEN_KEYS.
 * The Brain-side on_message() prefix check is the guard for lore plaintext. (RESEARCH.md §8)
 */
export const LORE_FORBIDDEN_KEYS = Object.freeze([
    'lore_body',
    'lore_content',
    'title_text',
    'summary_text',
] as const);
```

**FORBIDDEN_KEY_PATTERN extension** (append to end of existing regex at line 382):
```
// Current regex ends: |norm_text|fingerprint_text|rule_content/i
// Add: |lore_body|lore_content|title_text|summary_text
// Final tail: |norm_text|fingerprint_text|rule_content|lore_body|lore_content|title_text|summary_text/i
```

**ALLOWLIST_MEMBERS additions** (append after `'norm.crystallized'` at line 168 — assert length===41 first):
```typescript
    // Assert: ALLOWLIST_MEMBERS.length === 41 before these two lines (D-20-13).
    // LoreCitationListener observes lore.cited; increments citation_count in lore_commons.
    // Both emitted ONLY via grid/src/lore/appendLoreContributed.ts and appendLoreCited.ts.
    'lore.contributed', // (42) {category_tag, content_hash, contributor_did, tick}
    'lore.cited',       // (43) {citing_did, content_hash, tick}
```

---

### `grid/src/integration/nous-runner.ts` (modified — lore dispatch cases)

**Analog:** self — `case 'skill_taught':` (lines 724–744) and `case 'skill_inferred':` (lines 747–765)

**lore_contribute case** (model from skill_taught lines 724–744):
```typescript
                case 'lore_contribute': {
                    // Phase 20 D-20-12: Grid injects contributor_did+tick (3-keys-not-5).
                    // Brain sends content_hash, category_tag (2 keys).
                    // Quota enforcement BEFORE sole-producer call (D-20-13 / STATE.md invariant).
                    // Quota: K=3 per sleep epoch. Enforced at Grid boundary (Pitfall 5).
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const contentHash = typeof md['content_hash'] === 'string' ? md['content_hash'] : null;
                    const categoryTag = typeof md['category_tag'] === 'string' ? md['category_tag'] : null;
                    if (contentHash === null || categoryTag === null) {
                        console.warn(JSON.stringify({ event: 'lore.contribute.malformed_metadata', did: this.nousDid, tick }));
                        break;
                    }
                    // Quota check: loreDeps.quotaTracker.tryConsume(this.nousDid, tick)
                    // If quota exceeded: log + break (no appendLoreContributed call)
                    try {
                        appendLoreContributed(this.audit, this.nousDid, {
                            contributor_did: this.nousDid,
                            tick,
                            content_hash: contentHash,
                            category_tag: categoryTag,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({ event: 'lore.dispatch.rejected', action_type: 'lore_contribute', did: this.nousDid, reason: (err as Error).message }));
                    }
                    break;
                }
```

**lore_cited case** (model from skill_inferred lines 747–765):
```typescript
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
                        console.warn(JSON.stringify({ event: 'lore.dispatch.rejected', action_type: 'lore_cited', did: this.nousDid, reason: (err as Error).message }));
                    }
                    break;
                }
```

---

### `grid/src/db/schema.ts` (modified — version 8 migration)

**Analog:** self — version 7 `create_norm_tables` entry (lines 144–174)

**Migration entry pattern** (schema.ts lines 144–174):
```typescript
    {
        version: 8,
        name: 'create_lore_commons',
        up: `
            CREATE TABLE IF NOT EXISTS lore_commons (
                grid_name        VARCHAR(63)  NOT NULL,
                content_hash     CHAR(64)     NOT NULL,
                contributor_did  VARCHAR(255) NOT NULL,
                title_hash       CHAR(64)     NOT NULL,
                category_tag     VARCHAR(32)  NOT NULL,
                citation_count   INT UNSIGNED NOT NULL DEFAULT 0,
                contributed_tick INT UNSIGNED NOT NULL,
                PRIMARY KEY (grid_name, content_hash),
                INDEX idx_category    (grid_name, category_tag),
                INDEX idx_contributor (grid_name, contributor_did),
                INDEX idx_tick        (grid_name, contributed_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS lore_commons`,
    },
```
Append after the version 7 entry (before the closing `];` of the MIGRATIONS array).

NOTE: `title_hash` is in the MySQL table (for operator display) but NOT in the `lore.contributed` audit payload (which has only 4 keys: `{category_tag, content_hash, contributor_did, tick}`). This is Pitfall 6 from RESEARCH.md — the closed-tuple test will catch any extra key.

---

## Shared Patterns

### 10-Step Sole-Producer Validation Ladder
**Source:** `grid/src/skills/appendSkillTaught.ts` (full file) + `grid/src/norms/appendNormCrystallized.ts` (full file)
**Apply to:** `appendLoreContributed.ts`, `appendLoreCited.ts`

The 10 steps in order (locked — never reorder):
1. actorDid DID_RE check
2. Primary actor-field DID_RE check (contributor_did / citing_did)
3. Self-report invariant: primary-field === actorDid
4. Tick non-negative integer check
5. Hash field HEX64_RE check (content_hash)
6. Domain-specific enum/format check (category_tag closed enum — lore.contributed only; no step 6 for lore.cited)
7. Closed-tuple: `Object.keys(payload).sort()` strict equality against locked `*_KEYS` array
8. Explicit reconstruction (never spread `...payload`)
9. `payloadPrivacyCheck(cleanPayload)` from `../audit/broadcast-allowlist.js`
10. `audit.append('event.type', actorDid, cleanPayload)` — sole emit line

### Pure-Observer Constructor Wiring
**Source:** `grid/src/relationships/listener.ts` (lines 41–44), `grid/src/norms/NormDetector.ts` (line 30)
**Apply to:** `LoreCitationListener.ts`, `LoreCommonsListener.ts`

```typescript
// In constructor body — always last line before closing brace:
this.audit.onAppend((entry) => this.handleEntry(entry));
```
INVARIANT: Zero `audit.append(...)` calls anywhere in the listener class body. Enforced by `lore-producer-boundary.test.ts` grep gate.

### asyncio.create_task Closure Pattern
**Source:** `brain/src/noesis_brain/rpc/handler.py` (lines 425–436)
**Apply to:** `handler.py` lore discovery poll addition

```python
import asyncio as _asyncio

def _make_X_task(
    dep1: Type = self._dep1,
    t: int = tick,
) -> None:
    async def _run() -> None:
        await dep1.do_work(t)
    _asyncio.create_task(_run())

_make_X_task()
```
Always use the nested closure to capture mutable `self` fields at call time. Never `asyncio.create_task(coroutine)` directly in `on_tick` — the closure captures tick value correctly.

### NousRunner Switch Case Pattern
**Source:** `grid/src/integration/nous-runner.ts` (lines 724–744, 747–765)
**Apply to:** `lore_contribute` and `lore_cited` cases in nous-runner.ts

Mandatory structure:
1. Extract metadata fields with explicit type guards (`typeof md['x'] === 'string' ? md['x'] : null`)
2. Null-check all required fields; log + `break` on malformed
3. Quota check before sole-producer call (lore_contribute only)
4. `try { append*(...) } catch (err) { console.warn(...); }` — never re-throw
5. `break;` closes the case

### FORBIDDEN_KEY_PATTERN + Domain Forbidden Keys Export
**Source:** `grid/src/audit/broadcast-allowlist.ts` (lines 301–318, 382)
**Apply to:** Wave 0 modification of `broadcast-allowlist.ts`

Pattern: new `LORE_FORBIDDEN_KEYS = Object.freeze([...] as const)` constant, followed by JSDoc explaining which keys are forbidden and why. Then extend the FORBIDDEN_KEY_PATTERN regex by appending `|lore_body|lore_content|title_text|summary_text` before the closing `/i`. Never replace the whole regex — always append to avoid breaking prior Phase entries.

### MySQL Pool Query Pattern (swallowed errors on write)
**Source:** `grid/src/norms/storage.ts` (lines 11–91)
**Apply to:** `grid/src/lore/LoreStorage.ts` (new file — MySQL wrapper for lore_commons)

```typescript
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class LoreStorage {
    constructor(public readonly pool: Pool) {}

    async upsertContribution(...): Promise<void> {
        try {
            await this.pool.query(sql, [...]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(JSON.stringify({ msg: 'lore_contribution_upsert_failed', ...context, err: msg }));
        }
    }

    async incrementCitationCount(gridName: string, contentHash: string): Promise<void> {
        try {
            await this.pool.query(
                'UPDATE lore_commons SET citation_count = citation_count + 1 WHERE grid_name = ? AND content_hash = ?',
                [gridName, contentHash],
            );
        } catch (err) {
            // Swallow — audit chain is truth; citation_count is denormalized cache
        }
    }

    async queryEntries(gridName: string, category?: string, limit = 20): Promise<RowDataPacket[]> {
        // Propagate errors (REST endpoint caller handles them)
        const [rows] = await this.pool.query<RowDataPacket[]>(...);
        return rows;
    }
}
```

### Allowlist Baseline Test Pattern
**Source:** `grid/test/audit/skill-allowlist-baseline.test.ts` (verified from RESEARCH.md §10)
**Apply to:** `grid/test/lore/lore-allowlist-baseline.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('Phase 20 allowlist baseline — Wave 0 gate (D-20-13)', () => {
    it('allowlist has exactly 41 events before lore additions', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(41);
    });

    it('position 41 is norm.crystallized (last Phase 19 event)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[40]).toBe('norm.crystallized');
    });
});
```

### Sole-Producer Grep Gate Test Pattern
**Source:** `grid/test/norms/norm-producer-boundary.test.ts` (verified from RESEARCH.md §11)
**Apply to:** `grid/test/lore/lore-producer-boundary.test.ts`

```typescript
const SOLE_EMITTERS: Record<string, string> = {
    'lore.contributed': 'lore/appendLoreContributed.ts',
    'lore.cited': 'lore/appendLoreCited.ts',
};
// Walk grid/src; assert each event string appears ONLY in:
//   1. audit/broadcast-allowlist.ts
//   2. The sole emitter file listed above
// AND assert no other file calls audit.append('{event}', ...)
```

---

## No Analog Found

All files have direct analogs. No gaps.

---

## Critical Pitfalls (carry into plan)

From RESEARCH.md — each pitfall references the analog that establishes the correct pattern:

| Pitfall | Correct Analog | Wrong Pattern |
|---------|---------------|---------------|
| AAU Learner path wrong | `brain/src/noesis_brain/aau/learner.py` (NOT `learning/aau/`) | `brain/src/noesis_brain/learning/aau/learner.py` — does not exist |
| handler.py has duplicate methods — add lore only to the first (live) definition | handler.py lines 139–460 (first definitions) | Lines 940–1250 (dead duplicates) |
| WHISPER_FORBIDDEN_KEYS vs. FORBIDDEN_KEY_PATTERN — don't add prefix strings to field-name list | FORBIDDEN_KEY_PATTERN (line 382) | Adding `'__lore_request:'` to WHISPER_FORBIDDEN_KEYS constant |
| Brain LORE_CONTRIBUTE metadata = 2 keys only; Grid assembles 4-key payload | types.py SKILL_TAUGHT comment (line 52): "3 keys, Grid injects 2" | Sending `contributor_did` + `tick` from Brain |
| Quota enforced at NousRunner (Grid), not only Brain | nous-runner.ts skill_taught case (lines 724–744) | Quota check only in Brain on_tick |
| `content_hash` vs. `title_hash`: audit payload has only `content_hash`; MySQL table has both | LORE_CONTRIBUTED_KEYS (4 keys, no title_hash) | Adding title_hash to audit payload — closed-tuple test catches this |
| LoreStore uses shared MemoryStore connection (not a new file) | skills/store.py `__init__` accepting `conn: sqlite3.Connection` | Creating `LoreStore(db_path=...)` with its own connection |

---

## Metadata

**Analog search scope:** `brain/src/noesis_brain/skills/`, `brain/src/noesis_brain/rpc/`, `brain/src/noesis_brain/aau/`, `grid/src/audit/`, `grid/src/skills/`, `grid/src/norms/`, `grid/src/relationships/`, `grid/src/integration/`, `grid/src/db/`
**Files scanned:** 16 analog files (full reads)
**Pattern extraction date:** 2026-05-16
