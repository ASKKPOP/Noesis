# Phase 45: IRS Treasury — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/audit/broadcast-allowlist.ts` | config | transform | self (extend) | exact |
| `grid/src/audit/append-irs-disbursement-authorized.ts` | utility | event-driven | `grid/src/audit/append-irs-tax-collected.ts` | exact |
| `grid/src/audit/append-irs-tax-collected.ts` | utility | event-driven | self (allowlist comment only) | exact |
| `grid/src/audit/append-irs-disbursement-executed.ts` | utility | event-driven | self (allowlist comment only) | exact |
| `grid/src/api/routes/irs.ts` | route | request-response | `grid/src/api/routes/market.ts` | exact |
| `grid/src/api/server.ts` | config | request-response | self (extend registration) | exact |
| `grid/src/api/policy.ts` | config | request-response | self (extend) | exact |
| `grid/src/irs/irs-store.ts` | service | CRUD | `grid/src/marketplace/marketplace-store.ts` | role-match |
| `grid/src/db/schema.ts` | migration | CRUD | self (extend with v36) | exact |
| `grid/test/irs-routes.test.ts` | test | request-response | `grid/test/market-routes.test.ts` | exact |
| `grid/test/append-irs-disbursement-authorized.test.ts` | test | event-driven | `grid/test/append-irs-tax-collected.test.ts` | exact |
| `grid/test/audit/broadcast-allowlist.test.ts` | test | transform | self (update count) | exact |

---

## Pattern Assignments

### `grid/src/audit/append-irs-disbursement-authorized.ts` (utility, event-driven) — NEW FILE

**Analog:** `grid/src/audit/append-irs-tax-collected.ts`

**Imports pattern** (lines 1–13):
```typescript
/**
 * Phase 45 (IRS-03) — Sole-producer for irs.disbursement_authorized.
 *
 * Closed 5-key payload: {amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick}.
 * actorDid = authorized_by_civic_did_hash (Government Speaker civic-did hash).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
```

**Interface + EXPECTED_KEYS pattern** (lines 15–27 of analog):
```typescript
/** Closed 5-key payload. Keys ALPHABETICAL. */
export interface IrsDisbursementAuthorizedPayload {
    readonly amount_bios: number;                        // positive integer (>0)
    readonly authorized_by_civic_did_hash: string;       // HEX64_RE — Government Speaker civic-did sha256
    readonly grid_name: string;                          // non-empty
    readonly legislation_ref_hash: string;               // HEX64_RE — sha256(legislation_ref plaintext)
    readonly tick: number;                               // non-negative integer
}

const EXPECTED_KEYS = ['amount_bios', 'authorized_by_civic_did_hash', 'grid_name', 'legislation_ref_hash', 'tick'] as const;
```

**9-step discipline core pattern** (lines 29–82 of `append-irs-tax-collected.ts`):
```typescript
export function appendIrsDisbursementAuthorized(
    audit: AuditChain,
    payload: IrsDisbursementAuthorizedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: payload must be a plain object`);
    }
    // 2. Regex: authorized_by_civic_did_hash (HEX64).
    if (typeof payload.authorized_by_civic_did_hash !== 'string' || !HEX64_RE.test(payload.authorized_by_civic_did_hash)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: authorized_by_civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.authorized_by_civic_did_hash)}`);
    }
    // 3. Regex: legislation_ref_hash (HEX64).
    if (typeof payload.legislation_ref_hash !== 'string' || !HEX64_RE.test(payload.legislation_ref_hash)) {
        throw new TypeError(`appendIrsDisbursementAuthorized: legislation_ref_hash must match HEX64_RE, got ${JSON.stringify(payload.legislation_ref_hash)}`);
    }
    // 4. Non-empty string: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: grid_name must be non-empty string, got ${JSON.stringify(payload.grid_name)}`);
    }
    // 5. Positive integer: amount_bios.
    if (!Number.isInteger(payload.amount_bios) || payload.amount_bios <= 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: amount_bios must be positive integer, got ${JSON.stringify(payload.amount_bios)}`);
    }
    // 6. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendIrsDisbursementAuthorized: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 7. Closed-tuple structural check (alphabetical order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendIrsDisbursementAuthorized: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 8. Explicit reconstruction — no spread.
    const cleanPayload = {
        amount_bios: payload.amount_bios,
        authorized_by_civic_did_hash: payload.authorized_by_civic_did_hash,
        grid_name: payload.grid_name,
        legislation_ref_hash: payload.legislation_ref_hash,
        tick: payload.tick,
    };
    // 9. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendIrsDisbursementAuthorized: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit. actorDid = authorized_by_civic_did_hash.
    return audit.append('irs.disbursement_authorized', payload.authorized_by_civic_did_hash, cleanPayload);
}
```

**Key differences from `append-irs-tax-collected.ts`:**
- Two HEX64 regex guards (not UUID + HEX64)
- Step numbering: steps 2/3 are both HEX64 checks; step 4 is non-empty string; step 5 is positive integer
- Event type string: `'irs.disbursement_authorized'`
- actorDid: `authorized_by_civic_did_hash` (not `payer_civic_did_hash`)

---

### `grid/src/audit/broadcast-allowlist.ts` (config, transform) — MODIFY

**Analog:** self

**Where to insert** (after line 300, after `'market.disputed', // (72)`):
```typescript
    // Phase 45 (IRS-04) — IRS treasury lifecycle events. Allowlist 72 → 75.
    // irs.tax_collected (73): pre-empted in Phase 44 (D-44-03); Phase 45 promotes to broadcast.
    //   Sole-producer: grid/src/audit/append-irs-tax-collected.ts
    //   Closed 5-key payload: {amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}
    // irs.disbursement_authorized (74): NEW in Phase 45 — Government-signed legislation authorization.
    //   Sole-producer: grid/src/audit/append-irs-disbursement-authorized.ts (Phase 45 creates)
    //   Closed 5-key payload: {amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick}
    // irs.disbursement_executed (75): pre-empted in Phase 41 (SLEEP-05); Phase 45 promotes to broadcast.
    //   Sole-producer: grid/src/audit/append-irs-disbursement-executed.ts
    //   Closed 5-key payload: {amount_bios, cause, civic_did, grid_name, tick}
    'irs.tax_collected',           // (73)
    'irs.disbursement_authorized', // (74) NEW
    'irs.disbursement_executed',   // (75)
```

**Comment to update** (line 24, header comment):
- Change `Phase 44)` to `Phase 44 + Phase 45)` and `exactly these 72 event types` to `exactly these 75 event types`

---

### `grid/src/api/routes/irs.ts` (route, request-response) — NEW FILE

**Analog:** `grid/src/api/routes/market.ts`

**Imports pattern** (lines 22–32 of market.ts):
```typescript
/**
 * Phase 45 IRS-01..04 — IRS Treasury routes.
 *
 * Routes registered:
 *  1. GET  /api/v1/irs/treasury              public (Cache-Control: max-age=10)
 *  2. POST /api/v1/irs/disburse              government_only
 *  3. GET  /api/v1/irs/audit/:period         public
 */
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { GridServices } from '../server.js';
import { createHash } from 'node:crypto';
import { appendIrsDisbursementAuthorized } from '../../audit/append-irs-disbursement-authorized.js';
import { appendIrsDisbursementExecuted } from '../../audit/append-irs-disbursement-executed.js';
import { verifyDisbursementAuth } from '../../civic-registry/government-session.js';
import { IrsStore } from '../../irs/irs-store.js';
```

**Function signature pattern** (lines 57–60 of market.ts):
```typescript
export async function registerIrsRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**GET /api/v1/irs/treasury pattern** (modeled on market.ts lines 63–87):
```typescript
    // ── GET /api/v1/irs/treasury (public, Cache-Control: max-age=10) ─────────
    app.get('/api/v1/irs/treasury', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT balance_bios, last_updated_tick FROM civic_treasury WHERE grid_name = ?`,
            [services.gridName],
        );
        const [rateRows] = await pool.query<RowDataPacket[]>(
            `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = 'irs_fee_rate'`,
            [services.gridName],
        );
        const rateRaw = rateRows[0]?.config_value ?? '0.02';
        const currentRatePercent = Number.parseFloat(String(rateRaw)) * 100;

        void reply.header('Cache-Control', 'public, max-age=10');
        return reply.code(200).send({
            balance_bios: String(rows[0]?.balance_bios ?? 0),
            last_updated_tick: rows[0]?.last_updated_tick ?? 0,
            current_rate_percent: currentRatePercent,
        });
    });
```

**POST /api/v1/irs/disburse pattern** (government auth modeled on `verifyGovernmentSession` in government-session.ts lines 35–56):
```typescript
    // ── POST /api/v1/irs/disburse (government_only) ─────────────────────────
    app.post<{ Body: { amount_bios?: unknown; recipient_note?: unknown } }>(
        '/api/v1/irs/disburse', async (req, reply) => {
        const pool = services.pool;
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!pool || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        // Government authorization — verifyDisbursementAuth checks legislation_ref claim
        const authResult = await verifyDisbursementAuth(req.headers.authorization);
        if (!authResult.ok) {
            return reply.code(403).send({ error: authResult.reason });
        }
        const { legislationRef } = authResult;

        const body = req.body ?? {};
        let amountBios: bigint;
        try { amountBios = BigInt(body.amount_bios as string | number); } catch {
            return reply.code(400).send({ error: 'invalid_amount' });
        }
        if (amountBios <= 0n) return reply.code(400).send({ error: 'invalid_amount' });

        const currentTick = tickFn();
        const store = new IrsStore(pool);

        // Emit authorized BEFORE DB deduction (authorization is the signing event)
        appendIrsDisbursementAuthorized(audit, {
            amount_bios: Number(amountBios),
            authorized_by_civic_did_hash: sha256Hex(GOV_SESSION_ISSUER_DID),
            grid_name: services.gridName,
            legislation_ref_hash: sha256Hex(legislationRef),
            tick: currentTick,
        });

        let newBalance: bigint;
        try {
            ({ newBalance } = await store.disburse({
                gridName: services.gridName,
                amountBios,
                legislationRef,
                currentTick,
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            if (msg === 'insufficient_treasury_balance') return reply.code(402).send({ error: 'insufficient_treasury_balance' });
            req.log.error({ err: msg }, 'irs_disburse_unhandled');
            return reply.code(500).send({ error: 'internal' });
        }

        // Emit executed AFTER DB commit
        appendIrsDisbursementExecuted(audit, {
            amount_bios: Number(amountBios),
            cause: 'government_disbursement',
            civic_did: GOV_SESSION_ISSUER_DID,
            grid_name: services.gridName,
            tick: currentTick,
        });

        return reply.code(200).send({
            disbursed: true,
            new_balance_bios: newBalance.toString(),
        });
    });
```

**GET /api/v1/irs/audit/:period pattern** (MySQL direct query, not AuditChain.query()):
```typescript
    // ── GET /api/v1/irs/audit/:period (public) ──────────────────────────────
    // period format: "<fromTick>-<toTick>" or "current" (last 1000 events)
    app.get<{ Params: { period: string } }>(
        '/api/v1/irs/audit/:period', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const { period } = req.params;
        let fromTick: number;
        let toTick: number;
        if (period === 'current') {
            toTick = (services.currentTick?.() ?? 0);
            fromTick = Math.max(0, toTick - 1000);
        } else {
            const parts = period.split('-');
            if (parts.length !== 2) return reply.code(400).send({ error: 'invalid_period' });
            fromTick = parseInt(parts[0], 10);
            toTick   = parseInt(parts[1], 10);
            if (!Number.isFinite(fromTick) || !Number.isFinite(toTick) || fromTick > toTick) {
                return reply.code(400).send({ error: 'invalid_period' });
            }
        }

        const IRS_EVENT_TYPES = ['irs.tax_collected', 'irs.disbursement_authorized', 'irs.disbursement_executed'];
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, event_type, actor_did, payload, created_at
             FROM audit_trail
             WHERE grid_name = ? AND event_type IN (?, ?, ?)
               AND created_at >= ? AND created_at <= ?
             ORDER BY id ASC
             LIMIT 500`,
            [services.gridName, ...IRS_EVENT_TYPES, fromTick, toTick],
        );
        return reply.code(200).send({ events: rows });
    });
```

---

### `grid/src/irs/irs-store.ts` (service, CRUD) — NEW FILE

**Analog:** `grid/src/marketplace/marketplace-store.ts` (especially `settle()` at lines 306–394)

**Class scaffold pattern:**
```typescript
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class IrsStore {
    constructor(private readonly pool: Pool) {}

    async getTreasuryBalance(gridName: string): Promise<{
        balance_bios: string;
        last_updated_tick: number;
        current_rate_percent: number;
    }> { ... }

    async disburse(params: {
        gridName: string;
        amountBios: bigint;
        legislationRef: string;
        currentTick: number;
    }): Promise<{ newBalance: bigint }> { ... }

    async getAuditHistory(params: {
        gridName: string;
        fromTick: number;
        toTick: number;
    }): Promise<RowDataPacket[]> { ... }
}
```

**Atomic disbursement pattern** (copy from `marketplace-store.ts` lines 329–394):
```typescript
    async disburse(params) {
        // Read config OUTSIDE transaction (Pitfall 1 from Phase 44 RESEARCH)
        // No fee rate needed for disburse — amount is passed in by caller

        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            // FOR UPDATE row lock
            const [treasuryRows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_bios FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
                [params.gridName],
            );
            const currentBalance = BigInt(treasuryRows[0]?.balance_bios ?? 0);
            if (currentBalance < params.amountBios) {
                await conn.rollback();
                throw new Error('insufficient_treasury_balance');
            }
            await conn.query(
                `UPDATE civic_treasury SET balance_bios = balance_bios - ?, last_updated_tick = ?
                 WHERE grid_name = ?`,
                [params.amountBios.toString(), params.currentTick, params.gridName],
            );
            // Optional: insert into irs_disbursements if migration v36 adds the table
            await conn.commit();
            return { newBalance: currentBalance - params.amountBios };
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore */ }
            throw err;
        } finally {
            conn.release();
        }
    }
```

**Error propagation pattern** (from `marketplace-store.ts` lines 388–393):
```typescript
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
```

---

### `grid/src/civic-registry/government-session.ts` (utility, request-response) — MODIFY

**Analog:** self (lines 1–56)

**New function to add** (mirrors `verifyGovernmentSession` exactly, checks `legislation_ref` instead of `court_conviction_ref`):
```typescript
export type DisbursementAuthResult =
    | { ok: true; legislationRef: string }
    | { ok: false; reason: 'legislation_auth_required' | 'legislation_ref_required' };

/**
 * Verify a government disbursement authorization JWT.
 * Mirrors verifyGovernmentSession() but checks payload.legislation_ref
 * instead of court_conviction_ref (disbursements are not court orders — D-V3-21).
 */
export async function verifyDisbursementAuth(
    authHeader: string | undefined,
): Promise<DisbursementAuthResult> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, reason: 'legislation_auth_required' };
    }
    const token = authHeader.substring('Bearer '.length);
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        if (payload.iss !== GOV_SESSION_ISSUER_DID) {
            return { ok: false, reason: 'legislation_auth_required' };
        }
        const ref = payload['legislation_ref'];
        if (typeof ref !== 'string' || ref.length === 0) {
            return { ok: false, reason: 'legislation_ref_required' };
        }
        return { ok: true, legislationRef: ref };
    } catch {
        return { ok: false, reason: 'legislation_auth_required' };
    }
}
```

---

### `grid/src/api/policy.ts` (config, request-response) — MODIFY

**Analog:** self (lines 259–268 for Phase 44 MKT pattern)

**Entries to add** (after Phase 44 block, before closing `}` at line 268):
```typescript
    // Phase 45 (IRS-01..04) — IRS treasury routes.
    // GET /api/v1/irs/treasury: public per SC-2 (no auth required, Cache-Control: max-age=10).
    // POST /api/v1/irs/disburse: government_only — requires Government authorization signature per D-V3-21.
    // GET /api/v1/irs/audit/:period: public per SC-4 (public transparency required).
    'GET /api/v1/irs/treasury':        'public',
    'POST /api/v1/irs/disburse':       'government_only',
    'GET /api/v1/irs/audit/:period':   'public',
```

---

### `grid/src/api/server.ts` (config, request-response) — MODIFY

**Analog:** self (lines 38 and 732 for `registerMarketRoutes` pattern)

**Import to add** (after market.ts import line 38):
```typescript
import { registerIrsRoutes } from './routes/irs.js';
```

**Registration to add** (after `void registerMarketRoutes(app, services);` line 732):
```typescript
    void registerIrsRoutes(app, services);
```

---

### `grid/src/db/schema.ts` (migration, CRUD) — MODIFY (if irs_disbursements table needed)

**Analog:** self (lines 690–712 for v35 migration pattern)

**Migration v36 pattern** (if `irs_disbursements` table is added per Open Question 3 in RESEARCH.md):
```typescript
    {
        version: 36,
        name: 'irs_disbursements',
        up: `
            CREATE TABLE IF NOT EXISTS irs_disbursements (
                disbursement_id     VARCHAR(36)     NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                amount_bios         BIGINT          NOT NULL,
                legislation_ref     VARCHAR(512)    NOT NULL,
                authorized_at_tick  INT             NOT NULL DEFAULT 0,
                executed_at_tick    INT             NOT NULL DEFAULT 0,
                PRIMARY KEY (disbursement_id),
                KEY idx_irs_disbursements_grid (grid_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS irs_disbursements`,
    },
```

---

### `grid/test/irs-routes.test.ts` (test, request-response) — NEW FILE

**Analog:** `grid/test/market-routes.test.ts` (lines 1–92 for buildApp scaffold)

**Test file scaffold** (copy buildApp pattern from market-routes.test.ts lines 1–92):
```typescript
/**
 * Phase 45 IRS-02..04 — IRS route integration tests.
 *
 * Covers:
 *  - GET /api/v1/irs/treasury: 200 public, returns balance/rate fields
 *  - GET /api/v1/irs/treasury: 503 when pool unavailable
 *  - POST /api/v1/irs/disburse: 403 without government JWT
 *  - POST /api/v1/irs/disburse: 403 with invalid government JWT
 *  - POST /api/v1/irs/disburse: 400 invalid_amount on non-numeric body
 *  - POST /api/v1/irs/disburse: 402 insufficient_treasury_balance
 *  - POST /api/v1/irs/disburse: 200 + both audit events emitted (authorized + executed)
 *  - GET /api/v1/irs/audit/:period: 200 returns events array (public)
 *  - GET /api/v1/irs/audit/:period: 400 on invalid period format
 *  - GET /api/v1/irs/audit/current: 200 alias works
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../src/audit/chain.js';
import { registerIrsRoutes } from '../src/api/routes/irs.js';
import type { GridServices } from '../src/api/server.js';

async function buildApp(opts: {
    poolQuery?: (...args: unknown[]) => Promise<unknown>;
    getConnectionImpl?: () => unknown;
    mockGovJwt?: string | null;  // null = no auth header
}): Promise<{ app: FastifyInstance; audit: AuditChain }> {
    const audit = new AuditChain();
    const mockPoolQuery = opts.poolQuery ?? (async () => [[]] as unknown);
    const mockPool = {
        query: vi.fn(mockPoolQuery),
        getConnection: vi.fn(opts.getConnectionImpl ?? async () => ({
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async () => [[]]),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        })),
    };

    const services: Partial<GridServices> = {
        audit,
        gridName: 'Genesis',
        currentTick: () => 100,
        pool: mockPool as unknown as import('mysql2/promise').Pool,
    };

    const app = Fastify({ logger: false });
    if (opts.mockGovJwt !== undefined) {
        app.addHook('onRequest', async (req) => {
            if (opts.mockGovJwt) {
                req.headers.authorization = `Bearer ${opts.mockGovJwt}`;
            }
        });
    }

    await registerIrsRoutes(app, services as GridServices);
    await app.ready();
    return { app, audit };
}
```

**Key test cases to cover** (modeled on market-routes.test.ts assertions):
```typescript
describe('GET /api/v1/irs/treasury (public)', () => {
    it('returns 200 with balance/rate fields (no auth required)', async () => { ... });
    it('returns 503 when pool unavailable', async () => { ... });
    it('returns 200 with balance_bios=0 when civic_treasury row absent (NULL handling)', async () => { ... });
});

describe('POST /api/v1/irs/disburse (government_only)', () => {
    it('returns 403 legislation_auth_required without Authorization header', async () => { ... });
    it('returns 400 invalid_amount for non-numeric amount_bios', async () => { ... });
    it('returns 402 insufficient_treasury_balance when balance too low', async () => { ... });
    it('emits irs.disbursement_authorized THEN irs.disbursement_executed on success', async () => {
        // Critical: checks audit chain has both events in correct order
    });
});

describe('GET /api/v1/irs/audit/:period (public)', () => {
    it('returns 200 with events array', async () => { ... });
    it('returns 400 for invalid period format', async () => { ... });
    it('returns 200 for period=current', async () => { ... });
});
```

---

### `grid/test/append-irs-disbursement-authorized.test.ts` (test, event-driven) — NEW FILE

**Analog:** `grid/test/append-irs-tax-collected.test.ts` (lines 1–122)

**Complete test structure** (copy exactly from analog, adapting payload shape):
```typescript
/**
 * Phase 45 (IRS-03) — append-irs-disbursement-authorized sole-producer test.
 *
 * Event: irs.disbursement_authorized (on broadcast allowlist at position 74)
 * Keys (alphabetical): amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick
 * Sole producer: grid/src/audit/append-irs-disbursement-authorized.ts
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('appendIrsDisbursementAuthorized — 9-step guard discipline', () => {
    let appendIrsDisbursementAuthorized: (audit: any, payload: any) => any;
    let mockAudit: () => any;

    beforeAll(async () => {
        const mod = await import('../src/audit/append-irs-disbursement-authorized.js');
        appendIrsDisbursementAuthorized = mod.appendIrsDisbursementAuthorized;
        mockAudit = () => {
            const entry = { id: 5n, tick: 0, event_type: 'irs.disbursement_authorized', actor_did: 'x', payload: {}, prev_hash: '', this_hash: '' };
            return { append: vi.fn(() => entry) };
        };
    });

    const VALID_HEX64 = 'd'.repeat(64);

    const validPayload = {
        amount_bios: 500,
        authorized_by_civic_did_hash: VALID_HEX64,
        grid_name: 'Genesis',
        legislation_ref_hash: 'a'.repeat(64),
        tick: 42,
    };

    // Tests mirror append-irs-tax-collected.test.ts structure:
    // - rejects non-object payload
    // - rejects extra key (closed-tuple violation)
    // - rejects missing key
    // - rejects invalid HEX64 for authorized_by_civic_did_hash
    // - rejects invalid HEX64 for legislation_ref_hash
    // - rejects non-positive amount_bios (0, -1)
    // - rejects negative tick
    // - rejects empty grid_name
    // - accepts valid payload and calls audit.append with correct event_type
    // - verifies payload reaches chain with exactly the closed tuple (alphabetical keys)
    // - accepts tick=0 (boundary)
});
```

---

### `grid/test/audit/broadcast-allowlist.test.ts` (test, transform) — MODIFY

**Analog:** self (lines 11–16 for count assertions)

**Updates required** (3 changes):

1. Line 11: Change `72` to `75` in the test description string:
```typescript
    it('has exactly 75 locked v1+...+Phase 44+Phase 45 event types', () => {
        expect(ALLOWLIST.size).toBe(75);
    });
```

2. Line 15: Update frozen count assertion:
```typescript
    it('has frozen 75-member allowlist (ALLOWLIST_MEMBERS array length)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(75);
    });
```

3. Add new describe block after Phase 44 block (line 270):
```typescript
describe('ALLOWLIST_MEMBERS Phase 45 (IRS-04)', () => {
    it('Phase 45 allowlist grows to 75 with 3 IRS additions (72 → 75)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(75);
        expect(ALLOWLIST_MEMBERS).toContain('irs.tax_collected');
        expect(ALLOWLIST_MEMBERS).toContain('irs.disbursement_authorized');
        expect(ALLOWLIST_MEMBERS).toContain('irs.disbursement_executed');
    });

    it('irs.tax_collected is at position 73 (index 72)', () => {
        expect(ALLOWLIST_MEMBERS[72]).toBe('irs.tax_collected');
    });

    it('irs.disbursement_authorized is at position 74 (index 73)', () => {
        expect(ALLOWLIST_MEMBERS[73]).toBe('irs.disbursement_authorized');
    });

    it('irs.disbursement_executed is at position 75 (index 74)', () => {
        expect(ALLOWLIST_MEMBERS[74]).toBe('irs.disbursement_executed');
    });

    it('Phase 45 IRS entries appear in order after market.disputed', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('market.disputed')).toBeLessThan(idx('irs.tax_collected'));
        expect(idx('irs.tax_collected')).toBeLessThan(idx('irs.disbursement_authorized'));
        expect(idx('irs.disbursement_authorized')).toBeLessThan(idx('irs.disbursement_executed'));
    });
});
```

---

## Shared Patterns

### Government JWT Verification
**Source:** `grid/src/civic-registry/government-session.ts` lines 35–56
**Apply to:** `grid/src/api/routes/irs.ts` (POST /disburse), `grid/src/civic-registry/government-session.ts` (add `verifyDisbursementAuth`)

The existing `verifyGovernmentSession()` pattern is the exact template. `verifyDisbursementAuth()` replaces `court_conviction_ref` with `legislation_ref` and uses different error reason strings. Both functions:
- Check `authHeader?.startsWith('Bearer ')`
- Use `keyPairPromise` from `../api/portal/auth.js`
- Verify `payload.iss === GOV_SESSION_ISSUER_DID`
- Return typed discriminated union result

```typescript
// From government-session.ts lines 37–56 — copy and adapt:
export async function verifyGovernmentSession(
    authHeader: string | undefined,
): Promise<GovernmentSessionResult> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, reason: 'court_order_required' };
    }
    const token = authHeader.substring('Bearer '.length);
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        if (payload.iss !== GOV_SESSION_ISSUER_DID) {
            return { ok: false, reason: 'court_order_required' };
        }
        const ref = payload['court_conviction_ref'];   // ← change to 'legislation_ref'
        if (typeof ref !== 'string' || ref.length === 0) {
            return { ok: false, reason: 'court_conviction_ref_required' };  // ← change reason string
        }
        return { ok: true, courtConvictionRef: ref };  // ← change field name
    } catch {
        return { ok: false, reason: 'court_order_required' };
    }
}
```

### Audit Emission After DB Commit (Pitfall 4)
**Source:** `grid/src/api/routes/market.ts` lines 164–172, 225–232
**Apply to:** `grid/src/api/routes/irs.ts`

All audit events fire AFTER the DB write commits:
```typescript
// CORRECT — from market.ts:
listingId = await store.createListing({...});
// Emit AFTER DB write (Pitfall 4).
appendMarketListingCreated(audit, {...});
return reply.code(201).send({ listing_id: listingId });
```

**Exception for IRS disburse:** `irs.disbursement_authorized` fires at JWT-verification time (authorization is a signing event), BEFORE the DB transaction. `irs.disbursement_executed` fires AFTER `conn.commit()`. This is the correct order per RESEARCH.md Anti-Patterns.

### Atomic Transaction Pattern (FOR UPDATE)
**Source:** `grid/src/marketplace/marketplace-store.ts` lines 329–394
**Apply to:** `grid/src/irs/irs-store.ts` `disburse()`

Template: `getConnection()` → `beginTransaction()` → `FOR UPDATE` lock → balance check → `UPDATE` → `commit()` → `release()` in `finally`. Error path: `rollback()` in `catch`, `release()` in `finally`.

### Error Response Format
**Source:** `grid/src/api/routes/market.ts` (throughout)
**Apply to:** `grid/src/api/routes/irs.ts`

```typescript
// Consistent format across all routes:
return reply.code(400).send({ error: 'invalid_amount' });
return reply.code(402).send({ error: 'insufficient_treasury_balance' });
return reply.code(403).send({ error: 'legislation_auth_required' });
return reply.code(503).send({ error: 'db_unavailable' });
return reply.code(500).send({ error: 'internal' });
```

Log unhandled errors with `req.log.error({ err: msg }, 'irs_disburse_unhandled')` before returning 500.

### sha256Hex Helper
**Source:** `grid/src/api/routes/market.ts` lines 44–46
**Apply to:** `grid/src/api/routes/irs.ts`

```typescript
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}
```

### Route Registration Pattern
**Source:** `grid/src/api/server.ts` lines 38, 732
**Apply to:** `grid/src/api/server.ts` (add IRS route import + registration)

Pattern: import `registerXxxRoutes` at top (line ~38), call `void registerXxxRoutes(app, services)` in `buildServer()` body (line ~732, after market routes).

### pool.query ServiceAvailability Guard
**Source:** `grid/src/api/routes/market.ts` lines 65–67
**Apply to:** All three IRS routes

```typescript
const pool = services.pool;
if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
```

For routes that also need tick and audit:
```typescript
const pool = services.pool;
const tickFn = services.currentTick;
const audit = services.audit;
if (!pool || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have close analogs in the codebase |

---

## Critical Notes for Planner

1. **`irs.disbursement_executed` payload reuse (Pitfall 3):** The existing `appendIrsDisbursementExecuted` uses `civic_did` (full DID string, not hash) with `CIVIC_DID_RE`. Phase 45 calls it with `cause='government_disbursement'` and `civic_did=GOV_SESSION_ISSUER_DID` (`'did:gov:noesis:genesis-polis'`). Do NOT change the payload shape — Phase 41 tests will break.

2. **Double-emit is correct, not a bug:** After Phase 45, `appendIrsDisbursementExecuted` has two callers: `escalation-check.ts` (Phase 41, cause='presumed_departed') and `irs.ts` (Phase 45, cause='government_disbursement'). The CI gate `check-sole-producer-discipline.mjs` checks that `audit.append('irs.disbursement_executed', ...)` only appears in the sole-producer file — both callers use the function, not the raw `audit.append` call.

3. **Wave 0 RED gate:** Update `broadcast-allowlist.test.ts` count from `72` → `75` FIRST (makes test RED), then add 3 events to `ALLOWLIST_MEMBERS` (turns GREEN). Never modify in reverse order.

4. **civic_treasury NULL handling:** If no marketplace settlement has occurred since migration v35, the `SELECT` on `civic_treasury` returns no rows. Routes must handle `rows[0] ?? null` and default to `balance_bios: '0'`.

5. **`IrsStore` location:** RESEARCH.md shows `grid/src/irs/irs-store.ts` (not `grid/src/db/stores/`). Create the `grid/src/irs/` directory. This is consistent with `grid/src/marketplace/marketplace-store.ts` living in its own domain directory.

---

## Metadata

**Analog search scope:** `grid/src/audit/`, `grid/src/api/routes/`, `grid/src/api/`, `grid/src/marketplace/`, `grid/src/civic-registry/`, `grid/src/db/`, `grid/test/`
**Files scanned:** 14 source files, 6 test files
**Pattern extraction date:** 2026-05-28
