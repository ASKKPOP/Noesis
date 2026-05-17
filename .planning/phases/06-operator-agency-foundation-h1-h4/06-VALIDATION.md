---
phase: 6
slug: operator-agency-foundation-h1-h4
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (grid, dashboard) + playwright 1.x (dashboard E2E) |
| **Config file** | `grid/vitest.config.ts`, `dashboard/vitest.config.ts`, `dashboard/playwright.config.ts` |
| **Quick run command** | `cd grid && pnpm test -- --run test/api/operator test/audit/broadcast-allowlist.test.ts` |
| **Full suite command** | `pnpm -r test -- --run && cd dashboard && pnpm exec playwright test` |
| **Estimated runtime** | ~90 seconds (unit + integration) / ~180 seconds (incl. Playwright) |

---

## Sampling Rate

- **After every task commit:** Run quick command (grid vitest operator + allowlist + dashboard unit tests touching the modified surface)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green; Playwright SC#1 + SC#4 + SC#5 must pass
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Filled by planner during Step 8. Each plan's `<automated>` block maps 1:1 to a row below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 allowlist + tier-field | A | AGENCY-03 | T-6-03 (broadcast leak) | `operator.*` events land on allowlist; frozen-set invariant intact | unit | `cd grid && pnpm test -- --run test/audit/broadcast-allowlist.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 allowlist + tier-field | A | AGENCY-03 | T-6-02 (missing tier) | Every `operator.*` append validates `{tier, action, operator_id}` presence | unit | `cd grid && pnpm test -- --run test/audit/operator-event-invariant.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 AgencyIndicator + tooltip | B | AGENCY-01 | T-6-01 (missing indicator) | Chip mounts on every route; default tier H1 on first load | unit | `cd dashboard && pnpm test -- --run src/components/agency/agency-indicator.test.tsx` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 AgencyIndicator + tooltip | B | AGENCY-01 | — | Tooltip shows all 5 tier definitions verbatim from PHILOSOPHY §7 | unit | `cd dashboard && pnpm test -- --run src/components/agency/tier-tooltip.test.tsx` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 ElevationDialog + race regression | B | AGENCY-04 | T-6-04 (race downgrade) | Tier captured at confirm click; downgrade during await does NOT mutate committed tier (SC#4) | integration | `cd dashboard && pnpm test -- --run src/components/agency/elevation-race.test.tsx` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 ElevationDialog + race regression | B | AGENCY-04 | — | `<dialog>.showModal()` focus-traps and Escape-cancels | unit | `cd dashboard && pnpm test -- --run src/components/agency/elevation-dialog.test.tsx` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 H3 pause/resume + law endpoints | C | AGENCY-02, AGENCY-03 | T-6-05 (zero-diff loss) | WorldClock.pause()/resume() added; AuditChain zero-diff invariant preserved across pause boundary | integration | `cd grid && pnpm test -- --run test/api/operator/clock.test.ts test/worldclock-zero-diff.test.ts` | ❌ W0 | ⬜ pending |
| 6-04-02 | 04 H3 pause/resume + law endpoints | C | AGENCY-02, AGENCY-03 | T-6-06 (law mutation audit gap) | LogosEngine.amendLaw emits `operator.law_changed` with tier=H3 stamp | integration | `cd grid && pnpm test -- --run test/api/operator/governance.test.ts` | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 H2 memory + H4 force-Telos | C | AGENCY-02, AGENCY-03 | T-6-07 (telos leak) | H4 force-Telos broadcasts hash-only (`telos_hash_before/after`); plaintext Telos never leaves Grid | integration | `cd grid && pnpm test -- --run test/api/operator/telos.test.ts test/audit/operator-payload-privacy.test.ts` | ❌ W0 | ⬜ pending |
| 6-05-02 | 05 H2 memory + H4 force-Telos | C | AGENCY-02 | — | H2 memory query proxies to Brain; emits `operator.inspected` with `target_did` validated against DID regex | integration | `cd grid && pnpm test -- --run test/api/operator/memory.test.ts` | ❌ W0 | ⬜ pending |
| 6-06-01 | 06 SC E2E gates | D | AGENCY-01..04 + SC#1/#4/#5 | T-6-08 (SC gate drift) | Playwright E2E: chip on every dashboard route; elevation-race live test; H5 button visible+disabled | e2e | `cd dashboard && pnpm exec playwright test tests/e2e/agency.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — extend existing suite for 5 new `operator.*` members + count 11→16 assertion
- [ ] `grid/test/audit/operator-event-invariant.test.ts` — new; tier-required invariant (D-13)
- [ ] `grid/test/audit/operator-payload-privacy.test.ts` — new; `payloadPrivacyCheck()` across all 5 `operator.*` variants (D-12)
- [ ] `grid/test/api/operator/clock.test.ts` — new; pause/resume HTTP + AuditChain emission
- [ ] `grid/test/api/operator/governance.test.ts` — new; law add/amend/remove + `operator.law_changed` emission
- [ ] `grid/test/api/operator/memory.test.ts` — new; H2 proxy + `operator.inspected` emission
- [ ] `grid/test/api/operator/telos.test.ts` — new; H4 hash-only broadcast (`telos_hash_before/after`)
- [ ] `grid/test/worldclock-zero-diff.test.ts` — new; reuses Phase 2 tick-hash invariant under operator-initiated pause
- [ ] `dashboard/src/components/agency/agency-indicator.test.tsx` — new; chip render + default tier
- [ ] `dashboard/src/components/agency/tier-tooltip.test.tsx` — new; PHILOSOPHY §7 verbatim content
- [ ] `dashboard/src/components/agency/elevation-dialog.test.tsx` — new; `<dialog>` focus trap + Escape cancel
- [ ] `dashboard/src/components/agency/elevation-race.test.tsx` — new; SC#4 regression (tier captured at confirm)
- [ ] `dashboard/tests/e2e/agency.spec.ts` — new Playwright spec; SC#1 + SC#4 live + SC#5 disabled affordance

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doc-sync regression gate | CLAUDE.md doc-sync rule | `scripts/check-state-doc-sync.mjs` runs in CI but tied to single commit stream; manual spot-check before phase ship | After all plans green, run `node scripts/check-state-doc-sync.mjs` and confirm allowlist count 11→16 across STATE.md + README.md + broadcast-allowlist.ts tuple |
| Tier color contrast (visual) | UI-SPEC D-03 | WCAG contrast must be verified in actual dark theme render | Open `/grid`, cycle through tiers via localStorage override, screenshot and compare against UI-SPEC contrast table |
| H5 "Requires Phase 8" tooltip copy | SC#5 | String literal verification is covered by Playwright; UX feel on hover is human-judged | Hover H5 button in inspector drawer; tooltip appears within 400ms, does not flicker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (13 new test files)
- [ ] No watch-mode flags (all commands use `--run`)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
