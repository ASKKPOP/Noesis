# L3 — Orbital-Object Reality (built objects become real) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Make the built object **real**. A *settled* procurement contract (L2) produces a persistent `orbital_object` — owned by the commons, attributed to its builder, costed at the award, carrying its physics spec and **function output** — and only if its spec passes a **server-side physics gate** against the Grid's `GridEnvironment`. This is the thesis the deep-scan demanded: objects backed by the economy and obeying physics, not cosmetic localStorage sprites.

**Architecture:** Two slices.
- **L3a (this plan, Tasks 1–3):** TS server-side physics gate `object-physics.ts` (port of the F0 browser `physics-gate.js`, reading the grid-side `GridEnvironment` from F0b); migration **v51** `orbital_objects`; `OrbitalObjectStore.createFromContract` (validates physics vs the env → verifies the contract is `settled` and not already built → inserts the object, owner = the commons, builder = contract winner, cost = award) + `listObjects` / `getObject`. Mock-Pool tested, no audit yet.
- **L3b (next):** `orbital.object_built` audit event (allowlist 116 → 117) + wire emit.
- **L4 (next):** `GET /api/v1/orbital/objects` + Grid-Viz renders real objects from the backend — closes the visible loop.

**Design decisions (model-first):** A procurement-built object belongs to the **commons** (`owner_did = 'did:civic:noesis:treasury'` — the Polis paid for it) and is attributed to its **builder** (`builder_did = contract.winner_did`); `build_cost_wei = contract.award_wei`. One object per settled contract (UNIQUE `provenance_contract_id`). Physics is validated against the grid's `GridEnvironment` (default `EARTH_ORBIT` for Genesis; the caller passes the right env for other grids) — same laws as F0, now enforced server-side so a law-breaker can never be persisted.

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), MySQL `mysql2/promise`, Vitest mock-Pool. wei `bigint` (DECIMAL(65,0)). Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** no object persisted unless physics-valid (server-side gate); built only from a `settled` contract; one object per contract; commons-owned, builder-attributed; allowlist +0 in L3a (event in L3b). Existing suites stay green.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/economy/object-physics.ts` | TS server-side physics gate `checkObjectPhysics(spec, env)`. | **Create** |
| `grid/src/db/schema.ts` | Append migration **v51** `orbital_objects`. | **Modify** |
| `grid/src/economy/orbital-object-store.ts` | `OrbitalObjectStore`: createFromContract / listObjects / getObject. | **Create** |
| `grid/test/economy/object-physics.test.ts` · `orbital-object-store.test.ts` | L3a unit tests. | **Create** |

---

## Task 1: Server-side physics gate (`object-physics.ts`)

**Files:** Create `grid/src/economy/object-physics.ts` + `grid/test/economy/object-physics.test.ts`.

This ports the F0 browser gate (`dashboard/public/grid-viz/physics-gate.js`) to TS, reading the grid-side `GridEnvironment` (`grid/src/registry/grid-environments.ts`, from F0b). Same six laws; orbital floor from `env.min_stable_altitude_km` plus the universal `altitude_km <= 0` rejection.

- [ ] **Step 1: Write failing tests** — create `grid/test/economy/object-physics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkObjectPhysics } from '../../src/economy/object-physics.js';
import { EARTH_ORBIT, GRID_ENVIRONMENTS } from '../../src/registry/grid-environments.js';

function valid(over: Record<string, number> = {}) {
    return { mass_kg: 1000, massIn_kg: 5, massOut_kg: 5, energyIn_J: 1000, energyOut_J: 900,
        load_N: 200, yield_N: 500, dissipated_W: 50, radiated_W: 80, generation_W: 120, consumption_W: 100, altitude_km: 420, ...over };
}

describe('checkObjectPhysics (server-side)', () => {
    it('a valid spec passes (default Earth-orbit), reports env', () => {
        const r = checkObjectPhysics(valid());
        expect(r.ok).toBe(true);
        expect(r.violations).toEqual([]);
        expect(r.env).toBe('Earth-orbit');
    });
    it('rejects net mass creation', () => { expect(checkObjectPhysics(valid({ massOut_kg: 6 })).violations).toContain('mass'); });
    it('rejects net energy creation', () => { expect(checkObjectPhysics(valid({ energyOut_J: 1001 })).violations).toContain('energy'); });
    it('rejects structural overload', () => { expect(checkObjectPhysics(valid({ load_N: 600 })).violations).toContain('structural'); });
    it('rejects thermal runaway', () => { expect(checkObjectPhysics(valid({ radiated_W: 40 })).violations).toContain('thermal'); });
    it('rejects power deficit', () => { expect(checkObjectPhysics(valid({ generation_W: 90 })).violations).toContain('power'); });
    it('rejects an orbit below the Earth floor (160) and at/below surface', () => {
        expect(checkObjectPhysics(valid({ altitude_km: 50 })).violations).toContain('orbital');
        expect(checkObjectPhysics(valid({ altitude_km: 0 })).violations).toContain('orbital');
    });
    it('the same low orbit holds on the Moon (floor 15)', () => {
        const r = checkObjectPhysics(valid({ altitude_km: 50 }), GRID_ENVIRONMENTS['Moon']);
        expect(r.ok).toBe(true);
        expect(r.env).toBe('Moon');
    });
    it('rejects dimensional nonsense (missing / NaN field)', () => {
        expect(checkObjectPhysics(valid({ mass_kg: NaN })).violations).toContain('dimensional');
        const spec = valid(); delete (spec as Record<string, number>).yield_N;
        expect(checkObjectPhysics(spec).violations).toContain('dimensional');
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/object-physics.test.ts` → FAIL.

- [ ] **Step 3: Create `grid/src/economy/object-physics.ts`**:

```ts
/**
 * L3 — server-side physics gate. The grid-side port of the F0 browser gate
 * (dashboard/public/grid-viz/physics-gate.js): an object spec that violates
 * physical / structural law is REJECTED before it can ever be persisted as a
 * real orbital_object. "Physics wins" (PHILOSOPHY) enforced on the server.
 *
 * Reads the grid-side GridEnvironment (F0b) so the orbital floor is body-specific.
 * Keep in sync with the browser gate.
 */
import { type GridEnvironment, EARTH_ORBIT } from '../registry/grid-environments.js';

const REQUIRED = [
    'mass_kg', 'massIn_kg', 'massOut_kg', 'energyIn_J', 'energyOut_J',
    'load_N', 'yield_N', 'dissipated_W', 'radiated_W',
    'generation_W', 'consumption_W', 'altitude_km',
] as const;

export type ObjectPhysicsSpec = Partial<Record<(typeof REQUIRED)[number], number>>;

function finiteNonNeg(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }

export function checkObjectPhysics(spec: ObjectPhysicsSpec, env: GridEnvironment = EARTH_ORBIT): { ok: boolean; violations: string[]; env: string } {
    const v: string[] = [];

    // 6. Dimensional sanity — every required field present, finite, non-negative (altitude may be negative → checked in law 5).
    for (const k of REQUIRED) {
        const val = spec[k];
        if (val === undefined) { v.push('dimensional'); continue; }
        if (k === 'altitude_km') { if (typeof val !== 'number' || !Number.isFinite(val)) v.push('dimensional'); }
        else if (!finiteNonNeg(val)) v.push('dimensional');
    }
    // 1. Conservation of mass / energy.
    if (finiteNonNeg(spec.massOut_kg) && finiteNonNeg(spec.massIn_kg) && spec.massOut_kg > spec.massIn_kg) v.push('mass');
    if (finiteNonNeg(spec.energyOut_J) && finiteNonNeg(spec.energyIn_J) && spec.energyOut_J > spec.energyIn_J) v.push('energy');
    // 2. Structural integrity.
    if (finiteNonNeg(spec.load_N) && finiteNonNeg(spec.yield_N) && spec.load_N > spec.yield_N) v.push('structural');
    // 3. Thermal balance.
    if (finiteNonNeg(spec.radiated_W) && finiteNonNeg(spec.dissipated_W) && spec.radiated_W < spec.dissipated_W) v.push('thermal');
    // 4. Power budget.
    if (finiteNonNeg(spec.generation_W) && finiteNonNeg(spec.consumption_W) && spec.generation_W < spec.consumption_W) v.push('power');
    // 5. Orbital mechanics — inside the body (≤0, universal) or below this body's stable floor.
    const floor = (env && Number.isFinite(env.min_stable_altitude_km)) ? env.min_stable_altitude_km : 0;
    if (typeof spec.altitude_km === 'number' && Number.isFinite(spec.altitude_km)
        && (spec.altitude_km <= 0 || spec.altitude_km < floor)) v.push('orbital');

    const violations = Array.from(new Set(v));
    return { ok: violations.length === 0, violations, env: (env && env.name) || 'Earth-orbit' };
}
```

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/object-physics.test.ts` → all pass.

- [ ] **Step 5: Commit**

```bash
git add grid/src/economy/object-physics.ts grid/test/economy/object-physics.test.ts
git commit -m "feat(grid): L3a server-side physics gate (TS port of F0, reads GridEnvironment)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Migration v51 — `orbital_objects`

**Files:** Modify `grid/src/db/schema.ts`; migration test in `orbital-object-store.test.ts` (Task 3).

- [ ] **Step 1: Append migration v51** to `MIGRATIONS` in `grid/src/db/schema.ts`:

```ts
    {
        version: 51,
        name: 'create_orbital_objects',
        up: `
            CREATE TABLE IF NOT EXISTS orbital_objects (
                object_id              CHAR(36)      NOT NULL,
                grid_name              VARCHAR(63)   NOT NULL,
                owner_did              VARCHAR(255)  NOT NULL,
                builder_did            VARCHAR(255)  NOT NULL,
                build_cost_wei         DECIMAL(65,0) NOT NULL,
                function_type          VARCHAR(63)   NOT NULL,
                output_rate            BIGINT        NOT NULL DEFAULT 0,
                physics_spec           TEXT          NOT NULL,
                provenance_contract_id CHAR(36)      NOT NULL,
                zone                   VARCHAR(63)   NOT NULL,
                status                 ENUM('active','decommissioned') NOT NULL DEFAULT 'active',
                created_at             BIGINT        NOT NULL,
                updated_at             BIGINT        NOT NULL,
                PRIMARY KEY (object_id),
                UNIQUE KEY uniq_provenance (provenance_contract_id),
                INDEX idx_grid (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS orbital_objects`,
    },
```

- [ ] **Step 2: Commit** (with Task 3, or alone — your call). If alone:

```bash
git add grid/src/db/schema.ts
git commit -m "feat(grid): L3a migration v51 — orbital_objects

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 3: OrbitalObjectStore

**Files:** Create `grid/src/economy/orbital-object-store.ts` + `grid/test/economy/orbital-object-store.test.ts`.

- [ ] **Step 1: Write failing tests** — create `grid/test/economy/orbital-object-store.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { OrbitalObjectStore } from '../../src/economy/orbital-object-store.js';

describe('migration v51 — orbital_objects', () => {
    it('creates the orbital_objects table', () => {
        const m = MIGRATIONS.find((x) => x.version === 51);
        expect(m, 'v51 must exist').toBeDefined();
        expect(m!.name).toBe('create_orbital_objects');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS orbital_objects');
        expect(m!.up).toContain('provenance_contract_id');
        expect(m!.up).toContain('UNIQUE KEY uniq_provenance');
        expect(m!.down).toContain('DROP TABLE IF EXISTS orbital_objects');
    });
    it('migration v51 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 51)).toHaveLength(1);
    });
});

function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];
const validSpec = { mass_kg: 1000, massIn_kg: 5, massOut_kg: 5, energyIn_J: 1000, energyOut_J: 900, load_N: 200, yield_N: 500, dissipated_W: 50, radiated_W: 80, generation_W: 120, consumption_W: 100, altitude_km: 420 };

function args(over = {}) {
    return { gridName: 'genesis', objectId: 'o1', contractId: 'c1', functionType: 'Energy', outputRate: 120n, physicsSpec: validSpec, zone: 'infrastructure', currentTick: 10, ...over };
}

describe('OrbitalObjectStore.createFromContract', () => {
    it('builds the object from a settled contract (commons-owned, builder-attributed)', async () => {
        // contract FOR UPDATE (settled, winner w, award 4000); no existing object; INSERT object
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }]), rows([]), [{}, {}]]);
        await new OrbitalObjectStore(m.pool).createFromContract(args());
        const sql = m.calls().join('\n');
        expect(sql).toContain('INSERT INTO orbital_objects');
        expect(sql).toContain('did:civic:noesis:treasury'); // commons owner OR check via params
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('refuses a non-settled contract', async () => {
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'w', award_wei: '4000' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args())).rejects.toThrow('contract_not_settled');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('refuses a physically invalid spec (never persisted)', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args({ physicsSpec: { ...validSpec, massOut_kg: 9 } }))).rejects.toThrow('physics_violation');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('refuses a duplicate build for the same contract', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }]), rows([{ object_id: 'existing' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args())).rejects.toThrow('object_already_built');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
});

describe('OrbitalObjectStore reads', () => {
    it('listObjects returns active objects for the grid', async () => {
        const m = makeMockPool([rows([{ object_id: 'o1', function_type: 'Energy' }])]);
        const list = await new OrbitalObjectStore(m.pool).listObjects('genesis');
        expect(list).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM orbital_objects');
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/orbital-object-store.test.ts` → FAIL.

- [ ] **Step 3: Create `grid/src/economy/orbital-object-store.ts`**:

```ts
/**
 * L3 — Orbital object: a built object made real. Created ONLY from a settled
 * procurement contract (L2) and ONLY if its spec passes the server-side physics
 * gate against the Grid's environment. The object belongs to the commons
 * (owner = the treasury, since the Polis paid for it) and is attributed to its
 * builder (the contract winner); its cost is the award. One object per contract.
 *
 * This is the thesis made literal: objects backed by the economy + obeying physics,
 * not cosmetic sprites. Audit event (orbital.object_built) is wired in L3b; the
 * Grid-Viz render (L4) reads listObjects.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { checkObjectPhysics, type ObjectPhysicsSpec } from './object-physics.js';
import { type GridEnvironment, EARTH_ORBIT } from '../registry/grid-environments.js';

/** Procurement-built objects belong to the commons (matches grid/src/api/routes/irs.ts). */
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';

export interface OrbitalObjectRow {
    object_id: string; grid_name: string; owner_did: string; builder_did: string;
    build_cost_wei: string; function_type: string; output_rate: string;
    physics_spec: string; provenance_contract_id: string; zone: string; status: string;
}

export class OrbitalObjectStore {
    constructor(private readonly pool: Pool) {}

    /** Realize a built object from a settled contract. Physics-gated; one per contract. */
    async createFromContract(p: { gridName: string; objectId: string; contractId: string; functionType: string; outputRate: bigint; physicsSpec: ObjectPhysicsSpec; zone: string; currentTick: number; env?: GridEnvironment }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [contractRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, winner_did, award_wei FROM procurement_contracts WHERE contract_id = ? AND grid_name = ? FOR UPDATE`,
                [p.contractId, p.gridName],
            );
            const contract = contractRows[0];
            if (!contract || contract.status !== 'settled') {
                await conn.rollback();
                throw new Error('contract_not_settled');
            }
            const [existing] = await conn.query<RowDataPacket[]>(
                `SELECT object_id FROM orbital_objects WHERE provenance_contract_id = ?`,
                [p.contractId],
            );
            if (existing[0]) {
                await conn.rollback();
                throw new Error('object_already_built');
            }
            const physics = checkObjectPhysics(p.physicsSpec, p.env ?? EARTH_ORBIT);
            if (!physics.ok) {
                await conn.rollback();
                throw new Error(`physics_violation:${physics.violations.join(',')}`);
            }
            await conn.query(
                `INSERT INTO orbital_objects
                   (object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [p.objectId, p.gridName, TREASURY_CIVIC_DID, String(contract.winner_did), String(contract.award_wei),
                 p.functionType, p.outputRate.toString(), JSON.stringify(p.physicsSpec), p.contractId, p.zone, p.currentTick, p.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    /** Active objects for a grid (the L4 render reads this). */
    async listObjects(gridName: string): Promise<OrbitalObjectRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status
             FROM orbital_objects WHERE grid_name = ? AND status = 'active' ORDER BY created_at ASC LIMIT 500`,
            [gridName],
        );
        return rows as unknown as OrbitalObjectRow[];
    }

    async getObject(gridName: string, objectId: string): Promise<OrbitalObjectRow | undefined> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status
             FROM orbital_objects WHERE grid_name = ? AND object_id = ?`,
            [gridName, objectId],
        );
        return rows[0] as unknown as OrbitalObjectRow | undefined;
    }
}
```

- [ ] **Step 4: Verify pass** — `npx vitest run test/economy/orbital-object-store.test.ts` → migration + store tests pass. (Adjust the `did:civic:noesis:treasury` SQL-substring assertion if the implementation passes owner via a bind param rather than inline — assert via the INSERT params or `expect(m.calls()...)` accordingly; the value is bound, so check the test mirrors that. If needed, assert `INSERT INTO orbital_objects` + `commit` only.)

- [ ] **Step 5: Full economy suite + typecheck** — `npx vitest run test/economy/` then `npm run typecheck 2>/dev/null || npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add grid/src/economy/orbital-object-store.ts grid/test/economy/orbital-object-store.test.ts
git commit -m "feat(grid): L3a OrbitalObjectStore — settled contract -> real physics-gated object

createFromContract validates physics vs the GridEnvironment, requires a settled
contract, one object per contract; commons-owned, builder-attributed, costed at award.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## L3b / L4 (next slices, sketch)
- **L3b:** `append-orbital-object-built.ts` sole-producer (`orbital.object_built`, payload e.g. `{ builder_did_hash, contract_id, function_type, object_id, output_rate, tick }`) + producer-boundary test + allowlist **116 → 117** + count-test update + wire `OrbitalObjectStore.createFromContract` to emit (optional `audit?`).
- **L4:** `GET /api/v1/orbital/objects?grid=genesis` route returning `listObjects` (function/zone/owner/builder/cost, physics_spec parsed); rewrite `dashboard/public/grid-viz/orbital.js` to fetch from that route and render real objects (fallback to the local sim if the route is empty). Browser-verify with preview tools — **the cosmetic objects become real on screen.**

---

## Self-Review

**1. Spec coverage:** server-side physics gate (Task 1); orbital_objects table (Task 2); createFromContract physics-gated + settled-only + once + listObjects/getObject (Task 3). ✓
**2. Placeholder scan:** L3a fully coded; L3b/L4 sketched with payloads + the exact files. ✓
**3. Type/name consistency:** `checkObjectPhysics`, `OrbitalObjectStore` methods, columns (`build_cost_wei`/`function_type`/`output_rate`/`provenance_contract_id`), errors (`contract_not_settled`/`object_already_built`/`physics_violation:*`), `TREASURY_CIVIC_DID` matches. ✓
**4. Physics-first:** no object is inserted unless `checkObjectPhysics` passes (gate before INSERT, inside the txn → rollback on violation). ✓
**5. Invariants:** built only from a `settled` contract; one per contract (UNIQUE + pre-check); commons-owned/builder-attributed/award-costed; allowlist +0 in L3a; existing suites green. ✓
