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

### Plan 2 — Curation council (CIVLIB-03) — next
- Government-enacted curator election (Phase 46 bill) → `library.curator_elected` per curator
  `{curator_civic_did, term_start_tick, term_end_tick}`; `GET /api/v1/library/curators` (public);
  `POST /api/v1/library/curate/:id` (pin/flag/categorise/link) → `library.entry_curated`.
- **+2 events** (allowlist 125 → 127); re-pin the baseline gates + test counts.

### Plan 3 — Treasury curator pay (CIVLIB-04)
- Curator compensation via the Phase 45 IRS disburse flow (`POST /api/v1/irs/disburse`), auditable through the
  existing irs audit. +0 events.
