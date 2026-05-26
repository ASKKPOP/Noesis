---
phase: 37
slug: did-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `grid/vitest.config.ts` |
| **Quick run command** | `cd grid && npx vitest run --reporter=verbose src/api/registry` |
| **Full suite command** | `cd grid && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run --reporter=verbose src/api/registry`
- **After every plan wave:** Run `cd grid && npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | REG-01 | T-37-01 | Civic-DID request rejects unsigned payload | unit | `cd grid && npx vitest run src/api/registry/civic-did.test.ts` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | REG-02 | T-37-02 | Issued VC passes W3C VC v2.0 shape check | unit | `cd grid && npx vitest run src/api/registry/civic-did.test.ts` | ❌ W0 | ⬜ pending |
| 37-02-01 | 02 | 1 | REG-03 | T-37-03 | Business-DID register rejects insufficient Bios | unit | `cd grid && npx vitest run src/api/registry/business-did.test.ts` | ❌ W0 | ⬜ pending |
| 37-03-01 | 03 | 2 | REG-04 | T-37-04 | Revoke rejects operator-DID caller (court order required) | unit | `cd grid && npx vitest run src/api/registry/revocation.test.ts` | ❌ W0 | ⬜ pending |
| 37-03-02 | 03 | 2 | REG-04 | T-37-04 | Revoke rejects when no court-conviction reference present | unit | `cd grid && npx vitest run src/api/registry/revocation.test.ts` | ❌ W0 | ⬜ pending |
| 37-04-01 | 04 | 2 | REG-05 | — | Public lookup returns 200 without auth header | unit | `cd grid && npx vitest run src/api/registry/lookup.test.ts` | ❌ W0 | ⬜ pending |
| 37-04-02 | 04 | 2 | REG-05 | — | Response includes Cache-Control: max-age=60 | unit | `cd grid && npx vitest run src/api/registry/lookup.test.ts` | ❌ W0 | ⬜ pending |
| 37-05-01 | 05 | 2 | REG-06 | T-37-05 | Sole-producer files emit exactly 4 new event types | unit | `cd grid && node scripts/check-sole-producer-discipline.mjs` | ✅ | ⬜ pending |
| 37-05-02 | 05 | 2 | REG-06 | T-37-05 | Allowlist count = 64 after Phase 37 events added | unit | `cd grid && node scripts/check-audit-allowlist.mjs` | ✅ | ⬜ pending |
| 37-06-01 | 06 | 3 | REG-01..06 | T-37-06 | CI gate: civic-did issuance path only via Portal→Polis | unit | `node scripts/check-civic-did-issuance-path.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/src/api/registry/civic-did.test.ts` — stubs for REG-01, REG-02
- [ ] `grid/src/api/registry/business-did.test.ts` — stubs for REG-03
- [ ] `grid/src/api/registry/revocation.test.ts` — stubs for REG-04
- [ ] `grid/src/api/registry/lookup.test.ts` — stubs for REG-05
- [ ] `scripts/check-civic-did-issuance-path.mjs` — CI gate for D-V3-33 (CLAUDE.md mandated)

*Existing vitest infrastructure covers framework needs. Only new test files and the CI gate script are required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| W3C VC payload renders in external validator | REG-02 | Requires external tool (W3C Playground or credential.io) | Issue a test Civic-DID, paste payload into https://www.w3.org/2018/credentials/v2 validator, confirm no errors |
| Cache-Control header present on lookup response | REG-05 | Easier to spot-check than automate header inspection | `curl -I http://localhost:3000/api/v1/registry/civic-did/<test-did>` — confirm `cache-control: max-age=60` in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
