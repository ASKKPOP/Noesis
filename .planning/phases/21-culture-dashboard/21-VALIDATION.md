---
phase: 21
slug: culture-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (dashboard) |
| **Config file** | `dashboard/jest.config.ts` |
| **Quick run command** | `cd dashboard && npm test -- --testPathPattern="culture\|event-type\|tab-bar" --passWithNoTests` |
| **Full suite command** | `cd dashboard && npm test -- --passWithNoTests` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 0 | CULTURE-01..03 | T-21-02 | Grep gate extended to cover culture/** | integration | `node scripts/check-relationship-graph-deps.mjs` | ✅ | ⬜ pending |
| 21-01-02 | 01 | 0 | CULTURE-01..03 | — | EventCategory union includes "culture" | unit | `cd dashboard && npm test -- --testPathPattern="event-type"` | ✅ | ⬜ pending |
| 21-02-01 | 02 | 1 | CULTURE-01 | — | Lineage endpoint returns {nodes,edges} JSON | unit | `cd grid && npm test -- --testPathPattern="culture\|lineage"` | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 2 | CULTURE-01 | T-21-01 | SkillLineageGraph renders empty-state | unit | `cd dashboard && npm test -- --testPathPattern="skill-lineage"` | ❌ W0 | ⬜ pending |
| 21-03-02 | 03 | 2 | CULTURE-02 | T-21-01 | NormTimeline renders empty-state | unit | `cd dashboard && npm test -- --testPathPattern="norm-timeline"` | ❌ W0 | ⬜ pending |
| 21-03-03 | 03 | 2 | CULTURE-03 | T-21-01 | LoreGraph renders empty-state | unit | `cd dashboard && npm test -- --testPathPattern="lore-graph"` | ❌ W0 | ⬜ pending |
| 21-04-01 | 04 | 3 | CULTURE-01..03 | T-21-02 | No forbidden graph libs in culture/** | integration | `node scripts/check-relationship-graph-deps.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `dashboard/src/components/culture/__tests__/skill-lineage-graph.test.tsx` — stubs for CULTURE-01
- [ ] `dashboard/src/components/culture/__tests__/norm-timeline.test.tsx` — stubs for CULTURE-02
- [ ] `dashboard/src/components/culture/__tests__/lore-graph.test.tsx` — stubs for CULTURE-03
- [ ] `grid/src/__tests__/culture-lineage.test.ts` — stubs for Grid lineage endpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Culture tab appears in live dashboard tab bar | CULTURE-01..03 | Next.js routing requires browser | Navigate to `/grid/culture`, verify "Culture" tab highlighted |
| SVG hover titles show full DID/hash | CULTURE-01..03 | Tooltip is native browser behavior | Hover over a node in SkillLineageGraph, verify `<title>` content in browser tooltip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
