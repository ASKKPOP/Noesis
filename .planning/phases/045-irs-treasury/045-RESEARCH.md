# Phase 45: IRS Treasury — Research

**Researched:** 2026-05-28
**Domain:** Civic treasury management, audit event allowlisting, government-authorized disbursements
**Confidence:** HIGH

---

## Summary

Phase 45 is primarily a **continuation and completion** of work started in Phase 44, not greenfield development. Phase 44 created the `civic_treasury` table (migration v35), the `MarketplaceStore.settle()` method that credits the treasury atomically, and both sole-producer files (`append-irs-tax-collected.ts` and `append-irs-disbursement-executed.ts`) as audit-chain-only events. Phase 45's job is to:

1. Promote all three IRS audit events to the broadcast allowlist (+3: positions 73/74/75).
2. Create a new sole-producer file `append-irs-disbursement-authorized.ts` (position 74 — the new event).
3. Add public treasury read endpoint (`GET /api/v1/irs/treasury`).
4. Add government-authorized disbursement endpoint (`POST /api/v1/irs/disburse`).
5. Add public audit history endpoint (`GET /api/v1/irs/audit/:period`).

The phase is bounded by two hard constraints: D-V3-22 (no income/wealth tax, only transaction fees) and D-V3-21 (disbursements require Government authorization — the existing `verifyGovernmentSession` stub with an adapted claim serves this purpose in Phase 45, pending Phase 46 real Government).

The audit history endpoint (`GET /api/v1/irs/audit/:period`) requires querying the persistent MySQL `audit_trail` table by event_type + tick range, since the in-memory `AuditChain.query()` has no tick-range filter and the chain is unbounded in production.

**Primary recommendation:** Build Phase 45 as 3 focused plans — (1) Wave 0 test infrastructure + allowlist gate RED→GREEN, (2) IRS service layer + audit producers, (3) IRS routes + ROUTE_DID_POLICY entries + doc-sync.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IRS-01 | Each settled marketplace transaction triggers automatic IRS fee deduction at configured rate; fee transferred atomically before seller payout | Phase 44 already implemented in `MarketplaceStore.settle()` + `appendIrsTaxCollected()`. Phase 45 adds to allowlist only — zero new settlement logic. |
| IRS-02 | Civic treasury balance tracked in `civic_treasury` table; public read-only view via `GET /api/v1/irs/treasury` returning `{balance_bios, last_updated_tick, current_rate_percent}` | Table exists (migration v35). Need new Fastify route + ROUTE_DID_POLICY: public entry + `Cache-Control: max-age=10`. |
| IRS-03 | Government can authorize treasury disbursements via passed legislation; `POST /api/v1/irs/disburse` requires valid Government authorization signature; two audit events fire (authorized + executed) | Uses existing `verifyGovernmentSession()` stub; needs `legislation_ref` claim in JWT instead of `court_conviction_ref`; new IrsStore.disburse() atomic transaction. |
| IRS-04 | Public audit endpoint `GET /api/v1/irs/audit/:period` returns all collections + disbursements; 3 sole-producer audit events added to allowlist (+3: 72→75) | Needs MySQL query on `audit_trail` by event_type IN (irs.*) + tick range. `period` param parsed as tick range or calendar string. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| IRS fee collection | API / Backend (Grid) | — | Already wired in Phase 44 settlement path; atomic DB transaction is Grid's responsibility |
| Treasury balance read | API / Backend (Grid) | CDN/Static (cache header) | `civic_treasury` table lives in Grid MySQL; Cache-Control max-age=10 per SC-2 |
| Disbursement authorization | API / Backend (Grid) | — | Government JWT verification happens at Grid API layer via `verifyGovernmentSession` |
| Disbursement execution | API / Backend (Grid) | Database / Storage | Atomic balance deduction in MySQL `civic_treasury`; audit event post-commit |
| Audit history query | API / Backend (Grid) | Database / Storage | In-memory `AuditChain` has no tick-range filter; production query must hit MySQL `audit_trail` directly |
| Allowlist promotion | API / Backend (Grid) | — | `broadcast-allowlist.ts` is a Grid-internal config constant |

---

## Standard Stack

### Core (verified against existing project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mysql2/promise | (project dep) | MySQL pool queries for `civic_treasury` + `audit_trail` | Already the Grid DB driver throughout |
| fastify | (project dep) | HTTP route registration | All Grid routes use Fastify |
| jose | (project dep) | JWT verification for government session | Already imported in `government-session.ts` |
| node:crypto | built-in | sha256Hex for DID hashing in audit payloads | Used throughout the audit event producers |

[VERIFIED: codebase grep — all libraries confirmed in use across phases 37-44]

### No New Dependencies

Phase 45 introduces zero new npm dependencies. All patterns are already established.

[VERIFIED: codebase inspection]

---

## Architecture Patterns

### System Architecture Diagram

```
market.settle() [Phase 44]
        │
        ├─► appendMarketSettled()     (pos 71, already on allowlist)
        └─► appendIrsTaxCollected()  (pos 73, Phase 45 adds to allowlist)
                │
                ▼
          civic_treasury table (migration v35, already exists)
                │
        ┌───────┼──────────────────────┐
        │       │                      │
        ▼       ▼                      ▼
GET /irs/treasury  POST /irs/disburse  GET /irs/audit/:period
  (public,            (government_only,       (public,
   max-age=10)         legislation_ref)        tick range query
                        │                      against audit_trail)
                  appendIrsDisbursementAuthorized (pos 74, NEW)
                  appendIrsDisbursementExecuted   (pos 75, Phase 41 pre-empted)
                        │
                  civic_treasury UPDATE (atomic deduction)
```

### Recommended Project Structure

New files for Phase 45:

```
grid/src/
├── irs/
│   └── irs-store.ts               # getTreasuryBalance, disburse (atomic), getAuditHistory
├── audit/
│   └── append-irs-disbursement-authorized.ts  # NEW sole-producer (pos 74)
│   └── append-irs-tax-collected.ts            # already exists, Phase 45 adds to allowlist
│   └── append-irs-disbursement-executed.ts    # already exists, Phase 45 adds to allowlist
└── api/routes/
    └── irs.ts                      # 3 IRS routes
```

`broadcast-allowlist.ts` gains 3 new entries (positions 73, 74, 75). `policy.ts` gains 3 ROUTE_DID_POLICY entries.

### Pattern 1: Sole-Producer Audit Event (9-step discipline)

Every IRS audit event must follow the exact 9-step discipline established in earlier phases. Phase 45 creates one NEW sole-producer file and adds two existing ones to the allowlist.

```typescript
// Source: grid/src/audit/append-irs-tax-collected.ts (established pattern)
export function appendIrsDisbursementAuthorized(
    audit: AuditChain,
    payload: IrsDisbursementAuthorizedPayload,
): AuditEntry {
    // 1. Type guard
    // 2. Regex: legislation_ref_hash (HEX64_RE)
    // 3. Regex: authorized_by_civic_did_hash (HEX64_RE)
    // 4. Non-empty: grid_name
    // 5. Non-negative integer: amount_bios
    // 6. Non-negative integer: tick
    // 7. Closed-tuple structural check (alphabetical)
    // 8. Explicit reconstruction (no spread)
    // 9. Privacy gate + audit.append
    return audit.append('irs.disbursement_authorized', payload.authorized_by_civic_did_hash, cleanPayload);
}
```

[VERIFIED: pattern from grid/src/audit/append-irs-tax-collected.ts + append-irs-disbursement-executed.ts]

### Pattern 2: Government Authorization for Disbursement

The existing `verifyGovernmentSession()` stub uses `court_conviction_ref` as the payload claim. For IRS disbursements the analogous claim is `legislation_ref`. Phase 45 needs to either:

(a) Extend `verifyGovernmentSession()` to also accept a `legislation_ref` claim (returning it alongside `courtConvictionRef`), OR
(b) Create a parallel `verifyGovernmentDisbursementAuth()` function that checks for `legislation_ref`.

Option (b) is cleaner (single-responsibility) and avoids complicating the Phase 37 revocation path. The IRS disburse route calls it independently.

```typescript
// grid/src/civic-registry/government-session.ts — extend return type
export type DisbursementAuthResult =
    | { ok: true; legislationRef: string }
    | { ok: false; reason: 'legislation_auth_required' | 'legislation_ref_required' };

export async function verifyDisbursementAuth(
    authHeader: string | undefined,
): Promise<DisbursementAuthResult> {
    // Same JWT verification as verifyGovernmentSession,
    // but checks payload.legislation_ref instead of court_conviction_ref
}
```

[ASSUMED — architecture design choice; no prior art for disbursement auth in codebase]

### Pattern 3: Treasury Balance Query

`civic_treasury` table has a single row per `grid_name`. The read is a simple SELECT:

```typescript
// IrsStore.getTreasuryBalance()
const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_bios, last_updated_tick FROM civic_treasury WHERE grid_name = ?`,
    [gridName],
);
const irsFeeRate = await getConfigValue(pool, gridName, 'irs_fee_rate');
return {
    balance_bios: Number(rows[0]?.balance_bios ?? 0),
    last_updated_tick: rows[0]?.last_updated_tick ?? 0,
    current_rate_percent: Number(irsFeeRate ?? '0.02') * 100,
};
```

[VERIFIED: civic_treasury schema from grid/src/db/schema.ts migration v35]

### Pattern 4: IRS Audit History (tick-range query on audit_trail)

The in-memory `AuditChain.query()` has no tick filter. The `GET /api/v1/irs/audit/:period` endpoint must query MySQL `audit_trail` directly for the IRS event types within a tick range:

```typescript
// IrsStore.getAuditHistory(params: {gridName, fromTick, toTick})
const IRS_EVENT_TYPES = ['irs.tax_collected', 'irs.disbursement_authorized', 'irs.disbursement_executed'];
const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, event_type, actor_did, payload, created_at
     FROM audit_trail
     WHERE grid_name = ? AND event_type IN (?, ?, ?)
       AND created_at >= ? AND created_at <= ?
     ORDER BY id ASC`,
    [gridName, ...IRS_EVENT_TYPES, fromTick, toTick],
);
```

**Period parameter interpretation:** The `:period` URL param should be parsed as a tick range. Two formats are reasonable:
- `<fromTick>-<toTick>` (e.g. `/irs/audit/0-10000`) — recommended for v3.0
- Calendar strings (e.g. `/irs/audit/2026-05`) — deferred; requires tick→wall-clock mapping not in v3.0 scope

`period` = `current` is a useful alias for the last 1000 ticks.

[ASSUMED — `:period` param format interpretation; SC-4 says "JSON array sorted by tick and includes chain entry IDs"]

### Pattern 5: Atomic Disbursement Transaction

The disbursement must deduct from `civic_treasury` atomically:

```typescript
// IrsStore.disburse()
// Read fee rate OUTSIDE transaction (same Pitfall 1 pattern as marketplace)
const conn = await pool.getConnection();
try {
    await conn.beginTransaction();
    const [treasuryRows] = await conn.query<RowDataPacket[]>(
        `SELECT balance_bios FROM civic_treasury WHERE grid_name = ? FOR UPDATE`,
        [gridName],
    );
    const currentBalance = BigInt(treasuryRows[0]?.balance_bios ?? 0);
    if (currentBalance < amountBios) {
        await conn.rollback();
        throw new Error('insufficient_treasury_balance');
    }
    await conn.query(
        `UPDATE civic_treasury SET balance_bios = balance_bios - ?, last_updated_tick = ?
         WHERE grid_name = ?`,
        [amountBios.toString(), currentTick, gridName],
    );
    await conn.commit();
    return { newBalance: currentBalance - amountBios };
} finally {
    conn.release();
}
```

[VERIFIED: follows same `FOR UPDATE` atomic pattern as `MarketplaceStore.settle()` in grid/src/marketplace/marketplace-store.ts]

### Anti-Patterns to Avoid

- **Read `irs_fee_rate` inside the disburse transaction:** The Pitfall 1 pattern from Phase 44 applies — read config values OUTSIDE transactions to avoid potential deadlocks on the `grid_config` table.
- **Skipping `appendIrsTaxCollected` already-existing test stubs:** The test file `grid/test/append-irs-tax-collected.test.ts` already exists and is GREEN (Phase 44 implemented the producer). Phase 45 only needs to update the allowlist count gate in `broadcast-allowlist.test.ts`.
- **Modifying `MarketplaceStore.settle()` in Phase 45:** The settlement IRS logic is already correct and complete. Phase 45 must NOT touch it.
- **Using `AuditChain.query()` for the `/irs/audit/:period` endpoint:** The in-memory chain has no tick-range filter and may be truncated. Always query `audit_trail` MySQL table directly for the history endpoint.
- **Emitting `irs.disbursement_authorized` AND `irs.disbursement_executed` from the same function call site:** These are two separate events with distinct payloads and different timing (authorized = on JWT verification success; executed = after DB transfer commits). They must be emitted sequentially in the route handler, not inside `IrsStore.disburse()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Treasury balance caching | Custom TTL cache | `Cache-Control: max-age=10` HTTP header | The route itself is fast; HTTP caching at the browser/CDN is sufficient per SC-2 |
| Government JWT signing | Custom signing logic | Existing `jose` + `keyPairPromise` in `government-session.ts` | Phase 37 already established this pattern |
| Period-to-tick mapping | Calendar parser | Simple `<fromTick>-<toTick>` URL format | Phase 57 has no tick→wall-clock mapping; calendar dates require extra complexity |
| Audit history pagination | Full result set | `LIMIT 500 OFFSET N` pattern | Large grids may have many IRS events; unbounded queries are dangerous |

---

## Runtime State Inventory

> Phase 45 is not a rename/refactor/migration phase. This section is omitted.

---

## Common Pitfalls

### Pitfall 1: Reading `irs_fee_rate` Inside the Disbursement Transaction

**What goes wrong:** If `irs_fee_rate` is read inside the `FOR UPDATE` transaction on `civic_treasury`, MySQL may deadlock when `civic_treasury` and `grid_config` are locked in different orders across concurrent requests.

**Why it happens:** Phase 44 documented this exact pitfall — `MarketplaceStore.getConfigValue()` is explicitly called OUTSIDE the settle transaction. Phase 45's disbursement does not read the fee rate (it's a fixed amount passed by caller), but if fee-rate config is read in any IRS route, it must be outside any transaction.

**How to avoid:** Read config values before `conn.beginTransaction()`.

[VERIFIED: grid/src/marketplace/marketplace-store.ts line 313 comment + Phase 44 RESEARCH.md Pitfall 1]

### Pitfall 2: `irs.tax_collected` Already On Allowlist Check Required Before Adding

**What goes wrong:** The Wave 0 broadcast-allowlist length gate in `broadcast-allowlist.test.ts` currently asserts `72`. Phase 45 Wave 0 must update it to `75` as a RED gate, then add the 3 events to pass GREEN.

**Why it happens:** The test is a hard count gate. Any mismatch (adding only 2 events, or adding to wrong position) fails the test immediately.

**How to avoid:** Wave 0 plan must be explicit: update test to assert `75`, THEN add 3 events to `ALLOWLIST_MEMBERS` in order (73: `irs.tax_collected`, 74: `irs.disbursement_authorized`, 75: `irs.disbursement_executed`).

[VERIFIED: grid/test/audit/broadcast-allowlist.test.ts lines 11-16 — currently asserts 72]

### Pitfall 3: Existing `append-irs-disbursement-executed.ts` Has Wrong Payload Shape for Phase 45

**What goes wrong:** The Phase 41 `appendIrsDisbursementExecuted` was created for the `presumed_departed` case with payload `{amount_bios, cause, civic_did, grid_name, tick}`. Phase 45 disbursements have a different context (Government-authorized, not automatic departure).

**Why it happens:** Two different code paths call `appendIrsDisbursementExecuted` — the Phase 41 escalation-check path (cause: 'presumed_departed') and the Phase 45 Government-authorized disbursement path. The same sole-producer file must handle both.

**How to avoid:** The existing 5-key closed tuple `{amount_bios, cause, civic_did, grid_name, tick}` is actually usable for Phase 45 disbursements if `cause` is set to `'government_disbursement'` and `civic_did` is set to `GOV_SESSION_ISSUER_DID` ('did:gov:noesis:genesis-polis'). Alternatively, document as a known constraint that Phase 45 uses `cause='government_disbursement'`. Do NOT change the payload shape — that would break the Phase 41 tests.

[VERIFIED: grid/src/audit/append-irs-disbursement-executed.ts lines 23-29 — existing closed-tuple shape]

### Pitfall 4: `GET /api/v1/irs/audit/:period` Must Not Return Allowlist-Only Events

**What goes wrong:** The `audit_trail` table contains ALL audit events including non-allowlisted ones (audit-chain-only events like `p2p.signal_received` equivalent). The IRS audit endpoint must only return the three IRS event types.

**Why it happens:** The `audit_trail` MySQL table stores every event regardless of allowlist membership. A naive `WHERE event_type LIKE 'irs.%'` would return anything with an `irs.` prefix.

**How to avoid:** Explicitly enumerate the three event types in the WHERE clause: `event_type IN ('irs.tax_collected', 'irs.disbursement_authorized', 'irs.disbursement_executed')`.

[VERIFIED: grid/src/db/schema.ts migration v2 — audit_trail has no allowlist filtering]

### Pitfall 5: `irs.disbursement_authorized` Is a New Event (Not Pre-Empted)

**What goes wrong:** Unlike `irs.tax_collected` (pre-empted in Phase 44) and `irs.disbursement_executed` (pre-empted in Phase 41), `irs.disbursement_authorized` has NO existing sole-producer file. Phase 45 must create it from scratch.

**Why it happens:** The Phase 41 SLEEP-05 path pre-empted `irs.disbursement_executed` because dormancy Bios transfer needed it. But Government-authorized disbursements didn't exist at Phase 41 time.

**How to avoid:** Wave 0 plan explicitly notes: create `append-irs-disbursement-authorized.ts` as a NEW file (position 74). This is the one genuinely new audit event in Phase 45.

[VERIFIED: codebase search — no `append-irs-disbursement-authorized.ts` file exists anywhere]

### Pitfall 6: Double-Emit Risk — `irs.disbursement_executed` Called From Two Places

**What goes wrong:** After Phase 45 ships, `appendIrsDisbursementExecuted` is called from both `grid/src/civic-presence/escalation-check.ts` (Phase 41 path) AND the new `grid/src/api/routes/irs.ts` (Phase 45 path). This is CORRECT (it's the sole-producer, but with multiple callers using different `cause` values). However, CI gate `check-sole-producer-discipline.mjs` may flag this as a violation if it counts call sites.

**Why it happens:** Sole-producer discipline means ONE file can call `audit.append('irs.disbursement_executed', ...)` — that file is `append-irs-disbursement-executed.ts`. Multiple callers of that function are fine. The CI gate checks that `audit.append` with event type `'irs.disbursement_executed'` only appears in the designated sole-producer file.

**How to avoid:** Both the escalation-check route and the IRS disburse route must call `appendIrsDisbursementExecuted()` (the function), never call `audit.append('irs.disbursement_executed', ...)` directly.

[VERIFIED: grid/src/civic-presence/escalation-check.ts imports + calls `appendIrsDisbursementExecuted`]

---

## Code Examples

### Example 1: IRS Treasury GET Route

```typescript
// Source: Pattern follows grid/src/api/routes/market.ts structure
// GET /api/v1/irs/treasury (public, Cache-Control: max-age=10)
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

### Example 2: Allowlist Addition (positions 73, 74, 75)

```typescript
// Source: broadcast-allowlist.ts — append after 'market.disputed' (72)
// Phase 45 (IRS-04) — IRS treasury lifecycle events. Allowlist 72 → 75.
// irs.tax_collected (73): pre-empted in Phase 44 (D-44-03); Phase 45 promotes to broadcast.
//   Sole-producer: grid/src/audit/append-irs-tax-collected.ts
//   Closed 5-key payload: {amount_bios, listing_id, payer_civic_did_hash, tick, total_treasury_after}
// irs.disbursement_authorized (74): NEW in Phase 45 — Government-signed legislation authorization.
//   Sole-producer: grid/src/audit/append-irs-disbursement-authorized.ts (Phase 45 creates)
// irs.disbursement_executed (75): pre-empted in Phase 41 (SLEEP-05); Phase 45 promotes to broadcast.
//   Sole-producer: grid/src/audit/append-irs-disbursement-executed.ts
'irs.tax_collected',           // (73)
'irs.disbursement_authorized', // (74) NEW
'irs.disbursement_executed',   // (75)
```

### Example 3: Proposed Closed-Tuple for `irs.disbursement_authorized`

```typescript
// Source: ASSUMED — analogous to IrsTaxCollectedPayload in append-irs-tax-collected.ts
const HEX64_RE = /^[0-9a-f]{64}$/i;

export interface IrsDisbursementAuthorizedPayload {
    readonly amount_bios: number;                         // positive integer
    readonly authorized_by_civic_did_hash: string;        // HEX64_RE — Government Speaker civic-did hash
    readonly grid_name: string;                           // non-empty
    readonly legislation_ref_hash: string;                // HEX64_RE — sha256 of legislation_ref string
    readonly tick: number;                                // non-negative integer
}
// Keys (alphabetical): amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick
```

Note: `legislation_ref` (plaintext) is stored only in an IRS disbursements table, not in the audit payload. Only the hash crosses the wire. This mirrors the `court_conviction_ref` discipline in `append-registry-civic-did-revoked.ts`.

[ASSUMED — payload design; no prior `irs.disbursement_authorized` producer exists]

### Example 4: ROUTE_DID_POLICY Additions

```typescript
// Source: grid/src/api/policy.ts — add to ROUTE_DID_POLICY
// Phase 45 (IRS-01..04) — IRS treasury routes.
// GET /api/v1/irs/treasury: public per SC-2 (no auth required).
// POST /api/v1/irs/disburse: government_only — requires Government authorization signature per D-V3-21.
// GET /api/v1/irs/audit/:period: public per SC-4 (public transparency required).
'GET /api/v1/irs/treasury':           'public',
'POST /api/v1/irs/disburse':          'government_only',
'GET /api/v1/irs/audit/:period':      'public',
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `irs.tax_collected` as audit-chain-only (D-44-03) | Promoted to broadcast allowlist at position 73 | Phase 45 | WSS firehose now broadcasts IRS collection events |
| `irs.disbursement_executed` as audit-chain-only (Phase 41) | Promoted to broadcast allowlist at position 75 | Phase 45 | Dormancy Bios transfers now broadcast-visible |
| Government session verifies `court_conviction_ref` only | Extended to verify `legislation_ref` for disbursements | Phase 45 | Disbursement auth reuses JWT infrastructure without court-order semantics |

**Deprecated/outdated:**
- The `civic_treasury` row may not exist until first settlement after migration v35. IRS routes must handle `NULL` result from SELECT (default to 0 balance).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `irs.disbursement_authorized` closed-tuple is 5 keys: `{amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick}` | Code Examples §3 | Wrong key set fails closed-tuple validation at audit.append; planner must confirm shape |
| A2 | `period` URL param in `/irs/audit/:period` is parsed as `<fromTick>-<toTick>` or `current` | Architecture Patterns §4 | If calendar strings required, tick→wall-clock mapping is needed (not in v3.0 scope) |
| A3 | `verifyGovernmentSession` is extended/cloned for `legislation_ref` claim instead of `court_conviction_ref` | Architecture Patterns §2 | If Phase 45 reuses court_conviction_ref semantics, the disbursement flow is semantically incorrect (disbursements are not court orders) |
| A4 | `irs.disbursement_executed` re-uses Phase 41 payload shape with `cause='government_disbursement'` | Pitfall 3 | If payload shape is changed, Phase 41 escalation-check tests break |

**Claims A1-A4 need planner/user confirmation during plan writing.**

---

## Open Questions (RESOLVED)

> All open questions were resolved during planning (Plans 045-01/02/03). Resolutions are locked as Phase 45 decisions (D-45-01..03) and reflected in the plan actions + STATE.md Phase 45 close-out.

1. **`irs.disbursement_authorized` payload shape — 5-key or 6-key?** — **RESOLVED → 5 keys (D-45-01).**
   - What we know: Phase 44 `irs.tax_collected` uses a 5-key payload. Phase 41 `irs.disbursement_executed` uses a 5-key payload. SC-3 says "disbursement_authorized fires on Government signing."
   - What's unclear: Should the payload include the disbursement recipient (e.g., `recipient_civic_did_hash`) or keep it off-chain for privacy? Including it adds a 6th key.
   - Recommendation: Keep 5 keys (amount, authorized_by_hash, grid_name, legislation_ref_hash, tick). Recipient is an operational detail stored in an `irs_disbursements` DB table, not an audit concern — mirrors how `business_name` is off-chain in `registry.business_did_registered`.
   - **Resolution (D-45-01):** Locked to 5-key closed tuple `{amount_bios, authorized_by_civic_did_hash, grid_name, legislation_ref_hash, tick}`. Recipient stays off-chain. Implemented by Plan 02 in `grid/src/audit/append-irs-disbursement-authorized.ts`.

2. **`period` format for `/irs/audit/:period`** — **RESOLVED → tick-range format `<fromTick>-<toTick>` or literal `current` (D-45-02).**
   - What we know: SC-4 says "balance + every collection + every disbursement in the period as a JSON array sorted by tick."
   - What's unclear: Is `period` a tick range, a calendar month, or an opaque "epoch" concept?
   - Recommendation: Use `<fromTick>-<toTick>` format for v3.0. `current` alias returns last 1000 IRS events. Calendar dates require Phase 45 to know tick→wall-clock mapping which is not exposed via current AuditEntry structure.
   - **Resolution (D-45-02):** Locked to strict regex `/^(\d+)-(\d+)$/` or the literal string `current` (which maps to the last 1000 ticks). Garbage period strings return HTTP 400 `invalid_period`. Calendar-date support is explicitly deferred (no tick→wall-clock mapping ships in v3.0). Implemented by Plan 03 in `grid/src/api/routes/irs.ts` (GET /irs/audit/:period handler).

3. **Does `POST /api/v1/irs/disburse` need to track recipients?** — **RESOLVED → No `irs_disbursements` table in Phase 45 (D-45-03).**
   - What we know: SC-3 says "pay library curators 500 Bios" — the legislation authorizes a specific payment with a target.
   - What's unclear: Does Phase 45 store a separate `irs_disbursements` table with recipient details, or just deduct from treasury with an audit event?
   - Recommendation: Create a lightweight `irs_disbursements` table (migration v36) to track `{disbursement_id, grid_name, amount_bios, legislation_ref, authorized_at_tick, executed_at_tick}`. This supports SC-4's requirement that the audit history is queryable and includes chain entry IDs. The `irs_disbursements` table is the plain-text record; the audit chain has hash-only.
   - **Resolution (D-45-03):** Reversed the recommendation — Phase 45 ships NO `irs_disbursements` table. The `audit_trail` query (via `IrsStore.getAuditHistory` with explicit `event_type IN (...)`) is the canonical disbursement history and already includes chain entry IDs per SC-4. Adding a separate table would force migration v36 with zero operational value beyond what audit_trail provides. Recipient identity remains off-chain in the JWT's `legislation_ref` payload, never persisted by Phase 45. Implemented by Plan 02 (`IrsStore.getAuditHistory`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL / mysql2 pool | IrsStore, all DB queries | ✓ | project dep | — |
| jose (JWT) | verifyDisbursementAuth | ✓ | project dep | — |
| Vitest | test suite | ✓ | project dep | — |

[VERIFIED: all confirmed present from prior phases]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (grid) |
| Config file | grid/vitest.config.ts |
| Quick run command | `cd grid && npm run test -- --run` |
| Full suite command | `cd grid && npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IRS-01 | `irs.tax_collected` fires after settlement with correct payload | Unit | `npm run test -- --run append-irs-tax-collected` | ✅ (Phase 44 created) |
| IRS-01 | Allowlist now includes `irs.tax_collected` at position 73 | Unit | `npm run test -- --run broadcast-allowlist` | ✅ (needs update to assert 75) |
| IRS-02 | `GET /api/v1/irs/treasury` returns correct fields without auth | Integration | `npm run test -- --run irs-routes` | ❌ Wave 0 gap |
| IRS-03 | `POST /api/v1/irs/disburse` rejects without gov JWT → 403 | Integration | `npm run test -- --run irs-routes` | ❌ Wave 0 gap |
| IRS-03 | `POST /api/v1/irs/disburse` with valid gov JWT deducts from treasury | Integration | `npm run test -- --run irs-routes` | ❌ Wave 0 gap |
| IRS-03 | `irs.disbursement_authorized` fires on gov signing | Unit | `npm run test -- --run append-irs-disbursement-authorized` | ❌ Wave 0 gap |
| IRS-03 | `irs.disbursement_executed` fires after DB transfer | Unit | `npm run test -- --run append-irs-disbursement-executed` | ✅ (Phase 41 created, tests pass) |
| IRS-04 | `GET /api/v1/irs/audit/:period` returns sorted array with chain IDs | Integration | `npm run test -- --run irs-routes` | ❌ Wave 0 gap |
| IRS-04 | Allowlist count = 75 (+3: tax_collected + disbursement_authorized + disbursement_executed) | Unit | `npm run test -- --run broadcast-allowlist` | ✅ (needs count update to 75) |

### Sampling Rate
- **Per task commit:** `cd grid && npm run test -- --run`
- **Per wave merge:** `cd grid && npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/irs-routes.test.ts` — integration tests for all 3 IRS routes (IRS-02, IRS-03, IRS-04)
- [ ] `grid/test/append-irs-disbursement-authorized.test.ts` — unit tests for new sole-producer (IRS-04)
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — update length assertions from 72 → 75 (RED gate before implementation)

*(Existing: `grid/test/append-irs-tax-collected.test.ts` and `grid/test/append-irs-disbursement-executed.test.ts` already pass — no Wave 0 action needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (POST /irs/disburse) | Government JWT via `jose`; `verifyGovernmentSession` pattern |
| V3 Session Management | no | No session state in IRS routes |
| V4 Access Control | yes | `government_only` policy in ROUTE_DID_POLICY |
| V5 Input Validation | yes | Closed-tuple validation in all sole-producer files; UUID_RE + HEX64_RE |
| V6 Cryptography | no (uses existing) | JWT verification via `jose` — no new crypto |

### Known Threat Patterns for IRS Treasury

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized disbursement (Henry unilaterally drains treasury) | Elevation of Privilege | `government_only` policy gate; `verifyGovernmentSession` requires valid Government JWT; no Henry-direct code path |
| Treasury drain via repeated small disbursements | Denial of Service | `insufficient_treasury_balance` check in `IrsStore.disburse()`; each disbursement requires fresh Government JWT with unique `legislation_ref` |
| Replay of old disbursement JWT | Spoofing | JWT short-lived expiry (inherited from `keyPairPromise` pattern); `legislation_ref` uniqueness should be validated per disbursement |
| Double-emit of `irs.disbursement_executed` (one from escalation-check, one from disburse route) | Tampering | Sole-producer discipline — both callers use `appendIrsDisbursementExecuted()`; different `cause` values distinguish the two paths |

---

## Sources

### Primary (HIGH confidence)

- Codebase — `grid/src/audit/append-irs-tax-collected.ts` — existing sole-producer pattern, payload shape
- Codebase — `grid/src/audit/append-irs-disbursement-executed.ts` — Phase 41 pre-empted sole-producer
- Codebase — `grid/src/audit/broadcast-allowlist.ts` — current 72-member allowlist, positions confirmed
- Codebase — `grid/src/db/schema.ts` migration v35 — `civic_treasury` schema, `grid_config` seed
- Codebase — `grid/src/marketplace/marketplace-store.ts` — `settle()` atomic treasury credit
- Codebase — `grid/src/api/routes/market.ts` — D-44-03 emit ordering, `appendIrsTaxCollected` call site
- Codebase — `grid/src/civic-registry/government-session.ts` — Phase 37 JWT verification stub
- Codebase — `grid/src/api/policy.ts` — `government_only` policy enforcement pattern
- Codebase — `grid/src/api/server.ts` — `GridServices` interface, `verifyGovernmentSession` hook
- Codebase — `grid/test/audit/broadcast-allowlist.test.ts` — confirms current count = 72

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` Phase 44 close-out — confirmed inheritance: `civic_treasury` table owned by Phase 45 IRS logic
- `.planning/REQUIREMENTS.md` IRS-01..IRS-04 — confirmed requirement scope
- `.planning/ROADMAP.md` Phase 45 allowlist additions: +3 (72→75)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all patterns verified in codebase
- Architecture: HIGH — treasury table exists, settlement path wired, audit producers exist; only disbursement route is new design
- Pitfalls: HIGH — most pitfalls discovered from direct code inspection of Phase 44 patterns
- Payload shapes for new events: MEDIUM — A1/A3/A4 in assumptions log need planner confirmation

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days — stable codebase patterns)
