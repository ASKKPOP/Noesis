---
phase: 25c
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - grid/src/api/operator/relationships.ts
  - grid/src/main.ts
autonomous: true
requirements: [D-01, D-02, D-03]

must_haves:
  truths:
    - "relationships.ts has zero validateTierBody call sites after migration"
    - "ban-human and freeze-wallet routes return 200 (not 503) when humanSanctionStore is wired"
    - "spawn-system-nous route returns 200 (not 503) when SpawnNousDeps is wired"
  artifacts:
    - path: "grid/src/api/operator/relationships.ts"
      provides: "Header-auth migration for H2 inspect route and H5 edge-events route"
      contains: "x-operator-tier"
    - path: "grid/src/main.ts"
      provides: "humanSanctionStore and SpawnNousDeps wiring"
      contains: "humanSanctionStore"
  key_links:
    - from: "grid/src/main.ts"
      to: "grid/src/api/operator/ban-human.ts"
      via: "humanSanctionStore passed to buildServer"
      pattern: "humanSanctionStore"
    - from: "grid/src/main.ts"
      to: "grid/src/api/operator/spawn-system-nous.ts"
      via: "registerSpawnSystemNousRoute(app, services, spawnNousDeps)"
      pattern: "spawnNousDeps"
---

<objective>
Wave-0 cleanup tasks: migrate the last body-trust operator route to header-auth (D-01),
wire humanSanctionStore to unblock ban/freeze routes (D-02), and wire SpawnNousDeps to
unblock spawn route (D-03). All three are surgical changes to existing Grid files.

Purpose: Complete the Phase 25b header-auth migration and make the 25b operator surfaces
fully functional (ban-human, freeze-wallet, spawn-system-nous currently return 503).
Output: Modified relationships.ts and main.ts; all existing Grid tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-CONTEXT.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-RESEARCH.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-PATTERNS.md

<interfaces>
<!-- Key contracts extracted from source files -->

From grid/src/api/operator/export-replay.ts (header-auth pattern to clone):
```typescript
// Tier gate — read from server-trusted x-operator-tier header
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 2) {  // H2 gate — use 5 for H5 gate
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```

From grid/src/api/server.ts (humanSanctionStore interface, line 215):
```typescript
humanSanctionStore?: {
    existsByDid(did: string): Promise<boolean>;
    setBanned(did: string): Promise<void>;
    setFrozen(did: string): Promise<void>;
    getFlags(did: string): Promise<{ frozen: number; banned: number } | null>;
};
```

From grid/src/api/operator/spawn-system-nous.ts (lines 83-90):
```typescript
export interface SpawnNousDeps {
    spawnNous(name: string, did: string, publicKey: string, region: string): void;
}
export function registerSpawnSystemNousRoute(
    app: FastifyInstance,
    services: GridServices,
    deps?: SpawnNousDeps,  // third arg accepted here
): void
```

From grid/src/api/operator/index.ts (line 56 — current call site):
```typescript
registerSpawnSystemNousRoute(app, services);  // no deps passed → resolves via _spawnNousDeps escape hatch
```

From grid/src/main.ts (loreStorage wiring pattern, lines 126-143):
```typescript
const loreStorage = dbConn ? new LoreStorage(dbConn.getPool()) : undefined;
const server = buildServer({
    ...
    ...(loreStorage ? { lore: { storage: loreStorage } } : {}),
});
```

From grid/src/api/operator/relationships.ts — two validateTierBody call sites to migrate:
- Line 257: Route 2 H2 POST `/api/v1/nous/:did/relationships/inspect` — uses `validateTierBody(body, 'H2')`
- Lines 349-354: Route 3 H5 GET `/api/v1/operator/relationships/:edge_key/events` — reads `req.query.tier` and checks `if (tier !== 'H5')`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate relationships.ts H2 and H5 routes to header-auth (D-01)</name>
  <files>grid/src/api/operator/relationships.ts</files>
  <read_first>
    - grid/src/api/operator/relationships.ts (read fully before editing — contains 2 call sites)
    - grid/src/api/operator/export-replay.ts (lines 69-90, header-auth pattern to clone exactly)
    - grid/src/api/operator/_validation.ts (understand what validateTierBody does so the replacement is equivalent)
  </read_first>
  <behavior>
    - After migration, `cd grid && npx vitest run --reporter=dot` exits 0
    - grep for `validateTierBody` in relationships.ts returns 0 matches
    - grep for `x-operator-tier` in relationships.ts returns at least 2 matches (H2 route + H5 route)
  </behavior>
  <action>
Read relationships.ts fully. There are TWO validateTierBody call sites (per D-01 — Pitfall 4):

SITE 1 — Route 2 (H2 POST /api/v1/nous/:did/relationships/inspect, approx line 257):
Replace `const v = validateTierBody(body, 'H2');` and all downstream `v.tier` / `v.operatorId` references.
New header-auth code (clone from export-replay.ts pattern verbatim, gate is `tierNum < 2`):
```typescript
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 2) {
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}
const operatorId = req.headers['x-operator-id'];
if (typeof operatorId !== 'string' || !OPERATOR_ID_REGEX.test(operatorId)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```
Replace all downstream `v.tier` → `'H2'` (literal string) and `v.operatorId` → `operatorId` (local variable).
Also update the audit event fields `tier: v.tier` → `tier: 'H2'` and `operatorId: v.operatorId` → `operatorId`.

SITE 2 — Route 3 (H5 GET /api/v1/operator/relationships/:edge_key/events, approx lines 335-360):
This route currently reads `req.query.tier` and `req.query.operator_id`. Migrate to header reads:
```typescript
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 5) {
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}
const operatorId = req.headers['x-operator-id'];
if (typeof operatorId !== 'string' || !OPERATOR_ID_REGEX.test(operatorId)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```
Remove the old `req.query.tier` and `req.query.operator_id` reads for auth. Update audit event `tier: 'H5'` (literal) and `operatorId` from the header variable.

CLEANUP: After both call sites are migrated, remove the `import { validateTierBody } from './_validation.js';` import line (it is no longer referenced). Confirm `OPERATOR_ID_REGEX` is imported from `'../types.js'` — add it if not already present in the import statement.

Do NOT change the route handler bodies beyond the auth block. Do not modify comments, business logic, response shapes, or audit event payloads.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx vitest run --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep "validateTierBody" grid/src/api/operator/relationships.ts` returns empty (0 matches)
    - `grep "x-operator-tier" grid/src/api/operator/relationships.ts` returns at least 2 lines
    - `grep "import.*validateTierBody" grid/src/api/operator/relationships.ts` returns empty
    - Grid vitest suite exits 0
  </acceptance_criteria>
  <done>Both validateTierBody call sites in relationships.ts replaced with header-auth pattern matching export-replay.ts. Grid tests green.</done>
</task>

<task type="auto">
  <name>Task 2: Wire humanSanctionStore and SpawnNousDeps in main.ts (D-02, D-03)</name>
  <files>grid/src/main.ts, grid/src/api/operator/index.ts</files>
  <read_first>
    - grid/src/main.ts (read fully — find loreStorage wiring block at lines ~126-143)
    - grid/src/api/operator/spawn-system-nous.ts (lines 68-90, SpawnNousDeps interface + registerSpawnSystemNousRoute signature)
    - grid/src/api/operator/index.ts (line 56 — current registerSpawnSystemNousRoute call)
    - grid/src/api/server.ts (lines 210-225 — humanSanctionStore interface)
  </read_first>
  <action>
D-02 — humanSanctionStore: In grid/src/main.ts, after the `const loreStorage = ...` line, insert:
```typescript
// D-02: humanSanctionStore — DB pool wrapper for ban-human + freeze-wallet routes.
// Must be conditioned on dbConn (Pitfall 6 — test envs run without MySQL).
const humanSanctionStore = dbConn ? {
    async existsByDid(did: string): Promise<boolean> {
        const pool = dbConn.getPool();
        const [rows] = await pool.query<Array<{ did: string }>>(
            'SELECT did FROM human_users WHERE did = ? LIMIT 1',
            [did],
        );
        return (rows as Array<{ did: string }>).length > 0;
    },
    async setBanned(did: string): Promise<void> {
        const pool = dbConn.getPool();
        await pool.query('UPDATE human_users SET banned = 1 WHERE did = ?', [did]);
    },
    async setFrozen(did: string): Promise<void> {
        const pool = dbConn.getPool();
        await pool.query('UPDATE human_users SET frozen = 1 WHERE did = ?', [did]);
    },
    async getFlags(did: string): Promise<{ frozen: number; banned: number } | null> {
        const pool = dbConn.getPool();
        const [rows] = await pool.query<Array<{ frozen: number; banned: number }>>(
            'SELECT frozen, banned FROM human_users WHERE did = ? LIMIT 1',
            [did],
        );
        return (rows as Array<{ frozen: number; banned: number }>)[0] ?? null;
    },
} : undefined;
```

Then in the `buildServer({...})` call, add after the loreStorage spread:
```typescript
...(humanSanctionStore ? { humanSanctionStore } : {}),
```

D-03 — SpawnNousDeps: In grid/src/main.ts, after `launcher.bootstrap()` (approx line 83), insert:
```typescript
// D-03: SpawnNousDeps — wraps launcher.spawnNous for spawn-system-nous route.
const spawnNousDeps = {
    spawnNous: (name: string, did: string, publicKey: string, region: string) =>
        launcher.spawnNous(name, did, publicKey, region),
};
```

In grid/src/api/operator/index.ts, change line 56:
```typescript
// Before:
registerSpawnSystemNousRoute(app, services);
// After:
registerSpawnSystemNousRoute(app, services, (services as unknown as { _spawnDeps?: import('./spawn-system-nous.js').SpawnNousDeps })._spawnDeps);
```

Wait — the cleaner approach per RESEARCH Pattern 3: pass spawnNousDeps to buildServer or inject it via GridServices. However, `registerSpawnSystemNousRoute` already accepts a third `deps` arg (confirmed from spawn-system-nous.ts line 83-86). The simplest approach that does not change the barrel:

In main.ts, after constructing `spawnNousDeps`, pass it to `buildServer` via a services property. But GridServices does not have a `spawnNousDeps` field. The existing injection mechanism (escape hatch `_spawnNousDeps` on services) is the established pattern.

ACTUAL implementation for D-03: in `grid/src/main.ts`, after constructing `spawnNousDeps`, extend the `buildServer` call to include:
```typescript
...(spawnNousDeps ? { _spawnNousDeps: spawnNousDeps } : {}),
```
This matches the `(services as unknown as { _spawnNousDeps?: SpawnNousDeps })._spawnNousDeps` read in spawn-system-nous.ts line 89-90. The escape hatch IS the production path — confirmed from the source file comment "Allow injectable deps for tests via the `_spawnNousDeps` escape hatch on services."

No changes to index.ts needed — the barrel already calls `registerSpawnSystemNousRoute(app, services)` and the route resolves deps from the services escape hatch.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/grid && npx vitest run --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `grep "humanSanctionStore" grid/src/main.ts` returns at least 2 lines (construction + buildServer spread)
    - `grep "spawnNousDeps\|_spawnNousDeps" grid/src/main.ts` returns at least 2 lines
    - `grep "if (dbConn)" grid/src/main.ts | wc -l` shows humanSanctionStore construction is inside a dbConn guard (pattern: `const humanSanctionStore = dbConn ?`)
    - Grid vitest suite exits 0 (ban-human.test.ts, freeze-wallet.test.ts, spawn-system-nous.test.ts all pass)
  </acceptance_criteria>
  <done>humanSanctionStore and SpawnNousDeps wired in main.ts; ban/freeze/spawn routes no longer 503 when DB is connected. All Grid tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Steward proxy → Grid relationships endpoint | Operator tier header injected server-side by proxy; body tier fields were previously trusted directly from request body |
| main.ts → humanSanctionStore | DB pool queries run with operator-supplied DID; DID validated by existing OPERATOR_ID_REGEX before use |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25c-01-01 | Elevation of Privilege | relationships.ts H2 route | mitigate | Removed body-trust validateTierBody; now reads x-operator-tier header (server-injected by proxy per D-25b-NEW-1) |
| T-25c-01-02 | Elevation of Privilege | relationships.ts H5 route | mitigate | Removed query-param tier; now reads x-operator-tier header, tierNum < 5 gate |
| T-25c-01-03 | Tampering | humanSanctionStore SQL | mitigate | Parameterized queries (`WHERE did = ?`); DID validated by OPERATOR_ID_REGEX at route entry before reaching store |
| T-25c-01-04 | Denial of Service | spawnNousDeps not wired | accept | Returns 503 in production if deps absent; not a security threat — operational config error |
</threat_model>

<verification>
After both tasks:
- `cd grid && npx vitest run --reporter=dot` exits 0
- `grep -n "validateTierBody" grid/src/api/operator/relationships.ts` → 0 matches
- `grep -rn "audit\.append\|audit\.emit" grid/src/api/operator/relationships.ts` → 0 new append calls (allowlist delta 0 preserved)
- Existing ban-human.test.ts and freeze-wallet.test.ts and spawn-system-nous.test.ts pass
</verification>

<success_criteria>
1. relationships.ts has zero validateTierBody call sites; both routes use x-operator-tier / x-operator-id header pattern
2. main.ts constructs humanSanctionStore conditioned on dbConn non-null; spreads into buildServer
3. main.ts constructs spawnNousDeps and injects via _spawnNousDeps escape hatch on buildServer services
4. All Grid tests green
</success_criteria>

<output>
After completion, create `.planning/phases/25c-replay-scrubber-culture-browser/25c-01-SUMMARY.md`
</output>
