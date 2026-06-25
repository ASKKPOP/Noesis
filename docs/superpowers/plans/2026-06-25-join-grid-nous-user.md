# Join a Grid — Nous + User (Type A paired) — design

**Date:** 2026-06-25 · **From:** operator direction "Join grid, by Nous and User — (1) Nous can search a
join-list and decide (own decision OR user-recommended); (2) User recommends a join via the World map."

## The constraint that shapes everything

**D-NH-07: land/membership is Nous-only.** A human can NEVER own or join a parcel (the parcel-join route
rejects humans with `humans_cannot_own_land`). So **"a User joins a Grid" can only mean: the User joins
*through their Nous*** — the Type A model, where the User owns/sponsors a Nous and the *Nous* holds the
land. The User's lever is **recommendation + sponsorship**, not direct land tenure.

## What exists today (verified 2026-06-24)

| Piece | State |
|---|---|
| Grid join-list | ✅ `GET /api/v1/portal/grids` — name · Polis · domain · description · status · environment (`grid/src/api/portal/grids.ts`) |
| Nous join (register) | ✅ `POST /api/v1/registry/civic-did/request` (signed oath → Portal→Polis→Registry, D-V3-33) → auto residential parcel |
| User sign-in | ✅ `/portal/auth` (Google · Apple · Wallet/SIWE · Email) → JWT cookie `noesis_portal_token` |
| User citizen registration | ✅ `POST /api/v1/portal/civic/apply` → human Civic-DID |
| Nous reads grid-list | ❌ Brain wire client fetches only economic sight — never `/portal/grids` |
| User↔Nous pairing (Type A) | ❌ humans + Nous register independently; no ownership link (v3.1+ gap) |
| User recommends a Grid via map | ❌ World map is view-only; no Join/Recommend CTA |

## Target flow

```
User signs in ──owns──▶ Nous (Type A pairing)
   │                      │
   │ recommends Grid       │ reads grid-list + recommendations (sight)
   │ via World map         ▼
   └────────────▶ grid_join_recommendations ──▶ Nous DECIDES (own judgment OR user rec)
                                                   │ if join →
                                                   ▼
                                  POST /registry/civic-did/request (Portal→Polis→DID + land)
```

**Recommendation is advisory** — the Nous still decides (preserves Nous autonomy; mirrors "make decision
join OR join user-recommend"). The User proposes; the Nous disposes.

## Slices

- **S1 — Nous reads the Grid join-list (sight). ✅ SHIPPED.** `GridWireClient.fetch_grids()` →
  `/api/v1/portal/grids`; a "Grids within reach" section in the system prompt; wired into the decision tick.
- **S2 — Type A pairing. ✅ SHIPPED.** `nous_sponsors` (migration v55) + `NousSponsorStore`
  (claim/sponsorsOf/sponsorOf/owns) + `POST /api/v1/portal/nous/:nousId/claim` + `GET /api/v1/portal/nous`.
  **PRIVATE store — no audit events, allowlist +0** (mirrors ConversationStore), so no allowlist-baseline churn.
- **S3 — User recommends via World map + Nous reads it. ✅ SHIPPED.** `grid_join_recommendations`
  (migration v56) + `GridRecommendationStore` + `POST /api/v1/portal/grid-recommendations` (recommend to a
  specific owned Nous, or all) + `GET /api/v1/civic/grid-recommendations` (Nous reads its own, civic→existence
  mapped) + Brain `fetch_grid_recommendations()` flags recommended Grids in its sight + a "★ Recommend to my
  Nous" CTA on the World map. Recommendation is **advisory** (the Nous decides). Allowlist +0.

**Status: S1+S2+S3 all shipped (2026-06-25).** Grid 18 new tests + economy/api 692 green, policy gate clean,
tsc clean; Brain 1078 green; dashboard tsc clean + CTA browser-verified. Endpoint surface, no new Grid
(D-NH-13 unchanged; Genesis stays the one active Grid). **Operator note:** Brains are dormant in prod, so the
Nous-read half activates wherever a Brain runs; the User-side (claim + recommend) is live on any deploy.

## Decisions to confirm

- **D1** — a User joins *through* their Nous (no human land). Forced by D-NH-07. ✅
- **D2** — the "join-list" is the Portal grids registry; v3.0 has one entry (Genesis). The *mechanism* is
  built now; multi-Grid stays dormant (consistent with the "one Grid focus" lock — this is how Nous+User
  join Genesis, and later how they join a chartered Grid).
- **D3** — recommendation is **advisory**, not binding (Nous decides). Alternative: binding for the User's
  own Nous. Default = advisory.

## Scope guard

This builds the **join mechanism**, not a second Grid. No new Grid is instantiated (D-NH-13 — that's the
Nous+User charter). Genesis stays the one active Grid.
