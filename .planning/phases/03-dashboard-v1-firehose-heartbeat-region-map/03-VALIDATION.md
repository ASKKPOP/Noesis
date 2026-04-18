---
phase: 3
slug: dashboard-v1-firehose-heartbeat-region-map
status: draft
nyquist_compliant: false
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

---

## Sampling Rate

- **After every task commit:** Run `cd dashboard && npm run test:unit -- --run`
- **After every plan wave:** Run `cd dashboard && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (quick), 90 seconds (full)

---

## Per-Task Verification Map

*Planner fills this table during planning. Each task in every PLAN.md must appear here.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | AUDIT-01 | — | N/A (scaffold) | integration | `cd dashboard && npm run build` | ❌ W0 | ⬜ pending |
| *(planner to extend)* | | | | | | | | | |

---

## Wave 0 Requirements

Wave 0 = scaffolding tasks that must land before any test can run.

- [ ] `dashboard/package.json` — Next.js 15 + React 19 + Tailwind 4 + Vitest 4 + Playwright 1.50 installed
- [ ] `dashboard/vitest.config.ts` — jsdom environment, React testing library setup
- [ ] `dashboard/playwright.config.ts` — port 3001, Chromium, retry=1
- [ ] `dashboard/tests/setup.ts` — shared test fixtures, MockWebSocket helper
- [ ] `dashboard/tests/fixtures/ws-frames.ts` — canonical frame samples from Phase 2 protocol
- [ ] Grid-side: `@fastify/cors` must allow `http://localhost:3001` origin in dev (coordinate with Phase 1/2 work — add to Phase 3 Wave 0 if not already)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Open browser, watch Grid tick, see Nous move" | Phase 3 Goal | Acceptance happens in a real browser against a live Grid | 1. `docker compose up` (Phase 4) OR run Grid+Brain locally. 2. `cd dashboard && npm run dev`. 3. Visit `http://localhost:3001/grid`. 4. Observe heartbeat tick-count increment, firehose events stream, region map markers move. |
| Visual smoothness of Nous marker transition | SC-5 | Subjective frame-rate perception | Visually confirm markers glide between regions in under ~150ms on `nous.moved`. |

*All other acceptance criteria have automated coverage via unit/component/E2E tests below.*

---

## Coverage Matrix (Success Criteria → Automated Tests)

| SC | Criterion | Test Type | File | Command |
|----|-----------|-----------|------|---------|
| SC-1 | `dashboard/` scaffolded + `npm run dev` on :3001 | integration | `dashboard/tests/smoke/boot.test.ts` | `npm run test:unit` |
| SC-2 | WS client reconnect + lastSeenId + REST refill on `dropped` | unit | `dashboard/tests/unit/ws-client.test.ts` | `npm run test:unit` |
| SC-3 | `/grid` route firehose: 500-event ring, DOM cap 100, type/actor/ts/payload shown | component | `dashboard/tests/component/firehose-panel.test.tsx` | `npm run test:unit` |
| SC-4 | Region map renders regions as nodes, edges for connections, Nous names listed | component | `dashboard/tests/component/region-map.test.tsx` | `npm run test:unit` |
| SC-5 | Nous marker shifts within one render cycle of `nous.moved` | component + E2E | `dashboard/tests/component/region-map.test.tsx`, `dashboard/tests/e2e/nous-moves.spec.ts` | `npm run test` |
| SC-6 | Heartbeat widget shows tick count + "last event N seconds ago", stale if >2× tick rate | component | `dashboard/tests/component/heartbeat-widget.test.tsx` | `npm run test:unit` |
| SC-7 | Firehose filterable by event type (trade/message/movement/law) | component | `dashboard/tests/component/event-type-filter.test.tsx` | `npm run test:unit` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (CI-friendly)
- [ ] Feedback latency < 30s quick / 90s full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
