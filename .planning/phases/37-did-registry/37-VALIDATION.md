---
phase: 37
slug: did-registry
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
updated: 2026-05-26
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `grid/vitest.config.ts` |
| **Quick run command** | `cd grid && npx vitest run --reporter=verbose test/civic-registry test/audit test/api/registry-routes.test.ts test/api/registry-lookup.test.ts test/api/registry-business.test.ts test/api/registry-revocation.test.ts test/scripts/check-civic-did-issuance-path.test.ts` |
| **Full suite command** | `cd grid && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Plan & Wave Layout

Phase 37 ships in **4 plans across 3 waves** (see 37-01/02/03/04-PLAN.md).

| Wave | Plans | Concern | Autonomous |
|------|-------|---------|------------|
| 1 | 37-01, 37-02 | Civic-registry service primitives + sole-producer audit producers + allowlist 60 → 64 | yes |
| 2 | 37-03 | Fastify routes + onRequest hook government_only branch + tryDid ANY_DID_RE expansion | yes |
| 3 | 37-04 | Constitutional CI gate `check-civic-did-issuance-path.mjs` + workflow wiring + gate test | yes |

Plans 37-01 and 37-02 have no file overlap, so they run in parallel within Wave 1. Plan 37-03 depends on both via store/producer imports. Plan 37-04 depends on 37-02 (producer files must exist for the gate to scan them) and 37-03 (registry.ts must be the legitimate importer).

**Wave 0 inline:** Each plan is TDD-flagged (`type: tdd`-style discipline via `tdd="true"` on every code-producing task). The Wave 0 test scaffolds are created inline within each plan's first TDD task, not as a separate plan. This is why `wave_0_complete: true` in frontmatter — there is no separate Wave 0 file deliverable.

---

## Sampling Rate

- **After every task commit:** Run the focused subset for the active plan (e.g. `cd grid && npx vitest run test/civic-registry/` for Plan 37-01)
- **After every plan wave:** Run `cd grid && npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green + all 6 CI gates exit 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Task IDs are `{phase}-{plan}-{task}`. Test files are created inline by the same TDD task that writes the production code (RED → GREEN cycle within the task).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists (post-task) | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------------------------|--------|
| 37-01-1 | 01 | 1 | REG-01..04 | — | MySQL migrations v23+v24 idempotent + reversible | unit | `cd grid && npx tsc --noEmit src/db/schema.ts` | ✅ | ⬜ pending |
| 37-01-2 | 01 | 1 | REG-02 | T-37-02 | W3C VC v2.0 shape (validFrom, not issuanceDate) + JWS proof | unit | `cd grid && npx vitest run test/civic-registry/vc-builder.test.ts test/civic-registry/government-session.test.ts` | ✅ | ⬜ pending |
| 37-01-2 | 01 | 1 | REG-04 | T-37-01 | Government session JWT rejects operator-DID iss | unit | same command (government-session.test.ts) | ✅ | ⬜ pending |
| 37-01-3 | 01 | 1 | REG-01..03 | T-37-03, T-37-04 | CivicDidStore + BusinessDidStore round-trip + idempotent markRevoked/markDissolved | unit | `cd grid && npx vitest run test/civic-registry/civic-did-store.test.ts test/civic-registry/business-did-store.test.ts` | ✅ | ⬜ pending |
| 37-02-1 | 02 | 1 | REG-06 | T-37-07, T-37-08, T-37-09 | 4 sole-producer files with 8-step triad discipline; HEX64 for court_conviction_ref; closed-tuple excludes business_name/category | unit + CI | `node scripts/check-sole-producer-discipline.mjs` | ✅ | ⬜ pending |
| 37-02-2 | 02 | 1 | REG-06 | — | Allowlist count exactly 64 (was 60, +4 in documented order at positions 61-64) | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` | ✅ | ⬜ pending |
| 37-02-3 | 02 | 1 | REG-06 | T-37-07 | Every guard branch + happy path of all 4 producers covered | unit | `cd grid && npx vitest run test/audit/append-registry-civic-did-issued.test.ts test/audit/append-registry-civic-did-revoked.test.ts test/audit/append-registry-business-did-registered.test.ts test/audit/append-registry-business-did-dissolved.test.ts` | ✅ | ⬜ pending |
| 37-03-1 | 03 | 2 | REG-04 (policy), REG-02 (tryDid) | T-37-12, Pitfall 1, Pitfall 3, Pitfall 6 | ROUTE_DID_POLICY +6 entries (5 endpoints + dissolution); onRequest government_only branch with tier='government'; tryDid ANY_DID_RE accepts civic+biz DIDs | unit + CI | `cd grid && npx vitest run test/api/did-required-enforcement.test.ts test/api/policy-coverage.test.ts && node scripts/check-did-policy-coverage.mjs` | ✅ | ⬜ pending |
| 37-03-2a | 03 | 2 | REG-01..05 + REG-06 dissolution | T-37-12..T-37-20 | 6 endpoints registered (request, civic-GET, civic-revoke, business-register, business-GET, business-dissolve); registry.ts wires stores + audit producers; transferOusia Bios gate | unit | `cd grid && npx vitest run test/api/registry-routes.test.ts test/api/registry-lookup.test.ts test/api/registry-business.test.ts` | ✅ | ⬜ pending |
| 37-03-2b | 03 | 2 | REG-04 (security), REG-06 (dissolution security) | T-37-12, T-37-17 | Revoke rejects operator-DID + civic-DID-bearer + missing court_conviction_ref; audit payload uses HEX64 hash not plaintext; dissolution route government_only enforced | unit | `cd grid && npx vitest run test/api/registry-revocation.test.ts test/api/registry-dissolution.test.ts` | ✅ | ⬜ pending |
| 37-04-1 | 04 | 3 | REG-06, D-V3-33 | T-37-21 | CI gate `check-civic-did-issuance-path.mjs` exists, exits 0 on clean repo, exits 1 with violators; workflow step OBS-37-01 wired into rig-invariants.yml | CI gate | `node scripts/check-civic-did-issuance-path.mjs && grep -c "OBS-37-01" .github/workflows/rig-invariants.yml` | ✅ | ⬜ pending |
| 37-04-2 | 04 | 3 | REG-06, D-V3-33 | T-37-21 | Vitest test spawns the gate, asserts pass+fail behaviors + test-file exemption | unit | `cd grid && npx vitest run test/scripts/check-civic-did-issuance-path.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note on Plan 37-03 Task 2 split:** Following the reviewer's warning on task scope, the integration plan splits Task 2 into 2a (route implementation + server wiring) and 2b (security/privacy API tests). This keeps the security regression assertions reviewable independently from the route plumbing.

---

## Wave 0 Inline Test Scaffolds

Wave 0 is satisfied inline by the TDD-flagged tasks themselves. Every code-producing task creates its companion `*.test.ts` file in the same task block via the RED → GREEN cycle. The following test files are created by Phase 37 execution:

**Plan 37-01 (Wave 1):**
- `grid/test/civic-registry/vc-builder.test.ts` — REG-02 W3C VC shape
- `grid/test/civic-registry/government-session.test.ts` — REG-04 court-order gate
- `grid/test/civic-registry/civic-did-store.test.ts` — REG-01 persistence round-trip
- `grid/test/civic-registry/business-did-store.test.ts` — REG-03 persistence + dissolution

**Plan 37-02 (Wave 1):**
- `grid/test/audit/append-registry-civic-did-issued.test.ts` — REG-06 sole producer
- `grid/test/audit/append-registry-civic-did-revoked.test.ts` — REG-06 sole producer (HEX64)
- `grid/test/audit/append-registry-business-did-registered.test.ts` — REG-06 sole producer
- `grid/test/audit/append-registry-business-did-dissolved.test.ts` — REG-06 sole producer
- Updates `grid/test/audit/broadcast-allowlist.test.ts` — count 60 → 64

**Plan 37-03 (Wave 2):**
- `grid/test/api/registry-routes.test.ts` — REG-01 request
- `grid/test/api/registry-lookup.test.ts` — REG-02 + REG-05 Cache-Control
- `grid/test/api/registry-business.test.ts` — REG-03 Bios gate
- `grid/test/api/registry-revocation.test.ts` — REG-04 court-order gate (security critical)
- `grid/test/api/registry-dissolution.test.ts` — REG-06 dissolution endpoint (government_only)

**Plan 37-04 (Wave 3):**
- `grid/test/scripts/check-civic-did-issuance-path.test.ts` — D-V3-33 CI gate test
- New CI script: `scripts/check-civic-did-issuance-path.mjs`

There is no separate Plan 00 or Wave 0 — the inline TDD discipline absorbs that responsibility, which is why `wave_0_complete: true` in this document's frontmatter.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| W3C VC payload renders in external validator | REG-02 | Requires external tool (W3C Playground or credential.io) | Issue a test Civic-DID, paste payload into https://www.w3.org/2018/credentials/v2 validator, confirm no errors |
| Cache-Control header present on lookup response | REG-05 | Easier to spot-check than automate header inspection | `curl -I http://localhost:3000/api/v1/registry/civic-did/<test-did>` — confirm `cache-control: max-age=60` in output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (each TDD task includes a vitest command or CI script run)
- [x] Sampling continuity: every task has an automated verify within ≤ 30s
- [x] Wave 0 covered inline by TDD task scaffolds (no separate Wave 0 plan needed)
- [x] No watch-mode flags (all commands use `vitest run`, never `vitest --watch`)
- [x] Feedback latency < 30s for any focused subset
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Per-task verification map references existing plan IDs (01, 02, 03, 04) — no orphan plan references

**Approval:** pending (revised 2026-05-26 to match 4-plan structure)
