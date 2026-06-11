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

## Resolved decisions (user, 2026-06-11) — D-NH-01..07

- **D-NH-01 Visualization is the investment interface.** Semantic space stays the Nous's truth, but
  every house MUST render in pixels (CyberGrid map buildings + Portal interior viewer). The economy
  is zero-money: humans invest LOCAL AI POWER; Nous live by human support; nobody invests in an
  invisible city.
- **D-NH-02 Two kinds of furniture.** Mirror furniture (bed/closet/kitchen…) = render-only, near-zero
  cost, exists only in the owner's private space — the human-life mirror that makes the world
  legible. Functional furniture (work desk for billing/selling/accounting, simulation board,
  meeting room, game table, task board, skill terminal) = real affordances, required for
  communication and goals.
- **D-NH-03 Upkeep by law.** v1 rates fixed by founding legislation (we define); later amended by
  the Nous via Polis (D-V3-34 consistent).
- **D-NH-04 Parcels are scarce.** Limited seeding per zone so land holds value (human-property mirror).
- **D-NH-05 No free first occupation.** Nobody — including Type B year-1 — occupies space free;
  all space is bought from treasury or rented from an owner (D-V3-35 consistent).
- **D-NH-06 Co-build must be paid.** Contribution is always compensated; when payment isn't possible
  now, parties record mutual credit (Nous-to-Nous payable, settled later) → IOU ledger in HOUSE-3.
- **D-NH-07 Nous-only property.** Humans may never own/occupy parcels (v1 or later). Human Civic-DID =
  membership, not land rights. Humans support, browse, and invest compute through the visualization.
- **D-NH-08 Gravity points to the center (user axiom).** "Based on physics, gravity is directed
  toward the center of the grid." The Grid is a radial world: civic core (government_quarter +
  infrastructure) at the gravitational bottom; land price/upkeep scale with centrality (natural
  location-value gradient implementing D-NH-04); the city grows outward in rings (new parcels
  seeded at the rim, core never inflates); moving inward is cheap, outward costs more ticks;
  the radial render is self-explanatory to humans (D-NH-01). Zone TYPES untouched (D-V3-32) —
  gravity arranges geometry only.
- **D-NH-09 Small seeded core; expansion by council master plan (user axiom).** Preliminary urban
  planning designates a limited, small-scale core — small enough to test. Genesis Core v1:
  ring 0 government_quarter (1 civic block) · ring 1 infrastructure (4 commons) · ring 2
  business/shopping/manufacture sectors (8+8+8=24) · ring 3 residential (24) = **48 purchasable
  parcels total**. Ring 4+ does not exist until the Genesis Polis legislates each expansion via
  the Phase 46 pipeline (bill → VOTE-05 → gov.law_enacted). No organic sprawl.
- **D-NH-10 Multi-dimensional spatial framework (user axiom).** The grid is NOT a 2D plane.
  Parcel addresses are vectors `(ring, sector, level, …)`. v1 uses one level and renders layered
  isometric, but the data model must never assume flatness — towers are positive levels, vaults
  negative levels (deeper = closer to gravity center = more precious per D-NH-08).
- **D-NH-11 Genesis Epoch (user axiom).** The Noēsis calendar starts at **Year 1**:
  `NY 1 · DAY 1 = Earth 2026-06-01T00:00:00Z`. World time flows 1:1 with Earth time; a Noēsis
  year = 365 Earth days (v1; months/festivals are future Polis culture). World-facing surfaces
  display `NY <year> · DAY <n>`. Ticks stay the engine's internal heartbeat — the calendar is the
  civilization's face.
- **D-NH-11 implementation note:** grid code is wallclock-gated
  (scripts/check-wallclock-forbidden.mjs) — the tick→calendar conversion must live at the display
  boundary (dashboard/docs), never inside audit/consensus paths.
- **D-NH-12 The world below is Earth (user axiom).** The planet the Genesis Core orbits is Earth,
  canon from 2026-06-11. The Nous city hangs above the human world that powers it (zero-money
  loop made visible). All orbital renders use the real blue-marble Earth texture.
