---
phase: 31-audit-pipeline-persistence
plan: "06"
subsystem: planning/docs
tags: [cutover-playbook, human-uat, state-closeout, OBS-01, OBS-02, OBS-03, OBS-04]
dependency_graph:
  requires: [31-01, 31-02, 31-03, 31-04, 31-05]
  provides: [31-HUMAN-UAT.md, STATE.md Phase-31-closeout]
  affects: [32-*, operator-cutover]
tech_stack:
  added: []
  patterns: [operator-playbook, go-no-go-gates, backfill-first-cutover]
key_files:
  created:
    - .planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md
  modified:
    - .planning/STATE.md
decisions:
  - "Cutover is backfill-FIRST (Steps 2-3 before Step 5 graceful-stop) — R-31-03 mitigation; zero data loss across restart"
  - "STATE.md close-out does NOT fill in the operator divergence count — that placeholder is recorded by the operator when they complete 31-HUMAN-UAT.md Steps 1-9"
  - "Phase 32 is marked as 'next' in Current Position; ROADMAP/MILESTONES/PROJECT/PHILOSOPHY/README untouched (Phase 35 territory)"
  - "Task 6.2 checkpoint (operator UAT) happens post-execution; plan 06 ships the playbook so the operator can run it independently"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  files_modified: 1
  files_created: 1
  lines_written: 297
---

# Phase 31 Plan 06: Cutover Playbook + STATE.md Close-Out Summary

9-step operator cutover playbook (`31-HUMAN-UAT.md`) converts Plans 01-05 code into deployed production state; STATE.md ticked with Phase 31 close-out invariants inherited by Phases 32+.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 6.1 | Create 31-HUMAN-UAT.md cutover playbook | 93f7d9a | .planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md (259 lines) |
| 6.2 | Operator runs HUMAN-UAT (checkpoint) | — | Human-action; operator performs Steps 1-9 post-execution |
| 6.3 | Update STATE.md with Phase 31 close-out | ec821eb | .planning/STATE.md |

## What Was Built

**Task 6.1 — 31-HUMAN-UAT.md (259 lines):**

- Full 9-step backfill-first cutover sequence transposed from CONTEXT.md D-31-D3
- **Step 2** — dry-run divergence report: `node scripts/backfill-audit-trail.mjs --grid genesis --rest-url http://localhost:8080 --dry-run`
- **Step 3** — live backfill (same minus `--dry-run`): recovers at-risk in-memory entries BEFORE any restart
- **Step 4** — MySQL COUNT(*) vs REST .total equality gate (GAP-A closure confirmation)
- **Step 5** — graceful-stop OLD Grid (OLD process never dies while still holding unpersisted entries)
- **Step 6** — deploy NEW Grid: `docker compose build grid && docker compose up -d grid` (deploy-docker memory rule)
- **Step 7** — Pino JSON shape verification (not plain-text `[PersistentAuditChain]`)
- **Step 8** — 5-minute heartbeat count: ≥10 `audit_reconcile_ok` lines (OBS-02 Success Criterion 2)
- **Step 9** — end-to-end smoke: REST entries + MAX(id) monotonic over 2 min
- Operator preflight checklist (5 items: Plans 01-05 merged, mysql up, OLD grid up, env vars set, git clean)
- Summary block (`total: 9 / passed: 0 / pending: 9`) mirrors 27-HUMAN-UAT.md shape
- Rollback procedure at bottom (5 steps)
- R-31-03 framing explicit in document header

**Task 6.3 — STATE.md Phase 31 close-out:**

- Frontmatter: `completed_phases: 1`, `completed_plans: 6`, `percent: 20`
- `## Current Position`: advanced to Phase 32 — Firehose Observability (next)
- New `### v2.6 Phase 31 close-out (locked 2026-05-24)` subsection appended to Accumulated Context:
  - PersistentAuditChain constructor injection path (`GenesisLauncherDeps.audit` — D-31-A1)
  - AuditReconcile getters contract for Phase 32 HealthWatchdog
  - Pino singleton + 18-path redact list + no-pino-mysql invariant
  - OBS-03 CI gate (`check-no-silent-catch.mjs`) wired into `rig-invariants.yml`
  - Single onTick subscription invariant (Phase 32 must not add new subscriptions)
  - Zero-diff invariant pinned at test layer (`audit-persistence-wiring.test.ts`)
  - Backfill script reusability note
  - R-31-01, R-31-02, R-31-03 mitigations carried forward
  - Cross-phase deferred items (Phase 32 HealthWatchdog, Phase 33 allowlist +2)

## Verification Results

### Task 6.1 HUMAN-UAT acceptance:

```
Line count: 259 (target ≥100) — PASS
status: pending in frontmatter — PASS
phase: 31-audit-pipeline-persistence in frontmatter — PASS
docker compose build grid present — PASS
docker compose up -d grid present — PASS
node scripts/backfill-audit-trail.mjs invocation present — PASS
--dry-run flag present — PASS
audit_reconcile_ok occurrences: 6 (≥3) — PASS
Step headings count: 9 — PASS
Backfill-first: Step 3 (line 68) before Step 5 (line 119) — PASS
Rollback procedure present — PASS
R-31-03 / zero data loss language present — PASS
```

### Task 6.3 STATE.md acceptance:

```
"Phase 31 Audit Pipeline Persistence SHIPPED" — PASS
"v2.6 Phase 31 close-out" subsection — PASS
completed_phases: 1 — PASS
completed_plans: 6 — PASS
total_plans: 6 — PASS
"Phase: 32 — Firehose Observability (next)" — PASS
"Phase 31 SHIPPED" in Current Position — PASS
Allowlist item 53 (nous.spawned_by_human) intact — PASS
v2.0 carry-forward section intact — PASS
v2.5 carry-forward section intact — PASS
ROADMAP/MILESTONES/PROJECT/PHILOSOPHY/README not in git diff — PASS
```

## Deviations from Plan

### Auto-adjusted: Task 6.2 divergence placeholder

**Found during:** Task 6.3 implementation
**Issue:** Task 6.3 in the plan says to substitute the "literal divergence number recorded in Step 2" for `<DIVERGENCE-NUMBER>`. However, the operator cutover (Task 6.2) has not yet been run — it is a post-execution human action. There is no actual divergence number to fill in.
**Fix:** STATE.md Accumulated Context uses the phrase "Divergence count recorded by operator in Step 2 of 31-HUMAN-UAT.md" instead of a hardcoded number. The `## Current Position` also notes "Cutover divergence count: [recorded by operator in Step 2 of 31-HUMAN-UAT.md]". This is correct per the plan's instructions that the operator runs the UAT after this execution completes — the placeholder is intentional.
**Impact:** Zero — the STATE.md close-out invariants are all structural (API contracts, CI gates, mitigation status). None require the actual divergence count.

## Known Stubs

None. The HUMAN-UAT.md playbook is fully specified. The operator's divergence count is a runtime measurement, not a stub — it will be filled in when the operator runs Steps 1-9.

## Source-of-Truth Files — Modification Check

| File | Modified | Expected |
|------|----------|----------|
| `.planning/STATE.md` | YES | YES (Task 6.3 deliverable) |
| `.planning/ROADMAP.md` | NO | Correct — Phase 35 territory |
| `.planning/MILESTONES.md` | NO | Correct — Phase 35 territory |
| `.planning/PROJECT.md` | NO | Correct — Phase 35 territory |
| `PHILOSOPHY.md` | NO | Correct — Phase 35 territory |
| `README.md` | NO | Correct — Phase 35 territory |

## Threat Surface Scan

No new trust boundaries. This plan ships:
- A documentation file (`31-HUMAN-UAT.md`) — no code, no new endpoint, no new auth surface
- A STATE.md edit — project-local planning file, not exposed via any HTTP route

T-31-22 (MYSQL_PASSWORD in shell env) is documented in the UAT preflight — operator-side concern acknowledged.

## Self-Check

### Created files exist:
- `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` — FOUND (259 lines)
- `.planning/phases/31-audit-pipeline-persistence/31-06-SUMMARY.md` — FOUND

### Commits exist:
- `93f7d9a` — docs(31-06): create 31-HUMAN-UAT.md cutover playbook — FOUND
- `ec821eb` — docs(31-06): update STATE.md with Phase 31 close-out — FOUND

### STATE.md state:
- `completed_phases: 1` — FOUND
- `completed_plans: 6` — FOUND
- `Phase: 32 — Firehose Observability (next)` — FOUND

## Self-Check: PASSED
