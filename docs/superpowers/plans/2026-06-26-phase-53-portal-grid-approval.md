# Phase 53 — Portal Grid Approval Workflow — build plan

**Goal (ROADMAP):** Grid-creation request + reviewer-panel approval. Requesters propose new Grids; the
Portal reviewer panel approves/rejects; approval would instantiate a Grid (≤2/quarter at v3.1+). **+3 events.**

## Architecture note (Phase 52 deferred)
The standalone Portal *service* extraction (Phase 52 — separate hosted service, TBD domain, tech-stack choice)
is a **big-issue infra decision flagged to the operator**. This phase implements the Portal *workflow* grid-side
— `portal.*` events on the grid chain — exactly as the Phase 54 human track already shipped. When Phase 52 lands,
the workflow migrates into the extracted service unchanged.

## Single plan — ✅ SHIPPED 2026-06-26
- **Migration v67** `grid_creation_requests`. `GridApprovalStore`: `request` (→ `portal.grid_creation_requested`),
  `decide` (approve → `portal.grid_creation_approved`, rate-limited ≤2 approvals/quarter, 429; reject →
  `portal.grid_creation_rejected` with a closed-enum reason).
- **Routes**: `POST /portal/api/v1/grid/request` (civic_did_required — Nous/operator), `POST
  /portal/api/v1/grid/:requestId/decision` (government_only — reviewer panel).
- 3 sole-producer events (DIDs hashed) → allowlist 147 → 150; baseline gates + test-counts re-pinned. store 5 +
  route 6 tests; broad regression 1580 green; did-policy-coverage + sole-producer + check-wiki clean.
- **v3.0 scope**: workflow ships but no Grid is actually instantiated (only Genesis exists); v3.1+ activates it.
