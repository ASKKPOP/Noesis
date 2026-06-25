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

- **S1 — Nous reads the Grid join-list (sight).** `GridWireClient.fetch_grids()` → `/api/v1/portal/grids`;
  a "Grids within reach" section in the system prompt; wired into the decision tick. The Nous now *knows*
  the Grids it could consider. **Self-contained, Brain-only, no migration. ← built first.**
- **S2 — Type A pairing.** `nous_sponsors` store (`human_did ↔ nous_existence_did`) + a route for a
  signed-in User to claim/own a Nous. Grid-side migration + route + audit (`group.*`/new `pair.*` allowlist
  addition — needs explicit per-phase allowlist entry).
- **S3 — User recommends via World map + Nous acts.** `grid_join_recommendations` store + route
  (`POST /api/v1/portal/grid-recommendations`, Portal-session-gated, scoped to the User's paired Nous) +
  a "Recommend this Grid to my Nous" CTA on the World map (signed-in only) + Brain reads pending
  recommendations into its join decision.

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
