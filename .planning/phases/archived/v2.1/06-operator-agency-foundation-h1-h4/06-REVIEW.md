---
phase: 6
depth: standard
status: warnings
reviewed_files: 32
critical_count: 0
high_count: 0
medium_count: 2
low_count: 4
---

# Phase 6 Code Review — Operator Agency Foundation (H1–H4)

## Summary

Phase 6 source changes are clean on all ten invariants listed in the scope brief. The AGENCY-03 producer-boundary (all `operator.*` audit emissions route through `appendOperatorEvent`), the D-19 hash-only Telos invariant, the SC#4 closure-capture discipline, the frozen 16-member allowlist, and the WorldClock zero-diff pause/resume are each preserved in code and backed by the Fastify 400→404→503 error ladder with no 500 paths and no audit emit on non-2xx. The only findings are two medium-severity dashboard A11y bugs in `AgencyIndicator` (broken `aria-describedby` reference, duplicated `aria-label` on a role="status" live region) and four low-severity style / maintainability nits across the protocol bridge and telos-force handler.

## Critical findings

None. Every invariant in the scope brief was individually verified:

- **AGENCY-03 tier stamp** — `grep` for `audit\.append\(['\"]operator\.` in `grid/src/` returns zero matches outside doc/plan markdown. All five `operator.*` call sites (`clock-pause-resume.ts:47,68`, `governance-laws.ts:66,100,126`, `memory-query.ts:113`, `telos-force.ts:127`) route through `appendOperatorEvent` in `grid/src/audit/operator-events.ts:81`, which enforces `requireTierInPayload` + `payloadPrivacyCheck` before the chain write.
- **D-19 hash-only H4** — `telos-force.ts:127-140` constructs the payload as a closed object literal with exactly six keys (`tier`, `action`, `operator_id`, `target_did`, `telos_hash_before`, `telos_hash_after`). No spread, no interior `new_telos` leak. A hex-64 runtime guard (`telos-force.ts:109-123`) rejects malformed Brain responses with 503 before they enter the audit chain. Brain side (`brain/src/noesis_brain/rpc/handler.py:410-413`) returns the two hashes only.
- **SC#4 closure-capture** — `use-elevated-action.ts:95` captures `targetTier` (lexical argument) and `getOperatorId()` into a local `body` object synchronously **before** the `await p.dispatch(body)` on line 97. A mid-flight `agencyStore.setTier('H1')` cannot mutate the serialized string. The finally-block on line 103 auto-downgrades per AGENCY-04.
- **Frozen allowlist** — `broadcast-allowlist.ts:30-51` declares exactly 16 members (11 pre-existing + 5 Phase 6 `operator.*`). The `buildFrozenAllowlist` helper (lines 63-72) overrides `add`/`delete`/`clear` with a TypeError-thrower then `Object.freeze`s the set. Signature count matches STATE.md's "16 events" assertion enforced by `scripts/check-state-doc-sync.mjs:39`.
- **Zero-diff invariant** — `WorldClock.pause()` (`ticker.ts:51-56`) clears the interval timer and flips `this.paused = true`. It does NOT call `this.advance()` and does NOT mutate `this.tick`, `this.epoch`, or `this.startedAt`. `resume()` (lines 63-67) restarts the interval without resetting the counter. Commit 29c3516's determinism guarantee is intact.
- **DID regex validation** — `memory-query.ts:56` and `telos-force.ts:63` both test `DID_REGEX.test(targetDid)` and short-circuit with 400 BEFORE any runner lookup or Brain RPC.
- **Fastify error ladder** — All four operator handlers follow the 400 (malformed) → 404 (unknown_nous) → 503 (brain_unavailable) ladder. No 500s are possible: the only `try`/`catch` blocks (memory-query.ts:105, telos-force.ts:103) log via `req.log.warn` and return 503 with a fixed error shape. Critically, 400/404/503 code paths all return BEFORE `appendOperatorEvent` is reached, so no failed request ever leaks an audit entry.
- **Cross-language contract** — Brain registers `brain.queryMemory` / `brain.forceTelos` (`__main__.py:194-195`), matching the bridge callsites in `protocol/src/noesis/bridge/brain-bridge.ts:79,97`. Params use the snake_case `new_telos` key (`handler.py:393`, `brain-bridge.ts:97`) consistent across both sides.
- **Privacy leak surfaces** — No `console.log`, `console.debug`, or `toString()` on Telos/memory payloads in any Phase 6 handler. `req.log.warn({ err, targetDid }, …)` uses Pino's structured logging (warn level, server-side only). The brain handler's `log.warning` on memory.recent failure (`handler.py:362`) does not include query content or entry contents. None of these surfaces reach the broadcast channel.
- **Focus trap / modal semantics** — `ElevationDialog` uses `ref.current.showModal()` / `.close()` (`elevation-dialog.tsx:49-50`). No portal, no custom z-index, no hand-rolled trap. `autoFocus` on Cancel (line 74) follows UI-SPEC line 617. Native `close` event routes to `onCancel` via `onClose={onCancel}` (line 59); the `pendingRef`-nulling discipline in `use-elevated-action.ts:89` prevents double-resolution when confirm→programmatic-close→close-event chain fires.

The documentation discrepancy in the scope brief (it names `on_operator_memory_query` / `on_operator_force_telos` — the actual method names are `query_memory` / `force_telos` registered under RPC names `brain.queryMemory` / `brain.forceTelos`) is a prompt-authoring artifact, not a code bug.

## High findings

None.

## Medium findings

### MED-01: Broken `aria-describedby` reference in AgencyIndicator

**File:** `dashboard/src/components/agency/agency-indicator.tsx:61`
**Issue:** The indicator button declares `aria-describedby="tier-tooltip"`, but the `TierTooltip` component (`dashboard/src/components/agency/tier-tooltip.tsx:40-45`) sets only `data-testid="tier-tooltip"` on its root `<div>` — not `id="tier-tooltip"`. `aria-describedby` looks up DOM ids, not test-ids, so the reference never resolves. Screen readers fall back to reading the button's own `aria-label`, losing the five-row H1–H5 definition panel that the tooltip is meant to describe.
**Fix:** Add `id="tier-tooltip"` to the `TierTooltip` root `<div>` (or accept it via a prop passed from the indicator). The rendered markup should be:

```tsx
// tier-tooltip.tsx
<div
    id="tier-tooltip"
    role="tooltip"
    data-testid="tier-tooltip"
    …
>
```

This keeps the existing test selector working and resolves the ARIA reference.

### MED-02: Redundant aria-label on nested role="status" region

**File:** `dashboard/src/components/agency/agency-indicator.tsx:58-73`
**Issue:** The outer `<button>` carries `aria-label={ariaLabel}` (good — primary accessible name for the focusable control). It then nests a `<span role="status" aria-label={ariaLabel}>` around the Chip. `role="status"` is a polite live region that announces on text changes; adding an identical `aria-label` means (a) the span's aria-label overrides the Chip's visible text as the accessible name, and (b) on tier change, assistive tech will announce the same string the focused button already exposes — causing a duplicate announcement every elevation/downgrade. The live-region pattern should wrap only the chip's visible text, unlabelled, so the live update reflects the visible state change without double-speaking.
**Fix:** Drop the inner `aria-label`, and consider whether the live region is needed at all given the button already has `aria-live` semantics via focus/label changes. Minimal change:

```tsx
<span role="status">
    <Chip label={label} color={TIER_COLOR[tier]} testId="agency-chip" />
</span>
```

Or, if the live announcement is important for out-of-focus tier changes, keep `role="status"` on the span but remove `aria-label` so the announcement uses the Chip's text content.

## Low findings

### LOW-01: `as any` casts in brain-bridge.ts

**File:** `protocol/src/noesis/bridge/brain-bridge.ts:38,47,55`
**Issue:** Three existing `params as any` casts (pre-Phase-6; `sendMessage`, `sendTick`, `sendEvent`). Phase 6's new `queryMemory` (line 80) / `forceTelos` (line 97) correctly use `as unknown as Record<string, unknown>` and a plain object literal respectively — a stricter pattern. The three pre-existing sites are now inconsistent with the Phase 6 style.
**Fix:** Opportunistic cleanup in a future phase — cast as `unknown as Record<string, unknown>` to match `queryMemory`'s pattern. Not urgent; these are all internal bridge calls with typed wrappers.

### LOW-02: Silently-swallowed error in AgencyHydrator test hook

**File:** `dashboard/src/components/agency/agency-hydrator.tsx:43-46`
**Issue:** The `.catch(() => {})` swallows every fetch error from the E2E test hook. The inline comment explains why (test harness only inspects request body, not response), but the empty arrow-function catch is exactly the anti-pattern `.claudeignore`-era linters flag. In production builds this branch is dead-code-eliminated, so no runtime impact.
**Fix:** Consider renaming to `.catch(() => { /* test hook: response not read */ })` so the intent is explicit and lint rules that flag empty catch bodies see the comment. Not urgent.

### LOW-03: TradeRequestAction placeholder fields in grid/src/integration/types.ts

**File:** `grid/src/integration/types.ts:44-56`
**Issue:** `TradeRequestAction` carries `channel: string` and `text: string` fields (required by the discriminated union shape) but the `nous-runner.ts:148-268` handler ignores both. Comments acknowledge this ("kept on the shape for protocol uniformity with other BrainAction variants but are ignored by the grid's trade handler"). Phase 6 does not change this, but each new reader must re-derive the intent. Pre-existing.
**Fix:** No action. Noted here so future reviewers don't flag it again.

### LOW-04: Ambiguous float-to-integer coercion in memory-query limit validator

**File:** `grid/src/api/operator/memory-query.ts:69-77`
**Issue:** The grid accepts any `Number.isFinite` limit (including non-integers like `3.7` or negatives like `-5`). The handler then forwards it to Brain, which `int()`-casts then clamps to `[1,100]`. A `-5` becomes `1`, a `3.7` becomes `3`. Functionally safe but lenient — the contract is "positive integer" and the validator neither enforces that nor documents the deferred clamp visibly enough for a reader of `memory-query.ts` alone (the comment on line 68 is easily missed).
**Fix:** Optional — tighten to `Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100`, and respond with 400 on any non-conforming value. Or leave the deferred clamp but hoist the comment to the function doc so it's unmissable.

## Observations

**OBS-1 — useElevatedAction / ElevationDialog are test-only in Phase 6.** Grep shows `useElevatedAction` imported only by `agency-hydrator.tsx` (test hook) and three test files (`use-elevated-action.test.tsx`, `elevation-race.test.tsx`, `agency.spec.ts`). The `AgencyHydrator` test hook bypasses the hook entirely and fires a raw `fetch` — the SC#4 race E2E asserts the correct tier lands in the HTTP body, but the live dashboard has no clickable surface that wires the dialog yet. This is explicitly documented as "Phase 7 peer-dialogue UI will wire the first real caller" in the hook header. No action — flagged for Phase 7 orchestration.

**OBS-2 — `amendLaw` re-sets `id: id` at runtime as a defense-in-depth cast backstop.** `engine.ts:33` constructs the amended law as `{ ...existing, ...updates, id }`. This is correct: even if a caller passes `{ id: 'different' }` through a cast, the trailing `id` re-overrides. The TypeScript signature (`Partial<Omit<Law, 'id'>>`) already forbids this at compile time; the runtime re-set is belt-and-suspenders.

**OBS-3 — Idempotency audit skip on clock pause/resume.** `clock-pause-resume.ts:44-52,65-73` reads `isPaused` state BEFORE calling `pause()`/`resume()` and only emits `operator.paused`/`operator.resumed` on an actual state transition. This correctly suppresses double-emit on repeat clicks without weakening audit coverage (idempotent no-ops are non-events by design).

**OBS-4 — Grid-side integration `MemoryEntry` duplicates the protocol-package shape.** `grid/src/integration/types.ts:90-94` redefines `MemoryEntry` so the grid integration layer has no compile-time dependency on `@noesis/protocol`. `protocol/src/noesis/bridge/types.ts:59-66` defines the same shape. This mirrors the existing two-source copy pattern for `HumanAgencyTier` / `OPERATOR_ID_REGEX` (explicitly SYNC-commented in both files) and matches Phase 5's precedent. If `MemoryEntry` ever evolves, both sides must update in the same commit.

**OBS-5 — Test hooks are dead-code-eliminated by build env flag.** `agency-store.ts:105-107`, `agency-hydrator.tsx:28-48`, and `playwright.config.ts:22` coordinate on `NEXT_PUBLIC_E2E_TESTHOOKS === '1'`. Next.js's dead-code elimination strips the entire `if` branch in production bundles (T-6-08a mitigation). The exposed globals `window.__agencyStore` and `window.__testTriggerH4Force` are therefore unreachable outside Playwright. This is the correct pattern for an E2E-only escape hatch.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
