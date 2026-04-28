# Phase 14: Researcher Rigs — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/rig.mjs` | utility/CLI | batch (tick loop + I/O) | `grid/src/genesis/launcher.ts` + `grid/src/replay/replay-grid.ts` | role-match (composition) |
| `scripts/check-rig-invariants.mjs` | utility/CI | transform | `scripts/check-replay-readonly.mjs` | exact |
| `grid/src/rig/types.ts` | model | N/A | `grid/src/genesis/types.ts` | exact |
| `brain/src/noesis_brain/llm/fixture.py` | service | request-response | `brain/src/noesis_brain/llm/base.py` (ABC) | exact (implement) |
| `grid/test/rig/*.test.ts` | test | N/A | `grid/test/genesis.test.ts` + `grid/test/ci/bios-no-walltime.test.ts` | exact |
| `brain/test/test_fixture_adapter.py` | test | N/A | `brain/test/test_llm_claude.py` | exact |
| `config/rigs/*.toml` | config | N/A | `config/genesis/grid.yaml` | role-match |
| `.github/workflows/nightly-rig-bench.yml` | config/CI | N/A | (no existing workflow — new pattern) | no-analog |
| `sql/014_rig_schema.sql` or inline rig migration | migration | N/A | `grid/src/db/migration-runner.ts` + `grid/src/db/schema.ts` | role-match |

---

## Pattern Assignments

### `scripts/rig.mjs` (utility/CLI, batch tick loop)

**Primary analog:** `grid/src/genesis/launcher.ts` (GenesisLauncher constructor + bootstrap pattern)
**Secondary analog:** `grid/src/replay/replay-grid.ts` (no-network-server principle, in-memory transport discipline)

**Imports pattern** — follow ESM `node:` built-in style and internal workspace imports:
```javascript
// Source: grid/src/genesis/launcher.ts (lines 8-24) and scripts/check-replay-readonly.mjs (lines 27-28)
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
// Internal grid imports:
import { GenesisLauncher } from '../grid/src/genesis/launcher.js';
import { buildExportTarball } from '../grid/src/export/tarball-builder.js';
import { createManifest } from '../grid/src/export/manifest.js';
import { canonicalStringify } from '../grid/src/export/canonical-json.js';
import { DatabaseConnection, MigrationRunner } from '../grid/src/db/index.js';
```

**Nested Rig rejection guard** (D-14-02) — check at entry before any work:
```javascript
// Pattern: early-exit env guard (mirrors check-state-doc-sync.mjs existsSync guard, line 38)
if (process.env.NOESIS_RIG_PARENT) {
    console.error('[rig] ERROR: Nested Rig detected (NOESIS_RIG_PARENT is set). Rig invocation from inside a Rig is forbidden.');
    process.exit(1);
}
process.env.NOESIS_RIG_PARENT = '1';
```

**MySQL rig schema creation** (D-14-01) — clone of main.ts MigrationRunner pattern:
```javascript
// Source: grid/src/db/migration-runner.ts MigrationRunner.run() (lines 19-38)
// and grid/src/genesis/launcher.ts DatabaseConnection usage
const schemaName = `rig_${configName}_${seed.slice(0, 8)}`;
const adminDb = new DatabaseConnection({ host, port, user, password, database: 'information_schema' });
await adminDb.execute(`CREATE SCHEMA IF NOT EXISTS \`${schemaName}\``);
const rigDb = new DatabaseConnection({ host, port, user, password, database: schemaName });
const runner = new MigrationRunner(rigDb);
const applied = await runner.run();  // returns count of applied migrations
```

**GenesisLauncher construction** (RIG-01 zero code divergence) — pass GenesisConfig directly:
```javascript
// Source: grid/src/genesis/launcher.ts constructor (lines 95-138)
// and grid/src/genesis/types.ts GenesisConfig interface (lines 10-35)
const config = {
    gridName: schemaName,                        // rig_{configName}_{seed8}
    gridDomain: 'rig.noesis',
    tickRateMs: parsedToml.tick_rate_ms ?? 0,    // D-14-07: headless default = 0
    ticksPerEpoch: 100,
    regions: PRODUCTION_REGIONS,
    connections: PRODUCTION_CONNECTIONS,
    laws: PRODUCTION_LAWS,
    economy: {},
    seedNous: parsedManifest,                    // from [[nous_manifest]] or JSONL
};
const launcher = new GenesisLauncher(config);
// NO buildServer(), createGridApp(), httpServer.listen, wsHub — T-10-12 defense
```

**Direct tick loop** (RIG-04 — never use setInterval) — WorldClock.advance() is public (ticker.ts line 70):
```javascript
// Source: grid/src/clock/ticker.ts advance() (lines 70-91)
// Source: grid/src/integration/grid-coordinator.ts start() (lines 38-66) — clock.onTick pattern
// The coordinator's onTick listener fires synchronously but runs async runners.
// rig.mjs must await all runners completing per tick before advancing.
coordinator.start();   // wires clock.onTick → async runner dispatch
for (let t = 0; t < tickBudget; t++) {
    const tickDone = new Promise(resolve => { /* one-shot resolver injected */ });
    const event = launcher.clock.advance();   // fires onTick synchronously
    await tickDone;                           // wait for all 50 Nous runners to complete
    if (launcher.registry.count === 0) { exitReason = 'all_nous_dead'; break; }
    if (h5TerminateSignaled) { exitReason = 'operator_h5_terminate'; break; }
}
const finalTick = launcher.clock.currentTick;
exitReason ??= 'tick_budget_exhausted';
```

**chronos.rig_closed emission** (D-14-08) — audit.append on isolated chain only:
```javascript
// Source: grid/src/genesis/launcher.ts bootstrap() (lines 212-237) — audit.append pattern
// Source: grid/src/export/canonical-json.ts canonicalStringify (line 22)
// Source: grid/src/export/tarball-builder.ts createHash usage (line 29)
const lastEntry = launcher.audit.all().at(-1);
const chainTailHash = createHash('sha256')
    .update(canonicalStringify(lastEntry))
    .digest('hex');

launcher.audit.append('chronos.rig_closed', 'system', {
    seed,
    tick: finalTick,
    exit_reason: exitReason,          // 'tick_budget_exhausted' | 'all_nous_dead' | 'operator_h5_terminate'
    chain_entry_count: launcher.audit.length,
    chain_tail_hash: chainTailHash,
});
// NEVER added to production broadcast-allowlist.ts — D-14-08
```

**Tarball exit snapshot** (RIG-05) — buildExportTarball called unchanged:
```javascript
// Source: grid/src/export/tarball-builder.ts ExportTarballInputs interface (lines 38-43)
// Source: grid/src/export/manifest.ts createManifest (lines 44-72)
const chainEntries = launcher.audit.all();
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
// Write to disk: rig_{configName}_{seed8}_{timestamp}.tar
```

---

### `scripts/check-rig-invariants.mjs` (utility/CI, transform)

**Analog:** `scripts/check-replay-readonly.mjs` — clone this file exactly, adapting three things.

**Full structure to clone** (lines 1-87 of `scripts/check-replay-readonly.mjs`):
```javascript
// Source: scripts/check-replay-readonly.mjs (entire file — 87 lines)
// Clone the walkTs() generator, the FORBIDDEN_RE regex, the violation-reporting loop,
// and the exit-code contract.

// Adapted scan roots (replace SCAN_DIR):
const ROOT = process.cwd();
const RIG_SCRIPT = join(ROOT, 'scripts', 'rig.mjs');
const RIG_SRC_DIR = join(ROOT, 'grid', 'src', 'rig');

// Adapted forbidden patterns for T-10-12 (network symbols in rig.mjs):
const NETWORK_SYMBOLS_RE = /httpServer\.listen|wsHub/g;

// Adapted forbidden patterns for T-10-13 (bypass flags in rig code):
// Note: --permissive is NOT in this list per D-14-05
const BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g;
```

**Comment exclusion pattern** — copy exactly from analog (lines 62-68 of check-replay-readonly.mjs):
```javascript
// Source: scripts/check-replay-readonly.mjs lines 62-68
// Skip comment lines — the gate targets code-level violations only.
const trimmed = line.trim();
if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    continue;
}
```

**Exit code contract** (lines 78-87 of check-replay-readonly.mjs):
```javascript
// Source: scripts/check-replay-readonly.mjs lines 78-87
if (violations > 0) {
    console.error('');
    console.error(`check-rig-invariants: ${violations} violation(s) — T-10-12/T-10-13`);
    process.exit(1);
}
console.log(`check-rig-invariants: 0 violations ✓`);
process.exit(0);
```

---

### `grid/src/rig/types.ts` (model, N/A)

**Analog:** `grid/src/genesis/types.ts` — follow the same interface-only pattern with JSDoc comments referencing the decision that introduced each field.

**Interface style** (lines 1-57 of `grid/src/genesis/types.ts`):
```typescript
// Source: grid/src/genesis/types.ts (lines 1-57)
// File structure: copyright comment + imports + exported interfaces only.
// No classes. No implementations. Use `import type` for all cross-module refs.

import type { SeedNous } from '../genesis/types.js';

export interface RigConfig {
    /** D-14-01: deterministic schema name `rig_{config_name}_{seed_prefix_8chars}` */
    schemaName: string;
    /** D-14-03: seed for deterministic schema naming and tarball reproducibility */
    seed: string;
    /** D-14-07: 0 = headless benchmark; >0 = observable debugging run */
    tickRateMs: number;
    tickBudget: number;
    /** D-14-03: dual-format — inline [[nous_manifest]] OR external file path */
    nousManifest: SeedNous[];
    /** D-14-06: path to fixture JSONL; absent = live LLM (not allowed in CI) */
    llmFixturePath?: string;
    permissive?: boolean;
}

export type RigExitReason =
    | 'tick_budget_exhausted'
    | 'all_nous_dead'
    | 'operator_h5_terminate';

export interface RigClosedPayload {
    seed: string;
    tick: number;
    exit_reason: RigExitReason;
    chain_entry_count: number;
    chain_tail_hash: string;   // SHA-256 of last entry's canonicalStringify
}
```

**Extension to GenesisConfig** (`grid/src/genesis/types.ts`) — add optional rig fields:
```typescript
// Source: grid/src/genesis/types.ts GenesisConfig interface (lines 10-35)
// Pattern: optional fields with JSDoc citing the decision that added them.
// Follows the existing `dialogue?` and `relationship?` optional-field pattern (lines 22-35).

// Add to GenesisConfig:
/**
 * Phase 14 RIG-01: headless rig mode — tickRateMs=0 suppresses setInterval.
 * When truthy, rig.mjs drives the tick loop directly via clock.advance().
 */
headless?: boolean;
```

---

### `brain/src/noesis_brain/llm/fixture.py` (service, request-response)

**Analog:** `brain/src/noesis_brain/llm/base.py` (LLMAdapter ABC — implement all abstract methods) and `brain/test/test_llm_claude.py` (test structure to copy).

**ABC contract** — all four abstract methods must be implemented (lines 15-51 of base.py):
```python
# Source: brain/src/noesis_brain/llm/base.py (lines 10-59)
# FixtureBrainAdapter must implement: provider_name, generate(), list_models(), is_available()

from __future__ import annotations
import json
import sys
from pathlib import Path

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMResponse, ModelTier
```

**Class structure** — follow ClaudeAdapter pattern (test_llm_claude.py line 14-30 for constructor shape):
```python
# Source: brain/src/noesis_brain/llm/base.py (full ABC) + types.py LLMResponse (lines 30-38)
class FixtureBrainAdapter(LLMAdapter):
    """LLMAdapter that replays pre-recorded fixture JSONL records by key.

    Fixture JSONL record shape (D-14-04):
        {"key": "action_selection", "response_text": "MOVE agora", "tokens": 12, "tier": "PRIMARY"}

    D-14-05: strict mode (default) — unmatched key raises RuntimeError.
    D-14-06: registered as all three tiers in ModelRouter.
    """

    def __init__(self, fixture_path: str | Path, permissive: bool = False) -> None:
        self._records: dict[str, dict] = {}
        self._permissive = permissive
        path = Path(fixture_path)
        if not path.exists():
            raise LLMError('fixture', f'Fixture file not found: {fixture_path}')
        with path.open() as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as e:
                    raise LLMError('fixture', f'Invalid JSON at line {lineno}: {e}') from e
                if 'key' not in record:
                    raise LLMError('fixture', f'Fixture record at line {lineno} missing "key" field')
                self._records[record['key']] = record

    @property
    def provider_name(self) -> str:
        return 'fixture'

    async def generate(self, prompt: str, options: GenerateOptions | None = None) -> LLMResponse:
        key = (options.purpose if options else '') or ''
        record = self._records.get(key)
        if record is None:
            if self._permissive:
                print(f'[FIXTURE MISS] key="{key}"', file=sys.stderr)
                return LLMResponse(
                    text='[UNMATCHED FIXTURE]',
                    model='fixture',
                    provider='fixture',
                    usage={'prompt_tokens': 0, 'completion_tokens': 0},
                )
            # D-14-05: strict mode fatal error
            raise RuntimeError(
                f'[FIXTURE ERROR] No fixture record for key "{key}". '
                f'Run with --permissive to use stub.'
            )
        # D-14-04: key equality match; tier mismatch = authoring error
        expected_tier = record.get('tier', '').upper()
        if options and expected_tier and expected_tier != options.purpose.upper():
            # Tier mismatch: fixture was authored for a different tier
            raise RuntimeError(
                f'[FIXTURE ERROR] Tier mismatch for key "{key}": '
                f'fixture has tier="{expected_tier}", call site purpose="{options.purpose}".'
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

**ModelRouter registration** (D-14-06) — all three tiers:
```python
# Source: brain/src/noesis_brain/llm/router.py register_tier() (lines 30-32)
from noesis_brain.llm.types import ModelTier
adapter = FixtureBrainAdapter(fixture_path, permissive=permissive)
router.register_tier(ModelTier.SMALL, adapter)
router.register_tier(ModelTier.PRIMARY, adapter)
router.register_tier(ModelTier.LARGE, adapter)
```

---

### `grid/test/rig/*.test.ts` (tests, N/A)

**Primary analog:** `grid/test/genesis.test.ts` (describe/it/expect pattern with GenesisLauncher)
**Secondary analog:** `grid/test/ci/bios-no-walltime.test.ts` (CI grep gate test — walkTs + FORBIDDEN_PATTERNS pattern)

**Test file header** (copy from genesis.test.ts lines 1-4):
```typescript
// Source: grid/test/genesis.test.ts (lines 1-4)
import { describe, it, expect, afterEach } from 'vitest';
// For rig tests — add beforeEach as needed
import { beforeEach } from 'vitest';
```

**GenesisLauncher test pattern** (genesis.test.ts lines 5-62) — for `toml-config.test.ts` and `schema-name.test.ts`:
```typescript
// Source: grid/test/genesis.test.ts (lines 5-62)
// Clone: describe block, let launcher, afterEach(launcher?.stop()), bootstrap() pattern
describe('Rig TOML config → GenesisConfig mapping', () => {
    let launcher: GenesisLauncher;

    afterEach(() => {
        launcher?.stop();
    });

    it('derives schemaName from configName + seed prefix', () => {
        const schemaName = deriveSchemaName('small10', 'd4e5f6a7b8c9d0e1');
        expect(schemaName).toBe('rig_small10_d4e5f6a7');
    });
});
```

**CI grep gate test pattern** (bios-no-walltime.test.ts lines 1-82) — for `rig-invariants.test.ts`:
```typescript
// Source: grid/test/ci/bios-no-walltime.test.ts (lines 19-82)
// Clone: FORBIDDEN_PATTERNS array, walk() function, scanSubtree() function
const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    { name: 'httpServer.listen', regex: /\bhttpServer\.listen\b/ },
    { name: 'wsHub', regex: /\bwsHub\b/ },
    // bypass flags (T-10-13) — --permissive is NOT here per D-14-05
    { name: '--skip-*', regex: /--skip-[a-z]/ },
    { name: '--bypass-*', regex: /--bypass-[a-z]/ },
    { name: '--disable-*', regex: /--disable-[a-z]/ },
    { name: '--no-reviewer', regex: /--no-reviewer/ },
    { name: '--no-tier', regex: /--no-tier/ },
];
```

**Benchmark microbenchmark pattern** — `process.hrtime.bigint()` timing:
```typescript
// Source: 14-RESEARCH.md §Code Examples (perf-10k.test.ts pattern, verified 2026-04-28)
const start = process.hrtime.bigint();
rigChain.append('test.event', 'system', payload);
const end = process.hrtime.bigint();
const latencyMs = Number(end - start) / 1_000_000;
// Assert p99 < 1ms over N iterations with all listeners registered
```

---

### `brain/test/test_fixture_adapter.py` (test, N/A)

**Analog:** `brain/test/test_llm_claude.py` — copy structure exactly: class-based tests, `@pytest.mark.asyncio` for async methods, `pytest.raises` for error cases.

**Test file structure** (test_llm_claude.py lines 1-147):
```python
# Source: brain/test/test_llm_claude.py (lines 1-11) — imports pattern
import pytest
from noesis_brain.llm.fixture import FixtureBrainAdapter
from noesis_brain.llm.base import LLMError
from noesis_brain.llm.types import GenerateOptions, ModelTier
```

**Async test pattern** (test_llm_claude.py lines 55-75):
```python
# Source: brain/test/test_llm_claude.py (lines 55-75)
class TestFixtureBrainAdapter:
    @pytest.mark.asyncio
    async def test_generate_matches_key(self, tmp_path):
        fixture_file = tmp_path / 'fixtures.jsonl'
        fixture_file.write_text(
            '{"key":"action_selection","response_text":"MOVE agora","tokens":12,"tier":"PRIMARY"}\n'
        )
        adapter = FixtureBrainAdapter(fixture_file)
        opts = GenerateOptions(purpose='action_selection')
        resp = await adapter.generate('ignored prompt', opts)
        assert resp.text == 'MOVE agora'
        assert resp.provider == 'fixture'
```

**Error case pattern** (test_llm_claude.py lines 103-110):
```python
# Source: brain/test/test_llm_claude.py (lines 103-110) — pytest.raises pattern
    @pytest.mark.asyncio
    async def test_strict_cache_miss_raises(self, tmp_path):
        fixture_file = tmp_path / 'fixtures.jsonl'
        fixture_file.write_text('{"key":"action_selection","response_text":"X","tokens":0,"tier":"PRIMARY"}\n')
        adapter = FixtureBrainAdapter(fixture_file, permissive=False)
        opts = GenerateOptions(purpose='unknown_key')
        with pytest.raises(RuntimeError, match='FIXTURE ERROR.*unknown_key'):
            await adapter.generate('prompt', opts)
```

---

### `config/rigs/*.toml` (config, N/A)

**Analog:** `config/genesis/grid.yaml` — follow the same flat-section structure with comments per field. Use TOML syntax.

**TOML structure pattern** (derived from GenesisConfig fields, grid/src/genesis/types.ts lines 10-35):
```toml
# Source: config/genesis/grid.yaml structure + grid/src/genesis/types.ts GenesisConfig fields
# config/rigs/small-10.toml — dev/debug rig, 10 Nous × 1k ticks

[rig]
config_name = "small10"          # Used in schema name: rig_small10_{seed8}
seed = "d4e5f6a7b8c9d0e1f2a3b4c5"
tick_budget = 1000
tick_rate_ms = 0                 # D-14-07: 0 = as-fast-as-possible

[llm]
fixture_path = "fixtures/basic.jsonl"   # D-14-06: relative to this TOML file's dir

# D-14-03: inline manifest for ≤~10 Nous
[[nous_manifest]]
name = "sophia"
did = "did:noesis:sophia"
publicKey = "..."
region = "alpha"
```

---

### `.github/workflows/nightly-rig-bench.yml` (config/CI, N/A)

**No analog exists.** The `.github/workflows/` directory does not exist in this repository yet. Use standard GitHub Actions YAML patterns.

**GitHub Actions skeleton** (standard pattern, no codebase analog):
```yaml
# .github/workflows/nightly-rig-bench.yml
name: Nightly Rig Benchmark (RIG-04)
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC nightly
  workflow_dispatch:        # manual trigger for debugging

jobs:
  rig-bench:
    runs-on: ubuntu-latest
    timeout-minutes: 90     # RIG-04 target: <60min; 90min is the hard deadline

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run 50×10k rig benchmark
        run: node scripts/rig.mjs config/rigs/bench-50.toml
        env:
          NOESIS_MYSQL_HOST: localhost
          NOESIS_MYSQL_USER: test
          NOESIS_MYSQL_PASSWORD: test
```

---

### `sql/014_rig_schema.sql` / inline rig migration (migration, N/A)

**Analog:** `grid/src/db/migration-runner.ts` + the MIGRATIONS array in `grid/src/db/schema.ts` — inline migration pattern within a TypeScript array entry.

**Migration entry pattern** (migration-runner.ts lines 12-38):
```typescript
// Source: grid/src/db/migration-runner.ts (lines 12-38)
// Pattern: each MIGRATIONS entry has {version, name, up: string, down: string}
// Rig-specific migration should NOT be in the production MIGRATIONS array.
// Instead, rig.mjs applies it inline after MigrationRunner.run():

const RIG_SCHEMA_DDL = `
    CREATE TABLE IF NOT EXISTS rig_meta (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        config_name VARCHAR(64)  NOT NULL,
        seed        CHAR(64)     NOT NULL,
        exit_reason VARCHAR(32)  DEFAULT NULL,
        final_tick  INT UNSIGNED DEFAULT NULL,
        created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
    )
`;
// Apply after MigrationRunner.run():
await rigDb.execute(RIG_SCHEMA_DDL);
```

---

## Shared Patterns

### Node.js ESM Script Header
**Source:** `scripts/check-replay-readonly.mjs` (lines 1-35) and `scripts/check-wallclock-forbidden.mjs` (lines 1-38)
**Apply to:** `scripts/rig.mjs`, `scripts/check-rig-invariants.mjs`
```javascript
#!/usr/bin/env node
/**
 * [filename] — [one-line purpose]
 *
 * [Multi-line explanation of what this gate enforces and why.]
 *
 * Exit codes:
 *   0 — success
 *   1 — violation found / error
 *
 * See: [decision references]
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
```

### EXCLUDE_DIR_NAMES pattern
**Source:** `scripts/check-replay-readonly.mjs` (lines 33-34)
**Apply to:** `scripts/check-rig-invariants.mjs`
```javascript
// Source: scripts/check-replay-readonly.mjs lines 33-34
const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);
```

### Python LLM Adapter `from __future__ import annotations`
**Source:** `brain/src/noesis_brain/llm/base.py` (line 3) and `brain/src/noesis_brain/llm/router.py` (line 3) and `brain/src/noesis_brain/llm/types.py` (line 3)
**Apply to:** `brain/src/noesis_brain/llm/fixture.py`
```python
from __future__ import annotations
```
All brain LLM modules use this as the first line for forward-reference annotations.

### Vitest test imports
**Source:** `grid/test/genesis.test.ts` (line 1) and `grid/test/audit.test.ts` (line 1)
**Apply to:** All `grid/test/rig/*.test.ts` files
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
```

### LLMError construction
**Source:** `brain/src/noesis_brain/llm/base.py` (lines 54-59)
**Apply to:** `brain/src/noesis_brain/llm/fixture.py` constructor for file-not-found and bad JSON errors
```python
# Source: brain/src/noesis_brain/llm/base.py lines 54-59
class LLMError(Exception):
    """Raised when an LLM provider fails."""
    def __init__(self, provider: str, message: str) -> None:
        self.provider = provider
        super().__init__(f"[{provider}] {message}")
```

### audit.append eventType naming convention
**Source:** `grid/src/genesis/launcher.ts` bootstrap() (lines 214-236)
**Apply to:** `scripts/rig.mjs` — the `chronos.rig_closed` append call
```typescript
// Source: grid/src/genesis/launcher.ts lines 214-215
this.audit.append('nous.spawned', record.did, { ... });
// Pattern: 'domain.verb' eventType, actorDid as second arg, payload as third
// rig.mjs: launcher.audit.append('chronos.rig_closed', 'system', { ... })
```

### createHash SHA-256 for chain_tail_hash
**Source:** `grid/src/genesis/launcher.ts` (line 9: `import { createHash } from 'node:crypto'`)
**Apply to:** `scripts/rig.mjs` — chain_tail_hash derivation in chronos.rig_closed payload
```typescript
// Source: grid/src/genesis/launcher.ts lines 9, 38-39
import { createHash } from 'node:crypto';
// Usage:
createHash('sha256').update(`${input}`).digest('hex');
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/nightly-rig-bench.yml` | config/CI | N/A | No `.github/workflows/` directory exists in this repository; no existing CI workflow to clone |

---

## Metadata

**Analog search scope:** `scripts/`, `grid/src/genesis/`, `grid/src/export/`, `grid/src/replay/`, `grid/src/clock/`, `grid/src/db/`, `grid/src/integration/`, `grid/src/audit/`, `brain/src/noesis_brain/llm/`, `brain/test/`, `grid/test/`, `config/`
**Files scanned:** 22 files read; 5 searched via Glob/Bash
**Pattern extraction date:** 2026-04-28
