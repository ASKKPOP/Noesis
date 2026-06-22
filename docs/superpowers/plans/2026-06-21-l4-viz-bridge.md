# L4 — Viz Bridge (Grid-Viz renders real objects) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Close the *visible* loop. Expose the real `orbital_objects` (L3a) over `GET /api/v1/orbital/objects`, and make Grid-Viz render those backend objects instead of inventing cosmetic ones in `localStorage`. When the backend has objects, the scene shows the **real, economy-built, physics-gated** fleet; when it doesn't (or is unreachable), the existing local simulation runs unchanged as a graceful fallback. This is the moment the deep-scan's "cosmetic sprites" become real on screen.

**Architecture:** Two pieces.
- **Route (testable):** `registerOrbitalRoutes(app, services)` → `GET /api/v1/orbital/objects?grid=<name>` → reads `OrbitalObjectStore.listObjects` via `services.pool` (503 if absent, mirroring `irs`/`portal-grids`), returns `{ objects: [...], count }` with `physics_spec` parsed and wei as strings. Registered in `server.ts`.
- **Grid-Viz (additive + guarded):** in `dashboard/public/grid-viz/orbital.js`, on startup attempt `GET /api/v1/orbital/objects?grid=genesis`; if it returns objects, build the fleet from them (map `function_type` → the existing per-function form/colour, `zone` → placement); otherwise (empty / network error / timeout) leave the existing local generation exactly as-is. Everything wrapped so a failed fetch NEVER breaks the scene. A header line shows the source (`backend: N real` vs `local sim`).

**Verification reality:** the route↔render end-to-end needs the live grid + MySQL (not runnable here). So: the **route** is unit-tested (vitest, mock pool); `orbital.js` is **browser-verified** for (a) the graceful fallback (route unreachable on the static server → local sim renders, 0 console errors) and (b) the real-object render path (inject sample objects via the page and confirm they render). Full live integration is left for a Docker/DB run — called out, not silently skipped.

**Tech Stack:** TypeScript (route, Fastify + `mysql2`, Vitest) · plain browser JS + three.js (`orbital.js`). Run grid tests from `grid/`: `npx vitest run <target>`.

**Invariants:** read-only route (no audit, no mutation, allowlist +0); bounded result (`listObjects` LIMIT 500); the fetch is additive + fully guarded — the existing Grid-Viz behaviour is preserved when the backend is absent. No secrets/PII in the response (DIDs are already stored raw Grid-side as in other reads; the route exposes owner/builder/function/cost/zone + physics — no keys).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `grid/src/api/routes/orbital.ts` | `registerOrbitalRoutes` → `GET /api/v1/orbital/objects`. | **Create** |
| `grid/src/api/server.ts` | Import + register the orbital route. | **Modify** |
| `grid/test/api/orbital-objects.test.ts` | Route unit tests (mock pool). | **Create** |
| `dashboard/public/grid-viz/orbital.js` | Additive guarded fetch + render-from-backend (fallback to local sim). | **Modify** |

---

## Task 1: The route

**Files:** Create `grid/src/api/routes/orbital.ts` + `grid/test/api/orbital-objects.test.ts`; modify `grid/src/api/server.ts`.

- [ ] **Step 1: Write the failing route test** — create `grid/test/api/orbital-objects.test.ts` (model on `grid/test/portal/grids.test.ts`, but pass a mock `pool` in services):

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

function mockPool(rows: unknown[]): Pool {
    const query = vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]);
    return { query } as unknown as Pool;
}
function makeApp(pool?: Pool): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(), logos: new LogosEngine(), audit: new AuditChain(),
        gridName: 'genesis', pool: pool as never,
    });
}
const sample = {
    object_id: 'o1', grid_name: 'genesis', owner_did: 'did:civic:noesis:treasury', builder_did: 'w',
    build_cost_wei: '4000', function_type: 'Energy', output_rate: '120',
    physics_spec: JSON.stringify({ mass_kg: 1000, altitude_km: 420 }), provenance_contract_id: 'c1', zone: 'infrastructure', status: 'active',
};

describe('GET /api/v1/orbital/objects', () => {
    let app: FastifyInstance;
    beforeAll(() => { app = makeApp(mockPool([sample])); });
    afterAll(async () => { await app.close(); });

    it('returns active objects with parsed physics_spec', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/orbital/objects?grid=genesis' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.count).toBe(1);
        expect(body.objects[0]).toMatchObject({ object_id: 'o1', function_type: 'Energy', zone: 'infrastructure', build_cost_wei: '4000' });
        expect(body.objects[0].physics_spec).toMatchObject({ mass_kg: 1000, altitude_km: 420 }); // parsed object, not string
    });

    it('503 when the pool is not wired', async () => {
        const bare = makeApp(undefined);
        const res = await bare.inject({ method: 'GET', url: '/api/v1/orbital/objects?grid=genesis' });
        expect(res.statusCode).toBe(503);
        await bare.close();
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/api/orbital-objects.test.ts` → FAIL (route not registered).

- [ ] **Step 3: Create `grid/src/api/routes/orbital.ts`**:

```ts
/**
 * L4 — Orbital objects read API. Exposes the real, economy-built, physics-gated
 * orbital_objects (L3) so Grid-Viz can render them instead of inventing cosmetic
 * ones. Read-only, no audit, public. Mirrors the irs/portal-grids 503-on-no-pool idiom.
 *
 *   GET /api/v1/orbital/objects?grid=<name>  → { objects: [...], count }
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { OrbitalObjectStore } from '../../economy/orbital-object-store.js';

interface OrbitalQuery { grid?: string; }

export function registerOrbitalRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: OrbitalQuery }>('/api/v1/orbital/objects', async (req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const gridName = (req.query.grid ?? services.gridName ?? 'genesis').trim();
        const store = new OrbitalObjectStore(pool);
        const rows = await store.listObjects(gridName);
        const objects = rows.map((o) => ({
            object_id: o.object_id,
            owner_did: o.owner_did,
            builder_did: o.builder_did,
            build_cost_wei: o.build_cost_wei,
            function_type: o.function_type,
            output_rate: o.output_rate,
            zone: o.zone,
            status: o.status,
            physics_spec: safeParse(o.physics_spec),
        }));
        return reply.send({ objects, count: objects.length });
    });
}

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return null; }
}
```

- [ ] **Step 4: Register in `server.ts`** — add `import { registerOrbitalRoutes } from './routes/orbital.js';` with the other route imports, and call `registerOrbitalRoutes(app, services);` where the other `register*Routes(app, services)` calls are (e.g. next to `registerIrsRoutes`/`registerPortalGridsRoutes`).

- [ ] **Step 5: Verify pass** — `npx vitest run test/api/orbital-objects.test.ts` → both tests pass.

- [ ] **Step 6: Typecheck + commit**

```bash
cd grid && (npm run typecheck 2>/dev/null || npx tsc --noEmit) && cd ..
git add grid/src/api/routes/orbital.ts grid/src/api/server.ts grid/test/api/orbital-objects.test.ts
git commit -m "feat(grid): L4 GET /api/v1/orbital/objects — real objects read API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Task 2: Grid-Viz renders real objects (additive + guarded)

**Files:** Modify `dashboard/public/grid-viz/orbital.js`.

Read `orbital.js` first to find: (a) where the fleet of modules is built from specs, and (b) the header/stat line. The change must be **additive and fully guarded** — if the fetch fails or returns nothing, the existing local generation runs exactly as today.

- [ ] **Step 1: Add a guarded backend loader.** Near startup (after the scene + the existing local fleet are set up, or just before), add:

```js
// L4 — try to render the REAL, economy-built objects from the Grid backend.
// Fully guarded: any failure (route absent on a static host, network error,
// empty result) leaves the existing local simulation untouched.
async function tryLoadBackendObjects() {
  try {
    const res = await fetch('/api/v1/orbital/objects?grid=genesis', { cache: 'no-store' });
    if (!res.ok) return false;
    const body = await res.json();
    if (!body || !Array.isArray(body.objects) || body.objects.length === 0) return false;
    renderBackendObjects(body.objects);   // replace the procedural fleet with real objects
    setSourceLabel(`backend: ${body.objects.length} real`);
    return true;
  } catch (_e) {
    return false; // static host / offline → keep the local sim
  }
}
```

- [ ] **Step 2: Add `renderBackendObjects(objects)`** that maps each real object onto the EXISTING per-function module rendering (reuse the current form/colour logic keyed by `function_type`, and place by `zone`). Each object's info panel should show it is real: `object_id`, `function_type`, `output_rate`, `build_cost_wei` (wei), `owner` (commons), `builder`, and `physics ✓` (it passed the server gate). Do not delete the local-sim code — `renderBackendObjects` replaces the displayed fleet only when called.

- [ ] **Step 3: Add `setSourceLabel(text)`** updating a small header element (add a `<span id="source">local sim</span>` to the header in `orbital.html` if none exists; default text `local sim`).

- [ ] **Step 4: Call it on startup** — after the local scene is ready, `tryLoadBackendObjects();` (fire-and-forget; the local sim is already on screen, so a slow/failed fetch just leaves it).

- [ ] **Step 5: Browser-verify (fallback path).** Serve statically and open the scene:

```bash
python3 -m http.server 4178 --directory dashboard/public   # from repo root
```
Open `http://localhost:4178/grid-viz/orbital.html`. Expected: the route 404s on the static host → `tryLoadBackendObjects` returns false → the **local sim renders exactly as before**, header shows `local sim`, **zero console errors**. (Confirms the enhancement never breaks the scene.)

- [ ] **Step 6: Browser-verify (real-object render path).** With the scene open, inject sample backend objects and call the renderer directly (via the preview eval tool), confirming real objects render and the source label flips:

```js
renderBackendObjects([
  { object_id:'o1', function_type:'Energy', output_rate:'120', build_cost_wei:'4000', owner_did:'did:civic:noesis:treasury', builder_did:'w', zone:'infrastructure', physics_spec:{ mass_kg:1000, altitude_km:420 } },
  { object_id:'o2', function_type:'Compute', output_rate:'80', build_cost_wei:'3000', owner_did:'did:civic:noesis:treasury', builder_did:'w', zone:'business', physics_spec:{ mass_kg:800, altitude_km:500 } }
]);
setSourceLabel('backend: 2 real');
```
Expected: the two real objects render with their function forms/zones, the header shows `backend: 2 real`, no console errors. Screenshot it.

- [ ] **Step 7: Commit**

```bash
git add dashboard/public/grid-viz/orbital.js dashboard/public/grid-viz/orbital.html
git commit -m "feat(grid-viz): L4 render real backend objects (guarded fetch + local-sim fallback)

orbital.js fetches GET /api/v1/orbital/objects on startup; renders real
economy-built objects when present, falls back to the local sim otherwise.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review

**1. Spec coverage:** read route (Task 1, tested); Grid-Viz renders real objects with local-sim fallback (Task 2, browser-verified both paths). ✓
**2. Placeholder scan:** route fully coded; orbital.js change specified as additive functions + integration points (implementer reads the file to wire to the existing fleet/header). ✓
**3. Type/name consistency:** `registerOrbitalRoutes`, `/api/v1/orbital/objects`, response keys (`objects`/`count`, `physics_spec` parsed), `tryLoadBackendObjects`/`renderBackendObjects`/`setSourceLabel`. ✓
**4. Guarded/additive:** the fetch is fire-and-forget, fully try/caught; route-absent/empty/error → local sim unchanged. The shipped Grid-Viz behaviour is preserved. ✓
**5. Invariants:** read-only (no audit/mutation, allowlist +0); bounded (LIMIT 500 in listObjects); 503 when pool absent; no keys/secrets exposed. ✓ Full live route↔render integration noted as requiring a Docker/DB run (not silently skipped).
