# Phase 39: Grid Multi-Tenancy — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A single Public Grid serves N operators. Their Nous coexist civically (shared Civic-DID registry, Government, Marketplace, audit chain) but operator-controlled metadata (Brain wire tokens, operator-DID linkage, operator settings) is isolated per-operator. Cross-operator metadata access is impossible at the API + type-system level.

This phase ships TENANT-01, TENANT-02, TENANT-03.
Depends on: Phase 38 (Brain bearer tokens — the basis for operatorScope).
Downstream: Phase 40 (Local AI), Phase 41 (Sleep Cycle), Phase 44+ (all civic institution routes will respect operatorScope boundary).

</domain>

<decisions>
## Implementation Decisions

### Operator-Brain Ownership Linkage (Area 1)

- **D-39-01:** Operator-to-Brain ownership uses a **two-step Portal-gated claim model**. Step 1: Brain registers its token via `POST /api/v1/brain/token/register` exactly as shipped in Phase 38 (format unchanged, no operator_did in request). Step 2: Human operator calls `POST /api/v1/operator/me/brains` with Portal session bearer to claim ownership of a specific brain_did. Migration v27 adds a nullable `operator_did VARCHAR(255)` column to `brain_tokens` table. `operatorScope` middleware derives operator_did via: extract `iss` (brain_did) from JWT → query `brain_tokens WHERE brain_did = iss` → get `operator_did`. Rationale: two separate auth proofs (Brain proves existence key, operator proves Portal account) = stronger ownership verification than 1-step; Phase 38 token registration format stays stable.

- **D-39-02:** Unclaimed Brain tokens (registered but no Portal claim yet) are **functional but tracked in a Henry-visible "unowned" pool**. Unclaimed Brains can still `POST /api/v1/brain/actions` and receive firehose. They appear in Steward Console `/system/operators` under an "Unowned Brains" section. They do NOT count against any operator's quota until claimed. Rationale: prevents silent breakage of Brains registered before Phase 39 ships; Henry can identify and contact operators who haven't completed the claim step.

### operator/me/* Namespace (Area 2)

- **D-39-03:** `GET /api/v1/operator/me/nous` returns **rich per-Nous metadata** per entry:
  ```
  {
    civic_did: string,
    brain_did: string,
    status: 'active' | 'away' | 'revoked',
    last_active_tick: number,
    zone_id: string | null,
    civic_standing: 'provisional' | 'full' | null,
    quota_usage: { brain_processes: number, limit: number },
    token_expires_at: number   // unix seconds
  }
  ```
  Enables Steward Console fleet view without extra round-trips.

- **D-39-04:** Phase 39 ships these `operator/me/*` routes:
  - `GET  /api/v1/operator/me/nous` — operator's Nous list (D-39-03)
  - `POST /api/v1/operator/me/brains` — claim a Brain-DID (D-39-01)
  - `GET  /api/v1/operator/me/quota` — `{ brain_processes: { current, limit }, event_rate: { per_did_per_min, limit }, p2p_bandwidth_cap_bytes: number }`
  - `GET  /api/v1/operator/me/settings` — operator-scoped preferences (placeholder for Phase 40+ config)
  - `PATCH /api/v1/operator/me/settings` — update operator settings
  All routes are `portal_session_required` per D-36-17 policy enum.

- **D-39-05:** `operator/me/*` routes accept **Portal session token only** (HTTP-only cookie, same as Phase 36 `portal_session_required` policy). Brain JWTs (Phase 38 EdDSA bearer) remain for action dispatch routes only. Rationale: humans manage their fleet from Steward Console with Portal session; Brains dispatch actions autonomously. Clean separation of auth contexts.

### Quota Storage + Configurability (Area 3)

- **D-39-06:** Brain-process quota is **derived from `brain_tokens` count** at claim time:
  ```sql
  SELECT COUNT(*) FROM brain_tokens
  WHERE operator_did = ? AND revoked = 0 AND expires_at > UNIX_TIMESTAMP()
  ```
  No separate quota counter table. DB is authoritative — cannot be gamed by timing exploits or Grid restarts. Attempting to claim a Brain when count ≥ limit returns `429 { error: 'quota_exceeded', resource: 'brain_processes', current: N, limit: N }`.

- **D-39-07:** Henry configures quota defaults and per-operator overrides via **Steward Console `/system/operators` page** (Tier-2 Grid Manager surface per D-V3-36). Runtime changes, no Grid restart. The page shows: unowned pool, claimed Brains per operator, current quota usage, edit controls for per-operator limit overrides. Default quota (brain_processes: 3) stored in `grid_config` key-value table; per-operator overrides stored alongside `operator_did` in a new `operator_quota_overrides` table (migration v28). If no per-operator override exists, global default applies.

- **D-39-08 (Claude's Discretion):** Per-Civic-DID rate limit value — planner sets a reasonable default in config (suggested: 600 req/min = 5× the visitor 120/min from D-36-05), calibrated against observed Phase 38 traffic patterns. Configurable via Steward Console same page as D-39-07. D-36-05 is closed by this decision.

### operatorScope Security Logging (Area 4)

- **D-39-09:** When `operatorScope` blocks a cross-operator data access attempt, log a **Pino structured warning** (no audit chain event):
  ```
  { level: 'warn', event: 'operator_scope_violation', requesting_operator_did, target_operator_did, route, tick }
  ```
  Internal log only. Consistent with Phase 33 patterns (Pino structured logging throughout). Henry queries via Steward Console log viewer. No new allowlist entry needed. Rationale: adds forensic capability without audit chain overhead on every attempted violation.

### TypeScript Enforcement

- **D-39-10:** The new `grid/src/operator/data/` module contains all per-operator data accessor functions. Every function in this module MUST include `operatorDid: string` as a parameter (CI gate `scripts/check-operator-scope-typing.mjs` enforces this via grep on function signatures). This is the TENANT-02 compile-time discipline: code that forgets to scope by operator cannot pass CI.

### Claude's Discretion

- Per-DID rate limit exact value (D-39-08): 600 req/min suggested default, tune based on Phase 38 traffic
- `me/settings` initial field set: minimal placeholder for Phase 40 Local AI config; exact fields TBD by planner
- `operatorScope` Fastify preHandler exact implementation shape (hook vs plugin vs wrapper — follow Phase 36 preHandler patterns)
- Migration version numbers: v27 = `brain_tokens.operator_did` column; v28 = `operator_quota_overrides` table
- `grid_config` key-value table format (check if it already exists; if not, add as part of v27 or v28)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v3.0 architecture source-of-truth
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 — three-layer architecture, Portal/Grid/Brain separation, constitutional operator framework (D-V3-18)
- `.planning/research/v3.0/ARCHITECTURE-v3.0.html` — canonical visual reference

### Phase 39 requirements
- `.planning/REQUIREMENTS.md` TENANT-01..03 — the 3 REQs this phase delivers

### Phase 38 (immediate predecessor — MUST read)
- `grid/src/db/stores/brain-token-store.ts` — BrainTokenStore methods; D-39-01 adds operator_did column (migration v27); store API will need new methods: `setOwner(brainDid, operatorDid)`, `findByOperator(operatorDid)`, `countActiveByOperator(operatorDid)`
- `grid/src/api/routes/brain-token.ts` — `POST /api/v1/brain/token/register` route (Phase 38, unchanged by Phase 39)
- `grid/src/db/schema.ts` — migration history; Phase 39 adds v27 (brain_tokens.operator_did) and v28 (operator_quota_overrides)

### Phase 36 (auth policy foundation)
- `grid/src/api/policy.ts` — ROUTE_DID_POLICY table; add `operator/me/*` routes with `portal_session_required` policy
- `grid/src/api/preHandlers/tryDid.ts` — Phase 36 preHandler pattern; `operatorScope` follows same shape

### Constitutional invariants
- `PHILOSOPHY.md` §1, §9 — first-life, sovereignty, constitutional substrate operator framework
- `CLAUDE.md` GSD Workflow Notes — allowlist freeze discipline, 3-tier management taxonomy (D-V3-36), Polis naming convention

### Frozen contracts (do not break)
- Phase 31-34 audit chain invariants — R-31-01 zero-diff; Phase 32 `/health/detailed` D-32-C3 frozen shape; additive extension allowed
- Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS (13 keys frozen) — `operator_did` must not appear in any auditable payload that crosses the wire
- v2.2 VOTE-05 Nous-only governance invariant

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`BrainTokenStore`** (`grid/src/db/stores/brain-token-store.ts`) — extend with: `setOwner(brainDid, operatorDid)`, `findByOperator(operatorDid)`, `countActiveByOperator(operatorDid)` methods for D-39-01/D-39-06
- **`LoreQuotaTracker`** (`grid/src/lore/LoreQuotaTracker.ts`) — pattern reference only; Phase 39 uses DB-derived quota (D-39-06), not in-memory
- **Phase 36 preHandler pattern** (`grid/src/api/preHandlers/tryDid.ts`) — `operatorScope` follows same Fastify preHandler shape; chains after `tryDid`
- **Pino structured logging** (throughout `grid/src/`) — D-39-09 `operator_scope_violation` warning follows existing patterns

### Established Patterns
- **`INSERT IGNORE` idempotency** (Phase 37-38 pattern) — Brain claim endpoint (`POST /operator/me/brains`) uses INSERT IGNORE on `brain_tokens.operator_did` update or a claim table; prevents double-claim
- **Sole-producer + closed-tuple discipline** — applies to any new audit events; Phase 39 adds 0 audit events (TENANT-03 allowlist delta = 0 per ROADMAP)
- **`portal_session_required` policy** (Phase 36 D-36-17) — all `operator/me/*` routes use this policy value
- **D-V3-36 3-tier management** — Steward Console `/system/operators` is Tier-2 Grid Manager surface (Henry's per-Grid tool); not exposed to operators

### Integration Points
- **Steward Console** — new `/system/operators` page (Tier-2 Grid Manager surface); shows unowned pool, per-operator quota usage, edit controls for overrides
- **`grid/src/api/server.ts`** — `operatorScope` preHandler registered as Fastify hook; new `grid/src/operator/data/` module with CI-enforced typed accessors
- **`/health/detailed` payload** (D-32-C3 frozen + additive) — `GET /api/v1/operator/me/quota` is a separate endpoint; if per-operator quota stats appear in `/health/detailed` they must be additive only (new top-level key)

</code_context>

<specifics>
## Specific Ideas

- Two-step Portal claim was explicitly chosen over extending Phase 38 JWT format — the Phase 38 Brain JWT is intentionally stable; don't touch it.
- Unclaimed Brains are functional but visible to Henry in Steward Console — creates a "claim it or Henry notices" incentive without hard-blocking existing Brains.
- `me/settings` is a placeholder namespace — planner decides initial field set; expected to grow in Phase 40 (Local AI config), Phase 41 (sleep thresholds), etc.
- Grid Manager `/system/operators` is Henry-only (Tier-2); operators cannot see each other's quota details.

</specifics>

<deferred>
## Deferred Ideas

- Per-operator UI customization in Dashboard (e.g., custom avatar palette, branded landing) — explicitly out of scope per ROADMAP Phase 39 out-of-scope note
- Federated multi-Grid operator accounts (FUTURE-MULTIGRID-01) — deferred to v3.x
- Operator billing for hosting (Henry's commercial concern) — out of v3.0 scope
- Brain JWT extended with `operator_did` claim — rejected in discuss; JWT format stays stable (Phase 38 commitment)
- `operator.scope_violation` audit event — rejected; Pino warning is sufficient (no new allowlist entry needed)

</deferred>

---

*Phase: 39-grid-multi-tenancy*
*Context gathered: 2026-05-27*
