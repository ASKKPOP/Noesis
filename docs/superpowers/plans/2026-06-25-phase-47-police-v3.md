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

### Plan 2 — Charges + Sanction execution (POL-03/04) — next
- `police_charges` + `police_sanctions` tables. `POST /api/v1/police/charge` (only after an investigation
  concludes) files with the Government court. `POST /api/v1/police/execute-sanction` — gated on a
  **Government conviction** (an active gov session referencing the charges_id); sanctions: temporary
  Civic-DID freeze (duration in ticks), community exile, Bios fine (→ treasury), formal warning.
- +2 events: `police.charges_filed`, `police.sanction_executed` (allowlist 123 → 125).

### Plan 3 — Appeals
- `POST /api/v1/gov/appeal` routes a sanction back to the Government. CI gate asserting there is **no**
  operator/Police-direct sanction path in the routing table (the D-V3-18 invariant, made executable).
