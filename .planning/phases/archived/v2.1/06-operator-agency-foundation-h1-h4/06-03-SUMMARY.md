---
phase: 06-operator-agency-foundation-h1-h4
plan: 03
subsystem: ui
tags: [react, hooks, tdd, native-dialog, closure-capture, race-safety, fetch-wrapper, vitest]

requires:
  - phase: 06-02
    provides: "agencyStore singleton (subscribe/getSnapshot/setTier), getOperatorId() returning op:<uuid-v4>, HumanAgencyTier + TIER_NAME + OPERATOR_ID_REGEX from agency-types.ts"
  - phase: 06-01
    provides: "AGENCY-04 text, tier map, and elevation-dialog body-copy contract inherited from REQUIREMENTS.md"

provides:
  - "ElevationDialog native <dialog> primitive with REQ-verbatim body copy, focus-trap via showModal(), Escape-cancel via onClose"
  - "useElevatedAction hook with SC#4 closure-capture race-safety — tier + operator_id captured at confirm-click BEFORE network I/O"
  - "postOperatorAction fetch wrapper with operator error taxonomy (invalid_tier / unknown_nous / brain_unavailable / network)"
  - "ElevatedTier type (Exclude<HumanAgencyTier, 'H1'|'H5'>) as the compile-time guard for H2/H3/H4-only dialogs"
  - "jsdom HTMLDialogElement.showModal/close shim pattern for reuse by Plans 04/05 tests"

affects:
  - "06-05 (H2 memory query UI consumes useElevatedAction + postOperatorAction)"
  - "06-05 (H4 force-Telos Inspector button consumes useElevatedAction with ElevatedTier='H4')"
  - "06-05 (pause/resume/law-change controls consume useElevatedAction with ElevatedTier='H3')"

tech-stack:
  added: []
  patterns:
    - "Native HTMLDialogElement + showModal() instead of Radix/portal (D-08)"
    - "Closure-capture before first await: const body = { tier: targetTier, ... } (SC#4 / D-07)"
    - "useRef for pending request (not useState) to avoid double-resolve when programmatic dialog close fires native close event → onClose → onCancel"
    - "jsdom prototype-shim pattern for HTMLDialogElement in Vitest tests"

key-files:
  created:
    - dashboard/src/lib/api/operator.ts
    - dashboard/src/lib/api/operator.test.ts
    - dashboard/src/components/agency/elevation-dialog.tsx
    - dashboard/src/components/agency/elevation-dialog.test.tsx
    - dashboard/src/components/agency/elevation-race.test.tsx
    - dashboard/src/hooks/use-elevated-action.ts
    - dashboard/src/hooks/use-elevated-action.test.tsx
  modified: []

key-decisions:
  - "Use a useRef (not useState) for the pending request because the native <dialog>'s onClose event fires on ANY close — programmatic from Confirm as well as Escape. A ref mutated synchronously inside onConfirm avoids the stale-closure/batching window where onCancel would double-resolve the promise."
  - "autoFocus on Cancel (not Confirm) per UI-SPEC line 617 — safer default: Enter on dialog open cannot dispatch an unread action."
  - "Test asserts document.activeElement === cancelButton rather than the autofocus attribute, because React's autoFocus prop calls .focus() during mount rather than emitting the HTML attribute."
  - "REQ-verbatim body strings (H2/H3/H4) appear as LITERALS in the test — a rename of TIER_NAME.H3 from 'Partner' must fail loudly here rather than pass silently via a computed assertion."
  - "jsdom 26 leaves HTMLDialogElement.showModal/close undefined. Rather than mock at call sites, assign minimal shims to the prototype in each test file; vi.spyOn then wraps them for assertions. The close shim dispatches a real 'close' event so onClose handlers fire. This pattern is reused across three test files in Phase 6 and will be reused by Plan 04/05 dialog tests."

patterns-established:
  - "Operator fetch wrapper: mirrors introspect.ts but has its own error kinds (invalid_tier replaces invalid_did). Any new /api/v1/operator/* endpoint uses postOperatorAction directly."
  - "Closure-capture race-safety: the single load-bearing line is `const body = { tier: targetTier, operator_id: getOperatorId(), ...p.payload };` in use-elevated-action.ts:95. Any refactor that reads tier from agencyStore.getSnapshot() here breaks SC#4."
  - "Superseding-fire contract: the second fire() resolves the first as { ok:false, reason:'cancelled' }. Callers can depend on the promise always resolving (never hangs)."

requirements-completed: [AGENCY-04]

duration: 6min
completed: 2026-04-21
---

# Phase 6 Plan 03: Elevation dialog + race-safe dispatcher + operator API wrapper — Summary

**Ships the closure-capture race-safety machinery that closes threat T-6-04 (mid-flight tier downgrade): a native `<dialog>`-backed confirmation flow where the committed tier is the tier at confirm-click, not the tier at HTTP arrival.**

## Performance

- **Duration:** ~6 min (340 s)
- **Started:** 2026-04-21T05:08:38Z
- **Completed:** 2026-04-21T05:14:18Z
- **Tasks:** 3 completed (all TDD RED→GREEN)
- **Files created:** 7 (3 source + 4 test)
- **Total lines:** 1,204 (source 282, tests 922)

## Accomplishments

1. **SC#4 regression test is GREEN** — the single most important test in Phase 6. Mid-flight `agencyStore.setTier('H1')` fired from inside the dispatch callback does NOT mutate the committed tier. Plans 04/05 can now ship H2/H3/H4 endpoints through `useElevatedAction` and trust that the audit chain will record the confirmed tier.
2. **Native `<dialog>` primitive** with REQ-verbatim body copy (`Entering H{N} — {TierName}. This will be logged.`), focus-trap via `showModal()`, Escape-cancel via `onClose`, tier-colored confirm (H2 blue / H3 amber / H4 red), and autoFocus on Cancel.
3. **postOperatorAction fetch wrapper** with the Fastify 400→404→503 error ladder mapped to `invalid_tier` / `unknown_nous` / `brain_unavailable`, with `err.message` hermetically sealed behind a discriminated union (only `kind` leaks to callers).

## Task Commits

Each task was TDD (test-first RED → implementation GREEN):

1. **Task 1 RED:** `ad55e93` test(06-03): add failing tests for postOperatorAction
2. **Task 1 GREEN:** `351a951` feat(06-03): postOperatorAction fetch wrapper with operator error taxonomy
3. **Task 2 RED:** `e36c00f` test(06-03): add failing tests for ElevationDialog
4. **Task 2 GREEN:** `4b3c1b4` feat(06-03): ElevationDialog native <dialog> primitive
5. **Task 3 RED:** `ee73988` test(06-03): add failing tests for useElevatedAction + SC#4 race regression
6. **Task 3 GREEN:** `0145d45` feat(06-03): useElevatedAction hook with SC#4 closure-capture race-safety

## Test Counts

| File                                | Tests | Status |
|-------------------------------------|-------|--------|
| `src/lib/api/operator.test.ts`      | 9     | PASS   |
| `src/components/agency/elevation-dialog.test.tsx` | 16 | PASS |
| `src/hooks/use-elevated-action.test.tsx`          | 7  | PASS |
| `src/components/agency/elevation-race.test.tsx`   | 1  | PASS |
| **Plan 06-03 total**                | **33** | **PASS** |
| Full dashboard suite (regression)   | 307   | PASS   |

## SC#4 Regression Test — Confirmation

**File:** `dashboard/src/components/agency/elevation-race.test.tsx`
**Test name:** `SC#4 — committed tier is the confirmed tier, not the tier at HTTP arrival (tier captured at confirm)`
**Status:** GREEN (1/1)

Key assertion excerpt:
```typescript
const dispatch = vi.fn<DispatchFn>(async (body) => {
    observedBody.push(body);
    act(() => { agencyStore.setTier('H1'); });   // mid-flight downgrade
    return { ok: true, tier_echo: (body as { tier: string }).tier };
});
// ...click trigger, click Confirm...
expect(observedBody[0]).toMatchObject({
    tier: 'H4',                                  // MUST be H4, not H1
    target_did: 'did:noesis:x',
});
expect(observedBody[0]!.operator_id).toMatch(OPERATOR_ID_REGEX);
expect(agencyStore.getSnapshot()).toBe('H1');    // auto-downgrade fired
```

The load-bearing line in the hook is `use-elevated-action.ts:95`:
```typescript
const body = { tier: targetTier, operator_id: getOperatorId(), ...p.payload };
```
The `targetTier` is the lexical hook argument, captured at render time and closed over in `onConfirm`. A future refactor to `agencyStore.getSnapshot()` here would break SC#4 — the grep gate in the plan's `<done>` catches such drift.

## jsdom Workarounds Applied

**HTMLDialogElement shim** — jsdom 26 leaves `showModal` and `close` undefined on the prototype. Each of the three test files that uses the dialog installs a minimal shim:

```typescript
const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    close: () => void;
};
proto.showModal = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = true;
};
proto.close = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = false;
    this.dispatchEvent(new Event('close'));
};
```

`vi.spyOn(proto, 'showModal' | 'close')` then wraps these to count calls. The `close` shim dispatches a real native `close` event so the dialog's `onClose` handler fires — crucial because Escape simulation and programmatic close both route through that path.

**Reusable by Plans 04/05** — this block is suitable to lift verbatim into any future dashboard test that mounts ElevationDialog. Consider extracting to `src/test/dialog-shim.ts` if Plans 04/05 add more dialog tests.

## Interfaces Unlocked for Plans 04/05

All of these exports are stable and consumable by downstream plans:

| Export | From | Usage |
|--------|------|-------|
| `useElevatedAction(tier)` | `@/hooks/use-elevated-action` | Wrap any H2/H3/H4 action dispatcher with race-safe confirmation |
| `ElevatedTier` | `@/hooks/use-elevated-action` or `@/components/agency/elevation-dialog` | Type-constrains tier to H2\|H3\|H4 at compile time |
| `ElevationResult<T>` | `@/hooks/use-elevated-action` | Return type of fire() — `{ ok, reason?, data? }` |
| `ElevationDialog` | `@/components/agency/elevation-dialog` | Render inside any component that uses useElevatedAction — takes `targetTier`, `open`, `onConfirm`, `onCancel` |
| `postOperatorAction<T>(endpoint, origin, body, signal?)` | `@/lib/api/operator` | POST wrapper for all `/api/v1/operator/*` endpoints |
| `OperatorFetchResult<T>` / `OperatorFetchError` / `OperatorErrorKind` | `@/lib/api/operator` | Discriminated union for error handling in consumer components |

Typical consumer flow (Plan 04/05 reference):
```typescript
const pauseClock = useElevatedAction('H3');
// in pauseClock handler:
const result = await pauseClock.fire({}, async (body) => {
    const r = await postOperatorAction<{ ok: true }>('/api/v1/operator/clock/pause', origin, body);
    if (!r.ok) throw new Error(r.error.kind);
    return r.data;
});
// result.ok === true on success; result.reason === 'cancelled'|'failed' on failure
```

## Deviations from Plan

**None** — the plan executed exactly as written. One test-matcher substitution (`toBeInTheDocument` → `not.toBeNull()`) to match the existing dashboard test style (see `agency-indicator.test.tsx`), and one React-autoFocus assertion adjustment (check `document.activeElement` rather than the `autofocus` attribute, because React calls `.focus()` rather than emitting the attribute). Both substitutions are test-author style, not behavioral changes.

## Threat Model Status

| Threat ID | Category | Status | Mitigation Verified |
|-----------|----------|--------|---------------------|
| T-6-04 | Tampering (race downgrade) | mitigate | SC#4 regression test GREEN |
| T-6-04a | Repudiation (double-fire) | mitigate | Task 3 Test 3 asserts dispatch called exactly once |
| T-6-04c | Info Disclosure (err.message leak) | mitigate | Task 1 Test 7 asserts `Object.keys(error) === ['kind']` |
| T-6-04b | DoS via stale promise | accept | Single-operator v2.1, navigation discards tree |
| T-6-04d | Spoofing (client synthesizes H5) | accept | Compile-time only; server-side enforcement deferred to OP-MULTI-01 |

## Self-Check: PASSED

**Created files verified on disk:**
- `dashboard/src/lib/api/operator.ts` — FOUND
- `dashboard/src/lib/api/operator.test.ts` — FOUND
- `dashboard/src/components/agency/elevation-dialog.tsx` — FOUND
- `dashboard/src/components/agency/elevation-dialog.test.tsx` — FOUND
- `dashboard/src/components/agency/elevation-race.test.tsx` — FOUND
- `dashboard/src/hooks/use-elevated-action.ts` — FOUND
- `dashboard/src/hooks/use-elevated-action.test.tsx` — FOUND

**Commits verified in git log:**
- `ad55e93` — FOUND
- `351a951` — FOUND
- `e36c00f` — FOUND
- `4b3c1b4` — FOUND
- `ee73988` — FOUND
- `0145d45` — FOUND

**Done-gate greps:**
- `STATUS_TO_KIND` present in operator.ts: 2 matches (table + lookup) — PASS
- `Entering H` in elevation-dialog.tsx: 3 matches (1 comment + 2 computed from TIER_NAME, no paraphrase) — PASS
- `This will be logged` in elevation-dialog.tsx: 1 match (in bodyText template) — PASS
- `bg-(blue|amber|red)` in elevation-dialog.tsx: 3 matches (CONFIRM_FILL table) — PASS
- `const body = { tier: targetTier` in use-elevated-action.ts: 1 match (the closure-capture line) — PASS
- `agencyStore.setTier('H1')` in use-elevated-action.ts: 2 call sites (onConfirm finally + onCancel) — PASS
- `SC#4` in elevation-race.test.tsx: 3 matches (comment, describe, test name) — PASS
