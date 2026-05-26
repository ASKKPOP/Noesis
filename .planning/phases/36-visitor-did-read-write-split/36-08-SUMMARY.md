---
phase: 36
plan: "08"
subsystem: docs-sync
status: complete
tags: [docs-sync, milestone-log, phase-shipped]
---

# Plan 36-08: Documentation Sync — COMPLETE

## What shipped

6 source-of-truth documents updated atomically to reflect Phase 36 shipped state.

## Documents updated

| File | Change |
|------|--------|
| `.planning/STATE.md` | `status: phase_36_shipped_ready_to_plan_phase_37`; `completed_phases: 1`, `completed_plans: 8`, `percent: 4`; "Current Position" updated; Phase 36 close-out section added; allowlist Phase 36 line annotated SHIPPED |
| `.planning/ROADMAP.md` | Phase 36 wave-list `[ ]` → `[x]` + `SHIPPED 2026-05-26`; Plans section replaced with `8 plans` + all 8 `[x]` checkboxes filled in |
| `.planning/MILESTONES.md` | Phase 36 entry added (plans, REQs, allowlist delta, CI gates, key artifacts, decisions, carry-forward); v3.0 header updated to 1/24 phases complete |
| `.planning/PROJECT.md` | "Validated REQs (v3.0 — Phase 36)" block added: VIS-01..05 all `✓` |
| `.planning/REQUIREMENTS.md` | VIS-01..05 checkboxes `[ ]` → `[x]`; traceability table `Pending` → `Validated` for all 5 |
| `README.md` | Phase 36 SHIPPED paragraph added before v3.0 milestone block |

## Phase 36 official marker

**Phase 36 SHIPPED 2026-05-26**

- 8 plans: 36-01 through 36-08
- 5 requirements validated: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
- Allowlist: 56 → 60 (+4 events)
- CI gates added: 4
- 0 pre-existing invariants broken (R-31-01, VOTE-05, PORTAL_AUTH_FORBIDDEN_KEYS all preserved)

## Carry-forward surfaced in STATE.md close-out

1. `ROUTE_DID_POLICY` table extant (105 entries) — Phase 37 routes must add entries
2. `tryDid`/`requireDid` preHandlers wired globally — Phase 37 DID enforcement inherits
3. `WsFirehoseHub.onConnect` accepts `didContext` — Phase 37+ Civic-DID holders get full payload
4. 4 CI gates running in `rig-invariants.yml` — forward-only enforcement from here
5. Visitor surfaces in `dashboard/src/app/portal/` — 8 pages ready for real data from Phase 37+

## Phase 37 next

Ready to plan Phase 37: DID Registry (Civic-DID + Business-DID + Issuer/Revocation).
The issuance handler MUST call `appendPortalDidIssued` + `appendGridRecognitionGranted` (Phase 36 sole producers).
