# Phase 19: Norm Crystallization — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 15 (9 new, 6 modified)
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/norms/NormDetector.ts` | service/listener | event-driven | `grid/src/relationships/listener.ts` | exact |
| `grid/src/norms/appendNormCandidate.ts` | utility/emitter | request-response | `grid/src/skills/appendSkillTaught.ts` | exact |
| `grid/src/norms/appendNormCrystallized.ts` | utility/emitter | request-response | `grid/src/skills/appendSkillTaught.ts` | exact |
| `grid/src/norms/types.ts` | model | — | `grid/src/skills/types.ts` | exact |
| `grid/src/norms/storage.ts` | service | CRUD | `grid/src/relationships/storage.ts` | exact |
| `grid/src/norms/index.ts` | config | — | `grid/src/relationships/index.ts` | role-match |
| `grid/src/audit/broadcast-allowlist.ts` | middleware | — | self (extend) | exact |
| `grid/src/db/schema.ts` | migration | CRUD | self (version 6 pattern) | exact |
| `grid/src/genesis/launcher.ts` | config/wiring | — | self (RelationshipListener wiring lines 116-121, 278-290) | exact |
| `grid/src/genesis/types.ts` | model | — | self (RelationshipConfig pattern lines 34-35) | exact |
| `grid/src/api/server.ts` | route/controller | request-response | self (governance plugin pattern lines 343-353) | exact |
| `grid/src/api/norms/routes.ts` | route/controller | request-response | `grid/src/api/operator/relationships.ts` (H1 GET pattern) | role-match |
| `brain/src/noesis_brain/learning/rules.py` | service | transform | self (RuleStore.add() lines 53-87) | exact |
| `grid/test/norms/zero-diff.test.ts` | test | — | `grid/test/relationships/zero-diff.test.ts` | exact |
| `grid/test/norms/norm-producer-boundary.test.ts` | test | — | `grid/test/skills/skill-producer-boundary.test.ts` | exact |

---

## Pattern Assignments

### `grid/src/norms/NormDetector.ts` (service/listener, event-driven)

**Analog:** `grid/src/relationships/listener.ts`

**Imports pattern** (lines 25-28):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { RelationshipListener } from '../relationships/listener.js';
import type { NormConfig } from './types.js';
```

**Constructor + pure-observer registration** (lines 41-44):
```typescript
constructor(audit: AuditChain, config: RelationshipConfig) {
    this.audit = audit;
    this.config = config;
    this.audit.onAppend((entry) => this.handleEntry(entry));
}
```

**handleEntry dispatch pattern** (lines 157-248): switch on `entry.eventType`, `default: return` (silently ignore all other events). For NormDetector, handle only `'nous.self_model_revised'` and return silently on all others.

**reset() lifecycle** (lines 131-133):
```typescript
public reset(): void {
    this.edges.clear();
}
```

**rebuildFromChain() pattern** (lines 143-153):
```typescript
public rebuildFromChain(): void {
    this.reset();
    // loadEntries does NOT fire onAppend — manual replay required (P-9-02).
    const entries = this.audit.all();
    for (const entry of entries) {
        this.handleEntry(entry);
    }
}
```

**Critical deviation for NormDetector:** `rebuildFromChain()` MUST call a private `applyEntry()` that populates `candidateMap` WITHOUT calling emitters. The live `handleEntry()` path calls emitters; the rebuild path must not. The analog's `rebuildFromChain()` calls the same `handleEntry()` because RelationshipListener emits nothing — NormDetector must split these paths.

**Zero-emit invariant comment block** (lines 1-23): Copy the header comment verbatim, substituting:
- "RelationshipListener" → "NormDetector"
- "edges Map" → "candidates Map"
- "grid/test/relationships/zero-diff.test.ts" → "grid/test/norms/zero-diff.test.ts"
- "grid/test/relationships/producer-boundary.test.ts" → "grid/test/norms/norm-producer-boundary.test.ts"

---

### `grid/src/norms/appendNormCandidate.ts` (utility/emitter, request-response)

**Analog:** `grid/src/skills/appendSkillTaught.ts`

**Imports pattern** (lines 23-26):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { NORM_CANDIDATE_KEYS, type NormCandidatePayload } from './types.js';
```

**DID_RE and CHAR6_RE constants** (line 29):
```typescript
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const CHAR6_RE = /^[0-9a-f]{6}$/;
```

**10-step validation structure** (lines 39-103) — adapt from `appendSkillTaught.ts`:
```typescript
// 1. actorDid DID_RE
// 2. actorDid === 'did:noesis:grid' (system-actor gate — replaces self-report invariant)
// 3. tick non-negative integer
// 4. fingerprint CHAR6_RE
// 5. participating_count >= NORM_THRESHOLD (≥3)
// 6. convergence_type ∈ {'emergent', 'coincidental'}
// 7. Closed-tuple: Object.keys(payload).sort() === NORM_CANDIDATE_KEYS
// 8. Explicit reconstruction (prototype-pollution defense)
// 9. Privacy gate: payloadPrivacyCheck(cleanPayload)
// 10. audit.append('norm.candidate', actorDid, cleanPayload)
```

**Closed-tuple enforcement pattern** (lines 78-86):
```typescript
const actualKeys = Object.keys(payload).sort();
if (
    actualKeys.length !== SKILL_TAUGHT_KEYS.length ||
    !actualKeys.every((k, i) => k === SKILL_TAUGHT_KEYS[i])
) {
    throw new TypeError(
        `appendSkillTaught: closed-tuple violation — expected keys ${JSON.stringify(SKILL_TAUGHT_KEYS)}, got ${JSON.stringify(actualKeys)}`,
    );
}
```

**Explicit reconstruction pattern** (lines 88-94):
```typescript
const cleanPayload = {
    convergence_type: payload.convergence_type,
    fingerprint: payload.fingerprint,
    participating_count: payload.participating_count,
    tick: payload.tick,
};
```

**Commit line** (line 103):
```typescript
return audit.append('norm.candidate', actorDid, cleanPayload);
```

**Key deviation from appendSkillTaught:** Step 3 in `appendSkillTaught` is a self-report invariant (`payload.learner_did === actorDid`). For norm emitters, step 2 is instead `actorDid === 'did:noesis:grid'` — a system-actor gate. There is NO self-report payload field check. Do not copy the self-report check.

---

### `grid/src/norms/appendNormCrystallized.ts` (utility/emitter, request-response)

**Analog:** `grid/src/skills/appendSkillTaught.ts` (same structure as appendNormCandidate, different payload)

**5-key payload** (alphabetical): `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}`.

**evidence_tick_range validation** — step 5 or 6:
```typescript
if (!Array.isArray(payload.evidence_tick_range) ||
    payload.evidence_tick_range.length !== 2 ||
    !Number.isInteger(payload.evidence_tick_range[0]) ||
    !Number.isInteger(payload.evidence_tick_range[1]) ||
    payload.evidence_tick_range[0] > payload.evidence_tick_range[1]) {
    throw new TypeError('appendNormCrystallized: invalid evidence_tick_range');
}
```

**Explicit reconstruction** (step 8):
```typescript
const cleanPayload = {
    convergence_type: payload.convergence_type,
    evidence_tick_range: [payload.evidence_tick_range[0], payload.evidence_tick_range[1]],
    fingerprint: payload.fingerprint,
    participating_count: payload.participating_count,
    tick: payload.tick,
};
```

**Commit line**:
```typescript
return audit.append('norm.crystallized', actorDid, cleanPayload);
```

---

### `grid/src/norms/types.ts` (model)

**Analog:** `grid/src/skills/types.ts`

**Payload interfaces pattern** (lines 11-43):
```typescript
export interface SkillTaughtPayload {
    learner_did: string;
    parent_hash: string;
    skill_hash: string;
    teacher_did: string;
    tick: number;
}
export const SKILL_TAUGHT_KEYS = [
    'learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick',
] as const;
```

Adapt to:
```typescript
export interface NormCandidatePayload {
    convergence_type: 'emergent' | 'coincidental';
    fingerprint: string;       // CHAR(6) hex
    participating_count: number;
    tick: number;
}
export const NORM_CANDIDATE_KEYS = [
    'convergence_type', 'fingerprint', 'participating_count', 'tick',
] as const;

export interface NormCrystallizedPayload {
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
    fingerprint: string;
    participating_count: number;
    tick: number;
}
export const NORM_CRYSTALLIZED_KEYS = [
    'convergence_type', 'evidence_tick_range', 'fingerprint', 'participating_count', 'tick',
] as const;

export interface NormConfig {
    threshold: number;       // NORM_THRESHOLD default 3
    windowTicks: number;     // NORM_WINDOW_TICKS default 10
    adoptionTicks: number;   // NORM_ADOPTION_TICKS default 20
}
export const DEFAULT_NORM_CONFIG: NormConfig = {
    threshold: 3,
    windowTicks: 10,
    adoptionTicks: 20,
};
```

Also add `VALID_CONVERGENCE_TYPES`:
```typescript
export const VALID_CONVERGENCE_TYPES = new Set(['emergent', 'coincidental'] as const);
```

Mirror the `VALID_REJECTION_REASONS` pattern (line 46-51 of `skills/types.ts`).

---

### `grid/src/norms/storage.ts` (service, CRUD)

**Analog:** `grid/src/relationships/storage.ts`

**Constructor pattern** (line 25):
```typescript
export class NormStorage {
    constructor(public readonly pool: Pool) {}
```

**REPLACE INTO upsert pattern** (lines 48-76):
```typescript
const sql = `REPLACE INTO norm_candidates
    (fingerprint, grid_name, participant_dids, first_seen_tick, last_updated_tick)
    VALUES (?, ?, ?, ?, ?)`;
```

**Error handling / fire-and-forget** (lines 69-76):
```typescript
try {
    await this.pool.query(sql, params);
} catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(JSON.stringify({ msg: 'norm_candidate_upsert_failed', err: msg }));
}
```

**SELECT for norm_registry** (lines 90-103):
```typescript
async loadNorms(gridName: string): Promise<NormRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        'SELECT * FROM norm_registry WHERE grid_name = ? ORDER BY crystallized_tick ASC',
        [gridName],
    );
    return rows.map((row) => ({ /* map row fields */ }));
}
```

**Key differences from RelationshipStorage:**
- Two separate tables (`norm_candidates` upsert/delete, `norm_registry` insert-only)
- No `scheduleSnapshot()` — norm writes are triggered by NormDetector threshold crossings, not tick cadence
- `norm_registry` uses INSERT (not REPLACE INTO) — immutable append-only records

---

### `grid/src/audit/broadcast-allowlist.ts` (modify — extend)

**Analog:** self, Phase 18 extension pattern (lines 68-73, 293-360)

**ALLOWLIST_MEMBERS extension** (after line 163, after `'skill.rejected'`):
```typescript
// Phase 19 (NORM-01..03 / D-19-10) — Norm lifecycle events. Allowlist 39→41.
// NormDetector observes nous.self_model_revised; fires when N≥3 Nous share fingerprint.
// Both emitted ONLY via grid/src/norms/appendNorm*.ts sole-producer emitters (D-19-06).
'norm.candidate',    // (40) {convergence_type, fingerprint, participating_count, tick}
'norm.crystallized', // (41) {convergence_type, evidence_tick_range, fingerprint, participating_count, tick}
```

**NORM_FORBIDDEN_KEYS export** (after `SKILL_FORBIDDEN_KEYS`, lines 296-300 pattern):
```typescript
export const NORM_FORBIDDEN_KEYS = Object.freeze([
    'norm_text',
    'fingerprint_text',
    'rule_content',
] as const);
```

**FORBIDDEN_KEY_PATTERN extension** (line 360): append `|norm_text|fingerprint_text|rule_content` to the existing regex alternation. The exact pattern follows the Phase 18 append: `|skill_body|skill_text|rule_text` (lines 356-360).

**Wave 0 assertion comment:** Add inline comment before the new allowlist entries stating `// Assert: ALLOWLIST_MEMBERS.length === 39 before these two lines (D-19-11).`

---

### `grid/src/db/schema.ts` (modify — add version 7)

**Analog:** self, version 6 pattern (lines 103-142)

**Version 6 structure to clone** (lines 103-142):
```typescript
{
    version: 6,
    name: 'governance_proposals + governance_ballots',
    up: `
        CREATE TABLE IF NOT EXISTS governance_proposals ( ... ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        CREATE TABLE IF NOT EXISTS governance_ballots ( ... ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `
        DROP TABLE IF EXISTS governance_ballots;
        DROP TABLE IF EXISTS governance_proposals
    `,
},
```

**New version 7 entry:**
```typescript
{
    version: 7,
    name: 'create_norm_tables',
    up: `
        CREATE TABLE IF NOT EXISTS norm_candidates (
            fingerprint       CHAR(6)      NOT NULL,
            grid_name         VARCHAR(255) NOT NULL,
            participant_dids  TEXT         NOT NULL,
            first_seen_tick   INT          NOT NULL,
            last_updated_tick INT          NOT NULL,
            PRIMARY KEY (fingerprint, grid_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS norm_registry (
            norm_id           VARCHAR(64)  NOT NULL,
            fingerprint       CHAR(6)      NOT NULL,
            crystallized_tick INT          NOT NULL,
            participant_count INT          NOT NULL,
            convergence_type  ENUM('emergent','coincidental') NOT NULL,
            event_hash        VARCHAR(64)  NOT NULL,
            grid_name         VARCHAR(255) NOT NULL,
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

Note the `down` order: drop `norm_candidates` before `norm_registry` (no FK constraint, but mirrors version 6's reverse-order drop of dependent table first).

---

### `grid/src/genesis/launcher.ts` (modify — wire NormDetector)

**Analog:** self, RelationshipListener wiring pattern (lines 116-129 for constructor, lines 278-290 for tick callback and rebuild)

**Constructor wiring** (after line 121, after RelationshipListener construction):
```typescript
// Phase 19 NORM-01 (D-19-06): NormDetector is constructed AFTER RelationshipListener
// so it can receive the RelationshipListener reference for causal lineage (D-19-08).
const normCfg = config.norm ?? DEFAULT_NORM_CONFIG;
this.normDetector = new NormDetector(this.audit, this.relationships, normCfg);
this.normStorage = null;
```

**attachNormStorage() method** — mirror `attachRelationshipStorage()` (lines 154-166):
```typescript
attachNormStorage(pool: Pool): void {
    if (this.normStorage !== null) {
        if (this.normStorage.pool === pool) return;
        throw new Error('GenesisLauncher.attachNormStorage called twice with different pools');
    }
    this.normStorage = new NormStorage(pool);
}
```

**Startup rebuild** (after line 290, after `this.relationships.rebuildFromChain()`):
```typescript
// Phase 19: rebuild NormDetector candidate map from last NORM_WINDOW_TICKS ticks.
// norm_registry (crystallized) survives restart without rebuild.
const currentTick = this.clock.currentTick;
this.normDetector.rebuildFromChain(currentTick - normCfg.windowTicks);
```

**Tick callback — no snapshot cadence needed:** NormDetector writes to MySQL on threshold events (not on tick cadence), so no `scheduleSnapshot` equivalent is added to the tick callback.

---

### `grid/src/genesis/types.ts` (modify — add NormConfig to GenesisConfig)

**Analog:** self, lines 29-34 (RelationshipConfig optional field pattern):
```typescript
/**
 * Phase 9 REL-01: optional relationship engine tuning.
 * Defaults applied by GenesisLauncher when omitted (DEFAULT_RELATIONSHIP_CONFIG).
 * Per-Grid overridable for researcher rigs.
 */
relationship?: RelationshipConfig;
```

**New field to add** (after `relationship?`):
```typescript
/**
 * Phase 19 NORM-01: optional norm detection thresholds.
 * Defaults applied by GenesisLauncher when omitted (DEFAULT_NORM_CONFIG).
 * Per-Grid overridable via TOML rig config.
 */
norm?: NormConfig;
```

**Import to add** (after line 8):
```typescript
import type { NormConfig } from '../norms/types.js';
```

---

### `grid/src/api/server.ts` (modify — add norms field to GridServices + register route)

**Analog:** self, governance optional plugin pattern (lines 113-116 for interface, lines 343-353 for registration)

**GridServices interface extension** (after `governance?` at lines 113-116):
```typescript
/**
 * Phase 19 NORM-01 (D-19-12): norm registry access for GET /api/v1/grid/norms.
 * Optional so legacy tests without Phase 19 wiring still compile.
 */
norms?: {
    loadNorms(gridName: string): Promise<NormRow[]>;
};
```

**Route registration pattern** (after governance plugin registration, lines 343-353):
```typescript
// --- Phase 19: Norm registry endpoint ---
if (services.norms) {
    app.get('/api/v1/grid/norms', async () => {
        const norms = await services.norms!.loadNorms(services.gridName);
        return { norms };
    });
}
```

**Inline route vs plugin:** The norms endpoint is a single GET with no auth complexity — register it inline in `buildServerWithHub` like `/api/v1/grid/status` (line 160), not as a lazy plugin like governance. The governance plugin pattern (lazy `import()`) is only needed when the route module imports are heavy or circular.

---

### `grid/src/api/norms/routes.ts` (new — alternative if inline registration is too large)

**Analog:** `grid/src/api/operator/relationships.ts` (H1 GET read-only pattern, lines 183-244)

**Function export pattern** (lines 183-186):
```typescript
export function normsRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
```

**H1 GET route pattern** (lines 191-244):
```typescript
app.get('/api/v1/grid/norms', async (_req, reply) => {
    const norms = services.norms;
    if (!norms) {
        reply.code(200);
        return { norms: [] };
    }
    const rows = await norms.loadNorms(services.gridName);
    reply.code(200);
    return {
        norms: rows.map(r => ({
            norm_id: r.norm_id,
            fingerprint: r.fingerprint,
            crystallized_tick: r.crystallized_tick,
            participant_count: r.participant_count,
            convergence_type: r.convergence_type,
            evidence_tick_range: [r.first_seen_tick, r.crystallized_tick],
        })),
    };
});
```

**No operator.inspected emit** — this is an H1 read endpoint with no tier gate (norms are operator-observable, not H1-public). If a tier gate is needed, copy the `validateTierBody` pattern from `relationships.ts` lines 258-265.

---

### `brain/src/noesis_brain/learning/rules.py` (modify — fix revision_hash computation)

**Analog:** self, `RuleStore.add()` (lines 53-87)

**Current `add()` structure** (lines 53-87): stores `WikiPage` via `self._store.add_wiki_page(page)`. Does NOT compute `revision_hash`. Wave 0 must locate where `revision_hash` is set in `nous.self_model_revised` via:
```bash
grep -rn "revision_hash\|SELF_MODEL_REVISED\|self_model_revised" grid/src/ brain/src/
```

**Fingerprint function to add** (D-19-03 locked algorithm):
```python
import hashlib, re

def compute_norm_fingerprint(rule_text: str) -> str:
    """6-char hex n-gram fingerprint for norm clustering (D-19-03)."""
    words = re.findall(r'[a-z]+', rule_text.lower())
    trigrams = sorted({' '.join(words[i:i+3]) for i in range(len(words)-2)})
    if not trigrams:
        # Fallback: fewer than 3 words
        return hashlib.sha256(' '.join(words).encode()).hexdigest()[:6]
    return hashlib.sha256(' '.join(trigrams).encode()).hexdigest()[:6]
```

**Integration point:** This function must be called wherever `revision_hash` is set in the `nous.self_model_revised` payload. Wave 0 resolves the exact location. If it is in `rules.py` `add()`, add a return value. If it is in a Grid-side action handler, the fix is Grid-side.

---

### `grid/test/norms/zero-diff.test.ts` (new — test)

**Analog:** `grid/test/relationships/zero-diff.test.ts` (full file — exact structural clone)

**Test structure** (lines 15-209):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NormDetector } from '../../src/norms/NormDetector.js';
import { DEFAULT_NORM_CONFIG } from '../../src/norms/types.js';
// Also need a stub RelationshipListener (or real one with AuditChain)
```

**Event sequence:** use `nous.self_model_revised` events (with `revision_hash` and `tick` payloads) as the primary event type, plus unrelated events. The zero-diff test verifies that attaching `NormDetector` does not alter any `eventHash`.

**Core assertion** (lines 168-175):
```typescript
const withNone     = runSim(false, 0);
const withDetector = runSim(true,  0);
const withTen      = runSim(true,  10);
expect(withDetector).toEqual(withNone);
expect(withTen).toEqual(withNone);
```

**Date.now freeze pattern** (lines 145-147):
```typescript
const nowSpy = vi.spyOn(Date, 'now');
let fakeNow = 1_700_000_000_000;
nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));
```

---

### `grid/test/norms/norm-producer-boundary.test.ts` (new — test)

**Analog:** `grid/test/skills/skill-producer-boundary.test.ts` (full file — exact structural clone)

**Sole emitter map** (lines 23-27):
```typescript
const SOLE_EMITTERS: Record<string, string> = {
    'norm.candidate': 'norms/appendNormCandidate.ts',
    'norm.crystallized': 'norms/appendNormCrystallized.ts',
};
```

**Grep pattern for audit.append** (lines 63-69):
```typescript
const pattern = new RegExp(
    `\\b(?:audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"\`]${escapedEvent}['"\`]`,
    's'
);
```

This gate enforces that `norm.candidate` and `norm.crystallized` appear as string literals only in `norms/appendNormCandidate.ts`, `norms/appendNormCrystallized.ts`, and `audit/broadcast-allowlist.ts`.

---

## Shared Patterns

### Pure-Observer Registration
**Source:** `grid/src/relationships/listener.ts` lines 41-44
**Apply to:** `grid/src/norms/NormDetector.ts`
```typescript
constructor(audit: AuditChain, config: RelationshipConfig) {
    this.audit = audit;
    this.config = config;
    this.audit.onAppend((entry) => this.handleEntry(entry));
}
```
Register via `onAppend` only. Zero `audit.append` calls inside the class body. All `audit.append` calls belong exclusively in `appendNormCandidate.ts` and `appendNormCrystallized.ts`.

### Sole-Producer 10-Step Validation
**Source:** `grid/src/skills/appendSkillTaught.ts` lines 39-103
**Apply to:** `grid/src/norms/appendNormCandidate.ts`, `grid/src/norms/appendNormCrystallized.ts`

Step sequence: (1) actorDid DID_RE → (2) actorDid === 'did:noesis:grid' gate → (3) tick non-negative integer → (4) fingerprint CHAR6_RE → (5) participating_count ≥ threshold → (6) convergence_type enum → (7) closed-tuple Object.keys().sort() === LOCKED_KEYS → (8) explicit reconstruction → (9) payloadPrivacyCheck → (10) audit.append.

### Privacy Gate
**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 376-378
**Apply to:** Both norm emitters (step 9)
```typescript
const privacy = payloadPrivacyCheck(cleanPayload);
if (!privacy.ok) {
    throw new TypeError(`appendNormCandidate: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
}
```

### FORBIDDEN_KEY_PATTERN Domain Export
**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 296-300 (`SKILL_FORBIDDEN_KEYS`)
**Apply to:** `NORM_FORBIDDEN_KEYS` constant in `broadcast-allowlist.ts`
```typescript
export const SKILL_FORBIDDEN_KEYS = Object.freeze([
    'skill_body',
    'skill_text',
    'rule_text',
] as const);
```

### MySQL REPLACE INTO Upsert with Error Swallow
**Source:** `grid/src/relationships/storage.ts` lines 68-76
**Apply to:** `grid/src/norms/storage.ts` (norm_candidates upsert)
```typescript
try {
    await this.pool.query(sql, params);
} catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(JSON.stringify({ msg: 'relationships_snapshot_failed', tick: snapshotTick, err: msg }));
}
```
Audit chain is truth; storage failure is logged and swallowed.

### GenesisConfig Optional Field Extension
**Source:** `grid/src/genesis/types.ts` lines 29-34
**Apply to:** `norm?: NormConfig` field in `GenesisConfig`
```typescript
relationship?: RelationshipConfig;
```
Pattern: optional field with `??` fallback to `DEFAULT_NORM_CONFIG` in launcher.

### Fastify Optional Plugin Registration
**Source:** `grid/src/api/server.ts` lines 343-353
**Apply to:** norms route registration in `buildServerWithHub`
```typescript
if (services.governance && services.registry) {
    void app.register(async (instance) => {
        const { registerGovernanceRoutes } = await import('./governance/index.js');
        await registerGovernanceRoutes(instance, { ... });
    });
}
```

### Producer Boundary Grep Test
**Source:** `grid/test/skills/skill-producer-boundary.test.ts` lines 40-74
**Apply to:** `grid/test/norms/norm-producer-boundary.test.ts`

Walk `grid/src/`, for each event string assert it appears only in the sole-emitter file and `broadcast-allowlist.ts`. Second sub-test: no file except the emitter calls `audit.append` with the event literal.

### Zero-Diff Test with Date.now Freeze
**Source:** `grid/test/relationships/zero-diff.test.ts` lines 141-208
**Apply to:** `grid/test/norms/zero-diff.test.ts`

Freeze `Date.now`, run chain with and without `NormDetector`, assert `eventHash` arrays are byte-identical.

---

## No Analog Found

All files have close analogs. No files require RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/test/relationships/`, `grid/test/skills/`, `brain/src/noesis_brain/learning/`
**Files scanned:** 23 source files read directly; ~15 additional via Bash grep
**Pattern extraction date:** 2026-05-16
