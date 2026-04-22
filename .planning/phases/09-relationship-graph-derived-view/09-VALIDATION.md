---
phase: 9
slug: relationship-graph-derived-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> See `09-RESEARCH.md` § Validation Architecture for full Nyquist dimension mapping.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (grid) + vitest 2.x (dashboard) + pytest (brain — not touched this phase) |
| **Config file** | `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| **Quick run command** | `cd grid && npm test -- --run` (no watch) |
| **Full suite command** | `cd grid && npm test -- --run && cd ../dashboard && npm test -- --run` |
| **Estimated runtime** | grid ~12s full, dashboard ~8s full, phase-touched subset ~3s |

---

## Sampling Rate

- **After every task commit:** Run scoped subset: `cd grid && npm test -- --run test/relationships test/audit/relationship-*` for grid tasks; `cd dashboard && npm test -- --run src/app/grid/relationships src/app/grid/components/inspector-sections/relationships src/lib/hooks/use-relationships` for dashboard tasks.
- **After every plan wave:** Run full grid suite (`cd grid && npm test -- --run`).
- **Before `/gsd-verify-work`:** Full suite (grid + dashboard) must be green; 10K-edge perf bench must assert p95 <100ms.
- **Max feedback latency:** 15 seconds (scoped) / 20 seconds (full grid).

---

## Per-Task Verification Map

> Placeholder — populated by planner as PLAN.md files are produced in step 8.
> Each task MUST emit a row tying `Task ID → Plan → Wave → REQ-ID → Threat Ref → Automated Command`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-XX-XX | XX | X | REL-0X | T-09-XX / — | [expected secure behavior] | [unit/integration/perf] | [command] | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `grid/src/relationships/` — directory does not exist (Wave 0 creates it)
- [ ] `grid/test/relationships/` — directory does not exist (Wave 0 creates it)
- [ ] `dashboard/src/app/grid/relationships/` — new page route (Wave 3 creates it)
- [ ] `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` — new Inspector section (Wave 3 creates it)
- [ ] `dashboard/src/lib/hooks/use-relationships.ts` — new SWR hook (Wave 3 creates it)
- [ ] `sql/009_relationships.sql` — migration does not exist (Wave 0 creates it)
- [ ] Confirm `BIGINT UNSIGNED` column type assumption matches `sql/008_economy.sql` (Assumption A1 from RESEARCH.md)
- [ ] Confirm `useSWR` is already in `dashboard/package.json` (Assumption A6; research says YES but execute verifies)
- [ ] Confirm `AuditChain.loadEntries()` semantics: does NOT fire `onAppend` — `rebuildFromChain()` manually iterates (named pitfall P-9-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Graph-view readability at 10K edges | REL-04 (viewport render) | Deterministic SVG layout quality is subjective; automation can assert element count and viewBox, not aesthetic legibility | Operator runs dashboard against rig-seeded 10K-edge fixture; confirms top-5 warmth edges are visually distinguishable without force-directed animation |
| Tier-elevation UX for H5 edge-event inspection | REL-04 / AGENCY-01 inheritance | JSDOM cannot sample `<dialog>` focus-trap fidelity reliably | Operator elevates to H5 from Inspector, opens per-edge dialogue history modal, verifies IrreversibilityDialog-pattern copy + Escape key returns H5→H1 downgrade |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (enforced by plan-checker)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (listener.ts, storage.ts, aggregator.ts, endpoints, test files)
- [ ] No watch-mode flags (`--run` required on every vitest invocation)
- [ ] Feedback latency <20 seconds (full grid) / <15 seconds (scoped)
- [ ] `nyquist_compliant: true` set in frontmatter by planner once per-task map is populated

**Approval:** pending
