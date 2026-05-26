---
phase: 36-visitor-did-read-write-split
verified: 2026-05-26T00:00:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
---

# Phase 36: Visitor/DID Read-Write Split — Verification Report

**Phase Goal:** Implement visit-without-DID + action-with-DID asymmetry. Unauthenticated visitors can browse public Grid surfaces; every state-mutating route requires a valid Civic-DID. Per-endpoint policy table is the authority; WS firehose redacts private fields for non-DID subscribers without breaking R-31-01 zero-diff.

**Verified:** 2026-05-26  
**Status:** PASS  
**Re-verification:** No — initial verification

---

## SC-1: Unauthenticated visitors can access public routes — PASS

**Verdict:** PASS

**Evidence:**
- `grid/src/api/policy.ts` lists `'GET /api/v1/civic-map/state'`, `'GET /api/v1/audit/trail'`, `'GET /api/v1/library/entries'`, `'GET /api/v1/market/listings'`, `'GET /api/v1/polis/bills'`, and `'GET /api/v1/polis/bills/:id'` all as `'public'`.
- Route handlers exist: `civic-map.ts`, `visitor-audit-trail.ts`, `library-entries.ts`, `market-listings.ts`, `polis-bills.ts`, `nous-public-profile.ts`.
- The global `onRequest` hook in `server.ts` (line 323) only fires `requireDid` for `civic_did_required` (and higher) policies — public routes pass through unchanged.
- The dashboard `dashboard/src/app/portal/civic-map/page.tsx` contains no auth-redirect guard.
- `visitor-public-routes.test.ts` asserts all 5 routes return 200 with no Authorization header.

**Note:** `civic-map.ts` returns a hardcoded 6-zone stub layout (Phase 36 design decision documented at line 9: "Phase 57 (Zoning) wires real zone data model"). Routes are live and accessible — the stub is intentional scaffolding, not a blocker.

---

## SC-2: Unauthenticated POST returns `401 {error: 'did_required'}` — PASS

**Verdict:** PASS

**Evidence:**
- `requireDid.ts` (lines 23–25): `reply.code(401).send({ error: 'did_required', accepted_methods: ['civic_did_bearer', 'portal_session'] })`.
- `ROUTE_DID_POLICY` marks all 5 write routes (`POST /api/v1/trade`, `/governance/propose`, `/governance/commit`, `/governance/reveal`, `/spawn`) as `civic_did_required`.
- `lookupPolicy()` default-deny: any unlisted route resolves to `civic_did_required`.
- `did-required-enforcement.test.ts` asserts each write route returns `statusCode === 401` and `body.error === 'did_required'` with no Authorization header.

---

## SC-3: Two WS clients — same event timing, divergent redaction, chain head unchanged — PASS

**Verdict:** PASS

**Evidence:**
- `firehose-hub.ts` line 285 contains the required comment `"R-31-01 zero-diff: do NOT redact here"`. Full entry fans out to all clients; per-subscriber redaction happens in `ClientConnection.trySend()` (lines 93–96).
- `serializeVisitorFrame()` in `firehose-redaction.ts` emits only `{tick, event_type, family}` — `actor_did` and `payload` absent for non-civic_member tier.
- `serializeFullFrame()` passes through unchanged for `civic_member` tier.
- `firehose-hub-zero-diff.test.ts`: asserts `chain.head` is byte-identical across Scenario A (0 subscribers), B (1 anon), and C (1 civic_member + 1 anon) after the same append.
- `firehose-hub-redaction.test.ts`: asserts civic_member receives full frame with `actor_did`; anonymous receives frame without `actor_did` or `payload`, but with `family`.

---

## SC-4: CI gate `check-did-policy-coverage.mjs` exists and walks every Fastify route — PASS

**Verdict:** PASS

**Evidence:**
- All 4 CI gate scripts confirmed present:
  - `scripts/check-did-policy-coverage.mjs` — walks `grid/src/api/` inline routes; fails if any lacks `ROUTE_DID_POLICY` entry (exit 1).
  - `scripts/check-admin-policy-isolation.mjs` — named OBS-36-02 in CI.
  - `scripts/check-ws-redaction-zero-diff.mjs` — verifies R-31-01 structural invariants.
  - `scripts/check-no-did-exception-count.mjs` — asserts exactly 5 `POST /portal/auth/*` public exceptions.
- `.github/workflows/rig-invariants.yml` wires all 4 gates as named steps (OBS-36-01 through OBS-36-04) under the `rig-invariants` workflow.

---

## SC-5: Sole-producer boundaries for 4 events; allowlist 56 → 60 — PASS

**Verdict:** PASS

**Evidence:**
- All 4 sole-producer files exist and export named functions following the 8-step triad:
  - `grid/src/audit/append-portal-did-issued.ts` → `appendPortalDidIssued`
  - `grid/src/audit/append-portal-did-revoked.ts` → `appendPortalDidRevoked`
  - `grid/src/audit/append-grid-recognition-granted.ts` → `appendGridRecognitionGranted`
  - `grid/src/audit/append-grid-recognition-revoked.ts` → `appendGridRecognitionRevoked`
- `ALLOWLIST_MEMBERS` in `broadcast-allowlist.ts` contains exactly **60 entries** (verified by line-count parsing), with positions 57–60 being the 4 new Phase 36 events.
- `broadcast-allowlist.test.ts` asserts `ALLOWLIST_MEMBERS.length === 60` (two separate assertions at lines 12 and 16).
- `portal.notification_dispatched` is intentionally absent from the broadcast allowlist (D-36-19 — personal-queue event). The 5th producer file `append-portal-notification-dispatched.ts` exists but the event does not enter `ALLOWLIST_MEMBERS`. Decision documented in `36-VALIDATION.md`.

**Note:** The sole-producer functions are not yet called from production code — Phase 37 (DID Registry issuance handler) will wire `appendPortalDidIssued` + `appendGridRecognitionGranted`. This is explicitly deferred per `36-08-SUMMARY.md` lines 46–47 and is within Phase 36's stated scope ("DID issuance flow itself — Phase 37 out of scope").

**Documentation inconsistency (non-blocking):** The locked-allowlist header comment on line 24 of `broadcast-allowlist.ts` still reads "exactly these 53 event types" and does not list Phase 29/30/33/35/36 additions. The actual array is authoritative at 60; the stale comment is cosmetic.

---

## Overall Verdict: PASS

All 5 success criteria met. The phase delivered:

- `ROUTE_DID_POLICY` table (105 entries, default-deny) as the sole policy authority.
- `tryDid` / `requireDid` / `requirePortalSession` preHandlers wired globally via `onRequest` hook.
- 7 visitor public route handlers under `/api/v1/`.
- WS firehose redaction (`serializeVisitorFrame` / `serializeFullFrame`) branching on `DIDContext.tier` — chain-head-hash zero-diff preserved.
- 4 sole-producer audit boundaries + allowlist extended 56 → 60.
- 4 CI gates added to `rig-invariants.yml`.
- 8 dashboard portal pages without auth walls.
- 16 new test files encoding the visitor/DID contract.

Phase 37 (DID Registry) is the designated consumer of the sole-producer boundaries created here.

---

_Verified: 2026-05-26_  
_Verifier: Claude (gsd-verifier)_
