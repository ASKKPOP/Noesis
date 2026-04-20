---
phase: 3
slug: dashboard-v1-firehose-heartbeat-region-map
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by planner. Planner must reference this file in each plan's `<validation>` block.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/component) + Playwright 1.50 (E2E) — installed by Wave 0 |
| **Config file** | `dashboard/vitest.config.ts`, `dashboard/playwright.config.ts` — Wave 0 creates |
| **Quick run command** | `cd dashboard && npm run test:unit -- --run` |
| **Full suite command** | `cd dashboard && npm run test` (unit + component + e2e) |
| **Estimated runtime** | ~30s quick / ~90s full |

Grid-side work (Plan 01) uses the existing repo-root harness:

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (already configured in `grid/vitest.config.ts`) |
| **Quick run command** | `cd grid && npm test -- --run` |
| **Integration command** | `cd grid && npm test -- --run tests/integration` |

---

## Sampling Rate

- **After every task commit:** Run `cd dashboard && npm run test:unit -- --run` (and `cd grid && npm test -- --run` when Plan 01 tasks land)
- **After every plan wave:** Run `cd dashboard && npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite (dashboard + grid) must be green
- **Max feedback latency:** 30 seconds (quick), 90 seconds (full)

---

## Per-Task Verification Map

Every task below has an `<automated>` verify command. No task relies on manual-only checks for acceptance (see Manual-Only Verifications section for supplemental UX sanity checks).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | MAP-01 | T-03-01 | CORS allowlist rejects non-dev origins; credentials disabled | integration | `cd grid && npm test -- --run tests/integration/cors.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-01-02 | 01 | 1 | MAP-01 | T-03-02 | Read-only endpoint; no mutation path; shape validated | integration | `cd grid && npm test -- --run tests/integration/regions-endpoint.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-01-03 | 01 | 1 | AUDIT-03 | T-03-03 | Audit hash-chain invariant preserved; tick payload shape frozen | unit | `cd grid && npm test -- --run tests/unit/genesis-launcher.test.ts` | ❌ W0 (test extended in this task) | ⬜ pending |
| 3-02-01 | 02 | 1 | AUDIT-01 | — | N/A (scaffold); .env.example pins localhost origins only | integration | `cd dashboard && npm run build` | ❌ W0 (created by this task) | ⬜ pending |
| 3-02-02 | 02 | 1 | AUDIT-01 | — | MockWebSocket fixture prevents real network calls in tests | integration | `cd dashboard && npm run test:unit -- --run tests/smoke/boot.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-03-01 | 03 | 2 | AUDIT-02 | T-03-04 | Protocol types SYNC-mirrored; no cross-workspace imports | unit | `cd dashboard && npm run test:unit -- --run tests/unit/protocol-types.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-03-02 | 03 | 2 | AUDIT-02 | — | Full-jitter backoff bounded; no unbounded retries | unit | `cd dashboard && npm run test:unit -- --run tests/unit/backoff.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-03-03 | 03 | 2 | AUDIT-02 | T-03-05 | WS state machine; closes on invalid frames; broadcast allowlist enforced by server | unit | `cd dashboard && npm run test:unit -- --run tests/unit/ws-client.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-03-04 | 03 | 2 | AUDIT-03 | T-03-06 | In-flight guard prevents duplicate REST backfills; lastSeenId gap-detection | unit | `cd dashboard && npm run test:unit -- --run tests/unit/ws-client-refill.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-04-01 | 04 | 3 | ACT-03 | — | Pure function; no side effects; unknown types fall through to `other` | unit | `cd dashboard && npm run test:unit -- --run tests/unit/event-type.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-04-02 | 04 | 3 | ACT-03 | — | Ring buffer cap 500; no memory leak on long sessions | unit | `cd dashboard && npm run test:unit -- --run tests/unit/firehose-store.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-04-03 | 04 | 3 | AUDIT-02 | — | Presence derived from allowlisted events only; stale entries purged | unit | `cd dashboard && npm run test:unit -- --run tests/unit/presence-store.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-04-04 | 04 | 3 | AUDIT-02 | — | Staleness threshold = 2× tick rate; clock-skew tolerant | unit | `cd dashboard && npm run test:unit -- --run tests/unit/heartbeat-store.test.ts` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-05-01 | 05 | 4 | ACT-03 | — | Singleton stores via React context; no duplicate subscriptions on remount | component | `cd dashboard && npm run test:unit -- --run tests/component/use-stores.test.tsx` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-05-02 | 05 | 4 | ACT-03, AUDIT-01 | — | Components render from store only; no direct WS access; test-id convention enforced | component | `cd dashboard && npm run test:unit -- --run tests/component` | ❌ W0 (tests written in this task) | ⬜ pending |
| 3-05-03 | 05 | 4 | AUDIT-03 | T-03-07 | Server/client split respects RSC boundary; WS URL from env only; no auth tokens rendered | component | `cd dashboard && npm run test:unit -- --run tests/component/grid-client.test.tsx` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-06-01 | 06 | 5 | MAP-01, MAP-02 | — | computeRegionLayout deterministic; coords clamped to [0.05, 0.95]²; no XSS in region names (text node only) | component | `cd dashboard && npm run test:unit -- --run tests/component/region-map.test.tsx` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-06-02 | 06 | 5 | MAP-03 | — | flushSync prevents stale marker positions; no layout thrash on burst events | component | `cd dashboard && npm run test:unit -- --run tests/component/region-map-wiring.test.tsx` | ❌ W0 (test written in this task) | ⬜ pending |
| 3-06-03 | 06 | 5 | MAP-01, MAP-02, MAP-03 | — | Mock Grid isolated to test env; expected pixel coords derived from `computeRegionLayout`, not hard-coded | e2e | `cd dashboard && npm run test:e2e -- tests/e2e/nous-moves.spec.ts` | ❌ W0 (test written in this task) | ⬜ pending |

**Threat reference index** (full descriptions in each plan's `<threat_model>` block):

- T-03-01: CORS misconfiguration exposing Grid API to arbitrary origins
- T-03-02: Region endpoint leaking internal state beyond {regions, connections}
- T-03-03: Tick payload drift breaking AuditChain hash invariant
- T-03-04: Dashboard mirror diverging from authoritative Grid types
- T-03-05: Unbounded WS reconnect loop (DoS on Grid)
- T-03-06: Duplicate REST refills amplifying load on `dropped`
- T-03-07: Leaking WS URL / credentials via RSC hydration payload

---

## Wave 0 Requirements

Wave 0 = scaffolding tasks that must land before any test can run. Plans 01 + 02 collectively satisfy Wave 0:

- [ ] `dashboard/package.json` — Next.js 15 + React 19 + Tailwind 4 + Vitest 4 + Playwright 1.50 installed (Plan 02 Task 1)
- [ ] `dashboard/vitest.config.ts` — jsdom environment, React testing library setup, excludes `tests/e2e/**` (Plan 02 Task 1)
- [ ] `dashboard/playwright.config.ts` — `testDir: './tests/e2e'`, port 3001, Chromium, retry=1 (Plan 02 Task 1)
- [ ] `dashboard/tests/setup.ts` — shared test fixtures, MockWebSocket helper (Plan 02 Task 2)
- [ ] `dashboard/tests/fixtures/ws-frames.ts` — canonical frame samples from Phase 2 protocol (Plan 02 Task 2)
- [ ] `grid/src/server/plugins/cors.ts` — `@fastify/cors` allows `http://localhost:3000` and `http://localhost:3001` in dev (Plan 01 Task 1)
- [ ] Test-id convention documented in Plan 02 and consumed by Plans 05 + 06

---

## Manual-Only Verifications

These are **supplemental UX sanity checks**, not acceptance gates. All success criteria above have automated coverage.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Open browser, watch Grid tick, see Nous move" | Phase 3 Goal | Subjective end-to-end UX check in a real browser | 1. `docker compose up` (Phase 4) OR run Grid+Brain locally. 2. `cd dashboard && npm run dev`. 3. Visit `http://localhost:3001/grid`. 4. Observe heartbeat tick-count increment, firehose events stream, region map markers move. |
| Visual smoothness of Nous marker transition | SC-5 | Subjective frame-rate perception (automated test asserts transition occurs within one render cycle; smoothness is UX) | Visually confirm markers glide between regions in under ~150ms on `nous.moved`. |

*All other acceptance criteria have automated coverage via unit/component/E2E tests below.*

---

## Coverage Matrix (Success Criteria → Automated Tests)

| SC | Criterion | Test Type | File | Command |
|----|-----------|-----------|------|---------|
| SC-1 | `dashboard/` scaffolded + `npm run dev` on :3001 | integration | `dashboard/tests/smoke/boot.test.ts` | `npm run test:unit` |
| SC-2 | WS client reconnect + lastSeenId + REST refill on `dropped` | unit | `dashboard/tests/unit/ws-client.test.ts`, `dashboard/tests/unit/ws-client-refill.test.ts` | `npm run test:unit` |
| SC-3 | `/grid` route firehose: 500-event ring, DOM cap 100, type/actor/ts/payload shown | component | `dashboard/tests/component/firehose-panel.test.tsx` | `npm run test:unit` |
| SC-4 | Region map renders regions as nodes, edges for connections, Nous names listed | component | `dashboard/tests/component/region-map.test.tsx` | `npm run test:unit` |
| SC-5 | Nous marker shifts within one render cycle of `nous.moved` | component + E2E | `dashboard/tests/component/region-map.test.tsx`, `dashboard/tests/e2e/nous-moves.spec.ts` | `npm run test` |
| SC-6 | Heartbeat widget shows tick count + "last event N seconds ago", stale if >2× tick rate | component | `dashboard/tests/component/heartbeat-widget.test.tsx` | `npm run test:unit` |
| SC-7 | Firehose filterable by event type (trade/message/movement/law) | component | `dashboard/tests/component/event-type-filter.test.tsx` | `npm run test:unit` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plans 01 + 02 establish harness)
- [x] No watch-mode flags (CI-friendly, all commands use `-- --run`)
- [x] Feedback latency < 30s quick / 90s full
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for `/gsd-execute-phase`
