---
phase: 06-operator-agency-foundation-h1-h4
plan: 04
subsystem: grid
tags: [agency-02, agency-03, h3-partner, clock, logos, producer-boundary, zero-diff]
requires: [06-01]
provides:
  - "WorldClock.pause() / resume() / isPaused (preserves tick + startedAt across boundary)"
  - "LogosEngine.amendLaw(id, partial) replace-in-place with identity preserved"
  - "POST /api/v1/operator/clock/pause and /resume (H3 Partner, idempotent)"
  - "POST/PUT/DELETE /api/v1/operator/governance/laws* (H3 Partner add/amend/repeal)"
  - "validateTierBody() shared body validator in grid/src/api/operator/_validation.ts (Plan 05 consumer)"
  - "Zero-diff invariant regression across pause/resume boundary (crown-jewel #2)"
affects:
  - "grid/src/api/server.ts — registerOperatorRoutes() call site added between governance GETs and Audit block"
tech-stack:
  added: []
  patterns:
    - "D-13 tier-required producer-boundary gate (via Plan 01's appendOperatorEvent, zero new code paths)"
    - "D-11 closed-tuple payload (operator.law_changed payload keys exactly {tier, action, operator_id, law_id, change_type})"
    - "Shared _validation.ts single-sources tier/operator_id body contract for all /api/v1/operator/* endpoints"
key-files:
  created:
    - grid/src/api/operator/_validation.ts
    - grid/src/api/operator/clock-pause-resume.ts
    - grid/src/api/operator/governance-laws.ts
    - grid/src/api/operator/index.ts
    - grid/test/clock/ticker-pause-resume.test.ts
    - grid/test/worldclock-zero-diff.test.ts
    - grid/test/logos/engine-amend-law.test.ts
    - grid/test/api/operator/clock.test.ts
    - grid/test/api/operator/governance.test.ts
  modified:
    - grid/src/clock/ticker.ts
    - grid/src/logos/engine.ts
    - grid/src/api/server.ts
decisions:
  - "Idempotency is decided in the HTTP handler, not in WorldClock. The handler captures `isPaused` BEFORE calling pause/resume and only emits the audit event on a genuine state transition. This keeps WorldClock's pause/resume internally simple (short-circuit no-ops) while the public contract stays: double-pause returns 200 but emits one audit entry."
  - "Shared `validateTierBody<T>()` lives in `_validation.ts` instead of `api/types.ts` because it is a server-side validator (not a wire type). Plan 05 imports it for memory + telos routes."
  - "Law body text is NOT duplicated into the audit payload on add/amend/repeal. D-11 reads/writes are split: mutation events are attributive (who + which law + action), and law body is retrieved via the Phase 4 GET /api/v1/governance/laws/:id endpoint. This closes T-6-06 (law-body broadcast leak) at the payload-shape level rather than relying only on payloadPrivacyCheck keyword filtering."
  - "Clock-pause test harness starts the clock before calling pause() because WorldClock.pause() short-circuits when `!this.timer` (matches ticker-pause-resume Test 3's documented no-op semantics). Seeding `start()` in the beforeEach reflects production reality — operators can only pause a running clock."
metrics:
  duration_ms: 0
  completed_at: "2026-04-21T05:04:00Z"
---

# Phase 6 Plan 04: H3 Partner Agency Endpoints Summary

One-liner: Ships Grid-side H3 Partner: WorldClock pause/resume preserves AuditChain head byte-for-byte across the pause boundary, LogosEngine.amendLaw replaces in place, and five Fastify operator endpoints (clock pause/resume + law add/amend/repeal) route every `operator.*` emission through Plan 01's `appendOperatorEvent` producer-boundary gate.

## What Shipped

**Task 1 — Engine primitives (commit `b8c760f`):**

- `WorldClock.pause()` / `resume()` / `isPaused` — idempotent, preserves tick counter and `startedAt`; zero-diff linchpin (do NOT reset either in either method)
- `LogosEngine.amendLaw(id, partial)` — replace-in-place via `{ ...existing, ...updates, id }`; id is last in the spread for runtime defense against type-casts
- 12 new tests: 6 pause/resume, 2 zero-diff invariant (crown-jewel #2), 4 amendLaw

**Task 2 — Operator clock endpoints (commit `d188671`):**

- `POST /api/v1/operator/clock/pause` and `/resume` live in `grid/src/api/operator/clock-pause-resume.ts`
- Barrel `grid/src/api/operator/index.ts` exposes `registerOperatorRoutes()`; called once inside `buildServerWithHub`
- Idempotent — handler captures `isPaused` before/after to decide whether to emit; double-pause is 200 with one audit entry
- All writes through `appendOperatorEvent` → `operator.paused` / `operator.resumed` are allowlisted (Plan 01 D-10), fan out over `WsHub` firehose; verified via FakeSocket assertion
- 10 tests

**Task 3 — Operator governance CRUD (commit `83ecde3`):**

- `POST /api/v1/operator/governance/laws` (add), `PUT /:id` (amend), `DELETE /:id` (repeal) in `grid/src/api/operator/governance-laws.ts`
- Shared `validateTierBody<T>()` extracted to `grid/src/api/operator/_validation.ts`; `clock-pause-resume.ts` refactored to consume it (pure refactor, 10 existing tests stayed green)
- `operator.law_changed` payload is a **closed tuple** `{tier, action, operator_id, law_id, change_type}` — no law body fields in the broadcast
- Test 8 structural assertion (`Object.keys(entry.payload).sort() === [...]`) fails loudly if a future refactor adds a key
- 11 tests

## Zero-Diff Invariant Evidence (T-6-05 Closure, Crown-Jewel #2)

Both runs of the test produce **byte-identical AuditChain head hashes**:

```
CONTINUOUS run (no pause):  c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461
PAUSED-AT-50 run (pause+resume mid-run): c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461
```

Test config: `FIXED_TIME = 2026-01-01T00:00:00.000Z`, `TICK_COUNT = 100`, `PAUSE_AT = 50`, `tickRateMs = 1_000_000`, `ticksPerEpoch = 25`. Fake timers (`vi.useFakeTimers` + `vi.setSystemTime`) are mandatory because `AuditChain.computeHash` incorporates `Date.now()` (same pattern as Phase 5 zero-diff.test.ts). The head format matches `/^[0-9a-f]{64}$/`.

## File Inventory (lines)

| File | Lines | Status |
|------|------:|--------|
| grid/src/clock/ticker.ts | 122 | modified (+31 from Plan 01 baseline) |
| grid/src/logos/engine.ts | 139 | modified (+8 from baseline) |
| grid/src/api/server.ts | 362 | modified (+6: 1 import + 5 registrar block) |
| grid/src/api/operator/_validation.ts | 42 | new (shared across operator handlers) |
| grid/src/api/operator/clock-pause-resume.ts | 77 | new |
| grid/src/api/operator/governance-laws.ts | 136 | new |
| grid/src/api/operator/index.ts | 26 | new (barrel) |
| grid/test/clock/ticker-pause-resume.test.ts | 101 | new (6 tests) |
| grid/test/worldclock-zero-diff.test.ts | 86 | new (2 tests, zero-diff + timer-cleared) |
| grid/test/logos/engine-amend-law.test.ts | 74 | new (4 tests) |
| grid/test/api/operator/clock.test.ts | 261 | new (10 tests) |
| grid/test/api/operator/governance.test.ts | 225 | new (11 tests) |

Total: 1,289 lines of new/modified code across 12 files.

## Test Metrics

| Scope | Plan 01 baseline | After Plan 04 | Delta |
|------:|-----------------:|--------------:|------:|
| Full Grid suite | 458 | **491** | **+33** |
| Clock tests | 10 | 16 (10 + 6 pause/resume) | +6 |
| Logos tests | 27 | 31 (27 + 4 amendLaw) | +4 |
| Operator API tests | 0 | 21 (10 clock + 11 governance) | +21 |
| Zero-diff invariant | 0 | 2 | +2 |

All pre-existing tests stayed green through the three atomic commits. No regression on Phase 1–5 tests.

## Law Fixture Adjustments

The original plan sketch omitted two required `Law` fields: `severity: LawSeverity` and `ruleLogic.sanction_on_violation: SanctionType`. Both tests (`engine-amend-law.test.ts` `makeLaw()` and `governance.test.ts` `FIXTURE_LAW`) include them after reading `grid/src/logos/types.ts:45-53`:

```typescript
const FIXTURE_LAW: Law = {
    id: 'law.test.001',
    title: 'Test Law',
    description: 'For testing only',
    ruleLogic: {
        condition: { type: 'true' },
        action: 'allow',
        sanction_on_violation: 'warning',   // <— added
    },
    severity: 'minor',                      // <— added
    status: 'active',
};
```

## Plan 05 Handoff — `validateTierBody` Consumers

`grid/src/api/operator/_validation.ts` exports:

```typescript
export function validateTierBody<T extends HumanAgencyTier>(
    body: OperatorBody,
    expectedTier: T,
): { ok: true; tier: T; operator_id: string }
 | { ok: false; error: 'invalid_tier' | 'invalid_operator_id' };
```

Plan 05's `POST /api/v1/operator/memory/query` and `POST /api/v1/operator/telos/force` can import this directly:

```typescript
import { validateTierBody, type OperatorBody } from './_validation.js';
const v = validateTierBody(req.body ?? {}, 'H3');
if (!v.ok) { reply.code(400); return { error: v.error }; }
```

The validator is `HumanAgencyTier`-generic, so a future H4 endpoint could invoke `validateTierBody(body, 'H4')` without touching the helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test-harness bug] Clock tests needed `clock.start()` in beforeEach**

- **Found during:** Task 2 GREEN phase (2 of 10 tests failed on `expect(isPaused).toBe(true)` after calling /pause).
- **Issue:** `WorldClock.pause()` short-circuits when `!this.timer` (documented behavior — ticker-pause-resume Test 3 asserts this). The HTTP handler test seeded services with a fresh WorldClock but never called `start()`, so `pause()` was a no-op and `isPaused` stayed false.
- **Fix:** Added `services.clock.start()` in the pause-scoped `beforeEach` with an explanatory comment. This matches production semantics (operators only pause running clocks). No change to production code or to the idempotency/validation tests that don't require a running clock.
- **Files modified:** `grid/test/api/operator/clock.test.ts` (two call sites)
- **Commit:** `d188671`

### Rule 4 / Architectural Questions

None — Plan 04 executed without architectural blockers.

### Authentication Gates

None — this is a localhost dev API; the production auth model is deferred per Phase 6 scope.

## Threat Closure Report

| Threat | Status | Evidence |
|--------|--------|----------|
| T-6-05 (zero-diff loss across pause/resume) | Closed | `test/worldclock-zero-diff.test.ts` — both heads `c7c49f49…0461` byte-identical. Timer-cleared test also passes (no lingering interval). |
| T-6-06 (law body leaks into broadcast) | Closed | `test/api/operator/governance.test.ts` Test 8 — `Object.keys(entry.payload).sort()` structural assertion enforces closed tuple; six explicit `not.toHaveProperty` checks for law body fields. |
| T-6-06a (replay pause when already paused) | Accepted | Task 2 Test 7: double-pause returns 200 but emits one audit event; no state corruption, no rate-limiting needed for single-operator localhost v2.1. |
| T-6-06b (body smuggles extra fields) | Mitigated | Handlers read only expected keys; payload literals are closed; Fastify type narrowing enforces Body shape. |
| T-6-06c (repudiation — no actor attribution) | Mitigated | Every event carries `operator_id` (session-scoped `op:<uuid-v4>`) plus `tier`; AGENCY-03 tier invariant enforced producer-side. |
| T-6-06d (tier downgrade spoof) | Mitigated | `validateTierBody(body, 'H3')` rejects any non-H3 literal with 400; no audit event emitted on the rejection path. |

## Grep Audit (Enforcement of Plan Done-Criteria)

```
$ grep -rn "audit.append(" grid/src/api/operator/
0 matches   — all operator writes go through appendOperatorEvent.

$ grep -c "appendOperatorEvent" grid/src/api/operator/governance-laws.ts
3           — one per add/amend/repeal endpoint.

$ grep -nE "law_title|description|ruleLogic" grid/src/api/operator/governance-laws.ts
no matches in payload literals (only in isLawShape validator + doc comment).

$ grep -n "registerOperatorRoutes" grid/src/api/server.ts
2 matches   — import + call site.

$ grep -n "validateTierBody" grid/src/api/operator/clock-pause-resume.ts
2 matches   — pause + resume handlers share the validator.
```

## Self-Check: PASSED

- `grid/src/api/operator/{clock-pause-resume,governance-laws,_validation,index}.ts` all exist
- `grid/test/api/operator/{clock,governance}.test.ts` all exist
- `grid/test/{clock/ticker-pause-resume,worldclock-zero-diff,logos/engine-amend-law}.test.ts` all exist
- Commits `b8c760f`, `d188671`, `83ecde3` all present in `git log`
- `npx vitest run` → 491/491 Grid suite green
- Zero-diff head hash captured: `c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461`
