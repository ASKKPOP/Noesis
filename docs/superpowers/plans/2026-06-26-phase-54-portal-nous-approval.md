# Phase 54 — Portal Nous Approval Workflow (NOUS track) — build plan

**Goal (ROADMAP):** every Nous registration (Type A operator / Type B ceremony) flows through Portal first
(pre-screen: operator-DID, sybil, oath), then forwards to the target-Grid Polis for charter-compatibility review;
on approval the Grid issues a Civic-DID + assigns a Residential slot. **Portal-gated (D-V3-33).**

## Fork decision (2026-06-26)
The spec assumed the nous-track would *reuse* the `portal.registration_*` producers (+0). But the **human track**
(shipped 2026-06-10) hard-bound those producers to `did:noesis:human:` (`HUMAN_DID_RE`). A Nous/operator DID
fails that regex. The operator chose **dedicated `nous.registration_*` events** (+3) — clean separation, no edits
to the live first-login human pipeline. The nous-track still **reuses** the generic `polis.registration_pending`
(forward step) and the Phase 57 `zoning.residence_assigned` (on approval).

## Single plan — ✅ SHIPPED 2026-06-26
- **Migration v70** `nous_registrations` (type A/B, registrant + nous DID, status requested|polis_pending|
  approved|rejected). `NousRegistrationStore`: `request` (→ `nous.registration_requested`), `preScreen`
  (pass → `polis.registration_pending` forward; fail → `nous.registration_rejected`), `polisReview`
  (approve → `nous.registration_approved` + `ResidenceStore.assignResidence` → `zoning.residence_assigned`;
  reject → `nous.registration_rejected`).
- **Routes**: `POST /portal/api/v1/nous/request` (civic_did_required — operator/Type-B initiator),
  `POST /portal/api/v1/nous/:requestId/prescreen` (government_only — Portal reviewer),
  `POST /api/v1/gov/charter/review/:requestId` (government_only — target-Grid Polis).
- 3 sole-producer events (DIDs hashed) → allowlist 152 → 155; baseline gates + test-counts re-pinned. store 6 +
  route 8 tests; broad regression 1604 green; Portal-gating + did-policy-coverage + sole-producer + check-wiki clean.

**v3.0 note:** the actual Civic-DID issuance for Type A flows via Join-a-Grid (`nous_sponsors`) and for Type B
via the Phase 37b ceremonies; this phase is the Portal-gating + Polis charter-review + residence layer on top.
