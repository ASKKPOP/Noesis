# Phase 14: Researcher Rigs — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 14-researcher-rigs
**Areas discussed:** Chain Isolation, Nous Manifest Format, Fixture Cache-Miss Policy,
  `chronos.rig_closed` Payload, Fixture Prompt Matching Strategy, Clock Speed

---

## Chain Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite (in-memory or file-backed) | better-sqlite3 already in test suite. Zero external DB dependency, fast, ephemeral teardown. | |
| MySQL separate schema | Same MySQL driver and migration pattern as production. Requires DB running but mirrors production exactly. | ✓ |

**User's choice:** MySQL separate schema
**Notes:** Rationale was consistency with the production stack — same driver, same
migration pattern, same query patterns. No desire to introduce a second storage technology
in the Rig process itself.

Follow-up — schema lifecycle:

| Option | Description | Selected |
|--------|-------------|----------|
| Leave for researcher | Schema name is deterministic; researcher drops manually when done. Enables post-hoc SQL queries. | ✓ |
| Auto-drop on exit | Clean teardown. Researcher relies on JSONL tarball for post-hoc analysis. | |

**User's choice:** Leave for researcher

---

## Nous Manifest Format

| Option | Description | Selected |
|--------|-------------|----------|
| Both inline + path | `[[nous_manifest]]` inline for small runs; `nous_manifest_path` for 50-Nous scale. External is JSONL using SeedNous schema. | ✓ |
| Inline TOML only | Single format; 50-Nous = ~200 lines of TOML. | |
| External file only | Always a separate manifest file, even for 2-Nous experiments. | |

**User's choice:** Both inline + path (Recommended)
**Notes:** Dual format — inline for quick experiments, external JSONL for large research runs.

---

## Fixture Cache-Miss Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Strict crash (default) | Non-zero exit + error showing which key had no match. `--permissive` opt-in for prototyping. | ✓ |
| Silent stub always | Return "[UNMATCHED FIXTURE]" stub and log to stderr. Run completes even with incomplete fixtures. | |

**User's choice:** Strict crash (Recommended)
**Notes:** Reproducibility guarantee requires complete fixture files. `--permissive` is a
mode selector (not a bypass flag) and is excluded from the `check-rig-invariants.mjs` ban list.

---

## `chronos.rig_closed` Payload

| Option | Description | Selected |
|--------|-------------|----------|
| 5-key with chain tail hash | `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}`. Self-certifying. | ✓ |
| Minimal 3-key | `{seed, tick, exit_reason}` only. Chain integrity left to the tarball manifest. | |

**User's choice:** 5-key with tail hash (Recommended)
**Notes:** `exit_reason ∈ {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}`.
`chain_tail_hash` mirrors Phase 13 `operator.exported.tarball_hash` self-certification pattern.

---

## Fixture Prompt Matching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Template key (hand-authored) | Each fixture record has a `key` field. Brain's call site passes the key. Deterministic across runs. | ✓ |
| SHA-256 of full prompt text | Keyed by exact prompt hash. Breaks on tick-varying content. | |
| SHA-256 of stripped prompt | Canonicalized prompt hash. Fragile canonicalization step. | |

**User's choice:** Template key (Recommended)
**Notes:** Deterministic across any run with the same fixture file regardless of tick-varying
prompt content. Requires fixture authors to assign keys at call sites in the Brain.

---

## Clock Speed

| Option | Description | Selected |
|--------|-------------|----------|
| tickRateMs=0 default | Ticks as fast as compute allows. Fixture mode makes LLM instant; 10k ticks completes in seconds. | ✓ |
| Configurable in TOML | Researcher sets tick_rate_ms. Default still 0. Allows slow-motion debugging runs. | |

**User's choice:** tickRateMs=0 default (Recommended)
**Notes:** `tick_rate_ms` is still configurable in the TOML config for debugging runs.
Default is 0 for benchmark targets.

---

## Claude's Discretion

- TOML parsing library choice
- Rig tarball file naming convention
- `config/rigs/` directory structure and example configs
- Nightly CI benchmark workflow location
- Migration script number for rig MySQL schema
- `check-rig-invariants.mjs` structure (single gate or split)
- `--full-state` verbatim consent copy (planner defines, verbatim-locked in tests)

## Deferred Ideas

- Parquet export (RIG-PARQUET-01) — v2.3
- Nested Rigs — rejected at launcher entry
- Per-Rig dashboard surface — post-v2.2
- Multi-Grid federation — post-v2.2
- Fixture auto-recording (`noesis record` command) — out of scope in v2.2
