---
phase: 06-operator-agency-foundation-h1-h4
plan: 01
subsystem: audit
tags: [typescript, vitest, audit-chain, agency-tier, sovereignty, broadcast-allowlist]

# Dependency graph
requires:
  - phase: archived/v2.0/01-auditchain-listener-api-broadcast-allowlist
    provides: "ALLOWLIST frozen-set pattern, payloadPrivacyCheck, FORBIDDEN_KEY_PATTERN"
  - phase: 05-reviewernous-objective-only-pre-commit-review
    provides: "Closed-enum typing precedent (ReviewFailureCode); two-source copy pattern for dashboard type mirrors"
provides:
  - "16-member frozen broadcast allowlist including 5 operator.* events in locked D-10 order"
  - "appendOperatorEvent(audit, eventType, actorDid, payload, targetDid?) — sole sanctioned wrapper for emitting operator.* audit events"
  - "requireTierInPayload(eventType, payload) — D-13 tier-required validator (passthrough for non-operator events)"
  - "HumanAgencyTier string-literal union + TIER_NAME map + OPERATOR_ID_REGEX (RFC 4122 v4 strict)"
  - "OperatorEventPayload interface + TierRequiredCheckResult shape"
  - "Payload-privacy producer-boundary gate invoked inside the wrapper (reuses Phase 1 payloadPrivacyCheck unchanged)"
affects: [06-02-agency-indicator, 06-03-elevation-dialog, 06-04-clock-governance-endpoints, 06-05-memory-telos-endpoints, 06-06-sc-e2e-gates, scripts/check-state-doc-sync.mjs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-boundary invariant wrapper (tier-required + payload-privacy gates) around AuditChain.append — chain stays domain-agnostic"
    - "Two-source type mirror with SYNC: header (Grid ↔ dashboard) — consistent with Phase 5 audit-types.ts precedent"
    - "Tuple-extension under frozen-set invariant: buildFrozenAllowlist untouched; only ALLOWLIST_MEMBERS grew, in locked D-10 order"

key-files:
  created:
    - grid/src/audit/operator-events.ts
    - grid/test/audit/operator-event-invariant.test.ts
    - grid/test/audit/operator-payload-privacy.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/api/types.ts
    - grid/test/audit/broadcast-allowlist.test.ts  # moved via git mv from grid/test/

key-decisions:
  - "Appended D-10 operator.* tuple exactly as planned — frozen-set invariant preserved (buildFrozenAllowlist unchanged)"
  - "AuditEntry imported from './types.js' (not re-exported from './chain.js') — plan snippet adjusted to match actual module layout"
  - "Extended positive-accept enumeration to all 5 tier values (H1..H5) in requireTierInPayload passthrough test — additional defensive coverage beyond plan minimum"
  - "Added a non-string tier variant (numeric 3) as a third rejection mode — tightens the TypeScript-narrowing escape path"
  - "Asserted side-effect guarantee (chain.head unchanged, chain.length === 0) on every rejection path — goes beyond plan's explicit behavior list but is the structural proof the invariant survives failure"

patterns-established:
  - "Pattern: appendOperatorEvent wrapper is the only sanctioned surface for operator.* events. Downstream plans (04, 05) MUST import this — never call audit.append('operator.*', ...) directly."
  - "Pattern: OPERATOR_ID_REGEX is RFC 4122 v4 strict (/^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i). Loose regexes (e.g. /^op:[0-9a-f-]{36}$/i) seen in early PATTERNS.md drafts are NOT authoritative."
  - "Pattern: payload shape convention — law_changed MUST NOT carry law_body; telos_forced MUST NOT carry new_telos/goal/telos. Both enforced by assertion (not just privacy regex) in operator-payload-privacy.test.ts."

requirements-completed: [AGENCY-03]

# Metrics
duration: ~15min
completed: 2026-04-20
---

# Phase 06 Plan 01: Allowlist + Tier-Field Invariant Summary

**Frozen broadcast allowlist extended 11 → 16 with 5 operator.* events in D-10 tuple order; appendOperatorEvent wrapper enforces D-13 tier-required and D-12 payload-privacy gates at the producer boundary — AuditChain untouched.**

## Performance

- **Duration:** ~15 min (3 atomic commits + summary)
- **Started:** 2026-04-20T21:44:00Z (local execution)
- **Completed:** 2026-04-20T21:48:30Z
- **Tasks:** 3 / 3
- **Files modified:** 3 created, 3 modified (one via git mv + extend)

## Accomplishments

- Allowlist tuple extended from 11 → 16 events with `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced` appended after `grid.stopped` in locked D-10 order. Frozen-set invariant fully preserved (`buildFrozenAllowlist` unchanged; `ALLOWLIST.add/delete/clear` still throw TypeError).
- `appendOperatorEvent()` created as the sole sanctioned surface for emitting operator.* audit events. It chains tier-required (D-13) + payload-privacy (D-12) checks before delegating to `AuditChain.append` — the chain itself is not modified, honoring the Phase 5 "service at the producer boundary, not in the chain" pattern.
- Shared types `HumanAgencyTier`, `TIER_NAME`, and `OPERATOR_ID_REGEX` exported from `grid/src/api/types.ts` with a `SYNC: dashboard/src/lib/protocol/agency-types.ts` header pointing at the Plan 06-02 mirror to be created.
- 3 test files green with **83 audit-layer assertions**: broadcast-allowlist (43), operator-event-invariant (27), operator-payload-privacy (13). Full grid suite **458 / 458 green** — no regression.

## Task Commits

1. **Task 1: Append 5 operator.* members to frozen allowlist + extend test** — `79b57ad` (feat)
2. **Task 2: Create appendOperatorEvent wrapper + HumanAgencyTier types + invariant test** — `aeed3dc` (feat)
3. **Task 3: D-12 payload-privacy enumerator across all 5 operator.* events** — `081b011` (test)

_Plan metadata commit will follow at plan-level completion (SUMMARY.md + STATE.md reconciliation)._

## Public API Surface

Consumed by downstream plans 06-02..06-06:

```typescript
// grid/src/audit/operator-events.ts
export interface OperatorEventPayload {
    tier: HumanAgencyTier;
    action: string;
    operator_id: string;
    target_did?: string;
    [key: string]: unknown;
}

export interface TierRequiredCheckResult {
    ok: boolean;
    reason?: string;
}

export function requireTierInPayload(
    eventType: string,
    payload: Record<string, unknown>,
): TierRequiredCheckResult;

export function appendOperatorEvent(
    audit: AuditChain,
    eventType: `operator.${string}`,
    actorDid: string,
    payload: OperatorEventPayload,
    targetDid?: string,
): AuditEntry;

// grid/src/api/types.ts
export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
export const TIER_NAME: Record<HumanAgencyTier, string>;
export const OPERATOR_ID_REGEX: RegExp; // /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

## Final ALLOWLIST Tuple (16 events, locked order)

```
 1. nous.spawned
 2. nous.moved
 3. nous.spoke
 4. nous.direct_message
 5. trade.proposed
 6. trade.reviewed        // Phase 5 (REV-02)
 7. trade.settled
 8. law.triggered
 9. tick
10. grid.started
11. grid.stopped
12. operator.inspected    // Phase 6 (AGENCY-03) — H2 Reviewer
13. operator.paused       // Phase 6 (AGENCY-03) — H3 Partner
14. operator.resumed      // Phase 6 (AGENCY-03) — H3 Partner
15. operator.law_changed  // Phase 6 (AGENCY-03) — H3 Partner
16. operator.telos_forced // Phase 6 (AGENCY-03) — H4 Driver
```

## Files Created/Modified

- `grid/src/audit/broadcast-allowlist.ts` — Appended 5 operator.* members to `ALLOWLIST_MEMBERS` tuple in D-10 order; frozen-set machinery untouched.
- `grid/src/audit/operator-events.ts` (NEW) — Exports `appendOperatorEvent`, `requireTierInPayload`, `OperatorEventPayload`, `TierRequiredCheckResult`. Imports `payloadPrivacyCheck` from broadcast-allowlist; delegates to `AuditChain.append` on success.
- `grid/src/api/types.ts` — Appended `HumanAgencyTier`, `TIER_NAME`, `OPERATOR_ID_REGEX` with SYNC header pointing at future dashboard mirror.
- `grid/test/audit/broadcast-allowlist.test.ts` (MOVED via `git mv` + EXTENDED) — Imports fixed to `../../`; count assertion 11 → 16; 5 new `isAllowlisted` cases; tuple-order structural proof; 3 D-11 privacy cases.
- `grid/test/audit/operator-event-invariant.test.ts` (NEW, 27 assertions) — D-13 regression: 5 events × 3 rejection modes + 5 events × accept + head-advance + non-operator passthrough (4 cases) + privacy-gate-within-wrapper reject.
- `grid/test/audit/operator-payload-privacy.test.ts` (NEW, 13 assertions) — D-12 enumerator: 5 positive D-11 shapes + 6 `it.each` forbidden-key negatives + nested-path negative + side-effect guarantee.

## Test Counts

| File | Assertions | Coverage |
|------|-----------:|----------|
| `grid/test/audit/broadcast-allowlist.test.ts` | 43 | Allowlist membership, frozen-set invariant, payload-privacy primitives, D-11 representative samples, D-10 tuple order |
| `grid/test/audit/operator-event-invariant.test.ts` | 27 | D-13 tier-required + head-advance + non-operator passthrough + privacy-gate-within-wrapper |
| `grid/test/audit/operator-payload-privacy.test.ts` | 13 | D-12 enumerator across all 5 D-11 payload shapes + 6 forbidden-key negatives + shape-convention assertions |
| **Subtotal (audit)** | **83** | |
| Full grid suite | 458 | No regression |

## Decisions Made

- **Import path correction:** The plan snippet imported `AuditEntry` from `'./chain.js'`; the actual module layout exports `AuditEntry` from `'./types.js'` (chain.ts only imports it as a type). Adjusted `operator-events.ts` accordingly. Non-structural, no behavior change.
- **Defensive test coverage beyond plan minimum:** Added a third rejection mode in `operator-event-invariant.test.ts` (non-string tier, numeric `3`) to close the TypeScript-narrowing escape path. Plan required 2 rejection modes per event; ships with 3.
- **Side-effect guarantee assertions:** Every rejection path explicitly asserts `chain.head` unchanged and `chain.length === 0` — structural proof that a thrown wrapper never partially commits. Plan did not mandate this but it's the cheapest proof the producer-boundary gate is not merely advisory.
- **SYNC header phrasing:** Matched the Phase 5 `audit-types.ts` precedent verbatim ("Two-source copy intentional — Grid and dashboard are separate packages") so downstream 06-02 mirror work sees a consistent cross-reference idiom.

## Deviations from Plan

None — plan executed as written. The three "decisions" above are enhancements inside the prescribed scope (additional test cases; correct import path for the actual module layout). They do not change any behavior specified in the plan's `<behavior>` blocks.

## Issues Encountered

- **Pre-existing TypeScript errors in `grid/src/db/connection.ts` and `grid/src/main.ts`** (6 errors, out of scope per SCOPE BOUNDARY rule). These stem from `mysql2` type overloads unrelated to Phase 6 work. Verified none of the new files (`operator-events.ts`, extended `types.ts`, extended `broadcast-allowlist.ts`) introduce new TS errors. Logged here rather than in `deferred-items.md` because the issue predates Phase 6 and is not caused by this plan.
- **`pnpm` not on PATH in this environment.** Worked around by invoking vitest directly via `npx vitest run ...` from the grid workspace — equivalent to `pnpm test -- --run ...`. Full suite confirmed at 458/458 green.

## Threat Register Status

All three threats assigned `mitigate` dispositions in this plan's `<threat_model>` are structurally closed:

- **T-6-02 (missing tier = forensic attribution lost):** Closed by `requireTierInPayload()` inside `appendOperatorEvent`. 15 regression cases in `operator-event-invariant.test.ts` (5 events × 3 rejection modes).
- **T-6-03 (broadcast privacy leak):** Closed by `payloadPrivacyCheck()` call inside `appendOperatorEvent`. 7 regression cases in `operator-payload-privacy.test.ts` (6 forbidden keywords + 1 nested-path).
- **T-6-07 (Telos plaintext exfiltration):** Closed by `operator.telos_forced` payload shape convention. Assertion `Object.keys(payload)` does NOT contain `new_telos`, `goal`, or `telos` in the positive-path test.
- **Frozen-set tamper:** Preserved untouched — `ALLOWLIST.add('x')` still throws; verified in `broadcast-allowlist.test.ts` line 50.

## Next Phase Readiness

Downstream plans can now proceed:

- **06-02 (AgencyIndicator + tooltip):** Import `HumanAgencyTier` + `TIER_NAME` from `grid/src/api/types.ts` SYNC source; mirror into `dashboard/src/lib/protocol/agency-types.ts` with reciprocal SYNC header.
- **06-03 (ElevationDialog):** Consume `HumanAgencyTier` union for dialog prop typing (`targetTier: Exclude<HumanAgencyTier, 'H1' | 'H5'>`).
- **06-04 (H3 clock + governance endpoints):** Call `appendOperatorEvent(audit, 'operator.paused'|'operator.resumed'|'operator.law_changed', ...)` — **never** `audit.append('operator.*', ...)` directly.
- **06-05 (H2 memory + H4 force-Telos):** Same as 06-04 for `operator.inspected` / `operator.telos_forced`. Validate `operator_id` against `OPERATOR_ID_REGEX`.
- **06-06 (SC E2E gates):** `scripts/check-state-doc-sync.mjs` must be bumped from "11 events" to "16 events" and the 5 new members appended to its `required` array (carry-over from plan 06-CONTEXT §D-22; this plan did NOT touch the script).

No blockers for Wave B.

## Self-Check: PASSED

**Files:**
- FOUND: grid/src/audit/broadcast-allowlist.ts
- FOUND: grid/src/audit/operator-events.ts
- FOUND: grid/src/api/types.ts
- FOUND: grid/test/audit/broadcast-allowlist.test.ts
- FOUND: grid/test/audit/operator-event-invariant.test.ts
- FOUND: grid/test/audit/operator-payload-privacy.test.ts

**Commits:**
- FOUND: 79b57ad (Task 1: allowlist tuple + test extension)
- FOUND: aeed3dc (Task 2: wrapper + types + invariant test)
- FOUND: 081b011 (Task 3: payload-privacy enumerator)

**Tests:**
- Audit suite: 83 / 83 green (43 + 27 + 13)
- Full grid suite: 458 / 458 green

---
*Phase: 06-operator-agency-foundation-h1-h4*
*Completed: 2026-04-20*
