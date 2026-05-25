---
phase: 34
reviewed_at: 2026-05-25T19:32:06Z
reviewer: gsd-code-reviewer
depth: standard
diff_base: 3a9fc2e
files_reviewed: 9
files_reviewed_list:
  - grid/src/diagnostics/health-watchdog.ts
  - grid/test/health-detailed-route.test.ts
  - steward/src/lib/use-health-detailed.ts
  - steward/src/lib/health-reason-labels.ts
  - steward/src/lib/event-family-colors.ts
  - steward/src/components/EventsPerMinuteSparkline.tsx
  - steward/src/components/FrameCounterSparkline.tsx
  - steward/src/app/system/page.tsx
  - steward/src/app/firehose/page.tsx
findings:
  critical: 0
  high: 0
  medium: 1
  low: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 34: Code Review Report — Steward /system Health Surfaces

**Reviewed:** 2026-05-25T19:32:06Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found (no CRITICAL or HIGH — all findings are non-blocking polish items)

## Summary

Phase 34 ships a clean, well-disciplined set of observability surfaces. The implementation respects every declared invariant: Phase 31 zero-diff on `chain.ts` holds (verified — zero bytes changed), Phase 32 D-32-C1/C2/C3 are untouched (only the additive `reasons` field was added to the payload), and D-34-A2 REST-only resilience is honored in `EventsPerMinuteSparkline` (no WebSocket usage). React effect lifecycles are correctly cleaned up: every `setInterval` is paired with `clearInterval`, every `fetch` is gated by an `AbortController`, and a `cancelled` flag guards stale `setState` calls — these collectively satisfy R-32-02 lifecycle discipline.

Findings are non-blocking:
- **1 MEDIUM** — `divergenceBand()` hardcodes the divergence threshold instead of consuming `health.audit.divergence_threshold`, creating a duplication/drift risk against the FROZEN D-32-C1 constant.
- **3 LOW** — unused `EVENT_FAMILY_COLORS` import after Plan 34-04 refactor, misleading test name that asserts the opposite of what it claims, and a minor labeling drift between snake_case reason `stale_frames` and its human label ("No frames in 60s" — uses threshold value as wording).
- **2 INFO** — defensive-only fallbacks worth a comment for future maintainers.

No security findings (no user input flows into URLs, no secrets in client code, no XSS surface in new code — all new dynamic strings are passed through React's text interpolation). No race conditions detected in the watchdog suppression-window logic. No memory leaks in any of the polling hooks or sparkline components.

---

## Invariants Verified (all hold)

| Invariant | Verification | Result |
|---|---|---|
| Phase 31 zero-diff on `grid/src/audit/chain.ts` | `git diff --stat 3a9fc2e..HEAD -- grid/src/audit/chain.ts` returns empty | **HOLD** |
| Phase 32 D-32-C1 HEALTH_THRESHOLDS frozen | `Object.freeze({ DIVERGENCE_DEGRADED: 10, DIVERGENCE_CRITICAL: 100, STALE_FRAME_MS: 60_000, RECONCILE_STALE_MULTIPLIER: 5 })` unchanged at lines 39-44 | **HOLD** |
| Phase 32 D-32-C2 computeStatus() body frozen | Lines 108-156 unchanged; no edits to the predicate body | **HOLD** |
| Phase 32 D-32-C3 /health/detailed shape additive-only | Diff confirms exactly 2 added lines (`reasons` in interface, `reasons` in return); no field renamed or removed | **HOLD** |
| Phase 31 no-silent-catch CI gate on grid/src/db/ and grid/src/audit/ | No new error handling added in those subtrees by Phase 34 (only diagnostics/ was touched) | **HOLD** |
| D-34-A3 ring buffer: 12 entries (60s window @ 5s polling) | `RING_CAPACITY = 12` in use-health-detailed.ts:64; slice-tail clamp on lines 104, 111 | **HOLD** |
| R-34-03 watchdog suppression window = 60s after last close | firehose/page.tsx:167 `if (lastClose !== null && Date.now() - lastClose <= 60_000) return;` | **HOLD** |
| R-32-02 setInterval/AbortController lifecycle discipline | All 3 new useEffects (use-health-detailed L77, EventsPerMinuteSparkline L74, FrameCounter has none) clean up `clearInterval` + `controller.abort()` + cancelled flag | **HOLD** |
| D-34-A2 REST-only firehose-independence for EventsPerMinuteSparkline | Component imports `useState`/`useEffect` only, calls `fetch()` on `/api/v1/audit/trail`, no WebSocket | **HOLD** |
| Surgical-changes principle: only declared files modified | `git diff --name-only` returns exactly the 9 declared source files (plus planning docs not in scope) | **HOLD** |
| ALLOWLIST_STATIC = 56 entries matches broadcast-allowlist.ts | Counted both: 56 ≡ 56 | **HOLD** |

---

## Findings

### Medium

#### M-01: Divergence threshold hardcoded in UI band logic — drift risk against FROZEN D-32-C1

**File:** `steward/src/app/system/page.tsx:179-184`

**Issue:** The `divergenceBand()` helper hardcodes the amber/red threshold as the literal `10`:

```ts
function divergenceBand(div: number | null): { ... } {
    if (div === null) return { ... };
    if (div === 0) return { ... };
    if (div <= 10) return { ... };  // ← hardcoded
    return { ... };
}
```

The Phase 32 D-32-C1 constant `HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED = 10` is FROZEN policy. The /health/detailed payload already exposes the live value as `health.audit.divergence_threshold` (system/page.tsx already consumes `health` via the hook). If a future SPEC change ever moves the threshold (which would require a CONTEXT.md update per the freeze contract), this UI literal will silently drift out of sync, displaying amber for a value the server has classified as `degraded` or vice versa.

The condition `div <= 10` is also off-by-one against the server-side predicate `divergence > 10` (system uses strict `>`, UI uses `<=`). Today they happen to agree at the boundary (div=10 is "amber" in UI, "ok" on server), but encoding the constraint twice in different operators is a maintainability hazard.

**Fix:** Consume the live threshold from the payload:
```ts
function divergenceBand(div: number | null, threshold: number): { ... } {
    if (div === null) return { ... };
    if (div === 0) return { ... };
    if (div <= threshold) return { ... };
    return { ... };
}
// Call site:
const divBand = divergenceBand(divergence, health?.audit.divergence_threshold ?? 10);
```

**Severity rationale:** Not HIGH because the threshold is currently frozen and any change would require a coordinated CONTEXT.md edit (catching the drift). But this defeats the purpose of exposing `divergence_threshold` in the payload contract, which exists precisely so consumers don't re-encode it.

---

### Low

#### L-01: Unused `EVENT_FAMILY_COLORS` import after Plan 34-04 refactor

**File:** `steward/src/app/firehose/page.tsx:6`

**Issue:** Plan 34-04 replaced the inline `EVENT_FAMILY_COLORS` map with the shared import:

```ts
import { EVENT_FAMILY_COLORS, getFamilyColors, getFamilyName } from '@/lib/event-family-colors';
```

The page consumes `getFamilyColors` (line 332) and `getFamilyName` (line 333) but never references `EVENT_FAMILY_COLORS` directly. It's an orphan import created by the refactor.

**Fix:** Drop the unused name:
```ts
import { getFamilyColors, getFamilyName } from '@/lib/event-family-colors';
```

**Severity rationale:** Low because Next.js / TypeScript will not error on unused named imports without an explicit ESLint rule (no eslint config detected in `steward/`), but the surgical-changes principle (CLAUDE.md §3) calls for removing imports made unused by your own changes.

---

#### L-02: Test name claims "critical with persist_error_with_divergence" but asserts the opposite

**File:** `grid/test/health-detailed-route.test.ts:185-208`

**Issue:** The test is named:
> `'returns critical with persist_error_with_divergence in reasons when persist error AND divergence > 0'`

But the assertions are:
```ts
expect(body.status).toBe('ok');       // not 'critical'
expect(body.reasons).toEqual([]);     // empty, not containing 'persist_error_with_divergence'
```

The inline comment explains the reason (the test harness's fake `AuditReconcile` cannot produce `divergence > 0` because `inMemoryLength` is derived from `persistedMaxId` itself). The test is correctly pinning the AND-gate behavior of the predicate — when divergence is 0, the persist_error branch correctly does NOT trigger. But the test NAME describes a positive case that is never asserted.

**Fix:** Rename to match the actual assertion:
```ts
it('does NOT trigger persist_error_with_divergence when persistError set but divergence === 0 (AND-gate predicate)', ...)
```

If you want positive coverage of the critical branch, refactor `makeFakeReconcile` to also accept an explicit `inMemoryLength` override and add a second test that exercises `divergence > 0 + persistError → status='critical'`.

**Severity rationale:** Low because the test does what its body says — but anyone scanning test names to understand the OBS-06 contract will be misled into thinking the critical branch is covered when it isn't.

---

#### L-03: Reason-label string encodes the threshold value redundantly

**File:** `steward/src/lib/health-reason-labels.ts:21`

**Issue:** The label for `stale_frames` is:
```ts
stale_frames: 'No frames in 60s',
```

The "60s" is the `STALE_FRAME_MS = 60_000` threshold from D-32-C1 (frozen). Like M-01, this hardcodes the value in a second location. If the SPEC ever loosens the threshold to 90s or 120s, this label silently misinforms the operator about the actual condition that triggered it.

**Fix:** Either (a) make the label threshold-agnostic — `'No frames recently'` or `'Frames stale'` — or (b) parametrize the label table to accept the live threshold (over-engineering for v2.6; (a) is preferred).

**Severity rationale:** Low because the threshold is frozen and a SPEC change would trigger a sweep. But the label is a user-facing string that drifts from machine truth — bad pattern.

---

### Info

#### IN-01: Defensive fallback in `EventsPerMinuteSparkline.familyColor()` is currently unreachable

**File:** `steward/src/components/EventsPerMinuteSparkline.tsx:65-68`

**Issue:** The helper does `EVENT_FAMILY_COLORS[prefix]?.leftBorder ?? EVENT_FAMILY_COLORS['unknown'].leftBorder`. Since `getFamilyName()` only ever returns a known stripped prefix or the literal `'unknown'` (every code path in `event-family-colors.ts:44-50` ends at one of these), the `?? unknown.leftBorder` fallback can never fire. This is fine as defense-in-depth, but worth a single-line comment so future readers don't try to "clean it up" by removing the apparent dead branch.

**Fix:** Add a one-line comment:
```ts
// Defense-in-depth: getFamilyName() always returns a known prefix or 'unknown',
// but the ?? fallback guards against future palette additions without family rename.
```

---

#### IN-02: `useHealthDetailed` does not surface a "stale data" indicator when polling fails mid-session

**File:** `steward/src/lib/use-health-detailed.ts:120-126`

**Issue:** When a poll fails (network error / 503), the hook calls `setError(...)` but does NOT call `setData(null)`. The component continues to see the LAST SUCCESSFUL `data` payload, which may now be tens of seconds (or longer) out of date. The firehose-page watchdog uses `health.firehose.last_frame_at` to compute `stalenessMs = Date.now() - lastFrameAt` — this naturally inflates with wall-clock time, so the watchdog still fires correctly. But the system-page Audit Pipeline Health card will silently render stale divergence / persist-error values without indicating the data is no longer fresh.

This is INTENTIONAL behavior (avoid flapping the UI between "data" and "—" on transient network blips), and is documented in the hook's return-shape comment block. Worth noting that the `error` field IS surfaced to system/page.tsx (rendered at L552-553), so the operator does see a banner. No action required, but consider documenting the staleness contract more explicitly in the JSDoc if a future plan adds a freshness timestamp.

**Fix:** None required. Confirming awareness — this is the documented design.

---

## What Was Checked

### Security review
- [x] No new fetch URLs constructed with user input (all URLs are constants: `${GRID_ORIGIN}/health/detailed`, `${GRID_ORIGIN}/api/v1/audit/trail?limit=200`)
- [x] No new XSS surfaces — all dynamic strings (`event_type`, `actor_did`, error messages) flow through React text nodes, no `dangerouslySetInnerHTML`, no `eval`, no `Function`
- [x] No credentials / secrets in any new file (greppable patterns: zero matches for `password|secret|api_key|token`)
- [x] No `eval`, `innerHTML`, `Function(`, `exec` in any new file
- [x] No PII leakage in event types — `EventsPerMinuteSparkline` reads only `event_type` + `created_at`, ignores payload contents

### Memory & lifecycle review
- [x] `use-health-detailed.ts:130-136` — interval cleared, AbortController called, cancelled flag set on unmount
- [x] `EventsPerMinuteSparkline.tsx:100-104` — same three-part cleanup
- [x] `FrameCounterSparkline.tsx` — pure stateless component, no effects, no leaks possible
- [x] `firehose/page.tsx:143-147` (existing pre-Phase 34) — WS, retry timer, countdown timer all closed; Plan 34-04 added a new effect at 157-176 with no resources to clean up (`useRef` mutation only)
- [x] `system/page.tsx:284-302` — two intervals (drift + seconds-ago) both cleared on unmount
- [x] No setState calls outside `if (!cancelled)` guards in any async path

### Race condition review
- [x] `AbortController` correctly aborts in-flight fetch on unmount (verified in use-health-detailed.ts:83, EventsPerMinuteSparkline.tsx:80)
- [x] `AbortError` swallowed silently in both hooks (lines 122-123, 92-93)
- [x] Watchdog suppression window logic: traced through 3 scenarios (T=0, T=5, T=65) — correctly suppresses second close within 60s and re-arms after expiry
- [x] `lastWatchdogCloseAtRef` uses `useRef` (not state) — correct, prevents render storm
- [x] `prevSentRef` / `prevDroppedRef` correctly nulled at hook mount, only set after first successful poll — first-poll delta is correctly skipped (lines 100, 107 guard)

### Type safety
- [x] `HealthDetailedPayload` in `steward/src/lib/use-health-detailed.ts` mirrors `grid/src/diagnostics/health-watchdog.ts` shape — `reasons` typed as OPTIONAL in steward (good: graceful degradation against pre-Plan-01 grid builds, documented in comment block L7-10)
- [x] `readonly` modifiers consistent across boundary
- [x] No `as any` assertions
- [x] `Array.isArray(data.entries)` guard at EventsPerMinuteSparkline.tsx:88 — correct narrowing

### Phase 31 zero-diff invariant
- [x] `git diff --stat 3a9fc2e..HEAD -- grid/src/audit/chain.ts` → empty output → **chain.ts untouched**
- [x] `git log --oneline 3a9fc2e..HEAD -- grid/src/audit/chain.ts` → empty → no commits touched it

### Surgical-changes principle
- [x] Modified file list (9 files) matches declared scope exactly — no out-of-scope edits
- [x] No "improved" comments / formatting on adjacent code
- [x] Plan 34-04 firehose-page edit removes only the inline EVENT_FAMILY_COLORS map and adds the watchdog effect — does not touch any of the rendering / connection / pause-buffer logic

---

_Reviewed: 2026-05-25T19:32:06Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
