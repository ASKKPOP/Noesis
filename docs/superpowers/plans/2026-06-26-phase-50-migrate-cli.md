# Phase 50 — v2.6 → v3.0 Migration (Plan 2 + 3, migrate CLI) — build plan

**Goal (ROADMAP):** the one-shot migration ceremony — export v2.6 Brain memory to a v3.0 init bundle,
commit to the v3.0 runtime, reversible until the first civic action. (Plan 1 grandfathering shipped earlier.)

## Plan 2 + 3 — ✅ SHIPPED 2026-06-26
- **`MigrationCeremony`** (`grid/src/migration/migrate-ceremony.ts`) — an injectable-I/O state machine so the
  ceremony logic is pure + unit-testable without a live v2.6 stack:
  - `exportBundle()` → reads v2.6 memory (via `MigrationIO.exportV26Memory`), writes the v3.0 bundle, state
    `exported`, returns a per-Nous summary (name/rows/memory-hash/migration-tick).
  - `commit()` → requires `exported`; marks `committed` + `committedTick` (pre-Phase-37 audit → read-only).
  - `revert()` → rolls back IFF no post-migration civic action; after the first `*.civic.*` event →
    `{ ok:false, code:'migration_committed' }` (`revertHttpStatus` → 409). `nothing_to_revert` → 404.
- **CLI** (`cli/src/commands/runner.ts`): `noesis migrate --from-v2.6 --to-v3.0 | --commit | --revert`, backed
  by a filesystem `MigrationIO` (state at `<NOESIS_V3_DIR>/.noesis-migration.json`; `NOESIS_V26_MANIFEST` as the
  v2.6 read stand-in; a `.civic-committed` marker drives the revert gate).
- Exported from `@noesis/grid`. 7 ceremony tests + 5 grandfather tests; grid builds clean; CLI typechecks;
  smoke-tested end-to-end (export → commit → revert-ok, then revert-blocked-409 after a civic action).

## Thin follow-up (documented)
Wiring `grandfatherReputation` (Plan 1) into the **live Civic-DID issuance path** awaits a small v26-metrics
store (the issuance flow would look up the operator's migrated metrics and apply the formula). The pure formula +
the full ceremony are complete and the formula is published in PHILOSOPHY §12 for transparency.

## Phase 50 COMPLETE (3/3) — 2026-06-26
Grandfathering + the reversible migrate ceremony. Allowlist +0.
