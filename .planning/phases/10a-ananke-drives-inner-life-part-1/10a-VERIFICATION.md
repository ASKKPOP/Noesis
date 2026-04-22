---
phase: 10a-ananke-drives-inner-life-part-1
verified: 2026-04-22T01:30:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: N/A
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 10a: Ananke Drives (Inner Life, part 1) Verification Report

**Phase Goal:** Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain. Only threshold crossings cross the Brain↔Grid boundary as the single hash-authoritative broadcast event `ananke.drive_crossed`. No numeric drive value ever crosses the wire. Ships DRIVE-01..05. Allowlist 18→19 (exactly +1 slot).
**Verified:** 2026-04-22T01:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                          | Status     | Evidence                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Five drives implemented in `brain/src/noesis_brain/ananke/` as pure Python, deterministic      | ✓ VERIFIED | `types.py:14-26` closed 5-enum; `drives.py:35-71` pure `step(state,seed,tick)`; `config.py:49` single `math.exp` at load; stdlib only |
| 2   | `ananke.drive_crossed` is the single new broadcast event (allowlist exactly 19)                | ✓ VERIFIED | `broadcast-allowlist.ts:42-75` 19 distinct members; `ananke.drive_crossed` at position 19; no siblings present                      |
| 3   | Closed-tuple payload `{did, tick, drive, level, direction}` enforced via sole-producer         | ✓ VERIFIED | `append-drive-crossed.ts:101-110` `Object.keys(payload).sort()` strict-equality; 2-file grep boundary (emitter + allowlist)         |
| 4   | 3-keys-not-5 invariant: Brain emits 3-key metadata; Grid injects did+tick                      | ✓ VERIFIED | `handler.py:168-173` Brain metadata `{drive, level, direction}`; `nous-runner.ts:377-383` Grid injects `did: this.nousDid, tick`   |
| 5   | Threshold-crossing-only emission (audit ceiling ≤50 entries / 1000 ticks × 5 drives × 1 Nous)  | ✓ VERIFIED | `drives.py:113-142` `detect_crossing` bucket-change-only; `audit-size-ceiling-ananke.test.ts` 1/1 PASS; Brain bound ≤10/1000       |
| 6   | Determinism: replay at tickRateMs=1000 vs 1_000_000 produces byte-identical audit entries       | ✓ VERIFIED | `test_drives_determinism.py` 4 tests PASS (replay identity × 10_000 ticks, two-tick-rate equivalence, seed-independence)           |
| 7   | Wall-clock gate: zero `Date.now/performance.now/setInterval/time.*/datetime.*` in Ananke paths | ✓ VERIFIED | `grid/test/ci/ananke-no-walltime.test.ts` 1/1 PASS; `brain/test/test_ananke_no_walltime.py` 1/1 PASS; direct grep confirms zero     |
| 8   | Privacy matrix: `DRIVE_FORBIDDEN_KEYS` enforced at all 3 tiers (Grid / Brain wire / Dashboard)  | ✓ VERIFIED | `broadcast-allowlist.ts:110-127` 6-key export + regex pattern; `drive-forbidden-keys.test.ts` 21/21 PASS; dashboard 5/5 PASS       |
| 9   | Dashboard Drives panel renders 5 rows with icons/aria only — no numeric drive value in DOM     | ✓ VERIFIED | `ananke.tsx:76-124` 5-row locked order; level as string enum only; glyphs `aria-hidden`; 65-test aria matrix + 5-test privacy grep |
| 10  | Advisory-only coupling: drive state informs Telos but never coerces (PHILOSOPHY §6)             | ✓ VERIFIED | `handler.py:243-295` `_advisory_log_divergence` pure observation; grep `actions.remove/pop/[0]=` returns zero; test asserts NOOP unchanged |
| 11  | ROADMAP/STATE/MILESTONES/PROJECT/README all reflect Phase 10a shipped                          | ✓ VERIFIED | ROADMAP §10a `[x] shipped 2026-04-22`; STATE `status: Phase 10a shipped` + allowlist row 19; MILESTONES §Phase 10a SHIPPED; PROJECT DRIVE-01..05 Validated; README v2.2 Phase 10a SHIPPED blurb |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                                                    | Expected                                                | Status     | Details                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `brain/src/noesis_brain/ananke/__init__.py`                                 | Public surface re-export                                | ✓ VERIFIED | 1025 bytes; exports all public symbols incl. `AnankeRuntime`                              |
| `brain/src/noesis_brain/ananke/types.py`                                    | Closed 5-enum `DriveName` + `DriveLevel` + `Direction`  | ✓ VERIFIED | 87 lines; 5-entry `DRIVE_NAMES` tuple; frozen `DriveState` + `CrossingEvent` dataclasses |
| `brain/src/noesis_brain/ananke/config.py`                                   | Baselines, rise rates, thresholds, DECAY_FACTOR         | ✓ VERIFIED | 49 lines; `math.exp(-1/500)` pre-computed once; HYSTERESIS_BAND=0.02                     |
| `brain/src/noesis_brain/ananke/drives.py`                                   | `step / bucket / detect_crossing / initial_state`        | ✓ VERIFIED | 157 lines; piecewise recurrence; hysteresis-guarded; ordinal-derived direction           |
| `brain/src/noesis_brain/ananke/runtime.py`                                  | `AnankeRuntime` per-DID holder + `drain_crossings()`     | ✓ VERIFIED | 75 lines; `on_tick / drain_crossings / peek_crossings`                                   |
| `brain/src/noesis_brain/ananke/loader.py`                                   | `AnankeLoader` factory (clones `psyche/loader.py`)      | ✓ VERIFIED | 51 lines; `build(*, seed)` returns fresh runtime per call                                |
| `brain/src/noesis_brain/rpc/types.py` — `ActionType.DRIVE_CROSSED`          | 7th action type value `drive_crossed`                   | ✓ VERIFIED | grep confirms single enum entry; sits between TELOS_REFINED and NOOP                      |
| `brain/src/noesis_brain/rpc/handler.py` — Ananke integration                | per-DID runtime registry, on_tick drain, advisory log   | ✓ VERIFIED | `_ananke_runtimes: dict`, `_get_or_create_ananke` SHA-256 seed, 3-key metadata lift      |
| `grid/src/ananke/types.ts`                                                  | Closed enums + `AnankeDriveCrossedPayload` interface    | ✓ VERIFIED | 60 lines; `ANANKE_DRIVE_NAMES/LEVELS/DIRECTIONS` `as const` tuples                       |
| `grid/src/ananke/append-drive-crossed.ts`                                   | Sole-producer emitter with 8-step validation            | ✓ VERIFIED | 130 lines; DID regex → self-report → tick → enums → closed-tuple → privacy → chain.append |
| `grid/src/ananke/index.ts`                                                  | 4-line minimal public surface                           | ✓ VERIFIED | Re-exports `appendAnankeDriveCrossed` + types                                             |
| `grid/src/audit/broadcast-allowlist.ts` (modified)                          | Allowlist 19; `DRIVE_FORBIDDEN_KEYS`; FORBIDDEN pattern | ✓ VERIFIED | 19 entries; 6-key forbidden list; regex includes drive leaf keys                         |
| `grid/src/integration/types.ts` — `BrainActionDriveCrossed`                 | 7th BrainAction variant with 3-key metadata             | ✓ VERIFIED | `action_type: 'drive_crossed'`; metadata `{drive, level, direction}`                     |
| `grid/src/integration/nous-runner.ts` — dispatcher case                     | Injects `did`+`tick` from executeActions param           | ✓ VERIFIED | `case 'drive_crossed'` at line 371; try/catch drop-and-warn on rejection                 |
| `dashboard/src/lib/protocol/ananke-types.ts`                                | SYNC mirror of Brain/Grid types                         | ✓ VERIFIED | 3 SYNC: mirrors pointers; DRIVE_ORDER locked; no float literals in executable code        |
| `dashboard/src/lib/hooks/use-ananke-levels.ts`                              | Firehose-derived hook with baseline fallback            | ✓ VERIFIED | Walks audit entries; latest-crossing-per-drive wins; zero timers/wall-clock               |
| `dashboard/src/app/grid/components/inspector-sections/ananke.tsx`           | 5-row Drives panel with aria + locked glyphs            | ✓ VERIFIED | `AnankeSection`; locked order; color+text (WCAG); 45-state aria matrix                   |
| `dashboard/src/app/grid/components/inspector.tsx` (modified)                | AnankeSection mounted between Thymos and Telos           | ✓ VERIFIED | Import line 44; JSX mount line 388; section-order regression test PASS                   |
| `grid/test/audit/zero-diff-ananke.test.ts`                                  | Zero-diff regression (T-09-02)                          | ✓ VERIFIED | 1/1 PASS; 100-tick chain-head subtraction equality                                        |
| `grid/test/audit/audit-size-ceiling-ananke.test.ts`                         | 1000-tick × 5-drive ≤50 ceiling (T-09-01)               | ✓ VERIFIED | 1/1 PASS                                                                                  |
| `grid/test/ci/ananke-no-walltime.test.ts`                                   | Grid-side wall-clock grep gate (T-09-03)                | ✓ VERIFIED | 1/1 PASS                                                                                  |
| `brain/test/test_ananke_no_walltime.py`                                     | Brain-side wall-clock grep gate (T-09-03)               | ✓ VERIFIED | 1/1 PASS                                                                                  |
| `scripts/check-state-doc-sync.mjs` (modified)                               | EXPECTED_ALLOWLIST_SIZE 18→19 bump                      | ✓ VERIFIED | `node scripts/check-state-doc-sync.mjs` → OK (19-event allowlist in sync)                 |

### Key Link Verification

| From                                      | To                                       | Via                                                                                    | Status   | Details                                                                       |
| ----------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `handler.on_tick`                         | `AnankeRuntime.drain_crossings`          | `self._get_or_create_ananke(self.did).on_tick(tick)` → `runtime.drain_crossings()`     | ✓ WIRED  | handler.py:160-162; each crossing → one `DRIVE_CROSSED` Action (handler.py:163) |
| `handler.DRIVE_CROSSED Action`            | Grid `nous-runner.dispatchActions`       | RPC JSON `action_type='drive_crossed'` + `metadata{drive,level,direction}`              | ✓ WIRED  | nous-runner.ts:371 case branch consumes 3-key metadata                        |
| Grid dispatcher                           | `appendAnankeDriveCrossed` sole producer | `appendAnankeDriveCrossed(this.audit, this.nousDid, {did, tick, drive, level, direction})` | ✓ WIRED  | nous-runner.ts:377-383; injects did+tick from runner context, not metadata    |
| `appendAnankeDriveCrossed`                | AuditChain append                        | 8-step validation → `audit.append('ananke.drive_crossed', actorDid, cleanPayload)`      | ✓ WIRED  | append-drive-crossed.ts:133                                                   |
| AuditChain `ananke.drive_crossed` entries | Dashboard `AnankeSection`                | `useFirehose()` → `useAnankeLevels(did)` filters eventType=ananke.drive_crossed         | ✓ WIRED  | use-ananke-levels.ts filters + memoizes; ananke.tsx consumes Map<DriveName,{level,direction}> |
| Dashboard inspector                       | `AnankeSection` mount                    | Import + JSX at `inspector.tsx:44, 388`                                                 | ✓ WIRED  | Section-order regression asserts Psyche → Thymos → Ananke → Telos → Memory    |

### Data-Flow Trace (Level 4)

| Artifact                    | Data Variable    | Source                                                 | Produces Real Data | Status     |
| --------------------------- | ---------------- | ------------------------------------------------------ | ------------------ | ---------- |
| `AnankeSection`             | `levels` Map     | `useAnankeLevels(did)` → `useFirehose()` audit entries | Yes — live firehose + baseline fallback     | ✓ FLOWING  |
| Brain handler DRIVE_CROSSED | `xing` crossings | `runtime.drain_crossings()` from pure `step` recurrence | Yes — deterministic pure-fn output           | ✓ FLOWING  |
| Grid `appendAnankeDriveCrossed` | payload fields | Injected from runner context + Brain 3-key metadata    | Yes — `this.nousDid` + `tick` param + enums  | ✓ FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                            | Command                                                                        | Result                                       | Status   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | -------- |
| Brain ananke test suite (43 tests)                                  | `cd brain && uv run pytest test/ananke -q`                                     | 43 passed in 1.08s                           | ✓ PASS   |
| Brain wall-clock grep gate                                          | `cd brain && uv run pytest test/test_ananke_no_walltime.py -q`                 | 1 passed in 0.01s                            | ✓ PASS   |
| Grid Ananke + allowlist + regression + dispatcher tests (72 tests)  | `cd grid && npx vitest run test/ananke ... test/integration/brain-action-...`  | 72 passed (9 files)                          | ✓ PASS   |
| Dashboard Ananke + SYNC + privacy tests (81 tests)                  | `cd dashboard && npx vitest run src/lib/hooks/use-ananke-levels... test/...`    | 81 passed (4 files)                          | ✓ PASS   |
| Full Brain suite (no regression)                                    | `cd brain && uv run pytest -q`                                                  | 354 passed in 2.26s                          | ✓ PASS   |
| Full Grid suite (no regression)                                     | `cd grid && npx vitest run`                                                     | 813 passed (90 files) in 4.01s               | ✓ PASS   |
| Full Dashboard suite (no regression)                                | `cd dashboard && npx vitest run`                                                | 517 passed (53 files) in 2.30s               | ✓ PASS   |
| Doc-sync script gate                                                | `node scripts/check-state-doc-sync.mjs`                                         | `OK — STATE.md is in sync with the 19-event allowlist.` | ✓ PASS   |
| `ananke.drive_crossed` string grep boundary in grid/src/            | `grep -rln "ananke.drive_crossed" grid/src/`                                    | 2 files (emitter + allowlist) — 2-file invariant holds | ✓ PASS   |
| Forbidden-sibling event absence                                     | `grep -rln "drive_raised\|drive_saturated\|drive_reset" grid/ brain/ dashboard/` | 0 files                                     | ✓ PASS   |
| ALLOWLIST_MEMBERS count (excluding comments)                        | Node parse of `ALLOWLIST_MEMBERS` block                                         | 19 distinct entries; `ananke.drive_crossed` at position 19 | ✓ PASS   |

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                                             | Status       | Evidence                                                                                                                                    |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DRIVE-01    | 10a-01, 10a-02 | Five drives pure Python, closed MVP enum, v2.3 decision gate                                            | ✓ SATISFIED  | `types.py:14-26` 5-enum; grid `types.ts:ANANKE_DRIVE_NAMES` mirrors; no external libraries (`math`,`dataclasses`,`enum`,`typing` only)      |
| DRIVE-02    | 10a-01, 10a-06 | Deterministic `(seed, tick)` — byte-identical replay; monotonic rise; bounds clamping                  | ✓ SATISFIED  | `drives.py:35-71` piecewise + clamp [0,1]; 4 determinism tests PASS; two-tick-rate equivalence proven; 20-seed parametrized bounds property |
| DRIVE-03    | 10a-02, 10a-04 | `ananke.drive_crossed` allowlisted event, closed 5-key payload, threshold-only emission                  | ✓ SATISFIED  | Allowlist pos 19; `Object.keys(payload).sort()` at append-drive-crossed.ts:101; `detect_crossing` bucket-change only; audit-size ceiling PASS |
| DRIVE-04    | 10a-03         | Advisory-only coupling; Brain logs divergence but Grid never overrides                                   | ✓ SATISFIED  | `handler.py:243-295` `_advisory_log_divergence` pure observation; grep `actions.remove/pop/[0]=` zero; test asserts response-list unchanged  |
| DRIVE-05    | 10a-02, 10a-05, 10a-06 | No numeric drive value crosses Brain↔Grid wire; 3-tier privacy grep (emitter, wire, dashboard)        | ✓ SATISFIED  | `DRIVE_FORBIDDEN_KEYS` exported; `FORBIDDEN_KEY_PATTERN` extended; dashboard renders level-string only; 21+5 privacy tests PASS          |

**All DRIVE-01..05 requirements satisfied with concrete code + passing test evidence.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

_No anti-patterns found._

- Zero `Date.now / performance.now / setInterval / setTimeout / Math.random / new Date` in `grid/src/ananke/**`.
- Zero `time.time / time.monotonic / time.perf_counter / datetime.now / datetime.utcnow / random.*` in `brain/src/noesis_brain/ananke/**`.
- Zero `actions.remove / actions.pop / actions[0] =` in Brain handler's advisory path (PHILOSOPHY §6 preserved).
- Zero `drive_value` or drive-leaf keys in broadcast payload shapes.
- Zero numeric drive floats in dashboard component executable code (only in non-executable JSDoc).
- Zero `ananke.drive_raised / drive_saturated / drive_reset` forbidden-sibling literals.
- Zero `ananke.drive_crossed` string occurrences in grid/src/ outside the 2 sanctioned files (emitter + allowlist).

### Human Verification Required

_None._ All checks verifiable programmatically. Task 2 of Plan 10a-06 was a human-verify checkpoint for dashboard Unicode glyph rendering (⊘ ✦ ◆ ◯ ❍ ↑ ↓); this was approved 2026-04-22 per SUMMARY commit history, and the implementation uses standard Unicode BMP codepoints that render on the target platforms without tofu — the approval is recorded in STATE.md Accumulated Context (line 265-296) and MILESTONES Phase 10a entry. Visual appearance has been confirmed by the user at the planning-phase checkpoint.

### Gaps Summary

**None.** Phase 10a achieved all success criteria:

1. Five drives (hunger, curiosity, safety, boredom, loneliness) implemented in `brain/src/noesis_brain/ananke/` as pure deterministic Python.
2. `ananke.drive_crossed` added as the 19th allowlist member with zero sibling events.
3. Closed 5-key payload enforced by `Object.keys(payload).sort()` strict-equality at the sole producer.
4. Brain emits 3-key metadata; Grid injects `did`+`tick` from runner context — 3-keys-not-5 invariant holds.
5. Threshold-crossing-only emission locked by hysteresis-guarded `detect_crossing`; audit-size ceiling ≤50/1000 ticks × 5 drives × 1 Nous proven.
6. Determinism: byte-identical replay across tick rates proven by `test_drives_determinism.py` (10_000 ticks).
7. Wall-clock ban enforced by two-sided CI grep gates (grid + brain), both PASS.
8. Privacy matrix (`DRIVE_FORBIDDEN_KEYS`) enforced at Grid emitter + Brain wire + Dashboard render (three-tier grep).
9. Dashboard Drives panel renders 5 rows with color-+-text (WCAG), locked glyphs, 45-state aria matrix, and zero numeric values in DOM.
10. Advisory-only coupling: `_advisory_log_divergence` is pure observation; grep confirms zero mutations of the action list.
11. All 5 source-of-truth docs (ROADMAP, STATE, MILESTONES, PROJECT, README) reflect Phase 10a shipped 2026-04-22; doc-sync script gate PASS.

**Test coverage evidence:**
- Brain: 354/354 passing (43 Ananke-scoped: determinism/bounds/crossing/loader/handler + 1 wall-clock gate).
- Grid: 813/813 passing (72 Ananke-scoped: producer-boundary + allowlist-19 + dispatcher + privacy + zero-diff + audit-size ceiling + wall-clock gate + integration).
- Dashboard: 517/517 passing (81 Ananke-scoped: hook + 65-test aria matrix + drift detector + dashboard-side privacy grep).

**Full suite regression delta:** Zero regressions (baseline carried forward from Phase 9 close; all pre-existing tests green).

**Phase verdict: PASS. Ready to proceed to Phase 10b (Bios Needs + Chronos Subjective Time).**

---

_Verified: 2026-04-22T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
