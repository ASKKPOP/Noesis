---
phase: 45
slug: irs-treasury
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (grid) |
| **Config file** | `grid/vitest.config.ts` |
| **Quick run command** | `cd grid && npm run test -- --run` |
| **Full suite command** | `cd grid && npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npm run test -- --run`
- **After every plan wave:** Run `cd grid && npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 0 | IRS-01, IRS-04 | T-45-01 | Allowlist count = 75; no unapproved events | unit | `cd grid && npm run test -- --run broadcast-allowlist` | ✅ (needs count update) | ⬜ pending |
| 45-01-02 | 01 | 0 | IRS-03 | T-45-02 | New sole-producer stubs created | unit | `cd grid && npm run test -- --run append-irs-disbursement-authorized` | ❌ W0 | ⬜ pending |
| 45-01-03 | 01 | 0 | IRS-02, IRS-03, IRS-04 | — | IRS route test stubs created | integration | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 1 | IRS-01, IRS-04 | T-45-01 | `irs.tax_collected` on allowlist at pos 73 | unit | `cd grid && npm run test -- --run broadcast-allowlist` | ✅ | ⬜ pending |
| 45-02-02 | 02 | 1 | IRS-03 | T-45-02 | `irs.disbursement_authorized` sole-producer | unit | `cd grid && npm run test -- --run append-irs-disbursement-authorized` | ❌ W0 | ⬜ pending |
| 45-02-03 | 02 | 1 | IRS-03 | — | `irs.disbursement_executed` promoted | unit | `cd grid && npm run test -- --run append-irs-disbursement-executed` | ✅ | ⬜ pending |
| 45-02-04 | 02 | 1 | IRS-02, IRS-03, IRS-04 | T-45-03 | IrsStore methods: get, disburse | unit | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |
| 45-03-01 | 03 | 2 | IRS-02 | — | GET /irs/treasury returns correct shape | integration | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |
| 45-03-02 | 03 | 2 | IRS-03 | T-45-02 | POST /irs/disburse rejects missing gov JWT | integration | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |
| 45-03-03 | 03 | 2 | IRS-03 | T-45-02 | POST /irs/disburse with valid gov JWT succeeds | integration | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |
| 45-03-04 | 03 | 2 | IRS-04 | — | GET /irs/audit/:period returns sorted array | integration | `cd grid && npm run test -- --run irs-routes` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/irs-routes.test.ts` — integration test stubs for IRS-02 (treasury read), IRS-03 (disburse), IRS-04 (audit history)
- [ ] `grid/test/append-irs-disbursement-authorized.test.ts` — unit test stubs for new sole-producer event
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — update length assertion from 72 → 75 (RED gate before promotion)

*Existing infrastructure that does NOT need Wave 0 action:*
- `grid/test/append-irs-tax-collected.test.ts` — already passing (Phase 44 created)
- `grid/test/append-irs-disbursement-executed.test.ts` — already passing (Phase 41 created)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Government disbursement e2e (pre-Phase 46) | IRS-03 | Phase 46 Government JWT not available yet; use test fixture JWT | Generate test gov JWT with `legislation_ref` claim, call POST /api/v1/irs/disburse, verify treasury balance decreases and two audit events fire |
| Treasury read with browser | IRS-02 | Confirms `max-age=10` cache header in actual HTTP response | `curl -I http://localhost:3001/api/v1/irs/treasury` — check `Cache-Control: max-age=10` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
