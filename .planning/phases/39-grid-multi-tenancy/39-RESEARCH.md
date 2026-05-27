# Phase 39: Grid Multi-Tenancy — Research

**Researched:** 2026-05-27
**Domain:** Multi-tenant API access control, MySQL schema evolution, Fastify preHandler middleware, TypeScript compile-time enforcement
**Confidence:** HIGH

---

## Summary

Phase 39 adds per-operator isolation on top of the shared civic infrastructure established by Phases 36-38. The key insight is that this phase touches exactly three separable concerns: (1) DB schema evolution to attach operator ownership to brain_tokens and capture quota overrides, (2) a new `operatorScope` Fastify preHandler that enforces request-bearer matches data ownership, and (3) five new `operator/me/*` routes behind `portal_session_required`. Each concern maps cleanly to its own implementation boundary.

The codebase pattern is already established. Phase 36 built `tryDid` / `requireDid` as the preHandler contract. Phase 38 extended `DIDContext` with `operatorDid?: string`. The `operatorScope` middleware slots into this existing chain as a second enforcer that checks whether `req.didContext.operatorDid` owns the resource being accessed. The `grid_config` key-value table was introduced at migration v5 — it already exists, so the quota default just needs a row. Migration v28's `operator_quota_overrides` table is purely additive.

The CI gate `scripts/check-operator-scope-typing.mjs` is a new grep gate following the pattern of `check-did-policy-coverage.mjs` and `check-sole-producer-discipline.mjs`: static source analysis over a specific directory, exit 0/1.

**Primary recommendation:** Implement in four waves — (W0) test infrastructure; (W1) DB migrations v27+v28 + BrainTokenStore extensions; (W2) `operatorScope` preHandler + `operator/data/` module + five routes + ROUTE_DID_POLICY entries; (W3) Steward Console `/system/operators` page + CI gate + per-DID rate-limiter refactor from IP-buckets to DID-buckets.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brain ownership claim (POST /operator/me/brains) | API / Backend | Database | Portal session authenticates the human operator; DB stores the operator_did linkage |
| operator/me/* fleet view | API / Backend | Database | Portal session; DB-derived data via BrainTokenStore + nous_registry joins |
| Quota enforcement (max 3 Brains) | API / Backend | Database | DB COUNT query is authoritative; no in-memory counter (D-39-06) |
| operatorScope cross-operator block | API / Backend — | — | Fastify preHandler runs before handler; no DB call for the scope check itself (uses req.didContext.operatorDid from Phase 38) |
| Per-DID rate limiting | API / Backend | — | Replaces Phase 36 IP-bucket with DID-keyed Map; still in-process (multi-instance deferred) |
| Quota overrides configuration | API / Backend (Steward) | Database | Henry-only Grid Manager surface at /system/operators; grid_config + operator_quota_overrides tables |
| operatorScope violation logging | API / Backend | — | Pino structured warning; no audit chain event (D-39-09, allowlist delta = 0) |
| operator/data/ compile-time check | Build / CI | — | grep-based CI gate script at scripts/check-operator-scope-typing.mjs (D-39-10) |
| Steward Console /system/operators page | Frontend Server (SSR) | API | Next.js dashboard page; reads from Grid Manager API endpoints |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-39-01:** Two-step Portal-gated Brain claim model. Step 1: Brain registers via `POST /api/v1/brain/token/register` (Phase 38, unchanged). Step 2: operator claims via `POST /api/v1/operator/me/brains` with Portal session bearer. Migration v27 adds nullable `operator_did VARCHAR(255)` to `brain_tokens`. `operatorScope` derives operator_did via: extract `iss` (brain_did) from JWT → query `brain_tokens WHERE brain_did = iss` → get `operator_did`.

- **D-39-02:** Unclaimed Brains (no Portal claim yet) are functional but tracked in Henry-visible "unowned" pool. They can still `POST /api/v1/brain/actions` and receive firehose. They appear in Steward Console `/system/operators` under "Unowned Brains". They do NOT count against any operator's quota until claimed.

- **D-39-03:** `GET /api/v1/operator/me/nous` returns rich per-Nous metadata: `{ civic_did, brain_did, status, last_active_tick, zone_id, civic_standing, quota_usage: { brain_processes, limit }, token_expires_at }`.

- **D-39-04:** Phase 39 ships exactly 5 routes: `GET /api/v1/operator/me/nous`, `POST /api/v1/operator/me/brains`, `GET /api/v1/operator/me/quota`, `GET /api/v1/operator/me/settings`, `PATCH /api/v1/operator/me/settings`. All are `portal_session_required`.

- **D-39-05:** `operator/me/*` routes accept Portal session token only. Brain JWTs remain for action dispatch only.

- **D-39-06:** Brain-process quota is derived from `brain_tokens` COUNT at claim time. No separate quota counter table. `SELECT COUNT(*) FROM brain_tokens WHERE operator_did = ? AND revoked = 0 AND expires_at > UNIX_TIMESTAMP()`. Exceeding limit returns `429 { error: 'quota_exceeded', resource: 'brain_processes', current: N, limit: N }`.

- **D-39-07:** Henry configures quota defaults and per-operator overrides via Steward Console `/system/operators` page. Default quota (brain_processes: 3) stored in `grid_config` key-value table. Per-operator overrides in new `operator_quota_overrides` table (migration v28). If no override, global default applies.

- **D-39-08 (Claude's Discretion):** Per-Civic-DID rate limit — suggested default 600 req/min. Configurable via same Steward Console page as D-39-07.

- **D-39-09:** operatorScope violations log Pino structured warning: `{ level: 'warn', event: 'operator_scope_violation', requesting_operator_did, target_operator_did, route, tick }`. No audit chain event. No new allowlist entries.

- **D-39-10:** `grid/src/operator/data/` module. Every function MUST include `operatorDid: string` as a parameter. CI gate `scripts/check-operator-scope-typing.mjs` enforces this via grep on function signatures.

### Claude's Discretion

- Per-DID rate limit exact value: 600 req/min suggested default, tune based on Phase 38 traffic
- `me/settings` initial field set: minimal placeholder for Phase 40 Local AI config; exact fields TBD by planner
- `operatorScope` Fastify preHandler exact implementation shape (hook vs plugin vs wrapper — follow Phase 36 preHandler patterns)
- Migration version numbers: v27 = `brain_tokens.operator_did` column; v28 = `operator_quota_overrides` table
- `grid_config` key-value table format (check if it already exists; if not, add as part of v27 or v28)

### Deferred Ideas (OUT OF SCOPE)

- Per-operator UI customization in Dashboard
- Federated multi-Grid operator accounts (FUTURE-MULTIGRID-01)
- Operator billing for hosting
- Brain JWT extended with `operator_did` claim
- `operator.scope_violation` audit event
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENANT-01 | Grid isolates per-operator metadata (operator settings, Brain wire-protocol tokens, operator-DID linkage) in operator-scoped MySQL schemas/tables. Civic state is shared. | Migration v27 (operator_did on brain_tokens) + v28 (operator_quota_overrides) + operator/data/ module scopes all data accessor queries by operatorDid parameter |
| TENANT-02 | Cross-operator metadata queries forbidden — `operatorScope` API decorator enforces request-bearer matches data ownership. Compile-time TypeScript check ensures all operator-data accessors take operator-DID parameter. | operatorScope Fastify preHandler (chains after tryDid) + check-operator-scope-typing.mjs CI gate (grep on grid/src/operator/data/) |
| TENANT-03 | Per-operator resource quotas enforced: max Brain processes per operator (default 3), audit event rate limits (per-DID), P2P bandwidth caps. Configurable by Henry. | DB-authoritative COUNT query (D-39-06) + grid_config default + operator_quota_overrides table (v28) + per-DID rate-limit refactor from visitor-bucket.ts |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.0.0 | HTTP framework (already in project) | All Grid routes use it; preHandler pattern established in Phase 36 |
| mysql2 | ^3.9.0 | MySQL pool queries (already in project) | All DB operations use it; BrainTokenStore pattern is the template |
| pino | ^10.0.0 | Structured logging (already in project) | Grid-wide logger singleton at grid/src/util/logger.ts |
| jose | ^6.2.3 | JWT verification (already in project) | Already used by tryDid for EdDSA + ES256 paths |
| typescript | existing | Compile-time checks | CI gate grep targets .ts function signatures |

[VERIFIED: package.json at /Users/desirey/Programming/src/Noesis/grid/package.json]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | Used in brain-token.ts for Ed25519 sig verify | Already used; no new dep needed |
| vitest | existing | Test runner (`npm test` = vitest run) | All grid tests use it |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-authoritative quota COUNT | In-memory quota counter | DB is authoritative (D-39-06) — cannot be gamed by timing exploits or Grid restarts. In-memory would require sync on startup. |
| grep-based CI gate | TypeScript compiler plugin | Grep is the pattern already used by check-sole-producer-discipline, check-did-policy-coverage, etc. Simpler, no TS plugin infra needed. |
| Portal session cookie for operatorScope | Brain JWT | D-39-05 explicitly decided: operator/me/* is Portal session only; Brain JWTs are action-dispatch only. |

**Installation:** No new packages. Everything uses existing dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
Portal session cookie
        |
        v
[Fastify onRequest hook]
   registerVisitorRateLimit (120/min IP → Phase 39 adds per-DID 600/min)
        |
        v
[tryDid preHandler]
   resolves DIDContext: { did, tier, operatorDid }
        |
        v
[policy lookupPolicy]
   operator/me/* → portal_session_required
        |
        v
[requirePortalSession]
   passes if tier = human_visitor OR civic_member
        |
        v
[operatorScope preHandler]  ← NEW in Phase 39
   checks req.didContext.operatorDid matches requested resource owner
   violation → Pino warn + 403 forbidden
        |
        v
[Route handler in grid/src/api/routes/operator-me/]
   reads from grid/src/operator/data/ accessors (all typed with operatorDid param)
        |
        v
[BrainTokenStore.findByOperator / countActiveByOperator]
[operator_quota_overrides table]
[grid_config table — quota defaults]
```

Data flow for Brain claim (`POST /api/v1/operator/me/brains`):
```
Portal session → requirePortalSession → extract operatorDid from session did
→ read brain_did from body
→ BrainTokenStore.getByDid(brain_did) — verify Brain is registered (Phase 38)
→ Check brain_token.operator_did is NULL (not yet claimed)
→ Check countActiveByOperator(operatorDid) < quota limit
→ BrainTokenStore.setOwner(brain_did, operatorDid) — UPDATE with INSERT IGNORE semantics
→ 200 { ok: true, brain_did, operator_did }
```

### Recommended Project Structure
```
grid/src/
├── operator/
│   └── data/                   # NEW — all per-operator data accessors (CI-enforced)
│       ├── operator-brain-store.ts      # findByOperator, countActiveByOperator, setOwner
│       ├── operator-quota-store.ts      # getQuotaLimit, setQuotaOverride (v28 table)
│       └── operator-settings-store.ts  # get/set operator settings (placeholder)
├── api/
│   ├── preHandlers/
│   │   ├── tryDid.ts           # Phase 36/38 — unchanged
│   │   ├── requireDid.ts       # Phase 36 — unchanged
│   │   ├── types.ts            # DIDContext — no change needed (operatorDid already there)
│   │   └── operatorScope.ts    # NEW — enforces operatorDid boundary
│   ├── routes/
│   │   └── operator-me/        # NEW — 5 routes
│   │       ├── nous.ts         # GET /api/v1/operator/me/nous
│   │       ├── brains.ts       # POST /api/v1/operator/me/brains
│   │       ├── quota.ts        # GET /api/v1/operator/me/quota
│   │       └── settings.ts     # GET + PATCH /api/v1/operator/me/settings
│   ├── policy.ts               # Add 5 operator/me/* entries (portal_session_required)
│   └── rate-limit/
│       └── visitor-bucket.ts   # Refactor: add per-DID 600/min bucket alongside IP bucket
├── db/
│   ├── schema.ts               # Add migrations v27, v28
│   └── stores/
│       └── brain-token-store.ts  # Add setOwner, findByOperator, countActiveByOperator
scripts/
└── check-operator-scope-typing.mjs  # NEW CI gate
```

### Pattern 1: operatorScope preHandler (follows requireDid pattern)

**What:** A Fastify preHandler that extracts `req.didContext.operatorDid` and checks it against the target resource owner. Violation = Pino warn + 403. Non-violation = sets `req.operatorDid` on request for downstream handlers.

**When to use:** Applied via `preHandler: [operatorScopeHook]` on each `operator/me/*` route registration, OR injected as an `onRequest` hook scoped to the `operator/me` prefix plugin.

**Example (following requireDid.ts pattern):**
```typescript
// grid/src/api/preHandlers/operatorScope.ts
// [VERIFIED: pattern from grid/src/api/preHandlers/requireDid.ts]

import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../util/logger.js';

export async function operatorScope(
    req: FastifyRequest,
    reply: FastifyReply,
): Promise<string | null> {
    const ctx = req.didContext;
    // Portal session sets operatorDid = the human DID (did:noesis:human:*)
    // Brain JWT sets operatorDid = the Brain DID (did:noesis:nous:*)
    // operator/me/* routes require human portal session → operatorDid = human DID
    const operatorDid = ctx?.operatorDid;
    if (!operatorDid) {
        reply.code(403).send({ error: 'operator_scope_required' });
        return null;
    }
    return operatorDid;
}

export function assertOperatorOwns(
    req: FastifyRequest,
    reply: FastifyReply,
    resourceOperatorDid: string | null,
    tick: number,
): boolean {
    const requestingDid = req.didContext?.operatorDid;
    if (!requestingDid || requestingDid !== resourceOperatorDid) {
        logger.warn({
            event: 'operator_scope_violation',
            requesting_operator_did: requestingDid ?? null,
            target_operator_did: resourceOperatorDid,
            route: req.url,
            tick,
        });
        reply.code(403).send({ error: 'forbidden', reason: 'operator_scope' });
        return false;
    }
    return true;
}
```

[VERIFIED: DIDContext.operatorDid already on the type in grid/src/api/preHandlers/types.ts line 32; tryDid sets it for both Brain JWT path (iss) and Portal session path (did) — see tryDid.ts lines 93 and 133]

### Pattern 2: DB migration v27 — additive column on brain_tokens

**What:** Nullable `operator_did` column on the existing `brain_tokens` table (migration v25). Follows the established additive-only migration pattern used throughout schema.ts.

**When to use:** Whenever operator ownership needs to be expressed as a relationship to an existing entity.

**Example:**
```typescript
// grid/src/db/schema.ts — migration v27
// [VERIFIED: migration pattern from schema.ts versions 10, 13, 14, 15]
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

### Pattern 3: DB migration v28 — operator_quota_overrides table

**What:** New table for per-operator quota overrides. `grid_config` already exists (migration v5) with `{grid_name, config_key, config_value JSON}` — quota defaults just need a row insert at Grid boot time, no new table.

**Example:**
```typescript
// grid/src/db/schema.ts — migration v28
// [VERIFIED: grid_config table exists at schema.ts migration v5]
{
    version: 28,
    name: 'create_operator_quota_overrides',
    up: `
        CREATE TABLE IF NOT EXISTS operator_quota_overrides (
            grid_name    VARCHAR(63)  NOT NULL,
            operator_did VARCHAR(255) NOT NULL,
            brain_process_limit INT UNSIGNED NOT NULL DEFAULT 3,
            event_rate_per_did_per_min INT UNSIGNED NOT NULL DEFAULT 600,
            p2p_bandwidth_cap_bytes BIGINT UNSIGNED NULL DEFAULT NULL,
            updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, operator_did)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS operator_quota_overrides`,
},
```

### Pattern 4: BrainTokenStore new methods (follows existing store pattern)

**What:** Three new methods on the existing `BrainTokenStore` class following the same pool.query pattern.

**Example:**
```typescript
// grid/src/db/stores/brain-token-store.ts additions
// [VERIFIED: existing methods in brain-token-store.ts]

async setOwner(brainDid: string, operatorDid: string): Promise<boolean> {
    // UPDATE WHERE operator_did IS NULL — prevents double-claim
    const [result] = await this.pool.query<ResultSetHeader>(
        `UPDATE brain_tokens SET operator_did = ?
         WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`,
        [operatorDid, this.gridName, brainDid],
    );
    return result.affectedRows === 1;
}

async findByOperator(operatorDid: string): Promise<BrainTokenRecord[]> {
    const [rows] = await this.pool.query<BrainTokenRow[]>(
        `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked
         FROM brain_tokens
         WHERE grid_name = ? AND operator_did = ? AND revoked = 0`,
        [this.gridName, operatorDid],
    );
    return rows.map(rowToRecord);
}

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

[VERIFIED: existing store methods and pool.query patterns in brain-token-store.ts]

### Pattern 5: ROUTE_DID_POLICY additions

All 5 `operator/me/*` routes need entries in `grid/src/api/policy.ts`. The policy value is `portal_session_required` (D-39-05).

[VERIFIED: `portal_session_required` is already in the ROUTE_DID_POLICY_VALUES enum at policy.ts line 18]

```typescript
// Additions to ROUTE_DID_POLICY in grid/src/api/policy.ts
// [VERIFIED: existing portal_session_required entries at policy.ts lines 50-54]
'GET  /api/v1/operator/me/nous':     'portal_session_required',
'POST /api/v1/operator/me/brains':   'portal_session_required',
'GET  /api/v1/operator/me/quota':    'portal_session_required',
'GET  /api/v1/operator/me/settings': 'portal_session_required',
'PATCH /api/v1/operator/me/settings': 'portal_session_required',
```

### Pattern 6: CI gate `check-operator-scope-typing.mjs`

**What:** Grep-based gate that walks `grid/src/operator/data/*.ts` and asserts every exported function signature includes `operatorDid: string` as a parameter. Follows `check-sole-producer-discipline.mjs` pattern.

**Example logic:**
```javascript
// scripts/check-operator-scope-typing.mjs
// [VERIFIED: pattern from check-sole-producer-discipline.mjs]
// For each .ts file in grid/src/operator/data/:
//   Extract all export function / export async function declarations
//   Assert each one includes `operatorDid: string` in its parameter list
//   Violation → exit 1 with file + function name
```

The grep target: `export (async )?function \w+` must be followed by a parameter list containing `operatorDid: string`. A function signature missing this param fails the build.

### Anti-Patterns to Avoid

- **Global operatorScope hook on ALL routes:** operatorScope is for `operator/me/*` and `operator/data/` module only. The civic routes (library, marketplace, registry) are intentionally shared across operators — do NOT apply scope enforcement to those.
- **In-memory quota counter:** D-39-06 explicitly forbids this. Always query the DB for the authoritative count.
- **Adding operator_did to audit chain payloads:** D-39-09 says no audit event for scope violations. Additionally, Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS forbids exposing `operator_did` in auditable cross-wire payloads.
- **Modifying `POST /api/v1/brain/token/register`:** D-39-01 is explicit — this Phase 38 route is frozen. The ownership claim is a separate step via the new `/operator/me/brains` route.
- **Hot-patching the quota mid-tick:** Quota changes take effect immediately via DB reads (no Grid restart needed per D-39-07).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured warning logging | Custom log format | Pino logger singleton (`grid/src/util/logger.ts`) | Already wired globally; consistent with Phase 33 patterns |
| JWT Portal session verification | Custom JWT parser | Existing `tryDid` / `requirePortalSession` from Phase 36 | These already set `req.didContext`; operatorScope reads from it |
| Double-claim prevention | Locking mechanism | `UPDATE WHERE operator_did IS NULL` (single atomic UPDATE) | Follows INSERT IGNORE idempotency pattern from Phase 37-38 |
| Quota default storage | New table or env var | Existing `grid_config` key-value table (migration v5) | Already designed for runtime-configurable Grid settings |
| Rate-limit bucket | New Redis/external | In-process DID-keyed Map (same as current IP-bucket in visitor-bucket.ts) | Phase 39 only refactors the existing in-process implementation; multi-instance backend is explicitly deferred |

**Key insight:** Every building block for Phase 39 already exists in the codebase. The work is composition, not invention.

---

## Common Pitfalls

### Pitfall 1: operatorDid source confusion for operator/me/* routes

**What goes wrong:** `operator/me/*` uses Portal session. The Portal session cookie sets `operatorDid = did` (the human DID, e.g. `did:noesis:human:*`). Brain JWT sets `operatorDid = iss` (the Brain existence-DID, e.g. `did:noesis:nous:*`). If a handler accidentally reads Brain JWT's `operatorDid` for a Portal-session route, it would get the wrong value (or null if Brain JWT was not presented).

**Why it happens:** Both auth paths set `req.didContext.operatorDid` but with different DID types. The Portal session path (tryDid.ts line 133) sets `operatorDid: did` (the human DID). The Brain JWT path (tryDid.ts line 93) sets `operatorDid: iss` (the Brain existence-DID).

**How to avoid:** `requirePortalSession` enforces tier = human_visitor OR civic_member. The `operator/me/*` handlers should only be reached when Portal session is valid, meaning `operatorDid` is the human DID. Document this explicitly in the route handler.

**Warning signs:** Any test where `operatorDid` comes back as a `did:noesis:nous:*` value for an `operator/me/*` route is wrong.

### Pitfall 2: grid_config table already exists — don't create it in v27/v28

**What goes wrong:** Adding a `CREATE TABLE grid_config` statement to migration v27 or v28 will fail at runtime because the table was created at migration v5.

**Why it happens:** The CONTEXT.md mentions "check if `grid_config` already exists; if not, add as part of v27 or v28" — this is a research question, not a directive to create it.

**How to avoid:** `grid_config` is confirmed at migration v5 in `schema.ts`. It has columns `(grid_name, config_key, config_value JSON, updated_at)`. The quota default (`brain_processes: 3`) should be an INSERT/UPSERT row at Grid boot time, not a new table.

[VERIFIED: schema.ts migration v5 at lines 89-103]

### Pitfall 3: ROUTE_DID_POLICY check-did-policy-coverage.mjs gate will fail without entries

**What goes wrong:** The CI gate `scripts/check-did-policy-coverage.mjs` statically scans `grid/src/api/` for `app.(get|post|patch)('path', ...)` calls. Any new inline-registered routes without a corresponding ROUTE_DID_POLICY entry will fail the build.

**Why it happens:** Phase 36 wired this as a default-deny gate. Every plan that adds routes must add ROUTE_DID_POLICY entries in the same plan.

**How to avoid:** Add all 5 `operator/me/*` route policy entries in the same plan wave as the route files.

[VERIFIED: check-did-policy-coverage.mjs confirmed active in .github/workflows/rig-invariants.yml]

### Pitfall 4: Double-claim via race condition

**What goes wrong:** Two concurrent `POST /api/v1/operator/me/brains` requests from different operators could both claim the same Brain if the check is read-then-write with no atomic lock.

**Why it happens:** Non-atomic claim flow: read `operator_did IS NULL` → write `SET operator_did = ?`.

**How to avoid:** Use a single `UPDATE brain_tokens SET operator_did = ? WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`. If `affectedRows === 0`, the Brain was already claimed (return 409 already_claimed). This is the same INSERT IGNORE / conditional UPDATE pattern used throughout Phases 37-38.

[VERIFIED: INSERT IGNORE pattern confirmed in brain-token-store.ts upsert method; Phase 37-38 code context in 39-CONTEXT.md]

### Pitfall 5: Per-DID rate-limit refactor scope

**What goes wrong:** The visitor-bucket.ts comment explicitly says "Phase 39: refactor to per-DID buckets." If the planner forgets to include this refactor, D-39-08's per-DID 600/min rate limit has no backing store.

**Why it happens:** D-36-05 built a per-IP bucket (visitor-bucket.ts). D-39-08 requires a per-DID bucket layered on top. The original bucket must remain for unauthenticated visitors; DID-authenticated requests get a higher limit.

**How to avoid:** The refactor should extend visitor-bucket.ts to check `req.didContext` — if a DID is resolved, apply the per-DID bucket; if no DID (anonymous), apply the IP bucket. Not a replacement, a layering.

[VERIFIED: visitor-bucket.ts lines 5-8 explicitly document this as a Phase 39 TODO]

### Pitfall 6: operatorScope applied to civic routes

**What goes wrong:** Applying the `operatorScope` preHandler to civic routes like `GET /api/v1/library/entries` or `GET /api/v1/market/listings` would break the shared civic substrate. These routes intentionally return the same data regardless of which operator's bearer is presented (TENANT Success Criterion 4).

**How to avoid:** `operatorScope` enforcement ONLY applies in `operator/me/*` route handlers and within `grid/src/operator/data/` module functions. Civic routes do not call `operator/data/` accessors.

### Pitfall 7: `me/settings` placeholder fields must be Phase 40-compatible

**What goes wrong:** If `me/settings` returns a response shape that conflicts with what Phase 40 (Local AI) needs to store, Phase 40 will need to break the API contract.

**How to avoid:** Return a minimal but extensible shape. Suggested initial fields: `{ local_ai: null, _version: 1 }`. The `_version` field allows schema evolution without breaking existing callers.

---

## Code Examples

Verified patterns from official sources:

### tryDid with operatorDid already set (existing code)
```typescript
// Source: grid/src/api/preHandlers/tryDid.ts lines 88-93 [VERIFIED]
// Brain JWT path — operatorDid = iss (Brain existence-DID)
return { did: sub, tier: 'civic_member', operatorDid: iss };

// Source: grid/src/api/preHandlers/tryDid.ts line 133 [VERIFIED]
// Portal session path — operatorDid = did (human DID)
return { did, tier: 'human_visitor', operatorDid: did };
```

### ROUTE_DID_POLICY portal_session_required existing entries (reference)
```typescript
// Source: grid/src/api/policy.ts lines 50-54 [VERIFIED]
'GET /portal/api/v1/notifications': 'portal_session_required',
'POST /portal/api/v1/notifications/:id/read': 'portal_session_required',
'POST /api/v1/nous/:civic_did_hash/follow': 'portal_session_required',
'POST /api/v1/polis/bills/:id/watch': 'portal_session_required',
```

### grid_config key-value table structure (existing)
```sql
-- Source: grid/src/db/schema.ts migration v5 [VERIFIED]
-- (grid_name, config_key, config_value JSON, updated_at)
-- Quota default row example:
INSERT INTO grid_config (grid_name, config_key, config_value)
VALUES (?, 'quota.brain_processes_default', '3')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
```

### BrainTokenStore existing query pattern (reference for new methods)
```typescript
// Source: grid/src/db/stores/brain-token-store.ts lines 107-116 [VERIFIED]
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

### Pino structured warning (existing pattern)
```typescript
// Source: pattern established in Phase 31 (D-31 no-silent-catch) [ASSUMED: exact call sites not read]
// Canonical singleton is grid/src/util/logger.ts
import { logger } from '../../util/logger.js';

logger.warn({
    event: 'operator_scope_violation',
    requesting_operator_did: requestingOperatorDid,
    target_operator_did: targetOperatorDid,
    route: req.url,
    tick,
});
```

### CI gate pattern (grep-based, following check-sole-producer-discipline.mjs)
```javascript
// Source: scripts/check-sole-producer-discipline.mjs [VERIFIED]
// Pattern: walk directory → readFileSync → check required patterns → exit 0/1
// check-operator-scope-typing.mjs will follow this exact structure
// but check for 'operatorDid: string' in function param lists
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-IP rate limiting | Per-DID rate limiting (Phase 39 layered on top) | Phase 39 | DID-holders get higher quota (600/min vs 120/min); unauthenticated visitors remain at 120/min |
| No operator ownership in brain_tokens | Nullable operator_did column (migration v27) | Phase 39 | Brain claim model becomes two-step; unclaimed Brains stay functional |
| No quota enforcement | DB-authoritative COUNT-based quota (D-39-06) | Phase 39 | Prevents one operator from monopolizing Grid Brain slots |

**Deprecated/outdated:**
- Phase 36 comment "Phase 39 will refactor to per-DID buckets" in visitor-bucket.ts: This is the Phase 39 deliverable, not a future wish.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `grid_config` table (migration v5) is the right place to store `quota.brain_processes_default = 3` via UPSERT at Grid boot | Pitfall 2 / Code Examples | Low — grid_config is confirmed to exist; the boot-time UPSERT is the established pattern for runtime config |
| A2 | Pino logger singleton is at `grid/src/util/logger.ts` and is imported as `logger` | Code Examples | Low — confirmed by Phase 31 carry-forward notes in STATE.md; not directly read in this session |
| A3 | `me/settings` initial shape `{ local_ai: null, _version: 1 }` is compatible with Phase 40 requirements | Anti-Patterns / Pitfall 7 | Medium — Phase 40 CONTEXT.md not yet written; if Phase 40 requires a specific settings schema the planner should adjust the placeholder shape |
| A4 | The visitor rate-limit refactor adds a per-DID bucket layer without removing the per-IP bucket | Common Pitfalls | Low — visitor-bucket.ts comment explicitly states this intent |

---

## Open Questions

1. **`me/settings` exact initial field set**
   - What we know: D-39-08 says planner decides; Phase 40 expects Local AI config here
   - What's unclear: Exact field names Phase 40 will use (e.g., `{ ollama_model, temperature, max_tokens }`)
   - Recommendation: Use `{ local_ai: null, _version: 1 }` as a fully extensible placeholder; Phase 40 will add specific subkeys

2. **operatorScope implementation shape: Fastify hook vs per-route preHandler**
   - What we know: Phase 36 pattern used `onRequest` global hook for policy enforcement; `requirePortalSession` is called per-handler
   - What's unclear: Whether `operatorScope` should be registered as an `onRequest` hook scoped to a route prefix, or called inline per `operator/me/*` handler
   - Recommendation: Call `assertOperatorOwns` inline within each `operator/me/*` handler (same pattern as `requirePortalSession` in requireDid.ts) — this gives per-handler control over which resource's owner to check

3. **`nous.ts` GET /operator/me/nous data joins**
   - What we know: Response shape needs `civic_did, brain_did, status, last_active_tick, zone_id, civic_standing, quota_usage, token_expires_at` per D-39-03
   - What's unclear: `civic_standing` and `zone_id` come from `civic_did_registry` and a future `nous_registry` / zoning table; Phase 37 may have populated `civic_did_registry` but `zone_id` is a Phase 57 concept
   - Recommendation: Return `zone_id: null` and `civic_standing: null` as valid placeholders in Phase 39 (these tables are stubs until Phases 46/57 respectively); document the placeholder clearly

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 39 is code/config changes to Grid source; uses existing MySQL, Node.js, Fastify stack already confirmed working in Phases 36-38).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via `npm test` = `vitest run`) |
| Config file | vitest.config.ts or package.json scripts.test |
| Quick run command | `cd grid && npm test` |
| Full suite command | `cd grid && npm test` |

[VERIFIED: grid/package.json scripts.test = "vitest run"]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TENANT-01 | Migration v27 adds operator_did nullable col to brain_tokens; migration v28 creates operator_quota_overrides table | unit | `cd grid && npm test -- db/schema-v27-v28.test.ts` | ❌ Wave 0 |
| TENANT-01 | BrainTokenStore.setOwner assigns operator and returns true; second call on same brain_did returns false (already owned) | unit | `cd grid && npm test -- db/brain-token-store-owner.test.ts` | ❌ Wave 0 |
| TENANT-01 | BrainTokenStore.findByOperator returns only that operator's active tokens | unit | `cd grid && npm test -- db/brain-token-store-owner.test.ts` | ❌ Wave 0 |
| TENANT-02 | GET /operator/me/nous with operator A's Portal session returns only operator A's Nous; cross-operator query attempt returns 403 | integration | `cd grid && npm test -- api/operator-me-nous.test.ts` | ❌ Wave 0 |
| TENANT-02 | check-operator-scope-typing.mjs exits 0 when all grid/src/operator/data/*.ts functions have operatorDid param | ci gate | `node scripts/check-operator-scope-typing.mjs` | ❌ Wave 0 |
| TENANT-02 | check-operator-scope-typing.mjs exits 1 when any function is missing operatorDid param | ci gate | `node scripts/check-operator-scope-typing.mjs` | ❌ Wave 0 |
| TENANT-03 | POST /operator/me/brains when operator already has 3 active Brains returns 429 quota_exceeded | integration | `cd grid && npm test -- api/operator-me-brains.test.ts` | ❌ Wave 0 |
| TENANT-03 | GET /operator/me/quota returns current brain_processes count and limit | integration | `cd grid && npm test -- api/operator-me-quota.test.ts` | ❌ Wave 0 |
| TENANT-01-04 | Civic routes (GET /library/entries, GET /market/listings, GET /registry/civic-did/:did) return identical data regardless of which operator's Portal session is presented | integration | `cd grid && npm test -- api/civic-routes-shared.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd grid && npm test`
- **Per wave merge:** `cd grid && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `grid/test/db/schema-v27-v28.test.ts` — covers TENANT-01 DB migrations
- [ ] `grid/test/db/brain-token-store-owner.test.ts` — covers setOwner, findByOperator, countActiveByOperator
- [ ] `grid/test/api/operator-me-nous.test.ts` — covers TENANT-02 cross-operator isolation
- [ ] `grid/test/api/operator-me-brains.test.ts` — covers TENANT-03 quota enforcement on claim
- [ ] `grid/test/api/operator-me-quota.test.ts` — covers TENANT-03 quota read endpoint
- [ ] `grid/test/api/civic-routes-shared.test.ts` — covers Success Criterion 4 (shared civic data)
- [ ] `grid/test/ci/operator-scope-typing.test.ts` — covers D-39-10 CI gate correctness

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Phase 36 tryDid / requirePortalSession (already enforced) |
| V3 Session Management | yes | Portal session cookie (HTTP-only, existing Phase 36 cookie handling) |
| V4 Access Control | yes — PRIMARY | operatorScope preHandler (new) + ROUTE_DID_POLICY (existing) |
| V5 Input Validation | yes | DID regex validation on brain_did and operator_did parameters; existing BRAIN_DID_RE, CIVIC_DID_RE patterns in brain-token.ts |
| V6 Cryptography | no (Phase 39 does not introduce new cryptographic operations) | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator A guessing Operator B's brain_did to claim it | Spoofing | `UPDATE WHERE operator_did IS NULL` — if B already claimed, no-op; if unclaimed, first claimer wins; no enumeration of other operators' DIDs via API |
| Race condition double-claim | Tampering | Atomic `UPDATE WHERE operator_did IS NULL` — DB transaction guarantees at-most-one winner |
| Quota bypass via concurrent requests | Elevation of Privilege | DB-authoritative COUNT query per request (D-39-06) — cannot be gamed by concurrency |
| Cross-operator data exfiltration via brain_did guessing | Information Disclosure | `assertOperatorOwns` checks `req.didContext.operatorDid` matches stored `operator_did` on every `operator/me/*` data accessor call |
| operator_did leaking into audit chain | Information Disclosure | Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS forbids `token` in audit payloads; D-39-09 confirms no audit event is fired for scope violations; no `operator_did` crosses the audit chain |

---

## Sources

### Primary (HIGH confidence)
- `grid/src/db/schema.ts` — confirmed migration versions v1-v26; grid_config at v5; brain_tokens at v25/v26
- `grid/src/api/preHandlers/tryDid.ts` — confirmed operatorDid set on both Brain JWT path (line 93) and Portal session path (line 133)
- `grid/src/api/preHandlers/types.ts` — confirmed DIDContext interface with optional operatorDid
- `grid/src/api/policy.ts` — confirmed ROUTE_DID_POLICY enum values including portal_session_required; confirmed Phase 38 routes
- `grid/src/api/routes/brain-token.ts` — confirmed Phase 38 route is frozen; confirmed upsert pattern
- `grid/src/db/stores/brain-token-store.ts` — confirmed existing BrainTokenStore API shape
- `grid/src/api/rate-limit/visitor-bucket.ts` — confirmed "Phase 39: refactor to per-DID buckets" comment
- `grid/src/lore/LoreQuotaTracker.ts` — confirmed in-memory quota pattern (Phase 39 uses DB instead, per D-39-06)
- `grid/src/api/server.ts` — confirmed GridServices interface shape; existing service injection pattern
- `scripts/check-sole-producer-discipline.mjs` — confirmed CI gate pattern (walk dir, grep, exit 0/1)
- `scripts/check-did-policy-coverage.mjs` — confirmed policy coverage gate is active
- `.github/workflows/rig-invariants.yml` — confirmed active CI gates including check-civic-did-issuance-path from Phase 37
- `.planning/phases/39-grid-multi-tenancy/39-CONTEXT.md` — all locked decisions
- `.planning/REQUIREMENTS.md` — TENANT-01..03 exact text
- `.planning/STATE.md` — accumulated context, allowlist state, forbidden keys
- `.planning/ROADMAP.md` — Phase 39 success criteria and allowlist delta = 0

### Secondary (MEDIUM confidence)
- `grid/package.json` — confirmed vitest run as test command, dependency versions

### Tertiary (LOW confidence)
- None. All factual claims verified directly from source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json; no new deps needed
- Architecture: HIGH — preHandler pattern, BrainTokenStore extension, migration pattern all verified from existing code
- Pitfalls: HIGH — each pitfall verified against the specific code it references (schema.ts v5, visitor-bucket.ts comment, policy.ts enum, tryDid.ts operatorDid assignment)
- CI gate pattern: HIGH — check-sole-producer-discipline.mjs read and confirmed as template

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable codebase; decisions locked in CONTEXT.md)
