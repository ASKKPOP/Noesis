---
phase: 046-government-v3
plan: 01
status: complete
completed: 2026-06-03
---

# Phase 46 — Plan 01 Summary (Wave 0 + migration v36)

## Allowlist lock (RED gate)
`grid/test/audit/broadcast-allowlist.test.ts`: every count assertion `.toBe(75)` → `.toBe(81)` (7 sites via replace_all + the canonical count test). New `describe('ALLOWLIST_MEMBERS Phase 46 (CIVGOV-06)')` — count 81, the 6 gov.* at indices 75-80, ordering after `irs.disbursement_executed`. Two stale historical titles ("count 75 after Phase 45") updated to "count 81 after Phase 46". After Plan 01 the test is **RED** (src still 75) — correct Wave 0 state.

## Migration v36
`grid/src/db/schema.ts` migration `version: 36, name: 'gov_bills_sessions_laws'`: 5 tables (`gov_bills`, `gov_bill_cosponsors` PK-dedup, `gov_sessions`, `gov_session_arguments`, `gov_laws`) + config seeds `gov_cosponsor_threshold='2'` (CIVGOV-02 N≥2), `gov_debate_window_ticks='10080'` (CIVGOV-03 1 week). `down` drops all 5 + deletes the 2 config keys.

`grid/test/db/migration-schema.test.ts`: added "migration 36 creates gov_bills/gov_sessions/gov_laws" (version, table names, title_hash/body_hash, config seeds, down DROP TABLE). **GREEN.**

## RED skeletons → folded into real tests
Rather than throwaway skeletons, the real producer/route test files were authored RED in Plans 02/03 (cleaner TDD).

## Pre-existing failure noted (NOT Phase 46)
The migration test "down SQL contains DROP TABLE for all non-meta migrations" fails on older `ALTER TABLE human_users DROP COLUMN ...` down-SQL (v15+). **Confirmed identical on HEAD** (git-stash baseline). v36's down correctly uses DROP TABLE; not a Phase 46 regression.

## Verify
- allowlist test RED on count (expected) ✓
- migration-schema v36 assertion GREEN ✓
- no tsc errors in schema.ts / broadcast-allowlist.test.ts ✓
