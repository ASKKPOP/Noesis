# Phase 14: Researcher Rigs — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 delivers a headless researcher toolchain for running ephemeral, deterministic Grid
experiments at scale:

1. **`noesis rig` CLI** (`scripts/rig.mjs`) — spawns an ephemeral Grid from a versioned TOML
   config. Zero code divergence from production `GenesisLauncher`; configuration-over-fork.

2. **Isolated MySQL rig schema** — each Rig creates and populates its own MySQL schema
   (separate from the live Grid schema). Schema is LEFT for researcher post-hoc querying;
   no auto-drop. Schema name is deterministic from seed + config name.

3. **LLM fixture mode** — a `FixtureBrainAdapter` implementing `LLMAdapter` replays
   pre-recorded prompt→response pairs keyed by hand-authored template keys. Network LLM
   calls are refused in fixture mode (grep-enforced). Cache-miss is a strict fatal error by
   default (`--permissive` opt-in for prototyping).

4. **50 Nous × 10,000 tick benchmark** — Rigs run at `tickRateMs=0` by default (as-fast-as-
   possible headless mode). Fixture-mode LLM makes calls instant; target: <60min on 16GB/8-core
   laptop. Nightly CI smoke (not per-commit).

5. **JSONL exit snapshot** — same deterministic tarball format as Phase 13 REPLAY-01.
   `chronos.rig_closed` emitted on the Rig's own chain only (never production allowlist).

</domain>

<decisions>
## Implementation Decisions

### Chain Isolation

- **D-14-01:** MySQL separate schema — Rigs use the same MySQL driver and `MigrationRunner`
  as the production Grid (`grid/src/db/`). No second storage dependency (no SQLite in the
  Rig process itself). Rationale: consistency with production stack; same driver, same
  migration pattern, same query patterns. Schema name is deterministic:
  `rig_{config_name}_{seed_prefix_8chars}` (e.g., `rig_small50_d4e5f6a7`). Schema is LEFT
  after rig exit — researcher queries it post-hoc; drops manually when done.
  Grep CI gate: `rig.mjs` must not reference `httpServer.listen` or `wsHub` symbols
  (T-10-12 defense — clones REPLAY-03 discipline).

- **D-14-02:** Nested Rig rejection — `scripts/rig.mjs` exits non-zero if `NOESIS_RIG_PARENT`
  env var is set. The env var is set by `rig.mjs` before spawning the Grid process so any
  child that re-invokes `rig.mjs` is rejected at entry.

### Nous Manifest Format

- **D-14-03:** Dual-format manifest — TOML config supports both:
  - **Inline** `[[nous_manifest]]` TOML table-array for ≤~10 Nous (quick experiments). Each
    entry uses the same fields as `SeedNous` in `grid/src/genesis/types.ts` (`name`, `did`,
    `publicKey`, `region`, optional `humanOwner`, `personality`).
  - **External file** via `nous_manifest_path = "manifests/50-agents.jsonl"` for large runs.
    External manifest is a JSONL file, one `SeedNous`-shaped JSON object per line.
  - Both forms are mutually exclusive in one config (planner enforces at parse time).
    External manifest path is relative to the TOML config file's directory.

### LLM Fixture Mode

- **D-14-04:** Template-key matching — each fixture JSONL record carries a hand-authored
  `key` field (e.g., `"action_selection"`, `"reflection"`, `"dialogue_response"`). The
  Brain's fixture-mode call site must pass this key when invoking the LLM. Matching is on
  `key` equality, not on prompt text hash. This is deterministic across any run with the
  same fixture file, regardless of tick-varying prompt content.

- **D-14-05:** Strict cache-miss (default) — when the fixture adapter receives a `key` it
  has no record for, it raises a fatal error and exits non-zero with:
  `[FIXTURE ERROR] No fixture record for key "{key}". Run with --permissive to use stub.`
  `--permissive` flag opt-in: returns `"[UNMATCHED FIXTURE]"` stub response with 0 tokens
  and logs the miss to stderr. `--permissive` is a mode selector, NOT a bypass flag —
  `scripts/check-rig-invariants.mjs` must NOT treat it as a skip/bypass pattern.

- **D-14-06:** Network LLM call refusal — a `FixtureBrainAdapter` implementing
  `brain/src/noesis_brain/llm/base.py::LLMAdapter` is registered as all three model tiers
  (SMALL, PRIMARY, LARGE) in the `ModelRouter`. The adapter's `generate()` method serves
  from the fixture file; if called in fixture mode with a network provider, it raises
  immediately. Grep-enforced: `brain/src/llm/**` must have no network call path reachable
  when `NOESIS_FIXTURE_MODE=1` is set.

### Clock Speed

- **D-14-07:** `tickRateMs=0` default for Rigs — headless runs tick as fast as compute
  allows. Configurable via `tick_rate_ms` in the TOML config for slower debugging runs
  (e.g., `tick_rate_ms = 1000` to observe emergent behavior in real time). Default is 0
  for benchmark runs.

### `chronos.rig_closed` Event

- **D-14-08:** Closed 5-key tuple on Rig's own chain only — payload:
  `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}`.
  - `exit_reason ∈ {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}`
  - `chain_tail_hash` = SHA-256 of the last entry's serialized JSON (same derivation as
    Phase 13 tarball `chain_tail_hash`). Self-certifying: lets anyone verify the chain
    ended at the recorded state.
  - This event is NEVER added to `grid/src/audit/broadcast-allowlist.ts`. It exists in
    the Rig's own isolated chain only. `scripts/check-state-doc-sync.mjs` must assert
    the production allowlist stays at 27. Any future `chronos.*` or `rig.*` prefix in the
    production allowlist is a CI failure.

### Claude's Discretion

- TOML parsing library choice (`smol-toml` or `@iarna/toml`) — planner picks
- Rig tarball file naming convention (seed + config name + timestamp)
- `config/rigs/` directory structure and example TOML files
- Nightly CI benchmark workflow file location (`.github/workflows/nightly-rig-bench.yml`)
- Migration script number for the rig MySQL schema (e.g., `sql/014_rig_schema.sql`)
- Whether `check-rig-invariants.mjs` is a single gate or split into separate check files
- `--full-state` plaintext consent prompt verbatim copy (planner defines, must be
  verbatim-locked in tests; T-10-16 defense)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP — Phase 14 specification
- `.planning/ROADMAP.md` §"Phase 14: Researcher Rigs" — goal, success criteria (RIG-01..05),
  risks (T-10-12..T-10-16), allowlist note (0 production additions), out-of-scope list.

### Requirements
- `.planning/REQUIREMENTS.md` §"RIG — Researcher tools" — RIG-01..RIG-05 full text.

### Phase 13 patterns (MANDATORY read — Rig exit snapshot reuses these)
- `.planning/phases/13-operator-replay-export/13-CONTEXT.md` — tarball determinism
  discipline (D-13-09 payload shape, T-10-14 reproducible-builds conventions), ReplayGrid
  in-memory transport pattern (T-10-12), ExportConsentDialog verbatim-copy pattern.
- `grid/src/export/tarball-builder.ts` — `buildExportTarball` Rig exit reuses exactly.
- `grid/src/export/manifest.ts` — manifest format (chain_tail_hash, entry_count fields).
- `grid/src/export/canonical-json.ts` — canonical JSON serialization for determinism.
- `grid/src/replay/replay-grid.ts` — `{transport: 'in-memory'}` pattern; grep gate
  discipline; ReplayGrid construction order mirrors GenesisLauncher.
- `grid/src/replay/readonly-chain.ts` — ReadOnlyAuditChain; contrast with Rig's
  writable isolated chain (Rigs WRITE to their own schema, not read-only).

### Production GenesisLauncher (zero code divergence principle — RIG-01)
- `grid/src/genesis/launcher.ts` — GenesisLauncher construction order, subsystem list,
  `attachRelationshipStorage` pattern. Rig invokes this unchanged; config selects behavior.
- `grid/src/genesis/types.ts` — GenesisConfig and SeedNous schemas. Rig TOML config maps
  directly to GenesisConfig fields.
- `grid/src/genesis/presets.ts` — GENESIS_CONFIG reference; Rig overrides via config.

### Brain LLM adapter (FixtureBrainAdapter target interface)
- `brain/src/noesis_brain/llm/base.py` — LLMAdapter ABC. FixtureBrainAdapter implements this.
- `brain/src/noesis_brain/llm/router.py` — ModelRouter. Fixture adapter registered as all tiers.
- `brain/src/noesis_brain/llm/types.py` — LLMConfig, GenerateOptions, LLMResponse shapes.

### CI gate patterns (clone these for check-rig-invariants.mjs)
- `scripts/check-replay-readonly.mjs` — grep gate pattern (scan path, match pattern, exit 1).
- `scripts/check-wallclock-forbidden.mjs` — TIER_B_TS_ROOTS extension pattern; extend to
  cover `scripts/rig.mjs` and `grid/src/rig/**` paths.
- `scripts/check-state-doc-sync.mjs` — allowlist count assertion; must assert count stays at 27
  (no rig events on production allowlist).

### Database persistence patterns
- `grid/src/db/` — `DatabaseConnection`, `MigrationRunner`, `GridStore` — Rig schema
  setup uses the same `MigrationRunner.run(MIGRATIONS)` pattern as main.ts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `grid/src/export/tarball-builder.ts` — `buildExportTarball(opts)`: Rig exit snapshot calls
  this directly with its isolated chain entries. No modification needed.
- `grid/src/export/manifest.ts` — `createManifest()`: same manifest shape for Rig exit.
- `grid/src/genesis/launcher.ts` (GenesisLauncher) — Rig invokes unchanged; `{transport: 'in-memory'}` option suppresses network surface.
- `grid/src/genesis/types.ts` (GenesisConfig, SeedNous) — Rig TOML maps to these types directly.
- `brain/src/noesis_brain/llm/base.py` (LLMAdapter ABC) — `FixtureBrainAdapter` implements.
- `brain/src/noesis_brain/llm/router.py` (ModelRouter) — `register_tier` for all 3 tiers.
- `scripts/check-replay-readonly.mjs` — grep gate pattern to clone for `check-rig-invariants.mjs`.
- `scripts/check-wallclock-forbidden.mjs` — extend `TIER_B_TS_ROOTS` with rig paths.

### Established Patterns
- **In-memory transport**: `{transport: 'in-memory'}` already in GenesisLauncher — Rig uses
  same option to suppress httpServer.listen and wsHub (T-10-12 discipline).
- **MySQL separate schema + MigrationRunner**: same pattern as main.ts (`grid/src/db/`).
- **Sole-producer boundary**: clone Phase 6 D-13 pattern for `chronos.rig_closed` sole producer.
- **Verbatim-copy-locked consent**: `--full-state` consent prompt clones Phase 8/13 pattern.
- **Nightly CI bench**: same cadence as Phase 9 `load-10k.test.ts` (weekly → nightly for Rigs).

### Integration Points
- `scripts/rig.mjs` is the new entry point — reads TOML, sets `NOESIS_RIG_PARENT`, creates
  MySQL rig schema, invokes GenesisLauncher, runs tick loop, emits `chronos.rig_closed`,
  calls `buildExportTarball` on exit.
- `config/rigs/` — new directory for TOML config files, version-controlled with the repo.
- `.github/workflows/nightly-rig-bench.yml` — nightly smoke for 50×10k benchmark.
- `scripts/check-rig-invariants.mjs` — new CI gate; greps `rig.mjs` for bypass flags and
  `httpServer.listen`/`wsHub` symbols.

</code_context>

<specifics>
## Specific Ideas

- MySQL rig schema naming: `rig_{config_name}_{seed_8chars}` — deterministic, human-readable
  in `SHOW SCHEMAS` output, avoids collisions across multiple rig runs.
- Fixture JSONL record shape (planner to lock verbatim): `{key, response_text, tokens, tier}`.
  `tier ∈ {SMALL, PRIMARY, LARGE}` so the adapter can validate the call site's tier matches
  expectation. Mismatch is a fixture authoring error — fail loudly.
- `--permissive` flag does NOT appear in `check-rig-invariants.mjs` ban list (it's a mode
  selector, not a bypass). The ban list is: `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier`.
- Schema left for researcher = researcher runs `DROP SCHEMA rig_small50_d4e5f6a7` manually.
  No migration-down script needed (it's all ephemeral data).

</specifics>

<deferred>
## Deferred Ideas

- Parquet export (RIG-PARQUET-01) — explicitly out of scope per ROADMAP. JSONL suffices at
  50×10k scale. Deferred to v2.3.
- Nested Rigs — rejected at launcher entry. No future design planned in this phase.
- Per-Rig dashboard surface — stdout + tarball only in v2.2. Live web UI for Rigs is post-v2.2.
- Multi-Grid federation — post-v2.2.
- Fixture auto-recording (`noesis record` command) — out of scope. Researchers hand-craft
  fixture JSONL in v2.2. Auto-recording deferred.
- `relationship.warmed`/`.cooled` events — deferred to REL-EMIT-01 (pre-existing deferral).
- `@noesis/protocol-types` shared package consolidation — deferred from Phase 11 (D-11-16).

</deferred>

---

*Phase: 14-researcher-rigs*
*Context gathered: 2026-04-27*
