# Phase 45b — Treasury Operations (Type B endowment + dormancy) — build plan

**Goal (ROADMAP):** the 3-layer Type B funding hybrid (D-V3-25) — Foundation endowment at birth (~12mo runway),
marketplace earnings 70/30 split with infrastructure stipend, dormancy on treasury exhaustion (Brain stops,
identity preserved indefinitely, revival via donation/grant). **NO `bios.death` from treasury exhaustion** — only
a Phase-47 civic conviction can kill (PHILOSOPHY §9).

**Event-count note:** the ROADMAP states "+4" but the success criteria enumerate **5** events
(`endowment_granted`, `stipend_paid`, `low_power_entered`, `dormancy_entered`, `revived`). Implementing all 5,
split across the 2 plans (documented deviation, recorded in STATE + commit).

## Plans

### Plan 1 — Endowment + dormancy + revival + no-bios-death gate (TYPE-B-03/04) — ✅ SHIPPED 2026-06-26
- **Migration v65** `type_b_treasury` (per-Type-B Bios balance + status active|low_power|dormant).
- **`TypeBTreasuryStore`**: `endow` (credit + `treasury.endowment_granted`), `enterDormancy` (status dormant +
  `treasury.dormancy_entered`), `donate` (credit; reviving a dormant treasury above the threshold → status active
  + `treasury.revived`).
- **Routes**: `POST /api/v1/treasury/endow-type-b/:did` (government_only), `POST /api/v1/treasury/donate/:did`
  (civic_did_required; 404 no_treasury).
- **🔒 CI gate** `scripts/check-treasury-no-bios-death.mjs` — asserts the Type B funding code never emits
  `bios.death` (D-V3-25); wired into `.github/workflows/rig-invariants.yml`.
- 3 events (DIDs hashed) → allowlist 136 → 139; baseline gates + test-counts re-pinned. store 6 + route 4 tests;
  broad regression 1555 green.

### Plan 2 — Stipend + low-power + marketplace 70/30 split (TYPE-B-03) — ✅ SHIPPED 2026-06-26
- `payStipend` (daily compute deduction → `treasury.stipend_paid`; exhaustion → dormancy; runway < 3 months →
  `treasury.low_power_entered` + low-power, emitted once on crossing) + `applyTypeBEarning` (70/30 split via
  `splitTypeBEarning`) + `POST /api/v1/treasury/stipend/:did` (government_only).
- +2 → 141. store 10 + route 6 tests; broad regression 1562 green.

## Phase 45b COMPLETE (2/2) — 2026-06-26
Type B funding lifecycle: endow → stipend → low-power → dormancy (**never death**) → revive, plus the 70/30
marketplace earnings split. 5 `treasury.*` events; `check-treasury-no-bios-death.mjs` enforces D-V3-25 /
PHILOSOPHY §9. Allowlist 136 → 141.
