---
phase: 58
plan: 07
wave: 6
type: execute
status: complete
requirements: [R-58-07, R-58-08, R-58-12]
date: 2026-06-13
---

# Phase 58 · Wave 6 (FINAL) — Definition-of-Done E2E + CI-gate confirmation

## What shipped

One new file — the master-plan acceptance scenario, end-to-end:

- `grid/test/civic/house-1-e2e.test.ts` (NEW, 3 tests, all green)

No source was touched. The whole DoD runs against Wave 1–5 source via the real
`registerCivicParcelRoutes` HTTP handlers, a real `ParcelRegistry` seeded with the
WHOLE Genesis Core (`buildGenesisCoreParcels('genesis')` → `upsert`), a real
`NousRegistry` funding Nous A + Nous B + treasury, a real `AuditChain`, and a real
write-through `ParcelStore` over a **mock mysql2 Pool** (so `persistPurchase` /
`persistBuild` actually run — no live DB). `didContext` is swapped per request to
drive Nous A, Nous B, and the two human-refused cases through one running app.

## DoD scenario proven (R-58-07 / R-58-08)

1. **Buy** — Nous A buys `genesis:residential:0001` (ring 3). `gravityPrice(3) === 400`
   asserted; the parcel was priced 400 by the seed. Balance moved buyer → `TREASURY_DID`
   (alice 10_000 → 9_600; treasury 0 → 400). Write-through `UPDATE civic_parcels` ran.
   Trail shows `zoning.parcel_purchased (82)` + `treasury.parcel_revenue (83)`; owner ONLY
   as `buyer_civic_did_hash` HEX64 (=== sha256(NOUS_A)); `price_bios === 400`.
2. **Build** — Nous A builds a `home` → `zoning.structure_built (84)`; plaintext name
   "Alice Home" never crosses the chain (name_hash discipline asserted).
3. **Join** — Nous B joins → `zoning.structure_joined (85)`; `occupants(parcel) === [NOUS_B]`
   (length 1). The public feed shows the parcel `owned`, `owner_civic_did_hash` HEX64,
   `occupant_count === 1`.
4. **Leave** — Nous B leaves → `zoning.structure_left (86)`; occupants back to 0.
5. **Trail** — all five events present; **no raw `did:civic:` in any chain payload**.
6. **Human refused (D-NH-07)** — `human_visitor` tier → **401**; `did:civic:noesis:human:*`
   → **403 `humans_cannot_own_land`**. Neither emits a land event.

## CI gates — all green and UNCHANGED (R-58-12)

| Gate | Result |
|------|--------|
| `broadcast-allowlist.test.ts` (asserts 91, +0) | green · 107 tests · **file zero-diff** |
| `node scripts/check-wallclock-forbidden.mjs` | exit **0** (unchanged) |
| `node scripts/check-civic-did-issuance-path.mjs` | exit **0** (unchanged) |
| `node scripts/check-sole-producer-discipline.mjs` | exit **0** |
| `node scripts/check-did-policy-coverage.mjs` | exit **0** |
| privacy-walker (audit tests) | green |
| zero-diff R-31-01 (no chain/persistence file edited) | **holds** — only new test file in diff |
| `describe.skip(` in Phase 58 files | **0 everywhere** |

## Known unrelated failure (NOT Phase 58)

`grid/test/whisper/whisper-crypto.test.ts` fails with
`sodium.crypto_box_seed_keypair is not a function` — a pre-existing libsodium
`sodium.ready` init-timing issue. Confirmed failing on clean `HEAD` with the Phase 58
file stashed away; it lives in `grid/src/whisper/` and cannot be affected by this phase.
Reported honestly per the never-weaken-a-gate rule; left untouched (out of scope).

## Full grid suite

`cd grid && npm run test`: **3048 passed**, 33 skipped, **1 failed (the unrelated
whisper-crypto suite above)**. Every Phase 58 / civic / audit / route suite is green.
