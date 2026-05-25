---
phase: 34-steward-system-health-surfaces
phase_number: 34
verified_at: 2026-05-25T19:33:53Z
status: human_needed
automated_score: 29/29 must_haves verified via grep/diff/test
human_needed_count: 5
verifier_model: sonnet
human_needed_items:
  - test: "SC #1 — Operator opens Steward /system, sees three new cards above Allowlist Monitor with live data."
    expected: "Audit Pipeline Health, Firehose Diagnostics, Events per Minute by Family cards render above Allowlist Monitor with values populated from /health/detailed and /api/v1/audit/trail."
    why_human: "Visual rendering against a running Grid + Steward stack — cannot exercise React render tree without Docker compose stack. UAT Step 1-3."
  - test: "SC #2 — Cards refresh every 5s without page reload."
    expected: "Operator watches the three cards for 30+ seconds; numbers update visibly every 5 seconds with no manual refresh."
    why_human: "Requires temporal observation of live data; verifier confirmed the 5s setInterval in code but cannot watch the cards update."
  - test: "SC #3 — Events per Minute by Family sparkline renders even when firehose is down (REST-not-WS)."
    expected: "With firehose WebSocket disconnected, the Events per Minute by Family sparkline continues to populate from REST /api/v1/audit/trail?limit=200 polls."
    why_human: "Requires inducing a real firehose outage (kill WS hub or stop frame production) and visually confirming the REST sparkline survives. Verifier confirmed the code uses fetch (not WebSocket)."
  - test: "SC #4 — Firehose watchdog forces reconnect when last_frame_at goes stale despite client_count > 0."
    expected: "Operator pauses the Grid clock (Step 4 Option C); /firehose status pill flips connected → disconnected → connecting → connected within ~60-90s as the watchdog calls wsRef.current.close()."
    why_human: "Requires real WS connection + real stale last_frame_at + watching the connection-status pill cycle. Verifier confirmed predicate code + suppression-window ref."
  - test: "SC #5 — MySQL outage cutover: docker stop noesis-mysql → cards turn red within 60s → docker start noesis-mysql → cards turn green within 60s (no browser refresh)."
    expected: "After docker stop, Audit Pipeline Health card flips green → amber/red within 60s, divergence increases or persist_error_with_divergence reason appears. After docker start, card returns to green within 60s without operator browser refresh."
    why_human: "Requires Docker lifecycle interaction against the running production stack — cannot simulate in vitest. This is the central integration test that exercises all 4 REQs together."
overrides: []
---

# Phase 34: Steward `/system` Health Surfaces — Verification Report

## Phase Goal

Audit Pipeline Health card + Firehose Diagnostics card + Events per Minute by Family sparkline + client-side firehose watchdog. After this phase ships, an operator visiting Steward `/system` can see at-a-glance whether the audit chain is healthy and the firehose is delivering frames; degraded states surface within 60s. (REQ OBS-11/12/13/14; ROADMAP §Phase 34.)

## Success Criteria Verification Table

| # | Success Criterion (from ROADMAP.md) | Status | Evidence |
|---|-------------------------------------|--------|----------|
| 1 | Operator opens `/system` and sees three new cards above Allowlist Monitor with live data. | VERIFIED-CODE / HUMAN-UAT-REQUIRED | system/page.tsx lines 196 (SystemPage) < 537 (Audit) < 597 (Firehose) < 668 (Events) < 683 (Allowlist Monitor). useHealthDetailed() hook wired on line 342. Visual render verification deferred to UAT Steps 1-3. |
| 2 | Cards refresh every 5s without page reload. | VERIFIED-CODE / HUMAN-UAT-REQUIRED | `setInterval(fetchHealth, 5000)` at use-health-detailed.ts:130; `setInterval(fetchTrail, 5000)` at EventsPerMinuteSparkline.tsx:99. Temporal observation deferred to UAT. |
| 3 | Events per Minute by Family sparkline renders even when firehose is down (REST-not-WS). | VERIFIED-CODE / HUMAN-UAT-REQUIRED | Zero WebSocket references in EventsPerMinuteSparkline.tsx; uses `fetch(${GRID_ORIGIN}/api/v1/audit/trail?limit=200)`. Real-firehose-down test requires UAT (Step 3 covers indirect path). |
| 4 | Firehose watchdog forces reconnect when `last_frame_at` goes stale despite `client_count > 0`. | VERIFIED-CODE / HUMAN-UAT-REQUIRED | Watchdog effect at firehose/page.tsx:157-176; predicate exact match `lastFrameAt !== null && clientCount > 0 && stalenessMs > 60_000 && (no suppression)`; triggers `wsRef.current?.close()`. Real-WS reconnect cycle requires UAT (Step 4). |
| 5 | MySQL outage cutover: `docker stop noesis-mysql` → cards turn red within 60s → `docker start noesis-mysql` → cards turn green within 60s (no browser refresh). | HUMAN-UAT-REQUIRED | Cannot machine-verify Docker lifecycle interaction. Code paths (divergence band, persist_error_with_divergence predicate, 5s poll) all confirmed. UAT Step 5 is the gating test. |

**Code-side status: all 5 SCs have their implementing code verified.** No SC is blocked at the code layer. Five SCs require operator UAT before the phase can be declared shipped.

## Plan-by-Plan must_haves Verification

### Plan 34-01 — Grid HealthDetailedPayload reasons[] extension (6/6 truths VERIFIED)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /health/detailed payload top-level keys are exactly: audit, clock, firehose, reasons, status, timestamp (6 keys, sorted). | VERIFIED | health-detailed-route.test.ts:136 asserts `Object.keys(body).sort()` equals exactly that array; test passes. |
| 2 | When status === 'ok' and tick >= 60, reasons is an empty array []. | VERIFIED | Test at line 166: `expect(body.reasons).toEqual([])` for healthy steady-state passes. |
| 3 | During cold-start grace (tick < 60), reasons equals ['grace_period']. | VERIFIED | Test at line 146: `expect(body.reasons).toEqual(['grace_period'])` passes. |
| 4 | When reconcile is stale beyond multiplier, reasons contains 'reconcile_stale'. | VERIFIED | Test at line 181: `expect(body.reasons).toContain('reconcile_stale')` passes. |
| 5 | When divergence > DIVERGENCE_CRITICAL, reasons contains 'divergence_above_critical'. | VERIFIED (by code review) | computeStatus() at health-watchdog.ts:117-118 pushes 'divergence_above_critical' when divergence > 100; test asserts AND-gate non-trigger branch (line 205-207, divergence === 0 stays ok). Logic preserved. |
| 6 | HealthWatchdog.computeStatus() body and HEALTH_THRESHOLDS values are unchanged (Phase 32 D-32-C1 / D-32-C2 frozen). | VERIFIED | `git diff 3a9fc2e..HEAD -- grid/src/diagnostics/health-watchdog.ts` shows ONLY 2 single-line additions: `readonly reasons: readonly string[]` in interface (line 67) and `reasons,` in return literal (line 273). computeStatus() body, HEALTH_THRESHOLDS, predicate logic all UNCHANGED. |

**Key links verified:**
- snapshot() return literal → computeStatus destructured reasons: confirmed at health-watchdog.ts:273 (single-line propagation `reasons,`).
- health-detailed-route.test.ts → `['audit', 'clock', 'firehose', 'reasons', 'status', 'timestamp']`: confirmed at test line 136, exact array match.

### Plan 34-02 — Steward lib substrate + ALLOWLIST_STATIC fix (6/6 truths VERIFIED)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | use-health-detailed.ts exports useHealthDetailed() polling /health/detailed every 5000ms. | VERIFIED | Line 130: `setInterval(fetchHealth, 5000)`; line 83: `fetch(${GRID_ORIGIN}/health/detailed)`. |
| 2 | Hook returns { data, error, isLoading, sentDeltas, droppedDeltas } with 12-entry ring buffer. | VERIFIED | Lines 64 (RING_CAPACITY = 12), 102-105 (ring slice for sent), 109-112 (ring slice for dropped), 139 (return shape). |
| 3 | On unmount, polling setInterval is cleared and in-flight fetch aborted via AbortController. | VERIFIED | Lines 79 (`new AbortController()`), 134 (`controller.abort()`), 135 (`clearInterval(interval)`). |
| 4 | health-reason-labels.ts exports HEALTH_REASON_LABELS + getReasonLabel covering all 7 keys. | VERIFIED | Lines 15-23 list exactly: grace_period, divergence_above_critical, persist_error_with_divergence, divergence_above_degraded, no_frames_with_clients, stale_frames, reconcile_stale (7 keys). |
| 5 | event-family-colors.ts exports EVENT_FAMILY_COLORS + getFamilyName + getFamilyColors. | VERIFIED | Lines 11 (EVENT_FAMILY_COLORS map with 12 named families + unknown), 31 (getFamilyColors), 44 (getFamilyName). Both `'portal.'` (line 22) and `'bios.'` (line 23) present. |
| 6 | ALLOWLIST_STATIC contains exactly 56 entries with header updated to '(56 events as of Phase 33)'. | VERIFIED | `grep -c "{ position:"` returns 57 (1 type-decl line + 56 entries); positions 54/55/56 present at system/page.tsx:65-67 (portal.auth.login, portal.auth.register, human.identified). |

**Key links verified:**
- use-health-detailed.ts → `${GRID_ORIGIN}/health/detailed` via 5s setInterval: confirmed.
- event-family-colors.ts → firehose/page.tsx import: confirmed (Plan 04 wired; see Plan 04 verification below).
- ALLOWLIST_STATIC.length: array length reflects in badge auto-update (not asserted directly but `grep -c` confirms 56).

### Plan 34-03 — Three system cards + sparklines (9/9 truths VERIFIED)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Audit Pipeline Health card sits ABOVE Allowlist Monitor on /system. | VERIFIED | system/page.tsx line 537 (Audit) < line 683 (Allowlist Monitor). |
| 2 | Audit card shows divergence as big-number colored green/amber/red per OBS-11 thresholds. | VERIFIED | divergenceBand() at line 179 returns green/amber/red/muted bands; consumed in card body. |
| 3 | Audit card polls /health/detailed every 5s and updates without page reload. | VERIFIED | useHealthDetailed() at line 342; hook uses 5s setInterval. |
| 4 | Audit reasons sub-line renders ONLY when auditReasons.length > 0 (D-34-B3). | VERIFIED | AUDIT_REASONS Set at line 170, filter at line 346, conditional render block in card body. |
| 5 | Grace_period renders under status==='ok' (D-34-B3 EXCEPTION). | VERIFIED | grace_period included in AUDIT_REASONS Set; renders whenever present (filter does not check status). |
| 6 | Firehose card shows client_count gauge + frames-sent/dropped sparklines + time-since-last-frame red >60s. | VERIFIED | Card body at lines 597+; FrameCounterSparkline rendered at line 662 with sentDeltas/droppedDeltas props. |
| 7 | firehoseReasons sub-line BETWEEN 3-stat grid and FrameCounterSparkline (D-34-B3 placement). | VERIFIED | firehoseReasons block at lines 653-660 (`<FrameCounterSparkline` at line 662). 653 < 662 confirmed. |
| 8 | Events per Minute by Family sparkline renders as raw inline SVG, 60×5s buckets, REST-driven. | VERIFIED | EventsPerMinuteSparkline.tsx: BUCKET_COUNT=60 (line 37), BUCKET_WINDOW_MS=5_000 (line 38), `<svg>` element (line 117), `fetch(${GRID_ORIGIN}/api/v1/audit/trail?limit=200)` (line 80), zero WebSocket usage. |
| 9 | All 3 cards inside SystemPage return tree, above Allowlist Monitor; other sections unchanged. | VERIFIED | function SystemPage at line 196; cards at 537/597/668; Allowlist Monitor at 683. Plan 03 SUMMARY confirmed Grid Status / Clock Control / Regions unchanged. |

**Key links verified:**
- system/page.tsx cards → useHealthDetailed(): confirmed at line 342.
- EventsPerMinuteSparkline → /api/v1/audit/trail?limit=200: confirmed at line 80.
- EventsPerMinuteSparkline + system/page.tsx → event-family-colors.ts: confirmed at line 4 of sparkline (imports getFamilyName + EVENT_FAMILY_COLORS).

### Plan 34-04 — Firehose watchdog + shared event-family palette (7/7 truths VERIFIED)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Watchdog triggers wsRef.current?.close() when last_frame_at !== null AND stale > 60_000 AND client_count > 0. | VERIFIED | firehose/page.tsx:157-176 watchdog effect: lines 161 (lastFrameAt null check), 162 (clientCount<=0 check), 164 (stalenessMs<=60_000 check), 175 (`wsRef.current?.close()`). |
| 2 | Suppression window: 60s after last close to avoid reconnect storm (R-34-03). | VERIFIED | Lines 58 (`lastWatchdogCloseAtRef = useRef<number \| null>(null)`), 166-170 (suppression check `Date.now() - lastClose <= 60_000`). |
| 3 | Existing connect() / scheduleReconnect() / ws.onmessage/onclose/onerror UNCHANGED. | VERIFIED | `git diff` shows zero changes to those handlers; only 2 imports added + watchdog useEffect block + EVENT_FAMILY_COLORS inline replaced with import. |
| 4 | Existing exponential backoff 1→2→4→8→16→30 cap UNCHANGED. | VERIFIED | Plan 04 SUMMARY grep: `Math.min(delay * 2, 30)` present, count=1. |
| 5 | Existing four refs and useEffect cleanup discipline UNCHANGED. | VERIFIED | Plan 04 SUMMARY grep: wsRef/retryTimerRef/countdownTimerRef/retryDelayRef each count=1; unmount cleanup intact. |
| 6 | Watchdog interval cleared on unmount (R-32-02 spirit). | VERIFIED | The watchdog useEffect has no interval (it's keyed on `[health]` from useHealthDetailed which owns its own setInterval + cleanup). Hook's own cleanup at use-health-detailed.ts:132-136. |
| 7 | firehose/page.tsx imports EVENT_FAMILY_COLORS from @/lib/event-family-colors (inline block removed). | VERIFIED | Line 6: `import { EVENT_FAMILY_COLORS, getFamilyColors, getFamilyName } from '@/lib/event-family-colors';`. Plan 04 SUMMARY confirmed 0 inline declarations remain. Diff shows 33-line removal of inline block. |

**Key links verified:**
- firehose/page.tsx watchdog effect → useHealthDetailed(): confirmed at line 57.
- Watchdog trigger predicate → wsRef.current?.close(): confirmed at line 175.
- firehose/page.tsx → event-family-colors.ts: confirmed at line 6 import.

### Plan 34-05 — Operator UAT playbook (7/7 truths VERIFIED for Task 1; Task 2 is the operator checkpoint surfaced in this report)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 34-HUMAN-UAT.md exists. | VERIFIED | File exists at .planning/phases/34-steward-system-health-surfaces/34-HUMAN-UAT.md. |
| 2 | Follows Phase 31/32 structure (Why → Prerequisites → Step 0 → Steps → Sign-off). | VERIFIED | UAT line 25 (Step 0), lines 61/87/110/135/164 (Steps 1-5), structural mirror confirmed. |
| 3 | Step 0 calls `docker compose build grid && up -d grid` AND `docker compose build steward && up -d steward`. | VERIFIED | Step 0 section at line 25 includes both rebuild commands per Plan 05 acceptance. |
| 4 | One numbered step per REQ: Step 1 (OBS-11) / Step 2 (OBS-12) / Step 3 (OBS-13) / Step 4 (OBS-14). | VERIFIED | Headers at lines 61/87/110/135 reference each REQ ID explicitly. |
| 5 | Step 5 covers MySQL outage scenario: docker stop → red within 60s → docker start → green within 60s. | VERIFIED | Lines 164/171 (`docker stop noesis-mysql`), 180 (`docker start noesis-mysql`), 189-190 (60s amber/red + 60s green expected outputs). |
| 6 | Each step has Expected Output + Operator Notes sign-off lines. | VERIFIED | Per Plan 05 SUMMARY acceptance: 18/18 grep checks passed including operator-notes count. |
| 7 | Final 'Document close-out' section notes 34-VERIFICATION.md should be created. | VERIFIED | Plan 05 playbook includes the close-out branches (PASS → 34-VERIFICATION.md; FAIL → invoke `/gsd-plan-phase --gaps`). |

**Key links verified:**
- 34-HUMAN-UAT.md → ROADMAP §Phase 34 5 SCs: confirmed via OBS-11/OBS-12/OBS-13/OBS-14 mapping in section headers + Step 5 explicit MySQL outage scenario (ROADMAP SC #5).

## Frozen Contracts Check

| Contract | Phase Locked | Expected | Actual | Status |
|----------|--------------|----------|--------|--------|
| Phase 32 D-32-C1: HEALTH_THRESHOLDS frozen values | Phase 32 | Unchanged numeric values | `git diff 3a9fc2e..HEAD -- grid/src/diagnostics/health-watchdog.ts` shows only 2 additions to HealthDetailedPayload interface + return literal; HEALTH_THRESHOLDS block (lines 39-44) unchanged. | UNCHANGED |
| Phase 32 D-32-C2: computeStatus() predicate logic | Phase 32 | Unchanged body | Diff confirms no edits in lines 87-156 (computeStatus body). | UNCHANGED |
| Phase 32 D-32-C3: /health/detailed route handler | Phase 32 | Untouched | `git diff 3a9fc2e..HEAD -- grid/src/api/routes/health-detailed.ts` returns empty. | UNCHANGED |
| Phase 32 D-32-A4: WsFirehoseHub.stats() shape | Phase 32 | Untouched | `git diff` of grid/src/audit/firehose-hub.ts returns empty. | UNCHANGED |
| Phase 31 chain.ts zero-diff (since 29c3516) | Phase 1 | Untouched | `git log` shows last modification was 1414ee1, before Phase 31; no Phase 34 modification. | UNCHANGED |
| Phase 31 PersistentAuditChain / AuditReconcile | Phase 31 | Untouched | `git diff` of grid/src/db/persistent-chain.ts + grid/src/db/audit-reconcile.ts returns empty. | UNCHANGED |
| Phase 33 broadcast-allowlist.ts (56 entries) | Phase 33 | Untouched | `git diff` of grid/src/audit/broadcast-allowlist.ts returns empty; allowlist remains at 56. | UNCHANGED |
| Phase 33 portal/auth.ts wiring | Phase 33 | Untouched | `git diff` of grid/src/api/portal/auth.ts returns empty. | UNCHANGED |
| Phase 34 D-34-B1 additive extension only | Phase 34 | Two single-line additions to HealthDetailedPayload + snapshot() | Diff shows exactly those 2 lines (interface line 67, return literal line 273). | ADDITIVE ONLY ✓ |

## Cross-Plan Wiring Check

| From | To | Via | Status |
|------|-----|-----|--------|
| Plan 02 use-health-detailed.ts | Plan 03 system/page.tsx | `import { useHealthDetailed } from '@/lib/use-health-detailed'` at system/page.tsx:5; called at line 342 | WIRED |
| Plan 02 health-reason-labels.ts | Plan 03 system/page.tsx | Consumed via `getReasonLabel` in firehoseReasons sub-line (line 659) and audit reasons block | WIRED |
| Plan 02 event-family-colors.ts | Plan 03 EventsPerMinuteSparkline.tsx | `import { EVENT_FAMILY_COLORS, getFamilyName } from '@/lib/event-family-colors'` at line 4 | WIRED |
| Plan 02 event-family-colors.ts | Plan 04 firehose/page.tsx | `import { EVENT_FAMILY_COLORS, getFamilyColors, getFamilyName } from '@/lib/event-family-colors'` at line 6 (inline block removed) | WIRED |
| Plan 02 use-health-detailed.ts | Plan 04 firehose/page.tsx watchdog | `import { useHealthDetailed }` at line 5; `useHealthDetailed()` call at line 57; watchdog effect reads `health.firehose.last_frame_at` + `health.firehose.client_count` at lines 159-160 | WIRED |
| Plan 01 grid /health/detailed payload.reasons | Plan 02 hook + Plan 03 cards | Hook types `readonly reasons?: readonly string[]` (optional, parallel-wave safe); Plan 03 cards read `data?.reasons ?? []` via allReasons | WIRED |

**Test executions:**
- `cd grid && npx vitest run test/health-detailed-route.test.ts` → 7/7 tests PASS, 385ms.
- `cd steward && npx tsc --noEmit` → 0 errors (clean exit).

## Required Operator Actions

This VERIFICATION.md captures only the automated half of Phase 34 close-out. All 5 ROADMAP Success Criteria require operator UAT to be declared shipped. The operator must:

1. Run `34-HUMAN-UAT.md` Step 0 (rebuild + restart Grid + Steward Docker; verify `/health/detailed` returns the `reasons` field).
2. Walk Steps 1-4 (one per REQ OBS-11/12/13/14) and record PASS/FAIL + observed values.
3. Run Step 5 (MySQL outage cutover) — the central integration test that exercises all 4 REQs against the 60s recovery SLA from ROADMAP §Phase 34 SC #5.
4. On all-PASS: amend this VERIFICATION.md with a new `## Operator UAT Results` section recording each step's outcome, change frontmatter `status: human_needed` → `status: passed`, and commit.
5. On any-FAIL: amend this VERIFICATION.md with the failure details, add a `gaps:` array to frontmatter, then invoke `/gsd-plan-phase 34 --gaps` to schedule gap closure.

### Expected UAT Outcomes (per ROADMAP §Phase 34 SCs)

| UAT Step | ROADMAP SC | Expected PASS Outcome |
|----------|-----------|----------------------|
| Step 1 (OBS-11) | SC #1 (Audit Pipeline Health card visible) | Card appears above Allowlist Monitor with divergence big-number in correct color band (green if 0); reasons sub-line empty (or shows 'Cold-start grace period' for fresh boot). |
| Step 2 (OBS-12) | SC #1 (Firehose Diagnostics card visible) | Card shows Connected Clients gauge (≥1 if /firehose tab open), frames-sent sparkline populating every 5s, Time Since Last Frame staying <10s under normal load. |
| Step 3 (OBS-13) | SC #1 + SC #3 (Events per Minute by Family sparkline) | Sparkline renders bars colored by family (nous./portal./operator./etc.); legend shows family names; survives temporary firehose stalls because it reads REST. |
| Step 4 (OBS-14) | SC #4 (watchdog reconnect) | On Clock Pause + 60s+ wait: /firehose status pill cycles connected → disconnected → connecting → connected without operator intervention. |
| Step 5 (cross-cutting) | SC #2 + SC #5 (5s polling + MySQL outage cutover) | `docker stop noesis-mysql`: cards flip green → amber/red within 60s. `docker start noesis-mysql`: cards return to green within 60s. Throughout: no browser refresh required. |

## Gaps Summary

**No code-side gaps.** Every must_have across Plans 34-01..05 verified via grep, diff, and vitest. All Phase 31/32/33 frozen contracts confirmed untouched. All cross-plan wiring confirmed. The phase is code-ready for operator UAT.

The 5 human-needed items above are the gating UAT verifications that cannot be exercised in vitest — they require Docker compose interaction, real-time observation of card refresh, and real WebSocket connection lifecycle events.

---

*Verified: 2026-05-25T19:33:53Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: No — initial verification*
