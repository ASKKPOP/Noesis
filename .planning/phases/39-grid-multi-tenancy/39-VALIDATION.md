---
phase: 39
slug: grid-multi-tenancy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | grid/vitest.config.ts (or package.json scripts.test) |
| **Quick run command** | `cd grid && npm test` |
| **Full suite command** | `cd grid && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npm test`
- **After every plan wave:** Run `cd grid && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 0 | TENANT-01 | — | N/A | unit | `cd grid && npm test -- db/schema-v27-v28.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-01-02 | 01 | 0 | TENANT-01 | — | N/A | unit | `cd grid && npm test -- db/brain-token-store-owner.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-02-01 | 02 | 0 | TENANT-02 | T-39-cross-operator | Cross-operator query returns 403 | integration | `cd grid && npm test -- api/operator-me-nous.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-02-02 | 02 | 0 | TENANT-02 | T-39-ci-gate | CI gate exits 1 if operatorDid param missing | ci gate | `node scripts/check-operator-scope-typing.mjs` | ❌ Wave 0 | ⬜ pending |
| 39-03-01 | 03 | 0 | TENANT-03 | T-39-quota-bypass | 4th Brain claim returns 429 quota_exceeded | integration | `cd grid && npm test -- api/operator-me-brains.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-03-02 | 03 | 0 | TENANT-03 | — | N/A | integration | `cd grid && npm test -- api/operator-me-quota.test.ts` | ❌ Wave 0 | ⬜ pending |
| 39-04-01 | 04 | 0 | TENANT-01/02 | — | Civic routes return same data for all operator sessions | integration | `cd grid && npm test -- api/civic-routes-shared.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/db/schema-v27-v28.test.ts` — stubs for TENANT-01 DB migrations
- [ ] `grid/test/db/brain-token-store-owner.test.ts` — stubs for setOwner, findByOperator, countActiveByOperator
- [ ] `grid/test/api/operator-me-nous.test.ts` — stubs for TENANT-02 cross-operator isolation
- [ ] `grid/test/api/operator-me-brains.test.ts` — stubs for TENANT-03 quota enforcement on claim
- [ ] `grid/test/api/operator-me-quota.test.ts` — stubs for TENANT-03 quota read endpoint
- [ ] `grid/test/api/civic-routes-shared.test.ts` — stubs for Success Criterion 4 (shared civic data)
- [ ] `grid/test/ci/operator-scope-typing.test.ts` — stubs for D-39-10 CI gate correctness

*Existing infrastructure covers runner; only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Steward Console /system/operators page renders unowned pool + per-operator quota + edit controls | TENANT-03 | Next.js dashboard rendering requires browser | Open localhost:3000/system/operators as Henry; verify "Unowned Brains" section + quota edit controls visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
