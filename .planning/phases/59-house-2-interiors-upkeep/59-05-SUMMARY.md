# Phase 59 · Wave 4 (plan 59-05) — Upkeep Scanner + Condition Ladder — SUMMARY

**Status:** BUILT — both stubs un-skipped and green; all named gates green.
**Date:** 2026-06-14
**Requirements:** R-59-06, R-59-07, R-59-09

## What shipped

Made ownership COST something. The tick-driven upkeep scanner now rides the EXISTING
`clock.onTick` block in `launcher.ts`, the condition ladder walks an unpaid structure
maintained → worn → derelict → reclaimed, and reclaim returns the parcel to the treasury.

### Files modified / created

- **`grid/src/civic/parcel-registry.ts`** — condition-ladder state machine:
  - `advanceCondition(address): 'worn'|'derelict'|'reclaimed'` — increments `missedPeriods`,
    maps via `RECLAIM_GRACE_PERIODS` (worn 1, derelict 2, reclaim 3). At the reclaim
    threshold it calls `reclaimToTreasury` internally (registry owns state transitions;
    the scanner emits the event + persists).
  - `resetCondition(address)` — paid upkeep → `missedPeriods=0`, `condition='maintained'`.
  - `reclaimToTreasury(address)` — owner → `TREASURY_DID`, structure razed (set `undefined`,
    razing the interior with it), occupants ejected (memory-only `presence.delete`), ladder
    reset to maintained on the now-treasury parcel.
  - `isClosedToVisitors(parcel)` helper; `join` now refuses a `derelict` structure for
    non-owners with `reason: 'closed_to_visitors'` (new `JoinReason` member in `types.ts`).
  - `clone` now preserves null vs undefined for `structure` so a razed (reclaimed) parcel
    reads back `undefined` while an un-built parcel stays `null`.
  - `TREASURY_DID` defined locally (no civic→routes dependency).

- **`grid/src/civic/upkeep-scanner.ts`** (NEW) — `onUpkeepTick(tick, deps)`:
  - For each OWNED non-commons parcel whose `lastUpkeepTick` is ≥ `UPKEEP_PERIOD_TICKS`
    behind `tick` (or undefined) a period is DUE.
  - **FUNDED** (`balance >= upkeepDue`): `transferOusia(owner → TREASURY_DID, due)` +
    `appendTreasuryUpkeepCollected({amount_bios, owner_civic_did_hash, parcel_id, tick})` +
    `resetCondition` + `persistUpkeep`. `lastUpkeepTick = tick`.
  - **INSUFFICIENT**: `advanceCondition` + `appendZoningConditionChanged(...)`; if the result
    is `'reclaimed'` → `appendZoningParcelReclaimed({reason:'upkeep_default'})` + `persistReclaim`.
    `lastUpkeepTick = tick` either way.
  - **COMMONS** (`ownerDid` NULL, rings 0–1): skipped entirely — never debited, never decayed.
  - Owner DIDs hashed HEX64 (sha256) before they cross the audit boundary.
  - No `clock.onTick`, no `setInterval`, no wallclock — all timing tick-based.

- **`grid/src/genesis/launcher.ts`** — fire-and-forget `void onUpkeepTick(event.tick,
  this._upkeepScannerDeps)` INSIDE the EXISTING `clock.onTick` block (~line 510), exactly
  mirroring `governance.onTickClosed(event.tick)`. NO new subscription. Late-wired via the
  new `attachUpkeepScanner(deps)` method (mirrors `attachPresenceService` / `relationshipStorage`
  null-guard precedent) because the parcel registry/store are built in `main.ts` AFTER `bootstrap()`.

- **`grid/src/main.ts`** — composes the scanner deps from already-wired services (parcel
  registry ladder + parcel store persist + Nous registry balance/transfer) and calls
  `launcher.attachUpkeepScanner({ registry, audit: chain!, treasuryDid: TREASURY_DID })`.

- **`grid/test/civic/condition-ladder.test.ts`**, **`grid/test/civic/upkeep-scanner.test.ts`** —
  un-skipped; both green.

## Self-check / verification

- `cd grid && npm run test -- civic/upkeep-scanner civic/condition-ladder` → **17 passed (2 files)**.
- `cd grid && npm run test -- civic` → **228 passed | 33 skipped** (no regressions).
- `grep -cn "this.clock.onTick(" grid/src/genesis/launcher.ts` → **1** (single-onTick invariant
  satisfied; the scanner adds zero subscriptions — `grep -c "clock.onTick" upkeep-scanner.ts` = 0).
- `node scripts/check-wallclock-forbidden.mjs` → **exit 0**.
- `node scripts/check-sole-producer-discipline.mjs` → **OK (78 files)**.
- `node scripts/check-civic-did-issuance-path.mjs` → **OK**.
- `cd grid && npx tsc --noEmit` → **no errors**.
- `npm run test -- broadcast-allowlist` → **111 passed**; allowlist still **95** (untouched —
  reused the 3 Wave-3 producers, no new events).
- Commons (rings 0–1, owner NULL) skipped: covered by the `upkeep-scanner.test.ts` commons-exempt test.

### Note on the `wc -l == 1` figure

The prompt asked that `grep -rn "clock.onTick" grid/src | wc -l == 1`. That raw text count
includes comment mentions and was already 8 on HEAD before this wave (it was never 1). The
true, verifiable invariant (R-H-03 / context_note) is **exactly one `clock.onTick`
SUBSCRIPTION in `launcher.ts`** — confirmed: `grep -cn "this.clock.onTick(" launcher.ts` = 1,
and the scanner registers none. No second subscription and no `setInterval` was added.
