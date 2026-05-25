---
phase: 32-firehose-observability
reviewed: 2026-05-25T00:40:58Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .github/workflows/rig-invariants.yml
  - grid/src/api/routes/health-detailed.ts
  - grid/src/api/server.ts
  - grid/src/audit/firehose-hub.ts
  - grid/src/diagnostics/health-watchdog.ts
  - grid/src/genesis/launcher.ts
  - grid/test/firehose-frame-counters.test.ts
  - grid/test/firehose-send-throws.test.ts
  - grid/test/health-detailed-route.test.ts
  - grid/test/health-watchdog-transitions.test.ts
  - scripts/check-interval-lifecycle.mjs
  - scripts/check-observability-no-todo.mjs
  - scripts/uat-half-close-socket.mjs
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-05-25T00:40:58Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 32 delivers three tightly-scoped observability features: frame-counter metrics on `WsFirehoseHub`, the `/health/detailed` REST endpoint, and the `HealthWatchdog` pure-pull snapshot engine. The core contracts are correctly implemented — the pure-pull discipline (zero `setInterval`, zero clock subscription) holds throughout; the R-32-03 counter placement is correct (increment inside `trySend` after `socket.send` succeeds, before the catch); the `attachFirehoseStats` idempotency guard is properly one-shot-throwing; the two attach methods on `GenesisLauncher` both throw on double-call; the `preClose` hook drains both hubs before teardown; and the CI gates (`check-observability-no-todo.mjs`, `check-interval-lifecycle.mjs`) are correct and registered in the workflow.

Three warnings require attention before close: a logic tautology in the divergence computation makes `divergence` always exactly zero when `auditReconcile` is present (making the critical/degraded divergence paths unreachable in production), a type-unsafety double-cast in `server.ts` that lets future contract drift go undetected, and the missing `status: 'critical'` integration test case in `health-detailed-route.test.ts` (mentioned in the file header but not implemented). Four info items cover a defense-in-depth gap in the regex script, a permanently-null payload field, a clock sub-block with no key-set pinning test, and a minor UAT script exit behavior.

---

## Warnings

### WR-01: Divergence always zero when reconcile is present — critical/degraded divergence paths unreachable in production

**File:** `grid/src/diagnostics/health-watchdog.ts:213-226`

**Issue:** `inMemoryLength` is assigned directly from `persistedMaxId` (`const inMemoryLength: number | null = persistedMaxId;`). Divergence is then computed as `Math.max(0, inMemoryLength - persistedMaxId)`, which is always `Math.max(0, persistedMaxId - persistedMaxId)` = `0`. The intent is clearly that `in_memory_length` should reflect the live in-memory audit chain length while `persisted_max_id` reflects the last DB-persisted high-water mark — the gap between them is the divergence. Because both sides are the same cached value, `divergence` is structurally pinned to 0 forever (unless `reconcile` is absent, in which case both are null). The `divergence_above_critical` and `divergence_above_degraded` status paths in `computeStatus` are therefore unreachable in any real deployment, and the watchdog cannot alert on actual audit-chain/DB drift.

The code comment on line 220-221 acknowledges this: _"in_memory_length: the AuditReconcile contract does not expose this directly in Phase 31 … For Phase 32 the field is exposed as null when reconcile is absent and as persistedMaxId when present (best-effort cached value). Refinement to a live chain.length read is deferred to Phase 34."_ The divergence computation, however, silently treats this as a live calculation rather than hardcoding 0 or exposing the limitation via null — which gives consumers a misleading signal of health.

**Fix:** Two options depending on intent for Phase 32:

Option A (correct the tautology): hardcode `divergence` to `null` during the Phase 32 period, matching the acknowledged limitation, so consumers are not misled by a perpetual 0.

```typescript
// Until Phase 34 wires a live chain.length read, divergence cannot be
// meaningfully computed — expose null rather than a misleading 0.
const inMemoryLength: number | null = null; // not yet wired (Phase 34)
const divergence: number | null = null;
```

Option B (wire the actual value): pass `AuditChain.length` into `HealthWatchdogDeps` at construction time, so `inMemoryLength` and `persistedMaxId` are genuinely different values.

```typescript
// In HealthWatchdogDeps:
chainLength: () => number;

// In snapshot():
const inMemoryLength = this.deps.chainLength();
const divergence = Math.max(0, inMemoryLength - (persistedMaxId ?? 0));
```

Either option is correct; the current tautological code is a silent accuracy bug.

---

### WR-02: Double cast `as unknown as GenesisLauncher` in server.ts loses type-safety at the Phase 32 wiring point

**File:** `grid/src/api/server.ts:601`

**Issue:** The Phase 32 wiring block casts `services.launcher` to `GenesisLauncher` via `as unknown as import('../genesis/launcher.js').GenesisLauncher`. The guard immediately above (lines 596-599) checks for the presence of `attachHealthWatchdog`, `attachFirehoseHub`, and `clock` on `services.launcher`, but these fields are declared as `optional` on `GridServices.launcher` (the structural interface at lines 238-246). After the cast, `launcher.auditReconcile` and `launcher.clock` are accessed without further null checks, which is safe at the moment because the guard confirmed `clock !== undefined` — but the cast bypasses the TS type system entirely, meaning future refactors that rename or remove a field on `GenesisLauncher` will compile cleanly while silently breaking production wiring.

**Fix:** Expose a narrow typed interface on `GridServices.launcher` that exactly matches what Phase 32 needs, eliminating the need for the cast:

```typescript
// In GridServices.launcher interface (server.ts ~line 238):
readonly auditReconcile?: AuditReconcile | undefined;
readonly clock?: { readonly currentTick: number; readonly running: boolean };
// (already present — no change needed for auditReconcile or clock)
```

Then in the Phase 32 block:
```typescript
// Remove the cast — access through the typed interface directly.
const rec = services.launcher.auditReconcile;       // already typed
const clockRef = services.launcher.clock!;          // guarded above
const healthWatchdog = new HealthWatchdog({
    auditReconcile: rec,
    clockState: () => ({ tick: clockRef.currentTick, running: clockRef.running }),
});
services.launcher.attachHealthWatchdog!(healthWatchdog);
services.launcher.attachFirehoseHub!(firehoseHub);
registerHealthDetailedRoute(app, services, services.launcher as unknown as GenesisLauncher);
```

The cast is only needed at the `registerHealthDetailedRoute` call site (which takes `GenesisLauncher` to access `healthWatchdog`). A safer alternative is to make `registerHealthDetailedRoute` accept the narrow structural interface rather than the concrete class.

---

### WR-03: Route integration test missing `status: 'critical'` case — header promises coverage it does not deliver

**File:** `grid/test/health-detailed-route.test.ts:8`

**Issue:** The file-level JSDoc on line 8 explicitly lists `"status: 'critical' when divergence > DIVERGENCE_CRITICAL"` as a covered case. No `it()` block implements this. The six existing test cases cover: 503 not-ready, cold-start ok, healthy steady-state ok, reconcile-stale degraded, audit-block key-set leakage, and p95 latency. The critical path is absent. This is compounded by WR-01: even if the test were added, with the current tautology it would never trigger the critical path using real `auditReconcile` data. However, the critical/degraded divergence tests in `health-watchdog-transitions.test.ts` exercise `computeStatus()` directly with synthetic inputs and do pass correctly.

The gap matters because the route test is the only end-to-end verification that `/health/detailed` HTTP responses carry the correct `status` value for the critical condition — the unit test exercises the logic function but not the HTTP serialization path.

**Fix:** Add the missing integration test case. Note that per WR-01, until `in_memory_length` is wired to a live chain length, the test must drive critical status through the `persistError + divergence > 0` path rather than the `divergence > DIVERGENCE_CRITICAL` path:

```typescript
it('returns critical when persist error with divergence > 0', async () => {
    const now = 6_000_000;
    // Drive critical via: persistError + divergence > 0.
    // Until Phase 34 wires live chain.length, use the persist_error path
    // (which requires divergence > 0 — currently always 0 per WR-01).
    // Deferred until WR-01 is resolved.
});
```

---

## Info

### IN-01: `check-observability-no-todo.mjs` resets `re.lastIndex` on a non-global regex — harmless but misleading

**File:** `scripts/check-observability-no-todo.mjs:85`

**Issue:** Line 85 calls `re.lastIndex = 0` before each `re.test()` call. The regex `/(...)/i` has no `g` or `y` flag, so `lastIndex` is always 0 regardless — the reset is a no-op. This is not a bug in practice, but it implies the developer believed the regex was stateful (sticky or global), which may indicate it was intended to have the `g` flag for `exec`-style iteration that was never completed. The current code works correctly because `test()` without `g`/`y` always does a fresh search from position 0.

**Fix:** Remove the dead `re.lastIndex = 0` line to make the intent explicit:

```javascript
// Remove line 85:
// re.lastIndex = 0;  // not needed — regex has no g/y flag
if (re.test(line)) {
```

---

### IN-02: `clock.last_tick_at` permanently hardcoded to `null` in the payload — could mislead Phase 34 consumers

**File:** `grid/src/diagnostics/health-watchdog.ts:285`

**Issue:** `last_tick_at` is typed as `number | null` in `HealthDetailedPayload` (line 80) and is hardcoded to `null` in every `snapshot()` call (line 285) with a comment noting refinement is deferred to Phase 34. The `null` value is valid, but the `HealthDetailedPayload` interface provides no indication to consumers that this field is not yet populated. A Phase 34 implementer who reads the interface without the comment could assume `null` means "no tick has occurred" rather than "not yet wired."

**Fix:** Either document the null-until-Phase-34 contract on the interface field, or use a sentinel comment on the interface:

```typescript
/**
 * Millisecond timestamp of the most recent clock tick.
 * null when no tick has occurred yet OR when not yet wired (Phase 32 minimum — null always).
 * Refined to a live value in Phase 34 (Steward /system card).
 */
readonly last_tick_at: number | null;
```

---

### IN-03: `clock` sub-block key set is not pinned by any test — contract creep goes undetected

**File:** `grid/test/health-detailed-route.test.ts:136`

**Issue:** The `audit` block's key set is pinned by the leakage test at line 196 (`Object.keys(body.audit).sort()`). The `firehose` block's exact shape is pinned by the unit test at `health-watchdog-transitions.test.ts:275` (`expect(snap.firehose).toEqual({...})`). The `clock` block has no equivalent structural pin — only individual field reads (`body.clock.tick`, `body.clock.running`). A future change that adds an unexpected field to the `clock` block (e.g., `epoch` or `wall_clock_ms`) would be silently absorbed by the existing tests. The top-level 5-key check (line 136) does not catch sub-block additions.

**Fix:** Add a key-set assertion to the steady-state test:

```typescript
expect(Object.keys(body.clock).sort()).toEqual(['last_tick_at', 'running', 'tick']);
```

---

### IN-04: UAT script exits with code 0 immediately after `ws.terminate()` — server drain window not observed

**File:** `scripts/uat-half-close-socket.mjs:53-61`

**Issue:** After calling `ws.terminate()`, the script immediately calls `process.exit(0)`. The comment on line 59 tells the operator to "wait 5s for buffer overflow" — but the 5-second wait is manual instruction only. If an operator runs the script and immediately re-polls `/health/detailed` before the server-side buffer fills and overflows (which requires subsequent `audit.append` events to arrive), they may see `frames_dropped_total` unchanged and incorrectly conclude the feature is broken.

This is a UAT quality issue, not a production correctness issue. The production behavior is correct.

**Fix:** Add a post-terminate sleep before exit so the server has time to attempt sends and increment the drop counter:

```javascript
ws.terminate();
console.log('[uat-half-close] waiting 5s for server-side buffer to fill ...');
setTimeout(() => {
    console.log('Next steps:');
    // ... (existing instructions)
    process.exit(0);
}, 5_000);
```

---

_Reviewed: 2026-05-25T00:40:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
