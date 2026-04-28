---
phase: 13-operator-replay-export
verified: 2026-04-28T00:19:10Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3.5/5
  gaps_closed:
    - "STATE.md Accumulated Context says '27 events' and enumerates operator.exported as entry 27 — restored by commit 47c8131 in plan 13-06; CI gate exits 0"
    - "tar package not resolvable from scripts/ — fixed by commit 7ee4eca (hoisted tar@7.5.13 to root workspace)"
    - "Steward Console /grid/replay panel renders with Firehose, Inspector, and RegionMap reading from the replay store — fully resolved by plan 13-07 (commits 4718f7c, 4bcb2c7, 1b95bf8)"
  gaps_remaining: []
  regressions: []
---

# Phase 13: Operator Replay & Export Verification Report (Re-verification)

**Phase Goal:** An H3+ operator can scrub any historical chain slice in a sandboxed ReplayGrid and export a deterministic tarball that reproduces the same audit hash from seed — without the replay ever mutating the live chain or emitting fake timestamps.
**Verified:** 2026-04-28T00:19:10Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 13-06 and 13-07)

---

## Re-verification Context

Previous verification (2026-04-27T23:30:00Z) found status: gaps_found at 3.5/5 with three gaps:
- Gap 1 (HARD BLOCKER): STATE.md regression — commit f425d99 reverted 27-event content from cb7d136
- Gap 2 (HARD BLOCKER): `tar` package not resolvable from scripts/ and root vitest (ERR_MODULE_NOT_FOUND)
- Gap 3 (PARTIAL): Firehose, Inspector, RegionMap NOT mounted in /grid/replay (custom inline ReplayEntryRow used instead)

All three gaps were closed by plans 13-06 and 13-07.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chain slice export produces a deterministic tarball with fixed mtime, sorted entries, canonical JSON; replay-verify CLI reproduces hash bit-for-bit (REPLAY-01) | VERIFIED | `grid/src/export/canonical-json.ts` exports `canonicalStringify`. `grid/src/export/tarball-builder.ts`: `portable:true`, `noPax:true`, `mtime=new Date(0)` (EPOCH constant). `scripts/replay-verify.mjs` exists (231 lines). tar@7.5.13 hoisted to root workspace (commit 7ee4eca) — scripts/ resolves import. tarball-determinism.test.ts GREEN 2/2 (confirmed in 13-06-SUMMARY). |
| 2 | operator.exported is the one new allowlisted event; closed 6-tuple payload; H5-consent-gated via paste-suppressed ExportConsentDialog (REPLAY-02) | VERIFIED | `broadcast-allowlist.ts` contains `'operator.exported'` at position 27. `grid/src/audit/append-operator-exported.ts` is sole producer. `grid/src/api/operator/export-replay.ts`: POST /api/v1/operator/replay/export enforces `validateTierBody(body, 'H5')`. `ExportConsentDialog` mounted in `replay-client.tsx` with H5 gate (`disabled={!isH5}`). |
| 3 | ReplayGrid is configuration-over-fork with isolated readonly chain; grep CI gate confirms zero .append() in grid/src/replay/** (REPLAY-03, REPLAY-04) | VERIFIED | `grid/src/replay/readonly-chain.ts`: `ReadOnlyAuditChain` extends `AuditChain`, `append(): never` throws `TypeError` with 'read-only' and 'T-10-07'. `grid/src/replay/replay-grid.ts`: "No network server / no WebSocket hub". `scripts/check-replay-readonly.mjs` → `0 violations under grid/src/replay/ ✓` EXIT:0 (confirmed live). `grid/src/replay/state-builder.ts`: exports `buildStateAtTick`. |
| 4 | STATE.md Accumulated Context says '27 events' and enumerates operator.exported as entry 27 (doc-sync invariant) | VERIFIED | `node scripts/check-state-doc-sync.mjs` → `[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.` EXIT:0 (confirmed live). STATE.md grep: `grep -c "27 events" .planning/STATE.md` = 2. operator.exported confirmed at entry 27. Phase 13 Accumulated Context block present. Restored by commit 47c8131. |
| 5 | Steward Console /grid/replay panel renders at H3+ with REPLAY badge, Firehose + Inspector + RegionMap reading replay store, and H4/H5 inline redaction (REPLAY-05) | VERIFIED | `replay-client.tsx` imports and mounts `<Firehose replayMode />`, `<Inspector replayMode />`, `<RegionMap ... replayMode />` inside `<ReplayStoresProvider entries={entries}>`. `replay-stores.tsx`: `ReplayStoresProvider` seeds `FirehoseStore`/`PresenceStore` synchronously, mounts `StoresContext.Provider` override. `firehose.tsx`: reads `agencyStore` tier via `useSyncExternalStore`, passes `operatorTier` to each `FirehoseRow`. `firehose-row.tsx`: `tierNum = operatorTier ? parseInt(operatorTier.replace('H',''), 10) : 99`; checks H5_RESTRICTED then H4_RESTRICTED. `replay-redaction-copy.ts`: H4/H5 placeholder constants + restricted type Sets single-sourced. All 6 new redaction tests GREEN (confirmed in 13-07-SUMMARY). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `grid/src/replay/readonly-chain.ts` | VERIFIED | Exists, substantive (ReadOnlyAuditChain with append(): never TypeError). Used in replay-grid.ts. |
| `grid/src/replay/replay-grid.ts` | VERIFIED | Exists, substantive (ReplayGrid class, no network surface). Used in state-builder, export path. |
| `grid/src/replay/state-builder.ts` | VERIFIED | Exists, exports buildStateAtTick. Used in replay-client page. |
| `grid/src/export/canonical-json.ts` | VERIFIED | Exists, exports canonicalStringify. Used in tarball-builder. |
| `grid/src/export/tarball-builder.ts` | VERIFIED | Exists, exports buildExportTarball. Fixed mtime/portable/noPax confirmed. Used in export-replay.ts route. |
| `grid/src/export/manifest.ts` | VERIFIED | Exists under grid/src/export/. |
| `scripts/replay-verify.mjs` | VERIFIED | Exists, 231 lines. tar resolvable from root. Usage banner confirmed (13-06-SUMMARY). |
| `grid/src/audit/append-operator-exported.ts` | VERIFIED | Exists. Sole producer confirmed (1 file). Closed 6-tuple + H5-only gate. |
| `grid/src/api/operator/export-replay.ts` | VERIFIED | Exists. POST /api/v1/operator/replay/export, H5 gate, appendOperatorExported call. |
| `dashboard/src/app/grid/replay/page.tsx` | VERIFIED | Exists. Passes regions/connections to ReplayClient; fetchRegions wired. |
| `dashboard/src/app/grid/replay/replay-client.tsx` | VERIFIED | Exists. Mounts Firehose + Inspector + RegionMap inside ReplayStoresProvider. ExportConsentDialog H5-gated. |
| `dashboard/src/app/grid/replay/replay-stores.tsx` | VERIFIED | Exists (new in 13-07). ReplayStoresProvider: synchronous seeding, StoresContext.Provider override. |
| `dashboard/src/app/grid/replay/replay-redaction-copy.ts` | VERIFIED | Exists (new in 13-07). H4_PLACEHOLDER, H5_PLACEHOLDER, H4_RESTRICTED, H5_RESTRICTED single-sourced. |
| `dashboard/src/app/grid/replay/scrubber.tsx` | VERIFIED | Exists. |
| `dashboard/src/app/grid/replay/export-consent-dialog.tsx` | VERIFIED | Exists. |
| `dashboard/src/app/grid/components/firehose.tsx` | VERIFIED | Modified — reads agencyStore tier via useSyncExternalStore, passes operatorTier to FirehoseRow. |
| `dashboard/src/app/grid/components/firehose-row.tsx` | VERIFIED | Modified — operatorTier prop, tier-aware payload redaction logic present. |
| `scripts/check-replay-readonly.mjs` | VERIFIED | Exists. Exits 0 (confirmed live). |
| `.planning/STATE.md` | VERIFIED | 27-event allowlist in sync. operator.exported at entry 27. Phase 13 Accumulated Context block present. |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `replay-client.tsx` | `replay-stores.tsx` | `ReplayStoresProvider` import + wraps H3+ render branch | WIRED | `import { ReplayStoresProvider }` confirmed; `<ReplayStoresProvider entries={entries}>` wraps panels at line 121 |
| `replay-stores.tsx` | `use-stores.ts` | `StoresContext` import + `.Provider` override | WIRED | `import { StoresContext, useStores }` from `../use-stores`; mounts `StoresContext.Provider` at line 83 |
| `replay-client.tsx` | `Firehose/Inspector/RegionMap` | Direct component imports inside ReplayStoresProvider | WIRED | Lines 42–44 import all three; lines 160–170 mount all three with replayMode |
| `firehose.tsx` | `agencyStore` tier | `useSyncExternalStore` | WIRED | Lines 69–72 subscribe to agencyStore; operatorTier passed to each FirehoseRow at line 143 |
| `firehose-row.tsx` | `replay-redaction-copy.ts` | Named imports | WIRED | Line 23 imports H4_PLACEHOLDER, H5_PLACEHOLDER, H4_RESTRICTED, H5_RESTRICTED |
| `export-replay.ts` | `appendOperatorExported` | Direct import + call | WIRED | Line 37 imports; line 135 calls appendOperatorExported(services.audit, ...) |
| `export-replay.ts` | `buildExportTarball` | Import from export/index | WIRED | Confirmed in 13-04-SUMMARY and 13-04-PLAN |
| `tarball-builder.ts` | deterministic settings | `portable:true, noPax:true, mtime=new Date(0)` | WIRED | Lines 63–64 and EPOCH constant confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `replay-client.tsx` (Firehose) | `entries` prop → ReplayStoresProvider → FirehoseStore | entries passed from page.tsx audit slice, seeded synchronously in ReplayStoresProvider during render | Yes — seeded from real prop-fed AuditEntry[] | FLOWING |
| `firehose-row.tsx` | `operatorTier` | agencyStore.getSnapshot() via useSyncExternalStore in firehose.tsx | Yes — reactive read of live agency store tier | FLOWING |
| `tarball-builder.ts` | chain entries | Passed by buildExportTarball caller from ReplayGrid.chain.entries() | Yes — real chain entries from isolated replay grid | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| check-state-doc-sync gate | `node scripts/check-state-doc-sync.mjs` | `[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.` EXIT:0 | PASS |
| check-replay-readonly gate | `node scripts/check-replay-readonly.mjs` | `check-replay-readonly: 0 violations under grid/src/replay/ ✓` EXIT:0 | PASS |
| replay-verify CLI usage banner | `node scripts/replay-verify.mjs` (no args) | `Usage: node scripts/replay-verify.mjs <path-to-tarball>` (confirmed in 13-06-SUMMARY) | PASS |
| tarball determinism tests | `npx vitest run test/replay/tarball-determinism.test.ts` | 2/2 GREEN (confirmed in 13-06-SUMMARY) | PASS |
| StoresContext export | `grep "export const StoresContext" dashboard/src/app/grid/use-stores.ts` | Line 37: `export const StoresContext = createContext<Stores \| null>(null)` | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REPLAY-01 | 13-01, 13-03, 13-06 | Deterministic tarball, fixed mtime, canonical JSON, replay-verify CLI | SATISFIED | canonical-json.ts, tarball-builder.ts (portable/noPax/epoch mtime), replay-verify.mjs, tar hoisted to root |
| REPLAY-02 | 13-01, 13-04, 13-05, 13-06 | operator.exported event, H5-consent-gated ExportConsentDialog | SATISFIED | allowlist position 27, appendOperatorExported sole-producer, POST route H5 gate, ExportConsentDialog in replay-client |
| REPLAY-03 | 13-01, 13-02 | Configuration-over-fork ReplayGrid, isolated chain | SATISFIED | ReadOnlyAuditChain TypeError on append, ReplayGrid no network surface, check-replay-readonly exits 0 |
| REPLAY-04 | 13-01, 13-02 | STATE-LEVEL replay, byte-identical to live | SATISFIED | buildStateAtTick pure function, state-builder.ts, mirrors GenesisLauncher construction order |
| REPLAY-05 | 13-01, 13-05, 13-07 | Steward Console read-only Rewind panel at H3+, firehose+inspector+map | SATISFIED | ReplayStoresProvider, all three panels mounted in replay-client.tsx, tier-aware FirehoseRow redaction |

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `replay-stores.tsx` | Render-phase side effects (seeding stores during render) | Info | Intentional design decision (13-07-SUMMARY Decision 1): idempotent ingest/applyEvents called synchronously to ensure first render sees data. seededEntriesRef guard prevents re-seeding. |
| `firehose-row.tsx` | `operatorTier?: string` optional prop | Info | Intentional backward-compat: `undefined` sets `tierNum=99`, no redaction fires, live /grid behavior preserved. |

No blockers or warnings found.

---

### Human Verification Required

None — all programmatic checks pass. The Task 4 human-verification checkpoint from plan 13-05 (visual UI checks: REPLAY badge color, Scrubber scrubbing, H4/H5 placeholder rendering in browser) was approved on 2026-04-27 as documented in 13-05-SUMMARY.

---

## Gap Closure Summary

All three gaps from the previous verification (2026-04-27T23:30:00Z) are fully resolved:

**Gap 1 — STATE.md regression (HARD BLOCKER):** Commit 47c8131 (plan 13-06) restored the four content blocks reverted by f425d99: allowlist heading updated to Phase 13, event count 26→27, operator.exported entry 27 inserted, Phase 13 Accumulated Context block re-added. CI gate `check-state-doc-sync.mjs` exits 0.

**Gap 2 — tar not resolvable from scripts/ (HARD BLOCKER):** Commit 7ee4eca (plan 13-06) hoisted `tar@^7.5.13` to root `package.json` as a runtime dependency. `scripts/replay-verify.mjs` can now resolve the import. tarball-determinism tests pass 2/2 at root vitest.

**Gap 3 — Firehose/Inspector/RegionMap not mounted in /grid/replay (PARTIAL):** Plans 13-07 (commits 4718f7c, 4bcb2c7, 1b95bf8) fully resolved this by:
- Creating `ReplayStoresProvider` (replay-stores.tsx) with StoresContext.Provider override and synchronous render-phase seeding
- Exporting `StoresContext` from use-stores.ts (additive, backward-compat)
- Replacing the custom ReplayEntryRow list in replay-client.tsx with the three standard panels (`<Firehose replayMode />`, `<Inspector replayMode />`, `<RegionMap ... replayMode />`) inside the provider
- Adding tier-aware H4/H5 payload redaction in FirehoseRow (operatorTier prop)
- Single-sourcing redaction constants and event-type sets in replay-redaction-copy.ts

---

_Verified: 2026-04-28T00:19:10Z_
_Verifier: Claude (gsd-verifier) — re-verification after gap closure_
