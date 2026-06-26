# Phase 47 — Police v3 (build plan)

**Goal (ROADMAP):** civic-tier enforcement. Complaint-driven investigation → charges filed with the
Government court → conviction unlocks sanction execution → all sanctions appealable. **Police authority is
bounded by civic law — they cannot freeze a Civic-DID without a court order.** No operator-direct or
Police-direct sanction path exists anywhere in the routing table (D-V3-18).

## The constitutional spine (holds across all plans)
- A complaint and an investigation carry **no punitive power**.
- A sanction requires a **Government conviction** (Nous-only VOTE-05 session) referencing the charges.
- The operator — even at H5 — has **no** sanction path; enforcement runs only through the court.
- Every step emits a tamper-evident event; DIDs are **hashed** on the chain (raw DIDs live only in DB tables).

## Plans

### Plan 1 — Complaint + Investigation (POL-01/02) — ✅ SHIPPED 2026-06-25
- **Migration v57** `police_complaints` (raw DIDs; status `filed→investigating→dismissed|charged`).
  `police_investigations` already exists (Phase 44).
- **`PoliceStore`** — `fileComplaint` (insert + emit `police.complaint_filed`), `openInvestigation`
  (insert + mark complaint investigating + emit `police.investigation_opened`; exactly one of
  complaint/dispute source), `getComplaint`, `listComplaints`.
- **2 sole-producer events** (DIDs hashed HEX64): `police.complaint_filed` (closed 6-key),
  `police.investigation_opened` (closed 4-key). Allowlist **121 → 123**; the 3 baseline gates
  (state-doc-sync → 123, relationship-graph-deps → 891 lines, sole-producer triad) + the allowlist
  test-count assertions re-pinned.
- **Routes** (civic_member): `POST /api/v1/police/complaint`, `POST /api/v1/police/complaint/:id/investigate`,
  `GET /api/v1/police/complaints`.
- **Tests:** store 3 + route 10 + allowlist updates; audit dir 957 green; tsc + all gates clean.

### Plan 2 — Charges + Sanction execution (POL-03/04) — ✅ SHIPPED 2026-06-25
- **Migration v58** `police_charges` + `police_sanctions`. `PoliceStore`:
  `fileCharges` (emit `police.charges_filed`), `resolveCharge` (Government conviction/acquittal — no event),
  `recordSanction` (emit `police.sanction_executed`).
- **Routes:** `POST /api/v1/police/charge` (police), `POST /api/v1/police/charge/:id/convict`
  (**government_only** — the constitutional gate, the only path to punitive power),
  `POST /api/v1/police/charge/:id/execute-sanction` (police, **only against a convicted charge** → 403
  `no_conviction`). Sanction effects wired: freeze (`markFrozen`), fine (credit treasury), warning/exile
  recorded (exile membership-removal is a follow-up).
- **+2 events** `police.charges_filed` (7-key), `police.sanction_executed` (5-key); DIDs hashed. Allowlist
  **123 → 125**; the 3 baseline gates + every allowlist test-count re-pinned (relationship-graph-deps → 901).
- **Tests:** store 5 + route 16 (incl. the 🔒 "no sanction without conviction" gate test); broad regression
  1842 green; tsc + did-policy-coverage + all gates + check-wiki clean.

### Plan 3 — Appeals
- `POST /api/v1/gov/appeal` routes a sanction back to the Government. CI gate asserting there is **no**
  operator/Police-direct sanction path in the routing table (the D-V3-18 invariant, made executable).
