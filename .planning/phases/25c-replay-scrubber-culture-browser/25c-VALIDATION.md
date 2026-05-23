---
phase: 25c
slug: replay-scrubber-culture-browser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 25c — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 (grid + dashboard); no test framework in steward |
| **Config file** | `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| **Quick run command** | `cd grid && npx vitest run --reporter=dot` |
| **Full suite command** | `cd grid && npx vitest run && cd ../dashboard && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cd grid && npx vitest run && cd ../dashboard && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-01 | 01 | 0 | header-auth migration in relationships.ts | T-25b-NEW-1 | x-operator-tier header trusted, body tier rejected | unit | `cd grid && npx vitest run --reporter=dot` | ✅ existing grid auth tests | ⬜ pending |
| D-02 | 01 | 0 | humanSanctionStore wired — ban/freeze return 200 | — | ban-human + freeze-wallet routes no longer 503 | integration | `cd grid && npx vitest run --reporter=dot` | ✅ ban-human.test.ts, freeze-wallet.test.ts | ⬜ pending |
| D-03 | 01 | 0 | spawn-system-nous returns 200 with deps wired | — | spawn-system-nous route no longer 503 | unit | `cd grid && npx vitest run --reporter=dot` | ✅ spawn-system-nous.test.ts | ⬜ pending |
| D-07 | 02 | 1 | replay-client.test.tsx RED → GREEN | — | Phase 13 acceptance contract fulfilled | unit | `cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot` | ✅ file exists, currently RED | ⬜ pending |
| D-04/D-05 | 03 | 2 | /replay route renders listing table | — | observer-only, no Grid mutations | manual | navigate to `localhost:3002/replay` | ❌ Wave 0 | ⬜ pending |
| D-06 | 04 | 3 | scrubber modal: H1/H2 gate message; H3+ see slider | T-25b-06-02 pattern | H3+ required enforced server-side | manual | open row click → verify tier gate | ❌ Wave 0 | ⬜ pending |
| D-08/D-10 | 05 | 4 | culture SVGs render without d3/recharts | D-9-08 invariant | no charting libs in steward bundle | grep | `grep -r "from 'd3\|from 'recharts\|from 'react-flow\|from 'cytoscape" steward/src/` | ❌ Wave 0 | ⬜ pending |
| D-11 | 05 | 4 | per-Nous filter bar changes SVG display | — | URL param updates view, deep-link works | manual | navigate to `localhost:3002/culture?nous=<did>` | ❌ Wave 0 | ⬜ pending |
| allowlist-delta | all | all | 0 new audit events emitted in 25c | — | allowlist count unchanged after 25c | grep | `grep -r "audit.append\|audit.emit" steward/src/ grid/src/api/operator/relationships.ts` | ✅ grep gate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `dashboard/node_modules/@vitejs/plugin-react` — install `@vitejs/plugin-react` locally in dashboard (`npm install --save-dev @vitejs/plugin-react` from dashboard dir) to unblock D-07 test run
- [ ] `steward/src/app/replay/page.tsx` — listing table (created in Wave 2)
- [ ] `steward/src/app/replay/replay-modal.tsx` — scrubber modal (created in Wave 3)
- [ ] `steward/src/app/culture/page.tsx` — culture panels (created in Wave 4)
- [ ] `steward/src/components/StewardShell.tsx` — add Observatory nav group with /replay + /culture links

*Wave 0 infra gap applies: existing test infrastructure does NOT cover all phase requirements. See @vitejs/plugin-react install and new steward pages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /replay listing renders table rows | D-04/D-05 | No steward test framework; UI rendering | Navigate `localhost:3002/replay`, confirm table renders with Exported At / Operator / Tick Range / Tarball Hash columns |
| Scrubber modal H3+ tier gate | D-06 | Operator tier is cookie-based; requires real session | Login as H2 operator, click row → confirm gate message renders. Login as H3 operator → confirm slider renders |
| H4 redaction placeholder | D-06 | Requires real session with payload content | Login as H3, open modal with sensitive event → confirm `— Requires H4` placeholder |
| /culture SVG panels render | D-08/D-10 | No steward tests; visual output | Navigate `localhost:3002/culture`, confirm 3 SVG panels (Skill Lineage, Norm Timeline, Lore Graph) render without JS errors |
| Per-Nous DID filter | D-11 | URL-param interaction | Navigate `localhost:3002/culture?nous=did:noesis:...`, confirm Skill Lineage dims non-incident nodes, Lore Graph filters by contributor_did, Norm Timeline shows "Grid-wide" sub-label |
| Observatory nav group | UI-SPEC | StewardShell nav visual | Confirm "Observatory" heading appears between Operator and Grid groups; /replay and /culture links present with active-state treatment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
