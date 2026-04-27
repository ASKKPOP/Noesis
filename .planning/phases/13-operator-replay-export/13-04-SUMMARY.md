---
phase: 13-operator-replay-export
plan: "04"
subsystem: operator-exported-sole-producer
tags: [tdd, green-tests, replay, audit, sole-producer, allowlist, fastify-route, replay-02, d-13-09, t-10-10, t-10-08]
dependency_graph:
  requires:
    - 13-01 (RED tests for operator.exported — 3 test files turned GREEN here)
    - 13-02 (Wave 1 — ReadOnlyAuditChain, ReplayGrid, buildStateAtTick)
    - 13-03 (Wave 2 — buildExportTarball, createManifest, ExportManifest)
  provides:
    - grid/src/audit/append-operator-exported.ts (sole producer for operator.exported)
    - grid/src/audit/broadcast-allowlist.ts (ALLOWLIST_MEMBERS bumped 26→27)
    - grid/src/api/operator/export-replay.ts (POST /api/v1/operator/replay/export)
    - grid/src/api/operator/index.ts (registerReplayExportRoute wired)
    - scripts/check-state-doc-sync.mjs (26→27 + replay.* prefix hard-ban)
    - .planning/STATE.md (27-event allowlist enumeration updated)
  affects:
    - grid/test/audit/broadcast-allowlist.test.ts (26→27 count updated)
    - grid/test/audit/allowlist-twenty-six.test.ts (26→27 count + EXPECTED_ORDER updated)
    - grid/test/audit/allowlist-twenty-two.test.ts (26→27 count updated)
    - grid/test/relationships/allowlist-frozen.test.ts (26→27 count updated)
    - grid/src/export/tarball-builder.ts (undefined-strip fix for real chain entries)
tech_stack:
  added:
    - tar@^7.5.13 (installed in grid workspace — was missing despite Wave 2 claiming install)
  patterns:
    - Sole-producer audit event clone of appendNousDeleted (Phase 8 discipline)
    - 8-step guard discipline: operator_id format → type guard → literal tier → regex/range → self-report → closed-tuple → explicit reconstruction → privacy gate
    - REQUESTED_AT_MAX guard: Unix SECONDS enforcement (rejects Date.now() milliseconds)
    - D-30 order: tarball build → audit append → response stream (no half-states)
    - replay.* prefix CI hard-ban (permanent, references D-13 §deferred)
key_files:
  created:
    - grid/src/audit/append-operator-exported.ts
    - grid/src/api/operator/export-replay.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/api/operator/index.ts
    - scripts/check-state-doc-sync.mjs
    - .planning/STATE.md
    - grid/src/export/tarball-builder.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/allowlist-twenty-six.test.ts
    - grid/test/audit/allowlist-twenty-two.test.ts
    - grid/test/relationships/allowlist-frozen.test.ts
decisions:
  - "Math.floor(Date.now()/1000) for requested_at — D-13-09 Unix SECONDS contract prevents ms-vs-s confusion"
  - "REQUESTED_AT_MAX=10_000_000_000 guard in appendOperatorExported rejects Date.now() values (always ≥ 1e12)"
  - "buildStateAtTick(ReplayGrid, tick) used instead of plan's buildReplayState(entries, tick) — actual Wave 1 API"
  - "Two separate ReplayGrid instances per export (start + end) for snapshot isolation"
  - "stripUndefined() pre-pass in tarball-builder.ts — canonicalStringify throws on undefined; AuditEntry.targetDid is optional"
  - "tar package installed in grid workspace — Wave 2 npm install went to root workspace, not grid workspace"
metrics:
  duration_seconds: 642
  completed_date: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 10
---

# Phase 13 Plan 04: Wave 3 — operator.exported Sole-Producer + Export Route (REPLAY-02) Summary

**One-liner:** Sole-producer `appendOperatorExported` + H5 Fastify export route + allowlist 26→27 + replay.* hard-ban CI gate turning 3 Wave 0 RED tests GREEN.

## What Was Built

Wave 3 closed the REPLAY-02 audit-trail loop. When an operator exports a replay tarball via `POST /api/v1/operator/replay/export`, exactly one `operator.exported` audit event commits to the live chain — closed 6-tuple payload, no plaintext, no spoofable producer.

### Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `grid/src/audit/append-operator-exported.ts` | Sole producer — 8-step discipline clone of appendNousDeleted | 172 |
| `grid/src/api/operator/export-replay.ts` | POST /api/v1/operator/replay/export — H5-gated Fastify route | 130 |

### Files Modified

| File | Change |
|------|--------|
| `grid/src/audit/broadcast-allowlist.ts` | `export const ALLOWLIST_MEMBERS` (was `const`); append `'operator.exported'` at position 27 |
| `grid/src/api/operator/index.ts` | Import + call `registerReplayExportRoute` |
| `scripts/check-state-doc-sync.mjs` | 26→27 literal; add `'operator.exported'` to required[]; add `checkReplayPrefixBan()` |
| `.planning/STATE.md` | Forward-looking allowlist header: 26→27 events; add entry 27 |
| `grid/src/export/tarball-builder.ts` | `stripUndefined()` pre-pass (Rule 1 fix — undefined values crash canonicalStringify) |
| `grid/test/audit/broadcast-allowlist.test.ts` | 26→27; add `'operator.exported'` to it.each allowed list |
| `grid/test/audit/allowlist-twenty-six.test.ts` | 26→27; add position 27 to EXPECTED_ORDER |
| `grid/test/audit/allowlist-twenty-two.test.ts` | 26→27 size assertion |
| `grid/test/relationships/allowlist-frozen.test.ts` | 26→27 size assertion |

## Tests Turned GREEN

| Test File | Tests | Was |
|-----------|-------|-----|
| `grid/test/audit/operator-exported-allowlist.test.ts` | 3 | RED |
| `grid/test/audit/operator-exported-payload-privacy.test.ts` | 13 | RED |
| `grid/test/audit/operator-exported-producer-boundary.test.ts` | 1 | RED |
| **Total turned GREEN** | **17** | **17/17** |

Full suite after Wave 3: **148 test files / 1307 tests — all pass.**

## Allowlist Bump 26→27

Position 27 (zero-indexed 26) added to `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts`:

```
'operator.exported',  // Phase 13 — REPLAY-02 / D-13-09. Closed 6-tuple {tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}.
```

`ALLOWLIST_MEMBERS` changed from `const` to `export const` to satisfy the Wave 0 test import.

Cross-references updated:
- `scripts/check-state-doc-sync.mjs` required[] now has 27 entries
- `.planning/STATE.md` Broadcast allowlist section header updated to "27 events"
- Entry 27 added to the enumerated list in STATE.md

## Sole-Producer Grep Evidence

```
grep -rn "\.append\s*(\s*['\"]operator\.exported['\"]" grid/src/
```

Output (non-comment lines only):
```
grid/src/audit/append-operator-exported.ts:172:    return audit.append('operator.exported', operatorId, cleanPayload);
```

Exactly **1 file** in `grid/src/` calls `audit.append('operator.exported', ...)`. The producer-boundary grep test (Wave 0) confirms this at CI time.

## replay.* Hard-Ban CI Evidence

Added `checkReplayPrefixBan()` to `scripts/check-state-doc-sync.mjs`:

```
node scripts/check-state-doc-sync.mjs → exit 0
  "[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist."
```

**Negative test 1** — `'replay.test'` injected into ALLOWLIST_MEMBERS:
```
exit 1: REPLAY PREFIX HARD-BAN VIOLATION: grid/src/audit/broadcast-allowlist.ts contains a 'replay.*' token.
        Phase 13 D-13 §deferred bans replay.* allowlist members: ...
```
→ PASS

**Negative test 2** — `27\s+events` literal reverted to `26\s+events` in script:
```
exit 1: STATE.md does not mention "27 events" — Phase 13 allowlist count assertion missing.
```
→ PASS

## Manual Smoke Test — Pipeline Integration (7-step sequence)

Exercised via vitest smoke test covering the full pipeline:

| Step | Result |
|------|--------|
| 1. Populate AuditChain with 10 `tick` entries | OK |
| 2. Filter slice [1..5] — 5 entries, chainTailHash is HEX64 | OK |
| 3. Build start + end ReplayState snapshots via ReplayGrid + buildStateAtTick | OK |
| 4. createManifest + buildExportTarball → bytes (>0 length), hash (HEX64) | OK |
| 5. `appendOperatorExported` — chain grows 10→11, last eventType = `operator.exported` | OK |
| 6. `lastEntry.payload.tarball_hash === tarballHash` | OK |
| 7a. H4 tier → throws TypeError | PASS |
| 7b. `requested_at: Date.now()` (ms) → throws TypeError (REQUESTED_AT_MAX guard) | PASS |
| 7c. `end_tick < start_tick` → throws TypeError | PASS |

`requested_at` in smoke test was Unix seconds (≈ 1.75e9), well below `10_000_000_000` limit.

### Math.floor(Date.now()/1000) decision rationale (D-13-09)

`Date.now()` returns milliseconds (~1.75e12 in 2026), while the `requested_at` field in `OperatorExportedPayload` is specified as Unix SECONDS per D-13-09. If a developer accidentally passes `Date.now()` directly, the value (`>1e12`) exceeds `REQUESTED_AT_MAX=10_000_000_000` and `appendOperatorExported` throws with a clear message: "use Math.floor(Date.now()/1000), not Date.now()". This matches the Phase 5 TradeRecord contract referenced in D-13-09.

## Git Commits

| Hash | Message |
|------|---------|
| `330caac` | `feat(13-04): Task 1 — appendOperatorExported sole-producer + allowlist 26→27 (REPLAY-02 GREEN)` |
| `c0e0d53` | `feat(13-04): Task 2 — POST /api/v1/operator/replay/export + registrar wiring (REPLAY-02)` |
| `373e0ba` | `feat(13-04): Task 3 — doc-sync gate 26→27 + replay.* prefix hard-ban (CI)` |
| `d3219f1` | `fix(13-04): strip undefined fields in tarball-builder before canonicalStringify` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ALLOWLIST_MEMBERS` was `const` not `export const`**
- **Found during:** Task 1, pre-read of Wave 0 tests
- **Issue:** Wave 0 test imports `ALLOWLIST_MEMBERS` from broadcast-allowlist.ts but it was `const` (not exported). This was flagged in the 13-01 SUMMARY as a known issue for Wave 3 to fix.
- **Fix:** Changed to `export const ALLOWLIST_MEMBERS` when bumping the allowlist.
- **Files modified:** `grid/src/audit/broadcast-allowlist.ts`
- **Commit:** `330caac`

**2. [Rule 1 - Bug] 4 existing test files pinned to `26` broke after allowlist bump**
- **Found during:** Task 2 full test suite run
- **Issue:** `broadcast-allowlist.test.ts`, `allowlist-twenty-six.test.ts`, `allowlist-twenty-two.test.ts`, `allowlist-frozen.test.ts` all asserted `ALLOWLIST.size === 26`.
- **Fix:** Updated all 4 files to expect `27`; added `'operator.exported'` to the it.each list and EXPECTED_ORDER array where applicable.
- **Files modified:** 4 test files (listed above)
- **Commit:** `c0e0d53`

**3. [Rule 3 - Blocking] `tar` package not installed in grid workspace**
- **Found during:** Task 2 full test suite run
- **Issue:** Wave 2 ran `npm install tar` in the root workspace not the grid workspace. Vitest failed to resolve `tar` when any test transitively imported `tarball-builder.ts`.
- **Fix:** `cd grid && npm install tar@^7.5.13 --save` — installed directly in grid workspace.
- **Files modified:** `grid/package.json`, `grid/package-lock.json`
- **Commit:** `c0e0d53`

**4. [Rule 1 - Bug] `canonicalStringify` throws on `undefined` — AuditChain entries have optional fields**
- **Found during:** Manual smoke test (after Task 3 commit)
- **Issue:** Real `AuditChain.all()` entries include `targetDid: undefined` (optional field). `canonicalStringify` throws `TypeError: unsupported type undefined`. The Wave 2 tarball-determinism test used hand-crafted entries without undefined fields, masking this bug.
- **Fix:** Added `stripUndefined()` pre-pass in `tarball-builder.ts` before calling `canonicalStringify(e)` — mirrors standard `JSON.stringify` behavior (drops undefined-valued properties).
- **Files modified:** `grid/src/export/tarball-builder.ts`
- **Commit:** `d3219f1`

**5. [Rule 1 - Adaptation] `buildReplayState` in plan → actual API is `buildStateAtTick(ReplayGrid, tick)`**
- **Found during:** Task 2 pre-read of Wave 1 source files
- **Issue:** Plan interface block references `buildReplayState(allEntries, tick)` but Wave 1 exported `buildStateAtTick(replay: ReplayGrid, tick: number)` requiring a `ReplayGrid` instance.
- **Fix:** `export-replay.ts` constructs two `ReplayGrid` instances (one per snapshot tick) and calls `buildStateAtTick(replay, tick)`. Functionally equivalent — the plan's pseudocode was illustrative.
- **Files modified:** `grid/src/api/operator/export-replay.ts`
- **Commit:** `c0e0d53`

## Known Stubs

None — all production code paths are fully implemented. The route, sole-producer, allowlist bump, and CI gate are complete.

## Threat Flags

No new threat surfaces beyond what is documented in the plan's threat model. All 5 mitigated threats (T-10-10, T-10-08, T-13-04-01, T-13-04-02, T-13-04-03) are implemented:

| Threat | Mitigation Location | Status |
|--------|---------------------|--------|
| T-10-10 (Information Disclosure) | `appendOperatorExported` closed-tuple + `payloadPrivacyCheck` | MITIGATED |
| T-10-08 (Tampering — wall-clock) | `REQUESTED_AT_MAX` guard + `Math.floor(Date.now()/1000)` in route | MITIGATED |
| T-13-04-01 (Spoofing) | `validateTierBody` strict H5 check + self-report invariant | MITIGATED |
| T-13-04-02 (Tampering — allowlist CI) | `checkReplayPrefixBan()` + count assertion in doc-sync gate | MITIGATED |
| T-13-04-03 (Elevation of Privilege) | H5 is maximum tier; 400 (not 401/403) on tier mismatch | MITIGATED |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `grid/src/audit/append-operator-exported.ts` | FOUND |
| `grid/src/api/operator/export-replay.ts` | FOUND |
| `grid/src/audit/broadcast-allowlist.ts` has `'operator.exported'` | FOUND |
| `grid/src/api/operator/index.ts` imports `registerReplayExportRoute` | FOUND |
| `scripts/check-state-doc-sync.mjs` has `checkReplayPrefixBan` | FOUND |
| Commit `330caac` | FOUND |
| Commit `c0e0d53` | FOUND |
| Commit `373e0ba` | FOUND |
| Commit `d3219f1` | FOUND |
| 3 Wave 0 audit tests GREEN (17/17 assertions) | VERIFIED |
| 148 test files / 1307 tests all pass | VERIFIED |
| `node scripts/check-state-doc-sync.mjs` → exit 0 | VERIFIED |
| Sole-producer grep → exactly 1 file in grid/src/ | VERIFIED |
| replay.* hard-ban negative test → exit 1 | VERIFIED |
| Smoke test 7-step sequence → all steps PASS | VERIFIED |
