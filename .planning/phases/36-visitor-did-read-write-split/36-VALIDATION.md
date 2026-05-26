---
phase: 36
slug: visitor-did-read-write-split
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `36-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^2.0.0` (grid) / `^4.1.0` (dashboard) |
| **Config file** | `grid/vitest.config.ts` + `dashboard/vitest.config.ts` |
| **Quick run command** | `cd grid && npx vitest run test/rig/` |
| **Full suite command** | `cd grid && npx vitest run && cd ../dashboard && npx vitest run` |
| **Estimated runtime** | ~45 seconds (grid rig) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run test/rig/`
- **After every plan wave:** Run `cd grid && npx vitest run && node scripts/check-did-policy-coverage.mjs && node scripts/check-admin-policy-isolation.mjs && node scripts/check-ws-redaction-zero-diff.mjs && node scripts/check-no-did-exception-count.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds (rig) / 120 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-VIS01-A | TBD | TBD | VIS-01 | T-36-VIS01 | Unauthenticated GET to public routes returns 200 with public data | unit | `cd grid && npx vitest run test/api/visitor-public-routes.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS01-B | TBD | TBD | VIS-01 | T-36-VIS01 | Public audit stream strips `actor_did` to family prefix for visitors | unit | `cd grid && npx vitest run test/api/visitor-audit-redaction.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS02-A | TBD | TBD | VIS-02 | T-36-VIS02 | POST to any civic write route without DID returns `401 {error:'did_required'}` | unit | `cd grid && npx vitest run test/api/did-required-enforcement.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS03-A | TBD | TBD | VIS-03 | T-36-VIS03 | WS firehose subscriber without DID receives redacted frames (no `actor_did`, family prefix only) | unit | `cd grid && npx vitest run test/audit/firehose-hub-redaction.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS03-B | TBD | TBD | VIS-03 / R-31-01 | T-36-R3101 | Same event received by DID and non-DID subscriber has identical tick+event_type (zero-diff invariant) | unit | `cd grid && npx vitest run test/audit/firehose-hub-zero-diff.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS04-A | TBD | TBD | VIS-04 | T-36-VIS04 | `ROUTE_DID_POLICY` table covers all registered routes (mirrors CI gate logic) | unit | `cd grid && npx vitest run test/api/policy-coverage.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS04-B | TBD | TBD | VIS-04 | T-36-VIS04 | `check-did-policy-coverage.mjs` exits 0 on clean repo | smoke | `node scripts/check-did-policy-coverage.mjs` | ❌ W0 | ⬜ pending |
| TBD-VIS04-C | TBD | TBD | VIS-04 / D-36-10 | T-36-ADMIN | `check-admin-policy-isolation.mjs` exits 0 on clean repo | smoke | `node scripts/check-admin-policy-isolation.mjs` | ❌ W0 | ⬜ pending |
| TBD-VIS04-D | TBD | TBD | VIS-04 / D-V3-15 | T-36-EXC | `check-no-did-exception-count.mjs` enforces 5 (not 3) no-DID exceptions | smoke | `node scripts/check-no-did-exception-count.mjs` | ❌ W0 | ⬜ pending |
| TBD-VIS04-E | TBD | TBD | VIS-03 / R-31-01 | T-36-R3101 | `check-ws-redaction-zero-diff.mjs` exits 0 on clean repo (regression guard) | smoke | `node scripts/check-ws-redaction-zero-diff.mjs` | ❌ W0 | ⬜ pending |
| TBD-VIS05-A | TBD | TBD | VIS-05 | T-36-VIS05 | `portal.did_issued` sole producer throws TypeError on bad payload; commits correct entry | unit | `cd grid && npx vitest run test/audit/append-portal-did-issued.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS05-B | TBD | TBD | VIS-05 | T-36-VIS05 | `portal.did_revoked` sole producer throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-portal-did-revoked.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS05-C | TBD | TBD | VIS-05 | T-36-VIS05 | `grid.recognition_granted` sole producer throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-grid-recognition-granted.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS05-D | TBD | TBD | VIS-05 | T-36-VIS05 | `grid.recognition_revoked` sole producer throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-grid-recognition-revoked.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VIS05-E | TBD | TBD | VIS-05 | T-36-AL | Allowlist length assertion updated (56 → 60 or 61 per Wave 0 decision) | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts -x` | ✅ exists (update) | ⬜ pending |
| TBD-D3609 | TBD | TBD | D-36-09 | T-36-REVOKE | Revoked Civic-DID context falls through to visitor tier (not hard block) | unit | `cd grid && npx vitest run test/api/did-revoked-behavior.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-VOTE05 | TBD | TBD | D-36-15 / VOTE-05 | T-36-VOTE | `GET /api/v1/polis/bills/:id` does NOT include ballots array (privacy preserved) | unit | `cd grid && npx vitest run test/api/polis-bills-privacy.test.ts -x` | ❌ W0 | ⬜ pending |
| TBD-PORTAL-A | TBD | TBD | VIS-01 (UI) | — | Portal landing page renders verbatim "Noēsis · Polis" title | unit (component) | `cd dashboard && npx vitest run src/app/portal/page.test.tsx -x` | ❌ W0 | ⬜ pending |
| TBD-PORTAL-B | TBD | TBD | VIS-01 (UI) / D-V3-32 | — | Civic Map renders 6 zone polygons in raw SVG | unit (component) | `cd dashboard && npx vitest run src/app/portal/civic-map/CivicMap.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs (`TBD-*`) get rewritten to `36-NN-MM` format during planning when plan numbers are assigned.*

---

## Wave 0 Requirements

All test files marked ❌ above must be created in Wave 0 before implementation tasks begin.

Grid:
- [ ] `grid/test/api/visitor-public-routes.test.ts` — VIS-01 public route 200 assertions
- [ ] `grid/test/api/visitor-audit-redaction.test.ts` — VIS-01 family-prefix redaction
- [ ] `grid/test/api/did-required-enforcement.test.ts` — VIS-02 401 for all write routes
- [ ] `grid/test/api/did-revoked-behavior.test.ts` — D-36-09 revert-to-visitor
- [ ] `grid/test/api/policy-coverage.test.ts` — VIS-04 table completeness
- [ ] `grid/test/api/polis-bills-privacy.test.ts` — VOTE-05 ballot privacy preserved
- [ ] `grid/test/audit/firehose-hub-redaction.test.ts` — VIS-03 serializer redaction
- [ ] `grid/test/audit/firehose-hub-zero-diff.test.ts` — VIS-03 R-31-01 invariant
- [ ] `grid/test/audit/append-portal-did-issued.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-portal-did-revoked.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-grid-recognition-granted.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-grid-recognition-revoked.test.ts` — VIS-05 sole producer
- [ ] Update `grid/test/audit/broadcast-allowlist.test.ts` — change `ALLOWLIST_MEMBERS.length` assertion to 60 or 61 per Wave 0 allowlist-count decision (see Open Questions)

Dashboard:
- [ ] `dashboard/src/app/portal/page.test.tsx` — Portal landing copy assertions
- [ ] `dashboard/src/app/portal/civic-map/CivicMap.test.tsx` — SVG zone render

CI gate scripts (smoke tests are the scripts themselves on the clean repo):
- [ ] `scripts/check-did-policy-coverage.mjs`
- [ ] `scripts/check-admin-policy-isolation.mjs`
- [ ] `scripts/check-ws-redaction-zero-diff.mjs`
- [ ] Update `scripts/check-no-did-exception-count.mjs` (assertion 3 → 5)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visitor lands at `portal.noesis` and can complete the 5-surface tour without login prompt | VIS-01 / D-36-02 | End-to-end browser navigation; covers cookie-less + Portal-session paths across 5 routes | Open fresh browser (no cookies) → visit Portal root → click each: Civic Map · Library · Marketplace · Polis bills · Public Profile (via avatar click). No 401, no login redirect at any step. |
| Civic Map per-Nous avatar hover changes radius (6 → 8 px) | UI-SPEC | UI-SPEC flagged Tailwind 4 limitation — must verify React-state hover works in real browser | Open Civic Map in Chrome → hover over any avatar → radius visibly enlarges → mouseout → reverts. |
| WS firehose visual diff: two parallel browser tabs (one DID, one no-DID) show same event ordering with different actor_did rendering | VIS-03 / R-31-01 | Visual confirmation of zero-diff invariant in production-like conditions | Open two tabs to `/admin/firehose-tail` (DID) and `/portal/firehose-tail` (visitor) → trigger any audit event → both tabs scroll in lock-step at same tick; DID tab shows full `actor_did`, visitor tab shows family prefix only. |
| Google/Apple OAuth stub routes return `501 Not Implemented` cleanly (no crash) | D-36-21 | Stub behavior verification; full OAuth deferred to Phase 52-54 | `curl -X POST https://grid.noesis/portal/auth/oauth/google` → returns `501 {error:'not_implemented'}` (NOT 500, NOT 404). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (Vitest `run` only, never `watch`)
- [ ] Feedback latency < 45 seconds for rig sampling
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Open Questions (resolve in Wave 0)

1. **Allowlist count target:** 60 or 61?
   - Researcher's recommendation: `portal.notification_dispatched` (D-36-19) is a *private queue* event (person-to-person), not a broadcast city event → keep OFF the broadcast allowlist → count = 60.
   - Alternative interpretation: every audit event the chain emits gets broadcast → count = 61.
   - Wave 0 must lock this and update both the allowlist test assertion AND the ROADMAP "Allowlist count grows 56 → 60" line if revised.
