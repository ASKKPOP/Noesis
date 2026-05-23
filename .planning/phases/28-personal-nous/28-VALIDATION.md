---
phase: 28
slug: personal-nous
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (grid), vitest (dashboard) |
| **Config file** | `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| **Quick run command** | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` |
| **Full suite command** | `cd grid && npx vitest run` |
| **Estimated runtime** | ~30 seconds (grid), ~20 seconds (dashboard) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run test/portal/spawn-nous.test.ts && npx vitest run test/audit/append-nous-spawned-by-human.test.ts`
- **After every plan wave:** Run `cd grid && npx vitest run && cd ../dashboard && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-W0-01 | W0 | 0 | SPAWN-01..06 | — | RED stubs created | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-W0-02 | W0 | 0 | SPAWN-04 | T-28-01 | Audit sole-producer invariant stubs | unit | `cd grid && npx vitest run test/audit/append-nous-spawned-by-human.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-01 | 01 | 1 | SPAWN-04 | T-28-01 | `nous.spawned_by_human` in allowlist at pos 53 | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` | ✅ edit | ⬜ pending |
| 28-01-02 | 01 | 1 | SPAWN-04 | T-28-01 | `appendNousSpawnedByHuman` closed-tuple + privacy | unit | `cd grid && npx vitest run test/audit/append-nous-spawned-by-human.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 1 | SPAWN-01 | T-28-02 | POST /spawn rejects if payment not confirmed | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-02 | 02 | 1 | SPAWN-01 | T-28-02 | POST /spawn accepts after payment confirmed | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-03 | 02 | 1 | SPAWN-01 | T-28-02 | Payment replay (same txHash) returns 409 | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-04 | 02 | 1 | SPAWN-02 | T-28-03 | DID scheme `did:noesis:human-nous:*` validated | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-05 | 02 | 1 | SPAWN-03 | — | Returns 503 when ALLOW_HUMAN_SPAWNED_NOUS unset | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-06 | 02 | 1 | SPAWN-06 | T-28-04 | Returns 409 when human already has Nous | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-07 | 02 | 1 | SPAWN-05 | — | GET /portal/human/me/nous returns owned Nous | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-08 | 02 | 1 | SPAWN-03 | T-28-05 | Freeze check blocks spawn for frozen human | unit | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/portal/spawn-nous.test.ts` — stubs for SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-05, SPAWN-06
- [ ] `grid/test/audit/append-nous-spawned-by-human.test.ts` — SPAWN-04 sole-producer invariant stubs
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — edit to assert length 53 and include `nous.spawned_by_human`

*Existing infrastructure (vitest) covers all phase requirements — no new test framework installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4-step spawn wizard flow: complete spawn end-to-end | SPAWN-01, SPAWN-02 | Requires live wallet + on-chain testnet payment | Connect testnet wallet, navigate to /portal/nous/spawn, complete all 4 steps, confirm Nous appears in Genesis Grid |
| Owner hub displays spawn metadata + Chat shortcut | SPAWN-05 | Requires spawned Nous in DB | After spawn, navigate to /portal/my-nous, verify seed type, spawn date, USDT cost, and "Chat with [Name]" link |
| Personal Nous chat has distinct personality system prompt | D-08 | LLM output is non-deterministic | Chat with personal Explorer Nous and Scholar Nous; verify opening messages have different tones |
| Empty state CTA shows on /portal/my-nous before spawn | D-06 | Visual regression | Navigate to /portal/my-nous when no Nous owned; verify "Spawn Your Nous" button appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
