# Phase 48 — Library v3 (build plan)

**Goal (ROADMAP):** civic-tier evolution of the v2.4 Lore Commons. A **public reading room** (visitor-readable,
no DID); Civic-DID required to contribute (K=3/epoch quota); a rotating **curation council** elected by the
Government every 90 days and paid from the civic treasury.

## Design decisions (locked)
- **Readable content lives grid-side.** v2.4 `lore_commons` stores only hashes (content was Brain-private);
  a public library needs full text, so Library v3 adds `library_entries` (title/body/category) and reads from it.
- **Contribute reuses the v2.4 lore events** (operator-approved 2026-06-26): a Civic-DID contribution upserts
  `lore_commons` and emits the existing `lore.contributed`/`lore.cited` (no new allowlist for contribute/cite).
  To make that possible, the lore `DID_RE` was widened to accept Civic-DIDs (`did:civic:noesis:…`) — a small,
  backward-compatible edit to a frozen contract; the 46 lore tests stay green.

## Plans

### Plan 1 — Reading room + contribute/cite (CIVLIB-01/02) — ✅ SHIPPED 2026-06-26
- **Migration v60** `library_entries` (readable). `LibraryStore`: contribute (store content + upsert
  `lore_commons` + emit `lore.contributed`), cite (bump count + emit `lore.cited`), listEntries (search /
  category / page), getEntry (full content).
- **Routes:** `GET /api/v1/library/entries` (public — replaces the Phase-36 stub), `GET .../entries/:id`
  (public), `POST .../contribute` (civic + K=3 quota via `LoreQuotaTracker`), `POST .../cite` (civic).
- **Allowlist +0** (reuses lore.*). Lore `DID_RE` widened. store 5 + route 8 tests; broad regression 1799
  green; tsc + did-policy-coverage + sole-producer + check-wiki clean.

### Plan 2 — Curation council (CIVLIB-03) — ✅ SHIPPED 2026-06-26
- **Migration v61** `library_curators` + `library_entry_links` + a `pinned` column on `library_entries`.
  `LibraryStore`: electCurator (emit `library.curator_elected`), listCurators, isActiveCurator, curate
  (pin/flag/categorise/link → emit `library.entry_curated`).
- **Routes:** `POST /api/v1/library/curators/elect` (**government_only** — the Government enacts the election),
  `GET /api/v1/library/curators` (public council), `POST /api/v1/library/curate/:id` (an *active curator* only).
- **+2 events** (DIDs hashed) → allowlist **125 → 127**; the 3 baseline gates + every allowlist test-count
  re-pinned. library store 8 + route 14 tests; broad regression 1809 green; all gates clean.

### Plan 3 — Treasury curator pay (CIVLIB-04) — ✅ SHIPPED 2026-06-26
- `POST /api/v1/library/curators/pay` (**government_only**): for each active curator, runs the Phase 45
  `IrsStore.disburse` flow (treasury debit) bracketed by the existing `irs.disbursement_authorized`/`executed`
  events — **+0 new allowlist entries**. `legislation_ref = curator-pay:<curator_did>`; 402 on insufficient
  treasury; auditable via `GET /api/v1/irs/audit/:period`. library route +4 tests; regression 1529 green.

## Phase 48 COMPLETE (3/3) — 2026-06-26
A public reading room over the Lore Commons (visitor-readable), Civic-DID contribution + citation (reusing the
v2.4 lore events), a Government-elected curation council, and treasury-funded curator pay. Allowlist 125 → 127
(curation only); one operator-approved frozen-contract edit (lore `DID_RE` widened for Civic-DIDs).
