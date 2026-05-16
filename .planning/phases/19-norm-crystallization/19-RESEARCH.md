# Phase 19: Norm Crystallization — Research

**Researched:** 2026-05-16
**Domain:** Grid-side pure-observer listener (NormDetector) + Brain fingerprint audit + MySQL norm tables + sole-producer emitters + REST endpoint
**Confidence:** HIGH — all findings verified by direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-19-01:** `revision_hash` in `nous.self_model_revised` IS the n-gram fingerprint — the 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text. Phase 19 Wave 0 MUST audit `brain/src/noesis_brain/learning/rules.py` `RuleStore.add()` to verify the computation. If implemented as full SHA-256, Phase 19 must fix it to the 6-char n-gram fingerprint.

**D-19-02:** NormDetector counts **distinct Nous DIDs** per fingerprint cluster. N≥3 threshold counts unique `nous_did` values — not event count. Single-Nous inflation is architecturally impossible at the counting layer.

**D-19-03:** The `revision_hash` fingerprint computation is:
```python
import hashlib, re
def compute_norm_fingerprint(rule_text: str) -> str:
    words = re.findall(r'[a-z]+', rule_text.lower())
    trigrams = sorted({' '.join(words[i:i+3]) for i in range(len(words)-2)})
    return hashlib.sha256(' '.join(trigrams).encode()).hexdigest()[:6]
```
If no trigrams (rule < 3 words), use SHA-256 of lowercased words joined by space, truncated to 6 chars. Deterministic (no wall-clock, no random, no LLM).

**D-19-04:** Two MySQL tables via MigrationRunner:
- `norm_candidates` (mutable): `(fingerprint CHAR(6) NOT NULL, grid_name VARCHAR(255) NOT NULL)` primary key; `participant_dids TEXT NOT NULL` (JSON array), `first_seen_tick INT NOT NULL`, `last_updated_tick INT NOT NULL`
- `norm_registry` (immutable append-only): `norm_id VARCHAR(64) NOT NULL` (UUID), `fingerprint CHAR(6) NOT NULL`, `crystallized_tick INT NOT NULL`, `participant_count INT NOT NULL`, `convergence_type ENUM('emergent','coincidental') NOT NULL`, `event_hash VARCHAR(64) NOT NULL`, `grid_name VARCHAR(255) NOT NULL`

**D-19-05:** On Grid restart, NormDetector rebuilds `norm_candidates` from audit chain by replaying `nous.self_model_revised` events from last `NORM_WINDOW_TICKS` ticks. `norm_registry` survives restart as-is. Rebuild runs at startup before first tick is dispatched.

**D-19-06:** NormDetector is a Grid-side class in `grid/src/norms/` (new directory). Registers via `AuditChain.onAppend()`. Pure observer — zero `AuditChain.append` calls inside `NormDetector.ts`. All emissions delegate to sole-producer files (`appendNormCandidate.ts`, `appendNormCrystallized.ts`). Pattern identical to `RelationshipListener` from Phase 9.

**D-19-07:** `actorDid` for norm events is `did:noesis:grid`. VERIFIED: `DID_RE = /^did:noesis:[a-z0-9_\-]+$/i` — `did:noesis:grid` passes (verified by Node.js test). This is already used in existing test fixtures (`grid/test/worldclock-zero-diff.test.ts:44` and `grid/test/regression/pause-resume-10b.test.ts:70`).

**D-19-08:** Causal lineage gate via RelationshipListener in-memory edge map. If any pair of converging Nous has `edge.weight > 0`, cluster is `"emergent"`. If all pairs have zero-weight or missing edges, cluster is `"coincidental"`. O(1) lookup via `RelationshipListener.getEdge(didA, didB)`.

**D-19-09:** Thresholds are GenesisLauncher config keys:
- `NORM_THRESHOLD` = 3 (minimum distinct Nous in cluster)
- `NORM_WINDOW_TICKS` = 10 (sliding window width)
- `NORM_ADOPTION_TICKS` = 20 (stability duration before crystallized)

**D-19-10:** Two new allowlist events (positions 40 and 41):
- `norm.candidate` (pos 40): `{convergence_type, fingerprint, participating_count, tick}` — 4 keys, alphabetical
- `norm.crystallized` (pos 41): `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}` — 5 keys, alphabetical; `evidence_tick_range` is a 2-element array `[first_seen_tick, crystallized_tick]`

**D-19-11:** Wave 0 must:
1. Audit Brain `rules.py` `RuleStore.add()` and fix fingerprint computation if wrong
2. Extend `FORBIDDEN_KEY_PATTERN` with `norm_text|fingerprint_text|rule_content`; export `NORM_FORBIDDEN_KEYS`
3. Assert `ALLOWLIST_MEMBERS.length === 39` before norm events land

**D-19-12:** `GET /api/v1/grid/norms` returns crystallized norms only from `norm_registry`. Candidate norms not exposed via REST.

### Claude's Discretion

- Exact SQL schema beyond required columns (indexes, NULL constraints, default values)
- In-memory sliding window structure — recommend flat `Map<fingerprint, {dids: Set<string>, ticks: number[]}>` for simplicity over tick-bucket nesting
- Defection handling: if participant count drops below N during K-tick crystallization window, candidate evicts from `norm_candidates` silently — no re-emission
- Whether startup rebuild runs synchronously or as async task at Grid init

### Deferred Ideas (OUT OF SCOPE)

- Causal lineage via direct audit-chain scan (O(N) over event log)
- REST endpoint for candidates (transient state; observable via audit firehose)
- Defection events (`norm.weakened` or similar)
- `norm.candidate` REST exposure
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NORM-01 | NormDetector pure-observer on `nous.self_model_revised`; n-gram fingerprint clustering; `norm.candidate` fires when N≥3 Nous share fingerprint within W-tick window; `actorDid = did:noesis:grid` | D-19-01/06/07/09/10 verified; DID_RE confirmed to accept `did:noesis:grid`; `nous.self_model_revised` (pos 29) confirmed in ALLOWLIST_MEMBERS; RelationshipListener pure-observer pattern fully verified in source |
| NORM-02 | Causal lineage gate: `convergence_type` in payload; Nous with no prior audit-chain-visible interaction flagged `"coincidental"` vs `"emergent"` | D-19-08 verified; `RelationshipListener.getEdge()` returns `undefined` for unknown pairs and `Edge` with `weight` for known pairs; O(1) lookup confirmed |
| NORM-03 | `norm.crystallized` fires when candidate cluster stable for K ticks; two-stage lifecycle; closed-tuple payload | D-19-04/05/10 verified; two-table MySQL design confirmed; startup rebuild pattern clones Phase 9 RelationshipListener |
</phase_requirements>

---

## Summary

Phase 19 is a **structural clone + extension** of the Phase 9 RelationshipListener pure-observer pattern, applied to fingerprint co-occurrence across `nous.self_model_revised` events. The architecture is already validated — the planner needs only to direct the implementer toward the correct files to clone, the exact payload shapes that are locked, and the one novel element: Brain-side fingerprint computation in `RuleStore.add()`.

**Brain audit finding (critical):** `RuleStore.add()` in `brain/src/noesis_brain/learning/rules.py` currently stores `revision_hash` via the `source` field being set to `f"self_modification:{datetime.now(timezone.utc).isoformat()}"` — confirming wall-clock is used in the `source` metadata, NOT in the hash. However, `RuleStore.add()` does NOT currently compute any fingerprint at all — it calls `self._store.add_wiki_page(page)` and the `revision_hash` emitted in `nous.self_model_revised` comes from a different code path (the reflexion/self-model emitter). Wave 0 must locate where `revision_hash` is set in `nous.self_model_revised` and verify it computes the 6-char n-gram fingerprint per D-19-03.

The in-memory sliding window should be a flat `Map<fingerprint, {dids: Set<string>, ticks: number[]}>` — simpler than tick-bucket nesting and sufficient since eviction scans by checking `ticks[0] < currentTick - NORM_WINDOW_TICKS`. The two MySQL tables keep mutable candidate state separate from immutable crystallized records.

**Primary recommendation:** Wave 0 = Brain fingerprint audit + FORBIDDEN_KEY_PATTERN + allowlist-39 assertion. Wave 1 = MySQL migrations for both tables. Wave 2 = NormDetector class + two sole-producer emitters (DID_RE verified for `did:noesis:grid` before emitting). Wave 3 = causal lineage gate + REST endpoint. Wave 4 = startup rebuild + tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| n-gram fingerprint computation | Brain (RuleStore.add) | — | Rule text is Brain-private; only 6-char hex crosses wire |
| Fingerprint co-occurrence detection | Grid (NormDetector) | — | Observes `nous.self_model_revised.revision_hash` from audit chain |
| Sliding window accumulation | Grid (NormDetector in-memory Map) | — | Stateful accumulation; no Brain involvement |
| Causal lineage classification | Grid (NormDetector via RelationshipListener) | — | RelationshipListener already owns edge map; O(1) getEdge() |
| Candidate persistence | Grid (MySQL norm_candidates) | — | Mutable; survives tick but not restart without rebuild |
| Crystallized norm persistence | Grid (MySQL norm_registry) | — | Immutable append-only; survives restart without rebuild |
| Audit event emission (norm.candidate, norm.crystallized) | Grid (sole-producer emitters) | — | Zero-diff invariant; NormDetector delegates to appendNorm*.ts |
| FORBIDDEN_KEY_PATTERN enforcement | Grid (broadcast-allowlist.ts) | — | Last line of defense; extended in Wave 0 |
| REST API | Grid (Fastify server.ts) | — | `GET /api/v1/grid/norms` from norm_registry |
| Startup rebuild | Grid (NormDetector.rebuildFromChain) | — | Clones RelationshipListener.rebuildFromChain pattern |

---

## Standard Stack

### Core (VERIFIED by codebase inspection)

| Component | Location | Purpose | Verified Usage |
|-----------|----------|---------|----------------|
| `AuditChain.onAppend()` | `grid/src/audit/chain.ts` | Pure-observer registration point | Used by RelationshipListener, DialogueAggregator |
| `RelationshipListener` | `grid/src/relationships/listener.ts` | Structural clone template | Full source read; `handleEntry()` dispatch pattern confirmed |
| `RelationshipStorage` | `grid/src/relationships/storage.ts` | MySQL storage pattern template | REPLACE INTO batch write; scheduleSnapshot pattern |
| `MigrationRunner` | `grid/src/db/migration-runner.ts` | Table migration | `MIGRATIONS` array in `schema.ts`; next version = 7 |
| `SKILL_FORBIDDEN_KEYS` / `SKILL_FORBIDDEN_KEYS` pattern | `grid/src/audit/broadcast-allowlist.ts` | Export pattern for NORM_FORBIDDEN_KEYS | Exact copy-and-adapt; constant export + FORBIDDEN_KEY_PATTERN extension |
| `appendSkillTaught.ts` | `grid/src/skills/appendSkillTaught.ts` | Sole-producer emitter template | 10-step validation pattern confirmed; DID_RE + HEX64_RE + closed-tuple + privacy gate + chain.append |
| `GenesisConfig` | `grid/src/genesis/types.ts` | Config injection point | `relationship?: RelationshipConfig` pattern; add `norm?: NormConfig` |
| Fastify API router | `grid/src/api/server.ts` | REST endpoint registration | `registerGovernanceRoutes` lazy-import pattern for new route registration |
| `mysql2` | `grid/package.json` | MySQL client | Already installed; no new dep |
| `hashlib` stdlib | Brain Python | n-gram fingerprint | Already available; no new dep |

### Zero New Dependencies

Brain: `hashlib` (stdlib) + `re` (stdlib) suffice for fingerprint computation.
Grid: `mysql2` already installed; no new TypeScript library needed.
Dashboard: Phase 19 ships no dashboard panel (deferred to Phase 21).

---

## Architecture Patterns

### System Architecture Diagram

```
Brain (any Nous)
  └─ RuleStore.add(rule_text)
      └─ compute_norm_fingerprint(rule_text) → 6-char hex
      └─ wiki_pages table (Brain-private)
  └─ BrainHandler emits SELF_MODEL_REVISED action
      └─ metadata: {revision_hash: "a1b2c3"}  ← 6-char fingerprint

Grid NousRunner
  └─ appendNousSelfModelRevised(audit, actorDid, {nous_did, tick, revision_hash})
      └─ nous.self_model_revised (pos 29) → AuditChain

AuditChain.onAppend callback
  └─ NormDetector.handleEntry(entry)
      └─ entry.eventType === 'nous.self_model_revised'
      └─ fingerprint = entry.payload.revision_hash (6-char)
      └─ nous_did = entry.actorDid
      └─ tick = entry.payload.tick
      └─ candidateMap.get(fingerprint).dids.add(nous_did)
      └─ evict ticks older than (currentTick - NORM_WINDOW_TICKS)
      └─ if dids.size >= NORM_THRESHOLD:
           └─ convergence_type = classifyConvergence(dids, relListener)
           └─ appendNormCandidate(audit, 'did:noesis:grid', {...})  [sole producer]
           └─ MySQLPool.norm_candidates.upsert(...)
      └─ for each existing norm.candidate:
           └─ if stable K ticks AND dids.size >= NORM_THRESHOLD:
               └─ appendNormCrystallized(audit, 'did:noesis:grid', {...})  [sole producer]
               └─ MySQLPool.norm_registry.insert(...)
               └─ MySQLPool.norm_candidates.delete(fingerprint)

RelationshipListener (injected into NormDetector constructor)
  └─ getEdge(didA, didB) → Edge | undefined
      └─ undefined or weight=0 → coincidental
      └─ weight > 0 → emergent

REST: GET /api/v1/grid/norms
  └─ SELECT * FROM norm_registry WHERE grid_name = ?
  └─ Returns crystallized norms only

Grid Startup (GenesisLauncher)
  └─ RelationshipListener.rebuildFromChain() (existing)
  └─ NormDetector.rebuildFromChain(fromTick: currentTick - NORM_WINDOW_TICKS)
      └─ query audit_trail for nous.self_model_revised events in tick range
      └─ replay into candidateMap
      └─ norm_registry survives intact (no rebuild needed)
```

### Recommended Project Structure

```
grid/src/norms/
├── NormDetector.ts          # Pure-observer listener (clone of relationships/listener.ts)
├── appendNormCandidate.ts   # Sole producer for norm.candidate (pos 40)
├── appendNormCrystallized.ts # Sole producer for norm.crystallized (pos 41)
├── types.ts                 # NormCandidatePayload, NormCrystallizedPayload, NormConfig, NORM_*_KEYS
├── storage.ts               # MySQL norm_candidates + norm_registry writers
└── index.ts                 # Barrel exports

grid/test/norms/
├── zero-diff.test.ts        # NormDetector does not alter chain hashes (clone of relationships/zero-diff.test.ts)
├── norm-producer-boundary.test.ts  # Grep gate: only appendNorm*.ts may call audit.append for norm events
├── appendNormCandidate.test.ts     # Unit: 10-step validation (clone of appendSkillTaught.test.ts)
├── appendNormCrystallized.test.ts  # Unit: 10-step validation
├── norm-detector.test.ts    # Unit: sliding window accumulation, threshold firing, defection eviction
├── fingerprint-determinism.test.ts # Brain: same rule_text always produces same 6-char fingerprint
└── norm-startup-rebuild.test.ts    # Integration: rebuild from chain produces same candidateMap
```

### Pattern 1: Pure-Observer Listener (clone from RelationshipListener)

**What:** Register `this.audit.onAppend((entry) => this.handleEntry(entry))` in constructor. Never call `audit.append` inside the class. All mutations stay in-memory (Map). All DB writes delegate to a storage class.

**When to use:** Any Grid-side derived state computed from existing audit events.

```typescript
// Source: grid/src/relationships/listener.ts (Phase 9 canonical)
export class NormDetector {
    private readonly audit: AuditChain;
    private readonly relationships: RelationshipListener;
    private readonly config: NormConfig;
    // Flat map: fingerprint → {dids: Set<string>, firstSeenTick: number, lastUpdatedTick: number}
    private candidates: Map<string, {dids: Set<string>; firstSeenTick: number; lastUpdatedTick: number}> = new Map();

    constructor(audit: AuditChain, relationships: RelationshipListener, config: NormConfig) {
        this.audit = audit;
        this.relationships = relationships;
        this.config = config;
        // Pure observer — onAppend only, zero audit.append calls in this class
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'nous.self_model_revised') return;
        const fingerprint = entry.payload['revision_hash'] as string;
        const nousDid = entry.actorDid;
        const tick = entry.payload['tick'] as number;
        // ... accumulate, evict stale ticks, check thresholds, delegate to emitters
    }

    public reset(): void { this.candidates.clear(); }

    public rebuildFromChain(fromTick: number): void {
        // Clone of RelationshipListener.rebuildFromChain() — manual replay, NOT via onAppend
        this.reset();
        const entries = this.audit.all();
        for (const entry of entries) {
            if (entry.eventType !== 'nous.self_model_revised') continue;
            const tick = entry.payload['tick'] as number;
            if (tick < fromTick) continue;
            this.handleEntry(entry);
        }
    }
}
```

### Pattern 2: Sole-Producer Emitter (clone from appendSkillTaught.ts)

**What:** 10-step validation then single `audit.append()` call. Export typed payload interface + locked key tuple.

```typescript
// Source: grid/src/skills/appendSkillTaught.ts (Phase 18 canonical)
export const NORM_CANDIDATE_KEYS = ['convergence_type', 'fingerprint', 'participating_count', 'tick'] as const;

export function appendNormCandidate(
    audit: AuditChain,
    actorDid: string,  // MUST be 'did:noesis:grid'
    payload: NormCandidatePayload,
): AuditEntry {
    // 1. actorDid DID_RE
    // 2. actorDid === 'did:noesis:grid' assertion (system-actor gate, unique to norm events)
    // 3. tick non-negative integer
    // 4. fingerprint CHAR6_RE: /^[0-9a-f]{6}$/
    // 5. participating_count >= NORM_THRESHOLD
    // 6. convergence_type ∈ {'emergent', 'coincidental'}
    // 7. Closed-tuple: Object.keys(payload).sort() === NORM_CANDIDATE_KEYS
    // 8. Explicit reconstruction (prototype-pollution defense)
    // 9. Privacy gate: payloadPrivacyCheck (NORM_FORBIDDEN_KEYS)
    // 10. audit.append('norm.candidate', actorDid, cleanPayload)
}
```

### Pattern 3: GenesisConfig Extension for Norm Thresholds

**What:** Add `norm?: NormConfig` field to `GenesisConfig` interface (mirrors `relationship?: RelationshipConfig` in Phase 9).

```typescript
// Clone from grid/src/genesis/types.ts (Phase 9 pattern)
interface NormConfig {
    threshold: number;         // NORM_THRESHOLD default 3
    windowTicks: number;       // NORM_WINDOW_TICKS default 10
    adoptionTicks: number;     // NORM_ADOPTION_TICKS default 20
}
// GenesisLauncher: const normCfg = config.norm ?? DEFAULT_NORM_CONFIG;
```

### Anti-Patterns to Avoid

- **Calling `audit.append` inside NormDetector:** Violates zero-diff invariant. NormDetector is a pure observer — all `audit.append` calls belong in `appendNormCandidate.ts` and `appendNormCrystallized.ts` only. Enforced by `norm-producer-boundary.test.ts` grep gate.
- **Using wall-clock anywhere in NormDetector:** `Date.now()`, `performance.now()`, `new Date()` are forbidden. All timing must come from `entry.payload['tick']`. Enforced by determinism-source grep gate.
- **Computing fingerprint Grid-side from rule text:** Rule text never crosses Brain→Grid wire. Grid receives only the 6-char hex fingerprint. NormDetector works on `revision_hash` only.
- **Scanning audit chain for causal lineage:** O(N) over entire event log. Use `RelationshipListener.getEdge()` O(1) instead (D-19-08).
- **Tick-bucket nesting for sliding window:** Overcomplicates the accumulator. Flat `Map<fingerprint, {dids, ticks}>` where ticks[] are evicted when `ticks[0] < currentTick - windowTicks` is simpler and sufficient.
- **Storing `participant_dids` as a JSON string in candidates without a stable sort:** Rebuild idempotency requires that the JSON array is sorted before storage. Use `Array.from(dids).sort()` before serializing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MySQL writes | Raw `pool.query` inline in NormDetector | `NormStorage` class (clone RelationshipStorage) | Sole-writer gate enforced by grep; separates storage from accumulation logic |
| Hash computation (fingerprint) | Any JavaScript SHA-256 | Brain Python `hashlib.sha256()` already in rules.py | Fingerprint is computed Brain-side; Grid only receives the 6-char result |
| Causal lineage graph | Graph traversal / audit scan | `RelationshipListener.getEdge(didA, didB)` | Phase 9 already solves this O(1); no extra storage |
| Table migration SQL | Inline `CREATE TABLE` | `MIGRATIONS` array in `grid/src/db/schema.ts` (version 7) | MigrationRunner tracks applied versions; idempotent `IF NOT EXISTS` |
| `did:noesis:grid` validation | Custom check | Existing `DID_RE = /^did:noesis:[a-z0-9_\-]+$/i` | Already covers `grid` suffix; confirmed by Node.js test |

**Key insight:** NormDetector is a mechanical application of two existing patterns — RelationshipListener (pure observer) and appendSkillTaught (sole producer). The only novel element is the `convergence_type` classification via the already-existing RelationshipListener edge map.

---

## Common Pitfalls

### Pitfall 1: Brain fingerprint computation not yet wired
**What goes wrong:** `RuleStore.add()` does not currently compute `revision_hash`. The 6-char fingerprint for `nous.self_model_revised` is set elsewhere (likely in the reflexion/BrainHandler dispatch path where `SELF_MODEL_REVISED` action is handled). Wave 0 must trace the full path from `RULE_STORE` Brain action → `nous.self_model_revised` Grid event and find where `revision_hash` originates.
**Why it happens:** `RuleStore.add()` stores wiki pages; the audit event emission is in the Grid-side NousRunner or equivalent action handler, not in RuleStore.
**How to avoid:** Wave 0 audit: `grep -rn "revision_hash\|self_model_revised\|SELF_MODEL_REVISED" grid/src/ brain/src/` to find every production site. Fix the computation at the source.
**Warning signs:** If `revision_hash` in live events is 64 chars, it is the full SHA-256 hex — not the 6-char fingerprint.

### Pitfall 2: `evidence_tick_range` triggers FORBIDDEN_KEY_PATTERN via nested array
**What goes wrong:** `norm.crystallized` payload has `evidence_tick_range: [first_seen_tick, crystallized_tick]` — a 2-element number array. This is a payload with a key containing "tick" which must be verified NOT to match `FORBIDDEN_KEY_PATTERN`. Current pattern is `/prompt|response|wiki|...|rule_text/i` — "evidence_tick_range" does not match any forbidden term. But if NORM_FORBIDDEN_KEYS accidentally includes "tick_range", the privacy check would reject this payload.
**How to avoid:** NORM_FORBIDDEN_KEYS should be exactly `['norm_text', 'fingerprint_text', 'rule_content']` per D-19-11. Do not add "tick" variants.

### Pitfall 3: Startup rebuild fires `norm.candidate` events
**What goes wrong:** If `rebuildFromChain()` calls `handleEntry()` which in turn calls `appendNormCandidate()`, the startup rebuild will append new events to the chain — violating zero-diff and creating duplicate candidate events for already-seen clusters.
**How to avoid:** `rebuildFromChain()` must use a separate code path that populates `candidateMap` directly WITHOUT calling emitters. Only the live `handleEntry()` path calls emitters. Clone the RelationshipListener pattern exactly: `rebuildFromChain()` calls a private `applyEntry()` that mutates `candidateMap` without checking thresholds.

### Pitfall 4: `did:noesis:grid` fails self-report invariant check
**What goes wrong:** `appendSkillTaught.ts` has a `self-report invariant: payload.learner_did === actorDid`. If a norm emitter copies this check verbatim and also checks `payload.nous_did === actorDid`, norm events would fail because their payload keys are `convergence_type, fingerprint, participating_count, tick` — no `nous_did`. The system DID `did:noesis:grid` is NOT a Nous DID and has no self-report requirement.
**How to avoid:** Norm emitters do NOT include a self-report check. The system-actor gate in step 2 should assert `actorDid === 'did:noesis:grid'` instead of any payload-field equality check.

### Pitfall 5: Single-Nous inflation in sliding window
**What goes wrong:** Nous A rewrites the same rule 5 times in the window. If the accumulator uses event count instead of a `Set<string>` of DIDs, A's 5 events would inflate the cluster to appear as N=5 when in fact only 1 Nous participates.
**How to avoid:** `candidateMap` uses `dids: Set<string>`. Adding the same `nous_did` multiple times is idempotent. D-19-02 is preserved by the Set data structure, not by filtering.

### Pitfall 6: norm_candidates primary key conflict on upsert
**What goes wrong:** Two `norm.candidate` emissions for the same fingerprint in different ticks would INSERT a duplicate if the MySQL write uses `INSERT` instead of `REPLACE INTO` or `INSERT ... ON DUPLICATE KEY UPDATE`.
**How to avoid:** Use `REPLACE INTO norm_candidates` or `INSERT ... ON DUPLICATE KEY UPDATE participant_dids=VALUES(participant_dids), last_updated_tick=VALUES(last_updated_tick)`. The composite primary key is `(fingerprint, grid_name)`.

---

## Code Examples

### Brain fingerprint computation (D-19-03)

```python
# Source: D-19-03 (locked design decision, verified as correct approach)
import hashlib, re

def compute_norm_fingerprint(rule_text: str) -> str:
    """6-char hex n-gram fingerprint for norm clustering."""
    words = re.findall(r'[a-z]+', rule_text.lower())
    trigrams = sorted({' '.join(words[i:i+3]) for i in range(len(words)-2)})
    if not trigrams:
        # Fallback: fewer than 3 words — hash the lowercased words
        return hashlib.sha256(' '.join(words).encode()).hexdigest()[:6]
    return hashlib.sha256(' '.join(trigrams).encode()).hexdigest()[:6]
```

### NormConfig type (add to GenesisConfig)

```typescript
// Clone from grid/src/genesis/types.ts RelationshipConfig pattern (Phase 9)
export interface NormConfig {
    threshold: number;        // NORM_THRESHOLD; default 3
    windowTicks: number;      // NORM_WINDOW_TICKS; default 10
    adoptionTicks: number;    // NORM_ADOPTION_TICKS; default 20
}
export const DEFAULT_NORM_CONFIG: NormConfig = {
    threshold: 3,
    windowTicks: 10,
    adoptionTicks: 20,
};
```

### NORM_FORBIDDEN_KEYS constant (add to broadcast-allowlist.ts)

```typescript
// Clone SKILL_FORBIDDEN_KEYS pattern (Phase 18)
export const NORM_FORBIDDEN_KEYS = Object.freeze([
    'norm_text',
    'fingerprint_text',
    'rule_content',
] as const);

// Extend FORBIDDEN_KEY_PATTERN regex — append |norm_text|fingerprint_text|rule_content
```

### MySQL migration (add to schema.ts as version 7)

```typescript
// Clone version 2 (audit_trail) pattern from grid/src/db/schema.ts
{
    version: 7,
    name: 'create_norm_tables',
    up: `
        CREATE TABLE IF NOT EXISTS norm_candidates (
            fingerprint      CHAR(6)       NOT NULL,
            grid_name        VARCHAR(255)  NOT NULL,
            participant_dids TEXT          NOT NULL,
            first_seen_tick  INT           NOT NULL,
            last_updated_tick INT          NOT NULL,
            PRIMARY KEY (fingerprint, grid_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS norm_registry (
            norm_id           VARCHAR(64)   NOT NULL,
            fingerprint       CHAR(6)       NOT NULL,
            crystallized_tick INT           NOT NULL,
            participant_count INT           NOT NULL,
            convergence_type  ENUM('emergent','coincidental') NOT NULL,
            event_hash        VARCHAR(64)   NOT NULL,
            grid_name         VARCHAR(255)  NOT NULL,
            PRIMARY KEY (norm_id),
            INDEX idx_fingerprint (grid_name, fingerprint),
            INDEX idx_crystallized (grid_name, crystallized_tick)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `
        DROP TABLE IF EXISTS norm_candidates;
        DROP TABLE IF EXISTS norm_registry
    `,
},
```

### REST endpoint response shape (D-19-12)

```json
{
  "norms": [
    {
      "norm_id": "uuid",
      "fingerprint": "a1b2c3",
      "crystallized_tick": 450,
      "participant_count": 4,
      "convergence_type": "emergent",
      "evidence_tick_range": [410, 450]
    }
  ]
}
```

### Allowlist additions in broadcast-allowlist.ts

```typescript
// After skill.rejected (pos 39), add:
'norm.candidate',    // (40) {convergence_type, fingerprint, participating_count, tick}
'norm.crystallized', // (41) {convergence_type, evidence_tick_range, fingerprint, participating_count, tick}
```

### GenesisLauncher wiring order

```typescript
// After RelationshipListener construction (D-9-04 order preserved):
this.relationships = new RelationshipListener(this.audit, relationshipCfg);
const normCfg = config.norm ?? DEFAULT_NORM_CONFIG;
this.normDetector = new NormDetector(this.audit, this.relationships, normCfg);
// Startup: after RelationshipListener.rebuildFromChain():
// normDetector.rebuildFromChain(currentTick - normCfg.windowTicks)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Semantic embeddings for norm detection | n-gram fingerprint (6-char SHA-256 prefix of sorted word-trigrams) | v2.4 design (2026-05-16) | Deterministic, CPU-free at Grid, no float non-determinism |
| Single `norms` table with status enum | Two-table: `norm_candidates` (mutable) + `norm_registry` (immutable) | D-19-04 (2026-05-16) | Cleaner separation; candidates evictable without touching registry |
| Grid DID for system events was unspecified | `did:noesis:grid` as actorDid | D-19-07 (2026-05-16) | DID_RE already accepts it; first use as explicit system-DID in event-payload actorDid |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `revision_hash` in `nous.self_model_revised` is currently computed as full SHA-256 (not 6-char), requiring Wave 0 fix | Standard Stack (Brain audit) | If already 6-char n-gram, Wave 0 fix is a no-op (safe); if it's absent entirely, more invasive Brain change needed |
| A2 | Brain `nous.self_model_revised` event is emitted from Grid-side NousRunner (not Brain-side), with `revision_hash` injected by Grid from Brain action metadata | Architecture | If Brain self-emits the event hash, the injection point is different — but either way Wave 0 grep resolves it |
| A3 | `audit.all()` returns entries in tick order (used for rebuildFromChain) | Architecture | If out of order, rebuild would produce different candidateMap; verify `AuditChain.all()` ordering before writing rebuild |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. Note: A1 is the primary uncertainty; Wave 0 resolves it before any norm events land.

---

## Open Questions

1. **Where exactly is `revision_hash` set in `nous.self_model_revised`?**
   - What we know: `RuleStore.add()` does NOT compute it; it's in the audit payload
   - What's unclear: whether Grid-side NousRunner injects it from Brain action metadata, or Brain-side reflexion emitter sends it
   - Recommendation: Wave 0 grep `grep -rn "revision_hash\|self_model_revised\|SELF_MODEL_REVISED" grid/src/ brain/src/` — resolve before writing any norm code

2. **Is `AuditChain.all()` guaranteed to return entries in insertion (tick) order?**
   - What we know: RelationshipListener uses it for rebuildFromChain; Phase 9 tests pass
   - What's unclear: if ever out of order, NormDetector rebuild would be non-deterministic
   - Recommendation: Verify in `grid/src/audit/chain.ts` that `all()` preserves insertion order (likely yes — chain is append-only)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 19 is a code/config-only change. All dependencies (mysql2, vitest, TypeScript, Python hashlib) are already installed and verified operational by prior phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (Grid TypeScript) + pytest (Brain Python) |
| Config file | `grid/vitest.config.ts` (existing) |
| Quick run command | `cd grid && npx vitest run test/norms/` |
| Full suite command | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NORM-01 | NormDetector does not alter chain hashes (pure observer) | Integration | `npx vitest run test/norms/zero-diff.test.ts` | ❌ Wave 0 |
| NORM-01 | norm.candidate sole-producer boundary (grep gate) | Grep | `npx vitest run test/norms/norm-producer-boundary.test.ts` | ❌ Wave 0 |
| NORM-01 | appendNormCandidate 10-step validation | Unit | `npx vitest run test/norms/appendNormCandidate.test.ts` | ❌ Wave 2 |
| NORM-01 | Sliding window accumulation, threshold firing | Unit | `npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 2 |
| NORM-01 | `did:noesis:grid` passes DID_RE | Unit | `npx vitest run test/norms/appendNormCandidate.test.ts` | ❌ Wave 2 |
| NORM-01 | Allowlist count is 39 before norm events added | Unit (Wave 0) | `npx vitest run test/audit/` | existing |
| NORM-02 | Causal lineage convergence_type classification | Unit | `npx vitest run test/norms/norm-detector.test.ts` | ❌ Wave 3 |
| NORM-03 | appendNormCrystallized 10-step validation | Unit | `npx vitest run test/norms/appendNormCrystallized.test.ts` | ❌ Wave 2 |
| NORM-03 | Startup rebuild produces same candidateMap | Integration | `npx vitest run test/norms/norm-startup-rebuild.test.ts` | ❌ Wave 4 |
| D-19-03 | Brain fingerprint is deterministic (same input → same 6-char output) | Unit (pytest) | `cd brain && python -m pytest tests/learning/test_rules.py -k fingerprint -x` | ❌ Wave 0 |
| D-19-11 | FORBIDDEN_KEY_PATTERN does not reject evidence_tick_range | Unit | in `test/norms/appendNormCrystallized.test.ts` | ❌ Wave 2 |

### Sampling Rate
- **Per task commit:** `cd grid && npx vitest run test/norms/`
- **Per wave merge:** `cd grid && npx vitest run && cd ../brain && python -m pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `grid/test/norms/zero-diff.test.ts` — covers NORM-01 pure-observer gate
- [ ] `grid/test/norms/norm-producer-boundary.test.ts` — sole-producer grep gate
- [ ] `brain/tests/learning/test_rules.py` (add fingerprint tests) — covers D-19-03 determinism
- Frameworks already installed from prior phases; no new setup needed

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — internal Grid component |
| V3 Session Management | no | n/a |
| V4 Access Control | yes (REST endpoint) | Operator tier gate on `/api/v1/grid/norms` — follow existing operator route pattern |
| V5 Input Validation | yes | Closed-tuple payload + DID_RE + CHAR6_RE + FORBIDDEN_KEY_PATTERN at emitter boundary |
| V6 Cryptography | no | SHA-256 is used for fingerprinting, not for security; stdlib `hashlib` suffices |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Rule text leaked via norm event payload | Information Disclosure | NORM_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN; NormDetector never stores or forwards rule text |
| Single Nous inflating norm count | Tampering | `Set<string>` for dids; adding same DID multiple times is idempotent |
| `did:noesis:grid` spoofed by Nous | Spoofing | actorDid === 'did:noesis:grid' assertion in sole-producer emitters; only NormDetector (Grid-internal) calls appendNorm*.ts |
| Prototype pollution in payload | Tampering | Explicit reconstruction in step 8 of emitter validation (cloned from appendSkillTaught.ts) |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `grid/src/relationships/listener.ts` — RelationshipListener pure-observer pattern (full source read)
- `grid/src/audit/broadcast-allowlist.ts` — ALLOWLIST_MEMBERS confirmed 39 events; SKILL_FORBIDDEN_KEYS export pattern; FORBIDDEN_KEY_PATTERN current state
- `grid/src/skills/appendSkillTaught.ts` — Sole-producer emitter 10-step validation template (full source read)
- `grid/src/db/schema.ts` — MIGRATIONS array (versions 1-6; next is 7); migration structure
- `grid/src/genesis/types.ts` — GenesisConfig interface; `relationship?: RelationshipConfig` extension pattern
- `grid/src/db/migration-runner.ts` — MigrationRunner.run() pattern
- `grid/src/relationships/storage.ts` — RelationshipStorage REPLACE INTO batch write pattern
- `brain/src/noesis_brain/learning/rules.py` — RuleStore.add() confirmed does NOT compute `revision_hash` itself
- `grid/test/worldclock-zero-diff.test.ts` — `did:noesis:grid` confirmed used as actorDid in existing tests
- `DID_RE.test('did:noesis:grid')` — confirmed `true` by Node.js direct evaluation

### Secondary (MEDIUM confidence — planning documents)

- `.planning/phases/19-norm-crystallization/19-CONTEXT.md` — All decisions D-19-01 through D-19-12
- `.planning/STATE.md` — Allowlist 36→39→41 budget; locked payload shapes
- `.planning/REQUIREMENTS.md` — NORM-01..03 acceptance criteria
- `.planning/research/v2.4/ARCHITECTURE.md` — NormDetector component design
- `.planning/research/v2.4/STACK.md` — n-gram fingerprint rationale; zero new deps confirmation
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` — Pure-observer pattern decisions

---

## Metadata

**Confidence breakdown:**
- Allowlist baseline (39 events): HIGH — verified by counting ALLOWLIST_MEMBERS array entries in source
- Pure-observer pattern: HIGH — RelationshipListener source fully read
- Sole-producer template: HIGH — appendSkillTaught.ts source fully read
- DID_RE accepts `did:noesis:grid`: HIGH — verified by Node.js evaluation
- Brain fingerprint computation: MEDIUM — RuleStore.add() confirmed, but revision_hash origin requires Wave 0 grep to pin exact location
- MySQL migration version: HIGH — schema.ts shows versions 1-6; next is 7
- Payload shapes: HIGH — locked in STATE.md and CONTEXT.md

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (30-day window; stable internal architecture)
