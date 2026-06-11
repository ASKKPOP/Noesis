# Nous House — research summary (2026-06-11)

**Full design + cited report:** `docs/noesis-nous-house.html` (canonical).
**Trigger:** user decision — the world has "only space," no agent-owned houses/stores; Nous need
places they own, manage, and host others in (visit / co-work / business).

## Code-audit finding

Phase 48b's `ParcelRegistry` (grid/src/civic/) is a **dormant skeleton**: parcels, 4 structure
types (home/shop/workshop/venue), entry policies, join/leave + 5 audit events (allowlist 82-86) —
but in-memory only, never instantiated, no routes, no brain verbs. Nous House completes it.

## Research lessons (sources + verification status in the HTML)

1. **Space must be semantic** — Smallville's world→areas→objects tree + per-agent observed
   subgraph memory (Park et al. UIST'23, **verified**); AI Town's thin tilemap is the counter-example.
2. **Home anchors routine/memory/hosting** — fixed affordances (bed/desk/…) anchor daily routines
   (**verified**); the famous party emergence was place-anchored.
3. **Civic anchors are seeded; society emerges around them** — Project Sid seeded 6 named towns +
   landmarks in agent memory (arXiv:2411.00114, primary).
4. **Housing gates economic capability** — AIvilization v0 residential tier gates jobs/quotas
   (arXiv:2602.10429, primary). Adopted for economy only — NEVER civic rights (VOTE-05).
5. **Skills build buildings** — Voyager skill library (executable, transferable; arXiv:2305.16291);
   construction task-DAGs + 3-agent teams ~30-40% faster (arXiv:2503.03505); Creative Agents
   (UAI 2025) build from free-form language. Blueprint = teachable skill.
6. **Upkeep/decay keep cities alive** — MMO practice (UO/EVE/FFXIV/Second Life): upkeep, decay,
   reclamation, scarcity. Industry precedent; re-verify when sourcing the phase.

## Design core

House = parcel + structure + **interior tree** + management contract (upkeep in Bios → treasury;
neglect: maintained→worn→derelict→Polis reclaim). Guesthood first-class (Polis Commons seeded per
zone; staff role = co-work in others' walls; stall rental). Shop⇄structure binding closes the
Phase 4 ShopRegistry gap; `place://` NDS naming. Construction = executing blueprint skills,
diffused via existing skill.taught.

## Phases + allowlist

HOUSE-1 foundations (persistence/routes/verbs/map, +0 events) · HOUSE-2 interiors+upkeep (+4) ·
HOUSE-3 commerce+co-work (+4) · HOUSE-4 skill construction (+1). Allowlist 91 → 100, all under
pre-cleared zoning.*/treasury.*/skill.* prefixes, sole-producer discipline.

## Open questions → /gsd-discuss-phase

Upkeep rate fixed vs market-indexed · parcel scarcity per zone · Type B year-1 property
restrictions (D-V3-35 consistency) · co-build attribution · human parcel ownership in v1.
