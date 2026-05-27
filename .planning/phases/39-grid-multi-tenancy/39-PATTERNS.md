# Phase 39: Grid Multi-Tenancy — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 20 (7 new, 5 modified, 8 test)
**Analogs found:** 20 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/api/preHandlers/operatorScope.ts` | middleware | request-response | `grid/src/api/preHandlers/requireDid.ts` | exact |
| `grid/src/operator/data/operator-brain-store.ts` | service | CRUD | `grid/src/db/stores/brain-token-store.ts` | exact |
| `grid/src/operator/data/operator-quota-store.ts` | service | CRUD | `grid/src/db/stores/brain-token-store.ts` | role-match |
| `grid/src/operator/data/operator-settings-store.ts` | service | CRUD | `grid/src/db/stores/brain-token-store.ts` | role-match |
| `grid/src/api/routes/operator-me/nous.ts` | route | request-response | `grid/src/api/routes/brain-token.ts` | exact |
| `grid/src/api/routes/operator-me/brains.ts` | route | request-response | `grid/src/api/routes/brain-token.ts` | exact |
| `grid/src/api/routes/operator-me/quota.ts` | route | request-response | `grid/src/api/routes/brain-token.ts` | exact |
| `grid/src/api/routes/operator-me/settings.ts` | route | request-response | `grid/src/api/routes/brain-token.ts` | exact |
| `scripts/check-operator-scope-typing.mjs` | utility | batch | `scripts/check-sole-producer-discipline.mjs` | exact |
| `grid/src/db/schema.ts` (v27, v28) | migration | CRUD | `grid/src/db/schema.ts` v25/v26 | exact |
| `grid/src/db/stores/brain-token-store.ts` (3 new methods) | service | CRUD | existing `brain-token-store.ts` methods | exact |
| `grid/src/api/policy.ts` (5 entries) | config | request-response | existing `policy.ts` portal_session entries | exact |
| `grid/src/api/rate-limit/visitor-bucket.ts` (DID layer) | middleware | request-response | existing `visitor-bucket.ts` IP bucket | exact |
| `grid/src/api/server.ts` (wiring) | config | request-response | existing `server.ts` registration calls | exact |
| `grid/test/db/schema-v27-v28.test.ts` | test | batch | `grid/test/db/schema-v14.test.ts` | exact |
| `grid/test/db/brain-token-store-owner.test.ts` | test | CRUD | `grid/test/api/brain-token.test.ts` in-memory mock pattern | exact |
| `grid/test/api/operator-me-nous.test.ts` | test | request-response | `grid/test/api/brain-token.test.ts` | exact |
| `grid/test/api/operator-me-brains.test.ts` | test | request-response | `grid/test/api/brain-token.test.ts` | exact |
| `grid/test/api/operator-me-quota.test.ts` | test | request-response | `grid/test/api/brain-token.test.ts` | exact |
| `grid/test/api/civic-routes-shared.test.ts` | test | request-response | `grid/test/api/brain-token.test.ts` | role-match |
| `grid/test/ci/operator-scope-typing.test.ts` | test | batch | `grid/test/db/schema-v14.test.ts` | role-match |

---

## Pattern Assignments

### `grid/src/api/preHandlers/operatorScope.ts` (middleware, request-response)

**Analog:** `grid/src/api/preHandlers/requireDid.ts`

**Imports pattern** (`requireDid.ts` lines 1-6):
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DIDContext } from './types.js';
import type { DidStoreRef, TryDidServices } from './tryDid.js';
import { tryDid } from './tryDid.js';
```

For `operatorScope.ts`, only needs:
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../util/logger.js';
```

**Core preHandler pattern** (`requireDid.ts` lines 16-30 and 40-54):
```typescript
export async function requirePortalSession(
    req: FastifyRequest,
    reply: FastifyReply,
    services?: TryDidServices,
): Promise<DIDContext | null> {
    const ctx = await tryDid(req, services);
    if (!ctx) {
        reply.code(401).send({
            error: 'portal_session_required',
            accepted_methods: ['portal_session'],
        });
        return null;
    }
    return ctx;
}
```

`operatorScope.ts` follows this exact shape with two exported functions:
- `operatorScope(req, reply)` — extracts `operatorDid` from `req.didContext`, returns it or sends 403 if absent
- `assertOperatorOwns(req, reply, resourceOperatorDid, tick)` — compares `req.didContext.operatorDid` against the resource owner; Pino warn + 403 on mismatch

**Key difference from analog:** `operatorScope` reads `req.didContext` (already set by global onRequest hook) instead of calling `tryDid`. The `req.didContext` is already populated before `operator/me/*` handlers run.

**DIDContext.operatorDid** (`types.ts` lines 28-32):
```typescript
export interface DIDContext {
    readonly did: string;
    readonly tier: VisitorTier;
    readonly operatorDid?: string;
}
```

**Pino warning pattern** (D-39-09) — use project-wide singleton:
```typescript
import { logger } from '../../util/logger.js';

logger.warn({
    event: 'operator_scope_violation',
    requesting_operator_did: requestingDid ?? null,
    target_operator_did: resourceOperatorDid,
    route: req.url,
    tick,
});
```

**403 response shape** (matches existing auth error shapes):
```typescript
reply.code(403).send({ error: 'forbidden', reason: 'operator_scope' });
```

---

### `grid/src/operator/data/operator-brain-store.ts` (service, CRUD)

**Analog:** `grid/src/db/stores/brain-token-store.ts`

**Critical CI requirement (D-39-10):** Every exported function in `grid/src/operator/data/*.ts` MUST have `operatorDid: string` as a parameter. The CI gate `check-operator-scope-typing.mjs` enforces this.

**Imports pattern** (`brain-token-store.ts` lines 1-3):
```typescript
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
```

**Class constructor pattern** (`brain-token-store.ts` lines 49-56):
```typescript
export class OperatorBrainStore {
    private readonly gridName: string;
    private readonly pool: Pool;

    constructor(opts: { gridName: string; pool: Pool }) {
        this.gridName = opts.gridName;
        this.pool = opts.pool;
    }
```

**Core query pattern** (`brain-token-store.ts` lines 107-116):
```typescript
async getByDid(brainDid: string): Promise<BrainTokenRecord | null> {
    const [rows] = await this.pool.query<BrainTokenRow[]>(
        `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked
         FROM brain_tokens
         WHERE grid_name = ? AND brain_did = ?
         LIMIT 1`,
        [this.gridName, brainDid],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
}
```

**New methods to add** — these go directly on `BrainTokenStore` (in `brain-token-store.ts`) per canonical refs; the `operator-brain-store.ts` in `operator/data/` wraps them as standalone functions with `operatorDid` param (for CI gate compliance).

`setOwner` pattern — uses conditional UPDATE (INSERT IGNORE / UPDATE WHERE NULL semantics, `brain-token-store.ts` line 122-129 for the `revoke` pattern):
```typescript
export async function setOwner(
    pool: Pool, gridName: string, operatorDid: string, brainDid: string,
): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE brain_tokens SET operator_did = ?
         WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`,
        [operatorDid, gridName, brainDid],
    );
    return result.affectedRows === 1;
}
```

`findByOperator` + `countActiveByOperator` follow `getByDid` read pattern with `WHERE operator_did = ?`.

---

### `grid/src/operator/data/operator-quota-store.ts` (service, CRUD)

**Analog:** `grid/src/db/stores/brain-token-store.ts` (pool.query read/write pattern)

**CI requirement:** All exported functions must include `operatorDid: string` parameter.

**grid_config read pattern** (from schema.ts migration v5 — table is `(grid_name, config_key, config_value JSON, updated_at)`):
```typescript
export async function getQuotaLimit(
    pool: Pool, gridName: string, operatorDid: string,
): Promise<number> {
    // Per-operator override takes precedence over global default
    const [overrides] = await pool.query<Array<{ brain_process_limit: number } & RowDataPacket>>(
        `SELECT brain_process_limit FROM operator_quota_overrides
         WHERE grid_name = ? AND operator_did = ? LIMIT 1`,
        [gridName, operatorDid],
    );
    if (overrides[0]) return overrides[0].brain_process_limit;

    // Fall back to global default in grid_config
    const [rows] = await pool.query<Array<{ config_value: string } & RowDataPacket>>(
        `SELECT config_value FROM grid_config
         WHERE grid_name = ? AND config_key = 'quota.brain_processes_default' LIMIT 1`,
        [gridName],
    );
    return rows[0] ? (JSON.parse(rows[0].config_value) as number) : 3;
}
```

`setQuotaOverride` uses INSERT ... ON DUPLICATE KEY UPDATE (same as `brain-token-store.ts` `upsert` pattern lines 86-105).

---

### `grid/src/operator/data/operator-settings-store.ts` (service, CRUD)

**Analog:** `grid/src/db/stores/brain-token-store.ts` (pool.query read/write)

**CI requirement:** All exported functions must include `operatorDid: string` parameter.

Initial placeholder shape per RESEARCH.md pitfall 7: `{ local_ai: null, _version: 1 }`. Stored as JSON in `operator_quota_overrides` or a future dedicated settings row. Phase 40 will extend this.

---

### `grid/src/api/routes/operator-me/nous.ts` (route, request-response)

**Analog:** `grid/src/api/routes/brain-token.ts`

**File header pattern** (`brain-token.ts` lines 1-17):
```typescript
/**
 * Phase 39 — GET /api/v1/operator/me/nous
 * Returns rich per-Nous metadata for the authenticated operator's fleet.
 * portal_session_required (onRequest hook enforces policy before handler runs).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
```

**Route registration function pattern** (`brain-token.ts` lines 74-77):
```typescript
export async function registerOperatorMeNousRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**Handler body pattern** (`brain-token.ts` lines 81-152 — request reading + 503 guard + validation + DB call + reply):
```typescript
app.get('/api/v1/operator/me/nous', async (req, reply) => {
    // onRequest hook has already enforced portal_session_required
    // and set req.didContext with operatorDid = the human DID
    const operatorDid = req.didContext?.operatorDid;
    if (!operatorDid) {
        return reply.code(403).send({ error: 'operator_scope_required' });
    }
    const store = services.brainTokenStore;
    if (!store) return reply.code(503).send({ error: 'brain_token_store_unavailable' });

    const brains = await findByOperator(services.pool, services.gridName, operatorDid);
    // ... build response shape per D-39-03 ...
    return reply.code(200).send({ nous: [...] });
});
```

**Response shape** (D-39-03):
```typescript
// Per entry: { civic_did, brain_did, status, last_active_tick, zone_id: null,
//              civic_standing: null, quota_usage: { brain_processes, limit }, token_expires_at }
```

**Structured log pattern** (`brain-token.ts` line 149):
```typescript
req.log.info({ event: 'brain_token.registered', brain_did, civic_did });
// For operator-me routes:
req.log.info({ event: 'operator_me.nous_listed', operator_did: operatorDid });
```

---

### `grid/src/api/routes/operator-me/brains.ts` (route, request-response)

**Analog:** `grid/src/api/routes/brain-token.ts` — especially the POST register handler

**Core pattern:** POST with body validation + conditional DB write + 429 on quota exceeded:
```typescript
app.post<{ Body: Record<string, unknown> }>('/api/v1/operator/me/brains', async (req, reply) => {
    const operatorDid = req.didContext?.operatorDid;
    if (!operatorDid) return reply.code(403).send({ error: 'operator_scope_required' });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const brain_did = body['brain_did'];

    if (typeof brain_did !== 'string' || !BRAIN_DID_RE.test(brain_did)) {
        return reply.code(400).send({ error: 'invalid_request' });
    }

    // Verify Brain is registered (Phase 38 step 1 complete)
    const rec = await store.getByDid(brain_did);
    if (!rec) return reply.code(404).send({ error: 'unknown_brain_did' });

    // Quota check (D-39-06): DB-authoritative COUNT
    const count = await countActiveByOperator(pool, gridName, operatorDid);
    const limit = await getQuotaLimit(pool, gridName, operatorDid);
    if (count >= limit) {
        return reply.code(429).send({
            error: 'quota_exceeded', resource: 'brain_processes',
            current: count, limit,
        });
    }

    // Atomic claim — UPDATE WHERE operator_did IS NULL
    const claimed = await setOwner(pool, gridName, operatorDid, brain_did);
    if (!claimed) return reply.code(409).send({ error: 'already_claimed' });

    return reply.code(200).send({ ok: true, brain_did, operator_did: operatorDid });
});
```

**INSERT IGNORE / conditional UPDATE pattern** (`brain-token-store.ts` revoke method lines 122-129):
```typescript
const [result] = await this.pool.query<ResultSetHeader>(
    `UPDATE brain_tokens SET revoked = 1, revoked_at_tick = ?
     WHERE grid_name = ? AND brain_did = ? AND revoked = 0`,
    [atTick, this.gridName, brainDid],
);
return result.affectedRows === 1;
```

---

### `grid/src/api/routes/operator-me/quota.ts` (route, request-response)

**Analog:** `grid/src/api/routes/brain-token.ts` GET-style handler (read-only, no body)

Simple GET — reads quota from DB, returns shape per D-39-04:
```typescript
// Response: { brain_processes: { current, limit }, event_rate: { per_did_per_min, limit },
//             p2p_bandwidth_cap_bytes: number }
```

---

### `grid/src/api/routes/operator-me/settings.ts` (route, request-response)

**Analog:** `grid/src/api/routes/brain-token.ts`

Two methods on one file (GET + PATCH), following the same single-file two-handler pattern as `brain-token.ts` (lines 78-182 show two handlers in one `registerBrainTokenRoutes` function).

Initial shape per pitfall 7: `{ local_ai: null, _version: 1 }`.

---

### `scripts/check-operator-scope-typing.mjs` (utility, batch)

**Analog:** `scripts/check-sole-producer-discipline.mjs`

**Imports pattern** (`check-sole-producer-discipline.mjs` lines 31-33):
```javascript
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
```

**walkDir generator pattern** (`check-sole-producer-discipline.mjs` lines 58-80):
```javascript
function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
            yield* walkDir(p);
        } else if (
            e.isFile()
            && /\.ts$/.test(e.name)
            && !e.name.endsWith('.d.ts')
        ) {
            yield p;
        }
    }
}
```

**scanFile check pattern** (`check-sole-producer-discipline.mjs` lines 82-94):
```javascript
function scanFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const missing = [];
    for (const check of REQUIRED_TRIAD) {
        if (!text.includes(check)) {
            missing.push(check);
        }
    }
    return missing.map((check) => ({ file: relative(ROOT, filePath), missing: check }));
}
```

For `check-operator-scope-typing.mjs`, the check per file is different: extract every `export (async )?function` declaration and assert its parameter list contains `operatorDid: string`. The check-did-policy-coverage.mjs (`scripts/check-did-policy-coverage.mjs` lines 76-121) shows a more targeted per-function regex pattern if a per-declaration scan is needed.

**Exit pattern** (`check-sole-producer-discipline.mjs` lines 106-125):
```javascript
if (allViolations.length === 0) {
    console.log(`[check-operator-scope-typing] OK — ...`);
    process.exit(0);
}
console.error('[check-operator-scope-typing] VIOLATIONS FOUND:');
for (const v of allViolations) { console.error(`  ${v.file}  ${v.missing}`); }
process.exit(1);
```

**Scan target:** `grid/src/operator/data/` directory only (not all of `grid/src/`).

---

### `grid/src/db/schema.ts` — migrations v27 and v28 (migration, CRUD)

**Analog:** `grid/src/db/schema.ts` v25 (`create_brain_tokens`, lines 427-443) and v10 (additive ALTER TABLE, line 213-216)

**ALTER TABLE additive pattern** (v10, line 213-216):
```typescript
{
    version: 10,
    name: 'add_region_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN region VARCHAR(127) NOT NULL DEFAULT 'agora'`,
    down: `ALTER TABLE human_users DROP COLUMN region`,
},
```

**Migration v27 — additive column on brain_tokens:**
```typescript
{
    version: 27,
    name: 'add_operator_did_to_brain_tokens',
    up: `
        ALTER TABLE brain_tokens
          ADD COLUMN operator_did VARCHAR(255) NULL DEFAULT NULL,
          ADD INDEX idx_operator_did (grid_name, operator_did)
    `,
    down: `
        ALTER TABLE brain_tokens
          DROP INDEX idx_operator_did,
          DROP COLUMN operator_did
    `,
},
```

**CREATE TABLE pattern** (v25, lines 427-443):
```typescript
{
    version: 25,
    name: 'create_brain_tokens',
    up: `
        CREATE TABLE IF NOT EXISTS brain_tokens (
            grid_name  VARCHAR(63)  NOT NULL,
            brain_did  VARCHAR(255) NOT NULL,
            ...
            PRIMARY KEY (grid_name, brain_did),
            INDEX idx_revoked (grid_name, revoked)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS brain_tokens`,
},
```

**Migration v28 — operator_quota_overrides table:**
```typescript
{
    version: 28,
    name: 'create_operator_quota_overrides',
    up: `
        CREATE TABLE IF NOT EXISTS operator_quota_overrides (
            grid_name    VARCHAR(63)  NOT NULL,
            operator_did VARCHAR(255) NOT NULL,
            brain_process_limit           INT UNSIGNED NOT NULL DEFAULT 3,
            event_rate_per_did_per_min    INT UNSIGNED NOT NULL DEFAULT 600,
            p2p_bandwidth_cap_bytes       BIGINT UNSIGNED NULL DEFAULT NULL,
            updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, operator_did)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS operator_quota_overrides`,
},
```

**grid_config table** (v5, lines 89-101) — already exists, do NOT recreate:
```sql
-- (grid_name VARCHAR(63), config_key VARCHAR(127), config_value JSON, updated_at TIMESTAMP(3))
-- PRIMARY KEY (grid_name, config_key)
-- Quota default row at Grid boot:
INSERT INTO grid_config (grid_name, config_key, config_value)
VALUES (?, 'quota.brain_processes_default', '3')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
```

---

### `grid/src/db/stores/brain-token-store.ts` — new methods (service, CRUD)

**Analog:** Existing methods in the same file (lines 107-144)

**`setOwner` — conditional UPDATE pattern** (mirrors `revoke` lines 122-129):
```typescript
async setOwner(brainDid: string, operatorDid: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
        `UPDATE brain_tokens SET operator_did = ?
         WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`,
        [operatorDid, this.gridName, brainDid],
    );
    return result.affectedRows === 1;
}
```

**`findByOperator` — SELECT list pattern** (mirrors `getByDid` lines 107-116):
```typescript
async findByOperator(operatorDid: string): Promise<BrainTokenRecord[]> {
    const [rows] = await this.pool.query<BrainTokenRow[]>(
        `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked
         FROM brain_tokens
         WHERE grid_name = ? AND operator_did = ? AND revoked = 0`,
        [this.gridName, operatorDid],
    );
    return rows.map(rowToRecord);
}
```

**`countActiveByOperator` — COUNT pattern** (new; uses `RowDataPacket` intersection type like `isRevoked`):
```typescript
async countActiveByOperator(operatorDid: string): Promise<number> {
    const [rows] = await this.pool.query<Array<{ cnt: number } & RowDataPacket>>(
        `SELECT COUNT(*) AS cnt FROM brain_tokens
         WHERE grid_name = ? AND operator_did = ? AND revoked = 0
           AND expires_at > UNIX_TIMESTAMP()`,
        [this.gridName, operatorDid],
    );
    return rows[0]?.cnt ?? 0;
}
```

`ResultSetHeader` is already imported at line 17: `import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';`

---

### `grid/src/api/policy.ts` — 5 new entries (config, request-response)

**Analog:** Existing `portal_session_required` entries (`policy.ts` lines 50-55):
```typescript
// Human Visitor notifications (D-36-19)
'GET /portal/api/v1/notifications': 'portal_session_required',
'POST /portal/api/v1/notifications/:id/read': 'portal_session_required',

// Human Visitor soft interactions (D-36-18)
'POST /api/v1/nous/:civic_did_hash/follow': 'portal_session_required',
'POST /api/v1/polis/bills/:id/watch': 'portal_session_required',
```

**New entries to append** (under a `// Phase 39 — operator/me/* fleet management (D-39-04/D-39-05)` comment):
```typescript
'GET  /api/v1/operator/me/nous':      'portal_session_required',
'POST /api/v1/operator/me/brains':    'portal_session_required',
'GET  /api/v1/operator/me/quota':     'portal_session_required',
'GET  /api/v1/operator/me/settings':  'portal_session_required',
'PATCH /api/v1/operator/me/settings': 'portal_session_required',
```

Note: The existing `operator/*` routes (lines 153-170) use `'public'` policy with their own x-operator-tier mechanism. The new `operator/me/*` routes use `portal_session_required` — they are in the same namespace but different auth model. The comment block must make this clear.

---

### `grid/src/api/rate-limit/visitor-bucket.ts` — DID bucket layer (middleware, request-response)

**Analog:** Same file — the existing IP bucket pattern (lines 1-71)

**Existing structure to preserve** (lines 14-24):
```typescript
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // D-36-05

/** Module-scoped IP bucket map. Phase 39 replaces with per-DID buckets. */
const buckets = new Map<string, Bucket>();
```

**DID bucket addition pattern** — add alongside existing:
```typescript
const DID_MAX_REQUESTS = 600; // D-39-08 — 5× visitor rate for DID-authenticated requests

/** Per-DID bucket map. Phase 39 addition. Key = operatorDid or civic DID. */
const didBuckets = new Map<string, Bucket>();
```

**Hook modification pattern** — extend `registerVisitorRateLimit` to check `req.didContext` after DID resolution. The DID bucket check is layered on top of (not replacing) the IP bucket. The IP bucket runs first (existing 120/min), then DID-authenticated requests get the higher 600/min per-DID limit. Since `onRequest` fires before `tryDid` is called in the global policy hook, the visitor rate limit hook must be modified to read from `req.didContext` if already set, or accept that DID rate limiting is applied in the policy hook after DID resolution.

The comment at line 9-10 confirms the intent: "Phase 39: refactor to per-DID buckets (DID holders get higher limits)." The refactor adds a second Map and a second check — if `req.didContext?.operatorDid` or `req.didContext?.did` is present (set by an earlier hook), apply the DID bucket. Since the visitor rate limit is registered first (line 359 of server.ts, before the policy onRequest hook), the DID bucket layer should be added as a separate `onRequest` hook registered after the policy hook, or the existing hook should be split into two passes. The planner should choose: a second `addHook('onRequest', ...)` registered after the DID-resolving hook is the cleanest layering.

---

### `grid/src/api/server.ts` — wiring (config, request-response)

**Analog:** Existing route registrations (`server.ts` lines 600-625)

**Route registration pattern** (lines 606-608):
```typescript
// --- Phase 38 WIRE-02: Brain bearer-token routes ---
void registerBrainTokenRoutes(app, services);
```

**New import + registration to add:**
```typescript
// Import at top of file (lines 29-61 block):
import { registerOperatorMeRoutes } from './routes/operator-me/index.js';

// Registration call (after registerBrainTokenRoutes, before registerOperatorRoutes):
// --- Phase 39 TENANT-02: Operator fleet management routes ---
void registerOperatorMeRoutes(app, services);
```

**GridServices interface extension** (lines 282-303 pattern):
```typescript
/**
 * Phase 39 TENANT-01: Per-operator quota + settings stores.
 * When absent, operator/me/* routes return 503.
 */
operatorQuotaStore?: import('../operator/data/operator-quota-store.js').OperatorQuotaStore;
operatorSettingsStore?: import('../operator/data/operator-settings-store.js').OperatorSettingsStore;
```

---

## Test File Patterns

### `grid/test/db/schema-v27-v28.test.ts` (test, batch)

**Analog:** `grid/test/db/schema-v14.test.ts`

**Full test pattern** (schema-v14.test.ts lines 1-48):
```typescript
import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 39: Migration v27 — add_operator_did_to_brain_tokens', () => {
    it('last migration is version 28', () => {
        const last = MIGRATIONS[MIGRATIONS.length - 1];
        expect(last.version).toBe(28);
    });
    it('v27 up SQL contains operator_did VARCHAR(255) NULL', () => { ... });
    it('v27 down SQL drops operator_did column', () => { ... });
    it('v28 up SQL creates operator_quota_overrides table', () => { ... });
    it('no version appears twice', () => { ... });
    it('versions are sequential starting from 1', () => { ... });
});
```

---

### `grid/test/api/operator-me-*.test.ts` (tests, request-response)

**Analog:** `grid/test/api/brain-token.test.ts` — the in-memory mock store + buildServer pattern

**Full test setup pattern** (`brain-token.test.ts` lines 15-30):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
```

**Mock store pattern** (`brain-token.test.ts` lines 37-66):
```typescript
function makeMockBrainTokenStore() {
    const store = new Map<string, BrainTokenRecord>();
    return {
        async insert(rec) { ... },
        async upsert(rec) { store.set(rec.brainDid, { ...rec }); },
        async getByDid(brainDid) { return store.get(brainDid) ?? null; },
        async revoke(brainDid, _atTick) { ... },
        async isRevoked(brainDid) { ... },
        _store: store,
    };
}
```

For `operator-me-*.test.ts`, extend `makeMockBrainTokenStore` to include `setOwner`, `findByOperator`, `countActiveByOperator` — returning in-memory values from the same Map.

**buildServer call pattern** (`brain-token.test.ts` lines ~90-115 — not read but inferred from server.ts structure):
```typescript
let app: FastifyInstance;
beforeAll(async () => {
    const services = {
        gridName: GRID_NAME,
        clock: new WorldClock(),
        space: new SpatialMap(GRID_NAME),
        logos: new LogosEngine([]),
        audit: new AuditChain(),
        registry: new NousRegistry(GRID_NAME),
        brainTokenStore: makeMockBrainTokenStore(),
        // Phase 39 additions:
        operatorQuotaStore: makeMockOperatorQuotaStore(),
    };
    ({ app } = buildServer(services));
    await app.ready();
});
afterAll(() => app.close());
```

**Portal session cookie injection** — `keyPairPromise` is already imported; use `SignJWT` to issue a test cookie with `did: OPERATOR_DID` payload, set via `req.cookies.noesis_portal_token` in inject calls.

---

### `grid/test/ci/operator-scope-typing.test.ts` (test, batch)

**Analog:** `grid/test/db/schema-v14.test.ts` (simple assertion test pattern)

Tests that `check-operator-scope-typing.mjs` exits 0 on a valid directory and exits 1 when given a violating function. Can be implemented as a `node:child_process` spawn of the script or as a direct unit test of the scan logic.

---

## Shared Patterns

### Portal Session Authentication
**Source:** `grid/src/api/preHandlers/requireDid.ts` lines 40-54; `grid/src/api/preHandlers/tryDid.ts` lines 126-138
**Apply to:** All `operator/me/*` route handlers

The global `onRequest` hook in `server.ts` (lines 367-405) already calls `requirePortalSession` for any route with `portal_session_required` policy — so by the time an `operator/me/*` handler runs, `req.didContext` is guaranteed to be non-null and `operatorDid` is the human DID (`did:noesis:human:*`).

Portal session path sets `operatorDid = did` (the human DID):
```typescript
// tryDid.ts line 133
return { did, tier: 'human_visitor', operatorDid: did };
```

### Error Handling
**Source:** `grid/src/api/routes/brain-token.ts` lines 83-86
**Apply to:** All `operator/me/*` handlers

503 guard at top of every handler:
```typescript
const store = services.brainTokenStore;
if (!store) return reply.code(503).send({ error: 'brain_token_store_unavailable' });
```

400 for invalid input (lines 96-113):
```typescript
if (typeof brain_did !== 'string' || !BRAIN_DID_RE.test(brain_did)) {
    return reply.code(400).send({ error: 'invalid_request' });
}
```

### Structured Logging
**Source:** `grid/src/api/routes/brain-token.ts` line 149
**Apply to:** All `operator/me/*` handlers for info-level events; `operatorScope.ts` for warn-level violations

```typescript
req.log.info({ event: 'brain_token.registered', brain_did, civic_did });
// or for operator scope:
logger.warn({ event: 'operator_scope_violation', ... });
```

Note: `req.log` (Fastify's per-request logger) is used in route handlers. `logger` (Pino singleton from `grid/src/util/logger.ts`) is used in preHandlers and services outside the request context.

### DID Regex Validation
**Source:** `grid/src/api/routes/brain-token.ts` lines 25-26
**Apply to:** `operator-me/brains.ts` body validation

```typescript
const BRAIN_DID_RE = /^did:noesis:nous:[a-z0-9_\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
```

### Route Registration Function Shape
**Source:** `grid/src/api/routes/brain-token.ts` lines 74-77
**Apply to:** All `operator/me/*.ts` route files

```typescript
export async function register<Name>Route(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> { ... }
```

### ROUTE_DID_POLICY Entry Format
**Source:** `grid/src/api/policy.ts` lines 50-55
**Apply to:** `policy.ts` additions

```typescript
'METHOD /path': 'portal_session_required',
```

---

## No Analog Found

All files have close matches in the codebase. No "no analog" entries.

---

## Metadata

**Analog search scope:** `grid/src/api/`, `grid/src/db/stores/`, `grid/src/api/preHandlers/`, `scripts/`, `grid/test/`
**Files scanned:** 12 source files read directly; 2 scripts read directly
**Pattern extraction date:** 2026-05-27
