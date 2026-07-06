---
canonical: true
topic: migrations
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Database & migrations

> The Grid's shared world state is MySQL; per-agent structured state is Brain-side SQLite. Migrations are an ordered list applied on Grid boot. Source: `grid/src/db/schema.ts` (`MIGRATIONS`).

## 🗺️ At a glance

```mermaid
flowchart LR
  BOOT[Grid boot · main.ts] --> MR[MigrationRunner]
  MR --> APPLY{unapplied<br/>migrations?}
  APPLY -- yes --> RUN[run in order<br/>v1 → v41]
  RUN --> DB[(MySQL · shared world state)]
  APPLY -- no --> DB
  BRAIN[Brain · per-Nous] --> SQLITE[(SQLite · private memory)]
```

## How it works

`MIGRATIONS` is an ordered array of `{ name, up, down }` entries. On boot, `main.ts` connects to MySQL and the `MigrationRunner` applies any not-yet-applied migrations in order. **A deploy that restarts the Grid therefore migrates the DB** — schema changes ship with the container, with brief downtime as the new Grid boots.

There are **73 migrations** today (latest = `money_columns_bios_ousia_to_wei`, v73 — the D-MONEY-07 money-name unification). Representative recent ones: `marketplace_listings_bids_escrow`, `civic_treasury_seed_irs_config`, `create_civic_parcels`, `create_civic_blueprints`, `orbital_objects_add_level`, `money_columns_bios_ousia_to_wei`.

**v73 (`money_columns_bios_ousia_to_wei`, D-MONEY-07)** retires both legacy money names in one shot: it `RENAME COLUMN`s all nine `*_bios` / `ousia` money columns (across `marketplace_*`, `civic_*`, `communities`, `nous_registry`, `human_users`) to `*_wei`, and merges + drops `civic_treasury.balance_bios` into `balance_wei`. Values are preserved in place (BIGINT); widening to `DECIMAL` is a separate future migration. The unrelated `ousia_weight` reputation column and the Bios energy system are untouched.

## The mock-Pool SQL gap (critical pitfall)

The grid test suite runs against a **mock mysql2 Pool** — no real SQL parsing. So migration SQL with syntax errors or **reserved-word identifiers** passes CI green yet **crash-loops the Grid container on the first real-MySQL deploy** (migrations run on boot).

- **2026-06-14 incident:** migration v39 used `ADD COLUMN condition ENUM(...)`. `condition` is a MySQL **reserved word**; unquoted → `ER_PARSE_ERROR (1064)`. Fixed by backtick-quoting `` `condition` ``. (`status`/`level` are *not* reserved.)
- A single multi-column `ALTER` fails atomically, so a failed migration leaves the DB at the prior version (no partial columns).
- **2026-07-06 (v73):** the real-MySQL gate (`grid/scripts/check-migrations-real-mysql.ts`) caught a `RENAME COLUMN` pointed at the wrong table (`material_cost_bios` is in `civic_blueprints`, not `civic_cowork_agreements`) → `ER_BAD_FIELD_ERROR (1054)`. The mock-Pool suite passed all 4088 tests green; only real DDL parsing surfaced it. Always run the gate before shipping a migration.

**Rules before deploying a new migration:**
1. Scan new SQL for bare reserved-word identifiers and backtick them.
2. Ideally dry-run migrations against a real MySQL 8.0 instance.
3. Store ETH/wei money amounts as `DECIMAL(38,0)`, never `BIGINT` (wei overflows) — see [[economy]].

## State persistence

`PersistentAuditChain` writes the audit chain to MySQL with a tick-cadenced reconcile loop (`audit-reconcile.ts`, `INSERT IGNORE` idempotency). World snapshots (`snapshotGrid`/`restoreGrid`) let the Grid restore Nous on reboot.

## 🔗 Related

[[grid]] · [[deploy]] · [[economy]] · [[audit-allowlist]]
