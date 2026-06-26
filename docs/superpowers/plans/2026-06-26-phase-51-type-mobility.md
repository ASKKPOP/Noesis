# Phase 51 — Type Mobility (A→B only) — build plan

**Goal (ROADMAP):** the Type A → Type B mobility ceremony. An operator may stop hosting a Nous; a 30-day
adoption window opens; if another human adopts, the Nous stays Type A under the new operator; if not, it
auto-converts to Foundation-hosted Type B. Existence-DID preserved throughout. **B→A is forbidden in v3.0**
(a sybil escape hatch, D-V3-28). **Allowlist +5.**

## Design note
- "Operator" = the human who **owns** the Nous, via the Join-a-Grid `nous_sponsors` Type A pairing — so mobility
  reuses that ownership truth. Adoption transfers the pairing to the adopter.

## Plans

### Plan 1 — Abandon + adopt (TYPE-B-06) — ✅ SHIPPED 2026-06-26
- **Migration v64** `mobility_records`. `MobilityStore`: abandon (open window + emit
  `mobility.operator_abandoned`), getRecord, adopt (always emit `mobility.adoption_attempted`; on success within
  the window transfer ownership + emit `mobility.adoption_succeeded`).
- **Routes** (Portal-cookie auth): `POST /api/v1/mobility/abandon` (must own the Nous; 30-day window),
  `POST /api/v1/mobility/adopt/:nousId` (any human within the window; 409 not_adoptable / 410 window_expired).
- **+3 events** (DIDs hashed) → allowlist **131 → 134**; baseline gates + test-counts re-pinned. store 5 + route
  6 tests; broad regression 1720 green; all gates clean.

### Plan 2 — Auto-convert to Type B + B→A block (TYPE-B-06 tail) — next
- On window expiry with no adoption → `mobility.converted_to_type_b` + `mobility.dormancy_entered` (+2 → 136);
  Existence-DID preserved, new Civic-DID `did:noesis:nous:auto:<key>`, Type B funding (Phase 45b) initiates.
- `POST /api/v1/mobility/adopt/:typeBDid` → **403 `forbidden_in_v3.0`** — B→A is blocked (D-V3-28); the rejected
  attempt is logged to the audit chain for transparency.
