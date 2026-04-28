# Phase 14: Researcher Rigs — Research

**Researched:** 2026-04-28
**Domain:** Headless Grid orchestration, LLM fixture mode, deterministic benchmarking, MySQL schema isolation, tarball export reuse
**Confidence:** HIGH

---

## Summary

Phase 14 delivers a complete headless researcher toolchain built almost entirely from existing Noēsis primitives. The core insight is that the codebase already has every major building block in place: `GenesisLauncher`, `buildExportTarball`, `MigrationRunner`, the `LLMAdapter` ABC, the `ModelRouter`, `check-replay-readonly.mjs` grep gate pattern, and `check-wallclock-forbidden.mjs`. The phase is about wiring these pieces together under a new CLI entry point (`scripts/rig.mjs`) with configuration-over-fork discipline.

The three genuinely new pieces are: (1) `FixtureBrainAdapter` — a Python class implementing `LLMAdapter` that serves pre-recorded JSONL fixture records by key; (2) the rig tick loop — a direct `clock.advance()` async for-loop in `rig.mjs` (NOT `setInterval`) that drives 50 Nous × 10k ticks at maximum compute throughput; and (3) `check-rig-invariants.mjs` — a new CI gate cloning the `check-replay-readonly.mjs` pattern to enforce the T-10-12 and T-10-13 defenses.

The performance target (50 Nous × 10k ticks in <60 minutes with fixture-mode LLM) is achievable. The math: fixture lookup + audit append is ~0.1–0.3ms per Nous per tick; 50 × 10k × 0.3ms = 150 seconds (2.5 minutes). The headroom is enormous. The risk (T-10-15 producer-boundary perf cliff) is real but mitigatable with a microbenchmark gate.

**Primary recommendation:** Wire existing primitives via configuration. Build the tick loop as a direct `await clock.advance() + await coordinator.doTick()` async for-loop; never use `setInterval` for headless Rigs. Use `smol-toml` for TOML parsing (ESM-native, TypeScript-first, TOML 1.0 compliant).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-14-01 — MySQL separate schema:** Rigs use the same MySQL driver and `MigrationRunner` as production. Schema name: `rig_{config_name}_{seed_prefix_8chars}`. Schema LEFT after exit for researcher post-hoc queries. No auto-drop. Grep CI gate: `rig.mjs` must not reference `httpServer.listen` or `wsHub` symbols.

**D-14-02 — Nested Rig rejection:** `scripts/rig.mjs` exits non-zero if `NOESIS_RIG_PARENT` env var is set. Env var is set by `rig.mjs` before spawning Grid process so child re-invocations are rejected at entry.

**D-14-03 — Dual-format manifest:** TOML config supports both inline `[[nous_manifest]]` (≤~10 Nous) and external `nous_manifest_path = "manifests/50-agents.jsonl"` (large runs). Mutually exclusive in one config. External manifest is JSONL, path relative to TOML config file's directory.

**D-14-04 — Template-key matching:** Fixture JSONL records carry a hand-authored `key` field. Brain fixture-mode call site passes this key. Matching is on `key` equality, not prompt text hash. Deterministic across runs with same fixture file.

**D-14-05 — Strict cache-miss (default):** Fixture adapter raises fatal error on unmatched key. `--permissive` flag opt-in returns `"[UNMATCHED FIXTURE]"` stub with 0 tokens. `--permissive` is a mode selector, NOT a bypass — `check-rig-invariants.mjs` must NOT treat it as skip/bypass.

**D-14-06 — Network LLM call refusal:** `FixtureBrainAdapter` registered as all three model tiers (SMALL, PRIMARY, LARGE) in `ModelRouter`. `generate()` raises immediately if in fixture mode with network provider. Grep-enforced: `brain/src/llm/**` must have no network call path reachable when `NOESIS_FIXTURE_MODE=1`.

**D-14-07 — `tickRateMs=0` default for Rigs:** Headless runs tick as fast as compute allows. Configurable via `tick_rate_ms` in TOML for debugging runs.

**D-14-08 — `chronos.rig_closed` event:** Closed 5-key tuple: `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}`. `exit_reason ∈ {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}`. `chain_tail_hash` = SHA-256 of last entry's serialized JSON. NEVER added to production allowlist. Allowlist stays at 27. `check-state-doc-sync.mjs` must assert count stays at 27.

### Claude's Discretion

- TOML parsing library choice (`smol-toml` or `@iarna/toml`) — planner picks
- Rig tarball file naming convention (seed + config name + timestamp)
- `config/rigs/` directory structure and example TOML files
- Nightly CI benchmark workflow file location (`.github/workflows/nightly-rig-bench.yml`)
- Migration script number for the rig MySQL schema (e.g., `sql/014_rig_schema.sql`)
- Whether `check-rig-invariants.mjs` is a single gate or split into separate check files
- `--full-state` plaintext consent prompt verbatim copy (planner defines, must be verbatim-locked in tests; T-10-16 defense)

### Deferred Ideas (OUT OF SCOPE)

- Parquet export (RIG-PARQUET-01) — JSONL suffices at 50×10k scale. Deferred to v2.3.
- Nested Rigs — rejected at launcher entry. No future design planned in this phase.
- Per-Rig dashboard surface — stdout + tarball only in v2.2. Live web UI for Rigs is post-v2.2.
- Multi-Grid federation — post-v2.2.
- Fixture auto-recording (`noesis record` command) — researchers hand-craft fixture JSONL in v2.2.
- `relationship.warmed`/`.cooled` events — deferred to REL-EMIT-01.
- `@noesis/protocol-types` shared package consolidation — deferred from Phase 11.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RIG-01 | `noesis rig` CLI spawns ephemeral Grid from config `{seed, tick_budget, nous_manifest, operator_tier_cap, llm_fixture_path?}`. Configs in `config/rigs/*.toml`. Zero code divergence from production `GenesisLauncher`. | GenesisLauncher is already configuration-injectable. TOML parsing via `smol-toml`. Rig invokes `GenesisLauncher` unchanged; `{transport: 'in-memory'}` suppresses httpServer/wsHub. |
| RIG-02 | Each Rig runs its own isolated audit chain (separate MySQL schema), separate WsHub, separate Brain instances. Live Grid's AuditChain never touched. Nested Rigs rejected. | `MigrationRunner` + `DatabaseConnection` pattern from `grid/src/db/`. Schema name deterministic: `rig_{config_name}_{seed_8chars}`. `NOESIS_RIG_PARENT` env guard in `rig.mjs`. |
| RIG-03 | LLM fixture mode: pre-recorded Brain prompt→response pairs. Brain in fixture mode refuses network calls (grep-enforced). | `FixtureBrainAdapter` implements `LLMAdapter` ABC from `brain/src/noesis_brain/llm/base.py`. Registered as all tiers via `ModelRouter.register_tier()`. Grep gate covers `brain/src/llm/**`. |
| RIG-04 | 50 Nous × 10,000 ticks in <60 minutes on 16GB/8-core laptop. Nightly CI smoke. Producer-boundary microbenchmark p99 emit latency <1ms. | Direct tick for-loop (NOT setInterval) gives ~2–5 min for 50×10k with fixture-mode. Benchmark test clones `grid/test/relationships/perf-10k.test.ts` pattern with `process.hrtime.bigint()`. |
| RIG-05 | Rig exit emits JSONL snapshot (REPLAY-01 tarball format). Exit conditions: tick budget, all-Nous-dead, H5-terminate. `chronos.rig_closed` on own chain only. No bypass flags. | `buildExportTarball` from `grid/src/export/tarball-builder.ts` reused directly. `createManifest` from `grid/src/export/manifest.ts`. `check-rig-invariants.mjs` clones `check-replay-readonly.mjs` pattern. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rig CLI entry point + TOML parse | Script Layer (`scripts/rig.mjs`) | — | CLI script that bootstraps the Grid; no HTTP server involvement |
| MySQL rig schema creation | Database Layer (`grid/src/db/`) | Script Layer | Same `MigrationRunner` as production; schema name is deterministic from config |
| Headless tick loop | Script Layer (`scripts/rig.mjs`) | Grid Layer (GenesisLauncher) | `rig.mjs` owns the tick-advance loop; `GenesisLauncher` provides the clock primitive |
| LLM fixture mode | Brain Layer (`brain/src/noesis_brain/llm/`) | — | `FixtureBrainAdapter` is a pure Python LLMAdapter; registered in Brain's ModelRouter |
| Network LLM call refusal | Brain Layer (grep gate) | — | `NOESIS_FIXTURE_MODE=1` env var prevents network path; grep CI enforces at build time |
| JSONL tarball exit snapshot | Grid Export Layer (`grid/src/export/`) | Script Layer | `buildExportTarball` is already complete; `rig.mjs` calls it on exit |
| `chronos.rig_closed` emission | Script Layer (`scripts/rig.mjs`) | Audit Layer (isolated chain) | Emitted on Rig's own isolated `AuditChain`; never touches production allowlist |
| CI invariant gates | Scripts Layer (`scripts/check-rig-invariants.mjs`) | — | New grep gate cloning `check-replay-readonly.mjs` pattern for rig-specific rules |
| Nested Rig rejection | Script Layer (`scripts/rig.mjs`) | — | `NOESIS_RIG_PARENT` env var checked at rig.mjs entry point before any Grid construction |
| Performance benchmarking | Test Layer (Vitest) | CI (nightly) | Clones `perf-10k.test.ts` pattern; runs nightly (not per-commit per RIG-04) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `smol-toml` | `1.6.1` [VERIFIED: npm registry] | TOML config parsing for `config/rigs/*.toml` | ESM-native, TypeScript types included, TOML 1.0 compliant, minimal footprint; outperforms `@iarna/toml` for modern ESM projects |
| `@noesis/grid` (internal) | `*` | `GenesisLauncher`, `AuditChain`, `MigrationRunner`, `buildExportTarball`, `createManifest` | All required Grid primitives already ship in this workspace package |
| `mysql2` | `^3.9.0` [VERIFIED: grid/package.json] | Rig MySQL schema creation | Already a Grid dependency; same driver for rig schema as production |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@iarna/toml` | `2.2.5` [VERIFIED: npm registry] | Alternative TOML parser | Only if `smol-toml` has a blocking issue; prefer smol-toml |
| `process.hrtime.bigint()` | Node.js built-in | Nanosecond-precision timing for the producer-boundary microbenchmark | Benchmark test only (test code, not `grid/src/rig/**`) |
| `node:crypto` (SHA-256) | Node.js built-in | `chain_tail_hash` computation in `chronos.rig_closed` payload | Same `createHash` pattern used by `tarball-builder.ts` |
| `node:fs` | Node.js built-in | Reading fixture JSONL files, writing tarball output | |
| `node:path` | Node.js built-in | Resolving `nous_manifest_path` relative to TOML file's directory | |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `smol-toml` | `@iarna/toml` | `@iarna/toml` is CommonJS-first, older, TOML 0.5 by default (3.0.0-rc for TOML 1.0); smol-toml is the better pick for an ESM TypeScript monorepo |
| Direct tick for-loop | `setInterval(fn, 0)` | `setInterval(fn, 0)` adds ~1–4ms overhead per tick (measured: 100 intervals = ~112ms). For 10k ticks that's 11+ seconds of pure overhead. Direct loop = ~3ms for 10k sync advances. For headless benchmarking, direct loop is mandatory. |
| Isolated AuditChain (writable) | ReadOnlyAuditChain | Rigs WRITE to their own chain (unlike ReplayGrid which is read-only). Rig chain is a fresh `AuditChain()` instance, never the live chain reference. |

**Installation:**
```bash
# In scripts/ or root:
npm install smol-toml
```

**Version verification:** [VERIFIED: npm registry 2026-04-28] — `smol-toml@1.6.1` is current.

---

## Architecture Patterns

### System Architecture Diagram

```
rig.mjs (entry)
    │
    ├── Parse TOML config (smol-toml)
    │     ├── seed, tick_budget, nous_manifest, tick_rate_ms
    │     └── llm_fixture_path? → FixtureBrainAdapter
    │
    ├── Guard: NOESIS_RIG_PARENT → exit(1) if set
    ├── Set: process.env.NOESIS_RIG_PARENT = '1'
    │
    ├── Create MySQL rig schema
    │     └── MigrationRunner.run() on rig_{name}_{seed8} schema
    │
    ├── Build GenesisLauncher(config)
    │     ├── config.gridName = rig_{name}_{seed8}
    │     ├── config.tickRateMs = 0 (headless)
    │     ├── config.seedNous = parsed from manifest
    │     └── NO httpServer.listen / NO wsHub (in-memory transport)
    │
    ├── Construct Brain instances per Nous
    │     └── FixtureBrainAdapter registered as SMALL/PRIMARY/LARGE tiers
    │         └── NOESIS_FIXTURE_MODE=1 → all network paths raise immediately
    │
    ├── Wire GridCoordinator (50 NousRunners → FixtureBrainAdapter bridges)
    │
    ├── launcher.bootstrap() → spawn Nous, seed audit chain
    │
    ├── Tick Loop (direct for-loop, NOT setInterval)
    │     for (tick = 0; tick < tick_budget; tick++) {
    │         event = launcher.clock.advance()  ← synchronous
    │         await coordinator.doTick(tick, epoch)  ← all 50 Nous in parallel
    │         check exit conditions (all-Nous-dead, H5-terminate signal)
    │     }
    │
    ├── Emit chronos.rig_closed on rig's isolated audit chain
    │     payload: {seed, tick, exit_reason, chain_entry_count, chain_tail_hash}
    │
    └── Build JSONL tarball
          buildExportTarball({chainSlice, startSnapshot, endSnapshot, manifest})
          → write to disk: rig_{name}_{seed8}_{timestamp}.tar
```

### Recommended Project Structure
```
scripts/
├── rig.mjs                      # New: Rig CLI entry point
├── check-rig-invariants.mjs     # New: CI gate for T-10-12 + T-10-13 defenses
├── check-replay-readonly.mjs    # Existing: clone pattern for above
└── check-state-doc-sync.mjs     # Existing: assert allowlist stays at 27

config/
└── rigs/
    ├── small-10.toml            # Example: 10 Nous × 1k ticks (dev/debug)
    └── bench-50.toml            # Benchmark: 50 Nous × 10k ticks

brain/src/noesis_brain/llm/
├── base.py                      # Existing: LLMAdapter ABC (FixtureBrainAdapter target)
├── router.py                    # Existing: ModelRouter.register_tier()
├── types.py                     # Existing: ModelTier, LLMResponse
└── fixture.py                   # New: FixtureBrainAdapter

grid/src/rig/
└── types.ts                     # New: RigConfig, RigManifest, RigExitReason types

grid/test/rig/
├── fixture-adapter.test.ts      # Unit tests for FixtureBrainAdapter behavior (via bridge)
├── rig-invariants.test.ts       # Tests for check-rig-invariants.mjs behavior
└── rig-bench.test.ts            # 50×10k benchmark (nightly CI smoke)

sql/
└── 014_rig_schema.sql           # Rig schema migration (or inline in schema.ts)
```

### Pattern 1: Configuration-over-Fork (RIG-01 — Zero Code Divergence)

**What:** Rig uses the identical `GenesisLauncher` constructor as production. The TOML config maps directly to `GenesisConfig` fields.

**When to use:** All Rig runs. Never fork or subclass `GenesisLauncher`.

**Example:**
```typescript
// Source: grid/src/genesis/types.ts (existing interface)
// rig.mjs maps TOML fields to GenesisConfig fields:
const config: GenesisConfig = {
    gridName: `rig_${configName}_${seed.slice(0, 8)}`,
    gridDomain: 'rig.noesis',
    tickRateMs: parsedToml.tick_rate_ms ?? 0,   // D-14-07: headless default
    ticksPerEpoch: 100,
    regions: /* from production preset or config */,
    connections: /* from production preset or config */,
    laws: /* from production preset or config */,
    economy: {},
    seedNous: parsedManifest,   // D-14-03: from [[nous_manifest]] or external JSONL
};
const launcher = new GenesisLauncher(config);
```

### Pattern 2: Direct Tick Loop (RIG-04 — Headless Benchmarking)

**What:** `rig.mjs` drives the tick loop by calling `clock.advance()` + `coordinator.doTick()` in a direct async for-loop. Never uses `setInterval`.

**When to use:** Any Rig run with `tickRateMs=0`. Also correct for `tickRateMs > 0` if the rig wants precise tick timing.

**Why this matters:** `setInterval(fn, 0)` in Node.js fires at minimum ~1ms per call (measured: 100 intervals = 112ms). For 10k ticks, that is 11+ seconds of pure overhead before any Nous work. The direct loop collapses this to ~3ms.

**Example:**
```typescript
// Source: Derived from grid/src/clock/ticker.ts WorldClock.advance() pattern
// rig.mjs tick loop:
for (let t = 0; t < tickBudget; t++) {
    const event = launcher.clock.advance();  // synchronous tick advance
    await coordinator.doTick(event.tick, event.epoch);  // 50 Nous in parallel
    // Check exit: all Nous dead?
    if (launcher.registry.count === 0) { exitReason = 'all_nous_dead'; break; }
    // Check exit: H5-terminate signal (SIGTERM handler sets flag)?
    if (h5TerminateSignaled) { exitReason = 'operator_h5_terminate'; break; }
}
const finalTick = launcher.clock.currentTick;
exitReason ??= 'tick_budget_exhausted';
```

Note: `WorldClock.advance()` is already public and synchronous (`grid/src/clock/ticker.ts:69`). The rig bypasses `clock.start()` and never creates the `setInterval` timer.

### Pattern 3: FixtureBrainAdapter (RIG-03 — Deterministic LLM)

**What:** Python class implementing `LLMAdapter` that serves pre-recorded `{key, response_text, tokens, tier}` JSONL records by key lookup. Raises immediately if called when `NOESIS_FIXTURE_MODE=1` via a network provider path.

**When to use:** All Rig runs with `llm_fixture_path` specified in TOML.

**Example:**
```python
# Source: brain/src/noesis_brain/llm/base.py (existing ABC)
import json
import os

class FixtureBrainAdapter(LLMAdapter):
    """LLMAdapter that replays pre-recorded fixture JSONL records by key."""

    def __init__(self, fixture_path: str, permissive: bool = False) -> None:
        self._records: dict[str, dict] = {}
        self._permissive = permissive
        with open(fixture_path) as f:
            for line in f:
                record = json.loads(line.strip())
                self._records[record['key']] = record

    @property
    def provider_name(self) -> str:
        return 'fixture'

    async def generate(self, prompt: str, options=None) -> LLMResponse:
        key = options.purpose if options else ''
        record = self._records.get(key)
        if record is None:
            if self._permissive:
                import sys
                print(f'[FIXTURE MISS] key="{key}"', file=sys.stderr)
                return LLMResponse(text='[UNMATCHED FIXTURE]', model='fixture',
                                   provider='fixture', usage={'prompt_tokens': 0, 'completion_tokens': 0})
            raise RuntimeError(
                f'[FIXTURE ERROR] No fixture record for key "{key}". '
                f'Run with --permissive to use stub.'
            )
        return LLMResponse(
            text=record['response_text'],
            model='fixture',
            provider='fixture',
            usage={'prompt_tokens': 0, 'completion_tokens': record.get('tokens', 0)},
        )

    async def list_models(self) -> list[str]:
        return ['fixture']

    async def is_available(self) -> bool:
        return True
```

### Pattern 4: MySQL Rig Schema (RIG-02 — Isolated Audit Chain)

**What:** Each Rig creates its own `rig_{config_name}_{seed_8chars}` MySQL schema using the same `MigrationRunner` pattern as `grid/src/main.ts`.

**When to use:** Every Rig run. Schema is LEFT for post-hoc querying; no auto-drop.

**Example:**
```typescript
// Source: grid/src/db/ existing patterns
import { DatabaseConnection, MigrationRunner, MIGRATIONS } from '@noesis/grid';

const schemaName = `rig_${configName}_${seed.slice(0, 8)}`;
// Create schema:
await db.execute(`CREATE SCHEMA IF NOT EXISTS \`${schemaName}\``);
const rigDb = new DatabaseConnection({ ...dbConfig, database: schemaName });
const runner = new MigrationRunner(rigDb);
await runner.run();  // same MIGRATIONS as production
```

### Pattern 5: Rig Tarball (RIG-05 — REPLAY-01 Format Reuse)

**What:** `buildExportTarball` from `grid/src/export/tarball-builder.ts` is called unchanged with the Rig's isolated chain entries.

**When to use:** On Rig exit (all three exit conditions).

**Example:**
```typescript
// Source: grid/src/export/tarball-builder.ts, grid/src/export/manifest.ts
import { buildExportTarball } from '@noesis/grid/export';
import { createManifest } from '@noesis/grid/export';

const chainEntries = launcher.audit.all();
const chainTailHash = /* SHA-256 of last entry's canonical JSON */;
const manifest = createManifest({
    startTick: 0,
    endTick: finalTick,
    entryCount: chainEntries.length,
    chainTailHash,
});
const { bytes, hash } = await buildExportTarball({
    chainSlice: chainEntries,
    startSnapshot,
    endSnapshot,
    manifest,
});
```

### Pattern 6: CI Gate (check-rig-invariants.mjs)

**What:** New grep gate cloning `check-replay-readonly.mjs` that asserts:
1. `scripts/rig.mjs` does not reference `httpServer.listen` or `wsHub` (T-10-12 defense)
2. `scripts/rig.mjs` and `grid/src/rig/**` do not contain `--skip-*`, `--bypass-*`, `--disable-*`, `--no-reviewer`, `--no-tier` patterns (T-10-13 defense)
3. Production allowlist stays at 27 — no `chronos.*` or `rig.*` prefix in `ALLOWLIST_MEMBERS`

**Example:**
```javascript
// Source: scripts/check-replay-readonly.mjs (clone pattern)
const FORBIDDEN_RIG_SYMBOLS = /httpServer\.listen|wsHub/g;
const BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g;
// Note: --permissive is NOT in this list per D-14-05
```

### Anti-Patterns to Avoid

- **Using `setInterval` for the headless tick loop:** adds 1–4ms overhead per tick. For 10k ticks that's at minimum 10 seconds of wasted overhead. Use `clock.advance()` in a direct async for-loop.
- **Calling `clock.start()` in rig.mjs:** `start()` sets up `setInterval`. Rigs must call `clock.advance()` directly.
- **Putting `chronos.rig_closed` on the production allowlist:** This event must only exist on the Rig's own isolated chain. `check-state-doc-sync.mjs` already hard-bans `replay.*` prefix; planner must extend the ban to cover `rig.*` and `chronos.*` prefixes from rig code.
- **Using `--permissive` in the bypass flag ban list:** D-14-05 explicitly states it is NOT a bypass. The ban list is: `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier`.
- **Subclassing `GenesisLauncher` for Rigs:** Zero code divergence means the same class. Configuration-over-fork via `GenesisConfig` fields.
- **Importing the live Grid's AuditChain in rig.mjs:** Rig gets a fresh `AuditChain()` instance. The live Grid's chain object never appears in rig code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic tarball | Custom tar builder | `buildExportTarball` (`grid/src/export/tarball-builder.ts`) | Already implements 8-discipline two-pass self-referencing build (T-10-08 defense) |
| Canonical JSON | `JSON.stringify` with sort | `canonicalStringify` (`grid/src/export/canonical-json.ts`) | Handles key ordering, no undefined, deterministic across machines |
| TOML parsing | Hand-written parser | `smol-toml` 1.6.1 | TOML 1.0 compliant, handles all edge cases (multiline strings, arrays of tables) |
| MySQL schema setup | Raw DDL in rig.mjs | `MigrationRunner` + `MIGRATIONS` | Same migration pattern as production; idempotent; future schema changes propagate automatically |
| Audit chain hashing | Custom SHA-256 | `AuditChain.append()` existing chain | The chain's built-in hash-chaining already ensures tamper-evidence |
| LLM adapter interface | Custom protocol | `LLMAdapter` ABC + `ModelRouter` | The existing interface is what the Brain already expects; any deviation breaks the integration |
| Chain tail hash | Custom derivation | `SHA-256(canonicalStringify(lastEntry))` — same as Phase 13 tarball pattern | Matches `chain_tail_hash` semantics established in `createManifest()` |

**Key insight:** Phase 14 is the integration test for all of v2.2. Almost everything has already been built. The only genuinely new code is `FixtureBrainAdapter` (Python) and `rig.mjs` (wiring script). Resist the urge to build custom versions of what already exists.

---

## Common Pitfalls

### Pitfall 1: T-10-12 — Headless Rig Enables WsHub by Accident

**What goes wrong:** `rig.mjs` invokes `buildServer()` or `createGridApp()` which unconditionally creates a `WsHub` and calls `server.listen()`. This opens a network port the researcher didn't ask for.

**Why it happens:** Copying the production `main.ts` startup pattern without reading what `buildServer()` does.

**How to avoid:** `rig.mjs` must NOT call `buildServer()` or `createGridApp()`. It uses `GenesisLauncher` directly + a bare `MigrationRunner` for the rig schema. The `check-rig-invariants.mjs` gate greps `scripts/rig.mjs` for `httpServer.listen` and `wsHub` strings and exits 1 if found.

**Warning signs:** Any import of `grid/src/api/server.ts` in `rig.mjs`; any `buildServer` or `createGridApp` call.

### Pitfall 2: T-10-13 — Rig CLI Flag Silently Disables Invariants

**What goes wrong:** A researcher adds `--skip-audit` or `--disable-sole-producer` to speed up their Rig. The flag silently bypasses a critical correctness guarantee. Datasets produced are non-comparable to other runs.

**Why it happens:** Researcher wants faster iteration and adds a "shortcut" flag.

**How to avoid:** `check-rig-invariants.mjs` greps `scripts/rig.mjs` AND `grid/src/rig/**` for the bypass flag patterns `--skip-*|--bypass-*|--disable-*|--no-reviewer|--no-tier`. The grep is run in CI. Note: `--permissive` is NOT in this list (it is a mode selector for fixture cache-miss behavior, not a bypass of any invariant).

**Warning signs:** Any conditional block guarded by `args.includes('--skip-')` or similar.

### Pitfall 3: T-10-14 — Tarball Non-Deterministic Due to Spawn Order

**What goes wrong:** Two Rig runs with the same seed and config produce different tarball hashes because Nous were spawned in a different order (e.g., via `Promise.all` on an unordered map).

**Why it happens:** JavaScript `Map` iteration order is insertion-order, but if spawn is async-parallel, insertion order can vary by scheduling.

**How to avoid:** Spawn Nous from the manifest in exact declaration order (same as production `GenesisLauncher.bootstrap()` for-loop). The `buildExportTarball` already sorts chain entries by `id` (line 108 of `tarball-builder.ts`). The manifest parser must preserve JSONL line order.

**Warning signs:** `Promise.all(manifest.map(seed => launcher.spawnNous(...)))` — this is non-deterministic. Use a for-loop.

### Pitfall 4: T-10-15 — 10k-Tick Run Reveals Producer-Boundary Perf Cliff

**What goes wrong:** `AuditChain.append()` with 50 Nous × 10k ticks produces 500k+ audit entries. The in-memory entries array grows to use significant RAM, and each append triggers all listeners synchronously (DialogueAggregator, RelationshipListener, GovernanceEngine). At 10k ticks the listener fan-out for each entry adds up.

**Why it happens:** No snapshot cadence for the Rig's in-memory chain (unlike production MySQL-backed chain). All 500k+ entries stay in memory for the full run.

**How to avoid:** The producer-boundary microbenchmark (`p99 emit latency <1ms` gate) detects this early. The test should measure `audit.append()` latency with N listeners registered — not just the raw `AuditChain` without listeners. If the p99 exceeds 1ms, the rig must batch-flush listeners or reduce listener count.

**Warning signs:** Memory usage growing linearly with tick count. Single-tick wall time increasing after 5k+ ticks.

### Pitfall 5: T-10-16 — Published Dataset Leaks Plaintext Telos

**What goes wrong:** The `--full-state` flag on the rig CLI exports plaintext Telos goals into the JSONL snapshot, which a researcher then publishes. This violates Nous privacy.

**Why it happens:** Researcher wants to understand Nous decision-making and includes plaintext goals in the export.

**How to avoid:** The `--full-state` flag triggers a verbatim consent prompt (copy locked in tests, same pattern as `IrreversibilityDialog`). The consent prompt must explicitly state: "This export contains plaintext Telos goals and internal Nous state that has never been broadcast publicly." Only after character-by-character confirmation does the export proceed. The prompt verbatim copy is planner-defined and verbatim-locked in test assertions.

**Warning signs:** Any `--full-state` export without a consent dialog. Any payload that includes `telos_yaml`, `goals`, `new_goals`, or other Telos plaintext keys.

---

## Code Examples

Verified patterns from official sources (codebase inspection):

### GenesisLauncher Constructor (Zero Code Divergence)
```typescript
// Source: grid/src/genesis/launcher.ts (verified 2026-04-28)
// Rig uses this unchanged — just passes different GenesisConfig fields
const launcher = new GenesisLauncher({
    gridName: `rig_bench50_d4e5f6a7`,
    gridDomain: 'rig.noesis',
    tickRateMs: 0,              // D-14-07: headless
    ticksPerEpoch: 100,
    regions: PRODUCTION_REGIONS,   // same regions as production
    connections: PRODUCTION_CONNECTIONS,
    laws: PRODUCTION_LAWS,
    economy: {},
    seedNous: manifestEntries,  // from TOML/JSONL manifest
});
// NO: buildServer(), createGridApp(), httpServer.listen, wsHub
```

### WorldClock.advance() — Direct Loop Pattern
```typescript
// Source: grid/src/clock/ticker.ts:69 — advance() is already public
// Verified: returns TickEvent synchronously; no setInterval involved
for (let i = 0; i < tickBudget; i++) {
    const event = launcher.clock.advance();  // increments this.tick, fires listeners synchronously
    await coordinator.doTick(event.tick, event.epoch);
    if (exitConditionMet()) break;
}
// Note: do NOT call launcher.clock.start() — that creates setInterval
```

### MigrationRunner Pattern (Rig Schema)
```typescript
// Source: grid/src/db/migration-runner.ts (verified 2026-04-28)
// MigrationRunner.run() takes zero args — MIGRATIONS is imported from schema.ts
const rigDb = new DatabaseConnection({ host, port, database: schemaName, user, password });
const runner = new MigrationRunner(rigDb);
const applied = await runner.run();  // returns count of applied migrations
```

### check-rig-invariants.mjs skeleton
```javascript
// Source: Cloned from scripts/check-replay-readonly.mjs pattern
// Scan rig.mjs for forbidden network symbols (T-10-12):
const FORBIDDEN_SYMBOLS_RE = /httpServer\.listen|wsHub/g;
// Scan rig.mjs + grid/src/rig/** for bypass flag patterns (T-10-13):
const BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g;
// Note: --permissive is NOT forbidden per D-14-05
// Production allowlist rig/chronos prefix ban: extend check-state-doc-sync.mjs
```

### Fixture JSONL Record Shape (D-14-04 / CONTEXT.md §Specifics)
```jsonl
{"key":"action_selection","response_text":"MOVE agora","tokens":12,"tier":"PRIMARY"}
{"key":"reflection","response_text":"I considered speaking but moved instead.","tokens":18,"tier":"LARGE"}
{"key":"dialogue_response","response_text":"Hello, I am curious today.","tokens":10,"tier":"SMALL"}
```

### chronos.rig_closed Payload (D-14-08)
```typescript
// Emitted on rig's own isolated AuditChain only
// chain_tail_hash = SHA-256 of last entry's canonicalized JSON
const lastEntry = rigChain.all().at(-1)!;
const chainTailHash = createHash('sha256')
    .update(canonicalStringify(lastEntry))
    .digest('hex');

rigChain.append('chronos.rig_closed', 'system', {
    seed,
    tick: finalTick,
    exit_reason: exitReason,          // 'tick_budget_exhausted' | 'all_nous_dead' | 'operator_h5_terminate'
    chain_entry_count: rigChain.length,
    chain_tail_hash: chainTailHash,
});
```

### smol-toml Usage
```typescript
// Source: npm registry smol-toml@1.6.1 [VERIFIED]
import { parse } from 'smol-toml';
import { readFileSync } from 'node:fs';

const rawConfig = readFileSync('/path/to/config.toml', 'utf8');
const config = parse(rawConfig);
// config.seed, config.tick_budget, config.nous_manifest (array), config.nous_manifest_path (string)
```

### perf-10k.test.ts microbenchmark pattern
```typescript
// Source: grid/test/relationships/perf-10k.test.ts (verified 2026-04-28)
// Clone for producer-boundary microbenchmark:
const start = process.hrtime.bigint();
rigChain.append('test.event', 'system', payload);
const end = process.hrtime.bigint();
const latencyMs = Number(end - start) / 1_000_000;
// Assert p99 < 1ms over N iterations with all listeners registered
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setInterval(fn, 0)` for fast ticks | Direct `clock.advance()` async for-loop | Phase 14 (new) | 10x+ throughput improvement for headless benchmarking |
| SQLite for test isolation (ReplayGrid) | MySQL separate schema for Rig (writable) | Phase 14 (new) | Rigs write production-identical MySQL data; researchers query the same DB engine they know |
| Fixture mode not in codebase | `FixtureBrainAdapter` + `NOESIS_FIXTURE_MODE=1` | Phase 14 (new) | Deterministic LLM behavior; enables reproducible research |

**Deprecated/outdated:**
- `setInterval`-based tick loop for headless use: replaced by direct `clock.advance()` calls in rig.mjs. The `WorldClock.start()` method is still correct for production (long-running live Grid with real-time pacing) but wrong for Rigs.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `WorldClock.advance()` is callable directly from `rig.mjs` (not private/protected) | Architecture Patterns §Pattern 2 | [VERIFIED: grid/src/clock/ticker.ts:69] — `advance()` is a public method |
| A2 | `AuditChain` can hold 500k+ entries in memory for a 50×10k run without OOM on 16GB | Common Pitfalls §Pitfall 4 | [ASSUMED] — each AuditEntry ~500 bytes × 500k entries = ~250MB, well under 16GB. But listener fan-out cost is not measured for large entry counts. The microbenchmark gate addresses this. |
| A3 | `smol-toml` handles nested TOML table arrays (`[[nous_manifest]]`) correctly | Standard Stack | [VERIFIED: smol-toml@1.6.1 is TOML 1.0 compliant; table arrays are core TOML 1.0] |
| A4 | The `GridCoordinator.doTick()` method exists or can be added to support the direct tick loop | Architecture Patterns §Pattern 2 | [ASSUMED] — `GridCoordinator` currently subscribes to `clock.onTick` via `start()`. For headless, rig.mjs needs a way to trigger per-tick Nous processing. Either `doTick()` must be added or the rig constructs its own tick dispatch. The planner must decide. |

**Note on A4 (IMPORTANT):** `GridCoordinator.start()` wires `clock.onTick` which fires on `clock.advance()`. So calling `clock.advance()` DOES fire the `GridCoordinator` listener synchronously. The existing wiring works without modification — the rig calls `coordinator.start()` once, then `clock.advance()` repeatedly. The async work happens in the listener. **However**, the listener is async but `clock.advance()` doesn't await it (consistent with `WorldClock` fire-and-forget pattern). The rig must explicitly await completion after each `advance()` to avoid 50 Nous ticking simultaneously out of order. A thin wrapper or explicit `Promise.all` after each advance is needed.

---

## Open Questions

1. **GridCoordinator async tick completion signal**
   - What we know: `clock.advance()` fires `onTick` listeners synchronously, but `GridCoordinator.start()` registers an async listener that the clock does not await.
   - What's unclear: How does `rig.mjs` know when all 50 Nous have completed their tick work before advancing the next tick? In production this doesn't matter (real-time pacing gives time for async work). In headless mode it matters for correctness.
   - Recommendation: Planner adds a `awaitTick()` method to `GridCoordinator` or uses a `Promise`-based tick completion signal. Alternatively, `rig.mjs` directly calls `coordinator`'s internal tick dispatch without `clock.onTick` wiring.

2. **`NOESIS_FIXTURE_MODE=1` propagation to Brain processes**
   - What we know: Brain and Grid run as separate processes (Brain is Python, Grid is TypeScript).
   - What's unclear: How does `rig.mjs` communicate fixture mode to the Brain? Options: (a) env var inherited by child process, (b) `IBrainBridge` constructor flag, (c) RPC handshake message.
   - Recommendation: The `IBrainBridge` or `BrainBridgeConfig` is constructed by `rig.mjs` with a `fixture: true` flag that causes the bridge to instantiate `FixtureBrainAdapter` instead of the real LLM stack. The env var `NOESIS_FIXTURE_MODE=1` is set in the Brain process's environment by the bridge constructor.

3. **Rig schema migration list (should it include ALL MIGRATIONS?)**
   - What we know: `MigrationRunner.run()` applies all `MIGRATIONS` from `grid/src/db/schema.ts`. The current schema has 6 migrations (tables: grid_migrations, audit_trail, nous_registry, nous_positions, grid_config, governance_proposals+ballots).
   - What's unclear: Should the Rig also create the `relationships` table (migration 009) and a new rig-specific table? Or does it use the existing MIGRATIONS array as-is?
   - Recommendation: Use existing `MIGRATIONS` array as-is, then create an additional rig-specific migration inline in `rig.mjs` (not in the production `schema.ts` — Rig schema tables should not be in production migration history). The planner defines the rig schema additions.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | `scripts/rig.mjs` | ✓ | v25.9.0 (measured: `node --version`) | — |
| MySQL | RIG-02 isolated schema | [ASSUMED: required, not probed] | — | None — MySQL is production requirement |
| `smol-toml` | TOML config parsing | ✗ (not yet installed) | 1.6.1 (latest) | `npm install smol-toml` in Wave 0 |
| `tar` (npm) | `buildExportTarball` | ✓ | In grid/package.json and root package.json | — |
| `@noble/hashes` | SHA-256 for `chain_tail_hash` | ✓ | Node.js built-in `node:crypto` sufficient | — |
| Python 3.12 | `FixtureBrainAdapter` | [ASSUMED] | — | — |

**Missing dependencies with no fallback:**
- MySQL (production requirement — assumed present by Phase 14)

**Missing dependencies with fallback:**
- `smol-toml` — must be installed in Wave 0 (`npm install smol-toml`)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (grid) + pytest (brain) |
| Config file | No explicit vitest.config — uses package.json `"test": "vitest run"` |
| Quick run command | `cd grid && npx vitest run test/rig/` |
| Full suite command | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RIG-01 | TOML config parses to GenesisConfig; gridName matches schema convention | unit | `npx vitest run test/rig/toml-config.test.ts -x` | ❌ Wave 0 |
| RIG-01 | Zero code divergence: rig.mjs does not import buildServer or wsHub | CI grep | `node scripts/check-rig-invariants.mjs` | ❌ Wave 0 |
| RIG-02 | MySQL schema created with deterministic name; MigrationRunner runs | integration | `npx vitest run test/rig/schema.test.ts -x` | ❌ Wave 0 |
| RIG-02 | Nested Rig rejected (NOESIS_RIG_PARENT set) | unit | `npx vitest run test/rig/nested-rejection.test.ts -x` | ❌ Wave 0 |
| RIG-02 | Schema name matches `rig_{name}_{seed8}` pattern | unit | `npx vitest run test/rig/schema-name.test.ts -x` | ❌ Wave 0 |
| RIG-03 | FixtureBrainAdapter serves JSONL record by key | unit (Python) | `cd brain && pytest test/test_fixture_adapter.py -x` | ❌ Wave 0 |
| RIG-03 | Strict cache-miss raises fatal error; --permissive returns stub | unit (Python) | `cd brain && pytest test/test_fixture_adapter.py::test_cache_miss -x` | ❌ Wave 0 |
| RIG-03 | No network path reachable when NOESIS_FIXTURE_MODE=1 | CI grep | `node scripts/check-rig-invariants.mjs` (extended check) | ❌ Wave 0 |
| RIG-04 | p99 emit latency <1ms for audit.append() with all listeners | microbenchmark | `npx vitest run test/rig/producer-bench.test.ts -x` | ❌ Wave 1 |
| RIG-04 | 50 Nous × 10k ticks completes in <60 min | smoke (nightly) | `npx vitest run test/rig/rig-bench.test.ts -x` | ❌ Wave 2 |
| RIG-05 | chronos.rig_closed payload has exactly 5 keys; exit_reason in enum | unit | `npx vitest run test/rig/rig-closed-event.test.ts -x` | ❌ Wave 0 |
| RIG-05 | chronos.rig_closed NOT in production allowlist | CI grep | `node scripts/check-state-doc-sync.mjs` | Partial (existing gate, needs extension) |
| RIG-05 | Tarball hash matches replay-verify output | integration | `npx vitest run test/rig/tarball-integrity.test.ts -x` | ❌ Wave 1 |
| RIG-05 | check-rig-invariants.mjs: no --skip/--bypass/--disable in rig code | CI grep | `node scripts/check-rig-invariants.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd grid && npx vitest run test/rig/` (unit tests only)
- **Per wave merge:** `cd grid && npx vitest run` (full grid suite) + `cd brain && pytest` (full brain suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`
- **Nightly smoke:** `.github/workflows/nightly-rig-bench.yml` runs 50×10k benchmark (RIG-04)

### Wave 0 Gaps
- [ ] `grid/test/rig/toml-config.test.ts` — covers RIG-01 TOML→GenesisConfig mapping
- [ ] `grid/test/rig/schema-name.test.ts` — covers RIG-02 deterministic schema naming
- [ ] `grid/test/rig/nested-rejection.test.ts` — covers RIG-02 NOESIS_RIG_PARENT guard
- [ ] `grid/test/rig/rig-closed-event.test.ts` — covers RIG-05 chronos.rig_closed shape
- [ ] `brain/test/test_fixture_adapter.py` — covers RIG-03 FixtureBrainAdapter
- [ ] `scripts/check-rig-invariants.mjs` — covers T-10-12 + T-10-13 grep gates
- [ ] Framework install: `npm install smol-toml` — TOML parsing dependency

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Rigs are local researcher tools; no auth surface |
| V3 Session Management | No | Headless; no sessions |
| V4 Access Control | Partial | `NOESIS_RIG_PARENT` env guard prevents nested Rigs; operator tier cap enforced in config |
| V5 Input Validation | Yes | TOML config field validation (seed format, tick_budget bounds, manifest path existence) |
| V6 Cryptography | Yes | `chain_tail_hash` uses SHA-256 via `node:crypto` — never hand-rolled |

### Known Threat Patterns for Rig Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bypass flag injection (`--skip-audit`) | Tampering | `check-rig-invariants.mjs` grep gate; no bypass flags in rig code |
| WsHub/httpServer opened by accident | Elevation of privilege | `check-rig-invariants.mjs` grep for `httpServer.listen`, `wsHub` symbols in `rig.mjs` |
| Fixture mode disabled silently | Tampering | `NOESIS_FIXTURE_MODE=1` env var + grep gate on `brain/src/llm/**` network call paths |
| Plaintext Telos in `--full-state` export | Information disclosure | Verbatim-locked consent prompt (T-10-16 defense); planner defines exact copy |
| `chronos.rig_closed` added to production allowlist | Tampering | `check-state-doc-sync.mjs` extended with `rig.*`/`chronos.*` prefix ban (complement to existing `replay.*` ban) |
| Nested Rig creating double-isolated chain | Tampering | `NOESIS_RIG_PARENT` env var guard at `rig.mjs` entry (D-14-02) |

---

## Sources

### Primary (HIGH confidence)
- `grid/src/genesis/launcher.ts` — GenesisLauncher full constructor and subsystem wiring [VERIFIED: codebase read 2026-04-28]
- `grid/src/genesis/types.ts` — GenesisConfig, SeedNous interfaces [VERIFIED: codebase read 2026-04-28]
- `grid/src/export/tarball-builder.ts` — buildExportTarball 8-discipline deterministic build [VERIFIED: codebase read 2026-04-28]
- `grid/src/export/manifest.ts` — createManifest, ExportManifest shape [VERIFIED: codebase read 2026-04-28]
- `grid/src/replay/replay-grid.ts` — in-memory transport pattern; T-10-12 defense [VERIFIED: codebase read 2026-04-28]
- `grid/src/clock/ticker.ts` — WorldClock.advance() public method [VERIFIED: codebase read 2026-04-28]
- `grid/src/integration/grid-coordinator.ts` — GridCoordinator tick dispatch pattern [VERIFIED: codebase read 2026-04-28]
- `brain/src/noesis_brain/llm/base.py` — LLMAdapter ABC target for FixtureBrainAdapter [VERIFIED: codebase read 2026-04-28]
- `brain/src/noesis_brain/llm/router.py` — ModelRouter.register_tier() [VERIFIED: codebase read 2026-04-28]
- `brain/src/noesis_brain/llm/types.py` — ModelTier, LLMResponse, GenerateOptions shapes [VERIFIED: codebase read 2026-04-28]
- `grid/src/db/migration-runner.ts` — MigrationRunner.run() pattern [VERIFIED: codebase read 2026-04-28]
- `scripts/check-replay-readonly.mjs` — grep gate pattern to clone [VERIFIED: codebase read 2026-04-28]
- `scripts/check-wallclock-forbidden.mjs` — TIER_B_TS_ROOTS extension pattern [VERIFIED: codebase read 2026-04-28]
- `scripts/check-state-doc-sync.mjs` — allowlist count assertion, replay.* prefix ban pattern [VERIFIED: codebase read 2026-04-28]
- `grid/test/relationships/perf-10k.test.ts` — microbenchmark pattern with process.hrtime.bigint() [VERIFIED: codebase read 2026-04-28]
- npm registry — smol-toml@1.6.1 [VERIFIED: npm view 2026-04-28]
- Node.js timing measurement — setInterval(fn, 0) = ~1ms/tick [VERIFIED: measured locally 2026-04-28]

### Secondary (MEDIUM confidence)
- `.planning/phases/14-researcher-rigs/14-CONTEXT.md` — all D-14-xx decisions, requirements, canonical refs [VERIFIED: codebase read 2026-04-28]
- `.planning/REQUIREMENTS.md` — RIG-01..RIG-05 full text [VERIFIED: codebase read 2026-04-28]
- `.planning/phases/13-operator-replay-export/13-CONTEXT.md` — tarball determinism discipline to inherit [VERIFIED: codebase read 2026-04-28]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified in codebase and npm registry
- Architecture: HIGH — all building blocks verified in codebase; open question on GridCoordinator async tick signal is documented explicitly
- Pitfalls: HIGH — directly derived from CONTEXT.md T-10-12..T-10-16 risks with code verification

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable, grid codebase is the authoritative source)
