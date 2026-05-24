# Phase 31: Audit Pipeline Persistence — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 11 (7 new + 4 modified, plus opportunistic sweep)
**Analogs found:** 10 / 11

This map gives the planner concrete, line-numbered excerpts to copy from. Where Phase 31 *departs* from a precedent (most notably the post-construction setter pattern), the departure is called out so plans can document the rationale rather than discover it mid-implementation.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `grid/src/util/logger.ts` (NEW) | utility / singleton | transform (event → JSON stdout) | `grid/src/review/Reviewer.ts` | role-match (singleton shape) |
| `grid/src/db/audit-reconcile.ts` (NEW) | service / reconciliation | tick-driven batch | `grid/src/lore/LoreQuotaTracker.ts` + `grid/src/audit/firehose-hub.ts` | role-match (readonly field on launcher; tick-cadenced) |
| `scripts/backfill-audit-trail.mjs` (NEW) | utility script | REST read → MySQL write | `scripts/replay-verify.mjs` | role-match (one-shot CLI, ESM) |
| `scripts/check-no-silent-catch.mjs` (NEW) | CI gate | static analysis | `scripts/check-rig-invariants.mjs` | exact (regex over file globs, exit code on violation) |
| `grid/test/audit-persistence-wiring.test.ts` (NEW) | test | unit | existing `grid/test/*.test.ts` (vitest) | role-match |
| `grid/test/audit-reconcile.test.ts` (NEW) | test | unit | existing `grid/test/*.test.ts` (vitest) | role-match |
| `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` (NEW) | doc | n/a | prior phases' `*-HUMAN-UAT.md` | role-match |
| `grid/src/main.ts` (MODIFIED, lines 69–81) | composition root | construct & inject | (self — same file's `dbConn ?` conditional construction) | exact |
| `grid/src/genesis/launcher.ts` (MODIFIED, line 128–138, plus clock.onTick wire) | composition / DI | constructor injection + tick listener | (self — `attachRelationshipStorage` pattern is what we DEPART from) | departure |
| `grid/src/db/persistent-chain.ts` (MODIFIED, lines 30–42) | model | fire-and-forget mirror | (self — preserve `super.append()` first; replace only the `.catch` body) | surgical |
| `grid/package.json` (MODIFIED) | config | dep declaration | (self) | exact |

---

## Pattern Assignments

### `grid/src/util/logger.ts` (NEW — Pino singleton)

**Analog:** `grid/src/review/Reviewer.ts` — singleton shape (one instance per process, exported by name, with static enforcement). The Pino logger is structurally simpler than Reviewer (no static `constructed` flag because Pino itself returns idempotent child loggers), but the **export & import discipline is identical**.

**Singleton export pattern** (`grid/src/review/Reviewer.ts:1-16, 25-37`):

```typescript
// grid/src/review/Reviewer.ts — Phase 5 singleton reviewer (D-02, D-06, D-07, D-08).
//
// Design invariants:
//   • Singleton per process: second construction throws. Enforced via static `constructed` flag.
//   • Stable DID `did:noesis:reviewer` — grid-agnostic, passes Phase 1 DID regex.
//   • First-fail-wins dispatch: iterate CHECK_ORDER, return immediately on first handler failure.
//   • No async, no I/O, no RPC in review() — determinism required for zero-diff invariant (D-13).

import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import { CHECKS, CHECK_ORDER } from './registry.js';
import type { ReviewContext, ReviewResult } from './types.js';

export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(
        private readonly audit: AuditChain,
        private readonly registry: NousRegistry,
    ) {
        if (Reviewer.constructed) {
            throw new Error('ReviewerNous is a singleton — already constructed for this Grid.');
        }
        Reviewer.constructed = true;
    }
```

**What planner must replicate:**
- File-header JSDoc block documenting Phase 31 / D-31-B1 / D-31-B2 rationale (mirrors lines 1-10 of Reviewer.ts).
- Exported `logger` is a **module-scoped const** created via `pino({...})` at import time. Per-module scoping uses `logger.child({ module: 'persistent-chain' })` returned by the importer (NOT created in this file).
- Configuration is read once from env: `NOESIS_LOG_PRETTY=1` activates `pino-pretty` transport (devDeps only); default is raw JSON to stdout.

**What's variable:**
- Redact keys, base config keys (`pid`, `hostname`, `time`) are Claude's Discretion per CONTEXT.md.
- No singleton-flag enforcement needed — Pino returns idempotent child loggers and concurrent calls to `pino()` are tolerable (but we only call it once at module scope).

---

### `grid/src/db/audit-reconcile.ts` (NEW — tick-cadenced reconcile loop class)

**Analogs:**
1. `grid/src/lore/LoreQuotaTracker.ts` — class held as `readonly` field on `GenesisLauncher`; constructed once at launcher construction time; exposes simple per-instance state via methods/getters; no constructor-side I/O.
2. `grid/src/audit/firehose-hub.ts` — class subscribes once at construction (firehose: `audit.onAppend`; reconcile: `clock.onTick`); body wrapped in try/catch (defense-in-depth); never throws back into the listener.

**Readonly-field-on-launcher pattern** (`grid/src/lore/LoreQuotaTracker.ts:1-21`):

```typescript
/**
 * LoreQuotaTracker — Phase 20 LORE-03.
 * Enforces K=3 lore contributions per Nous per sleep epoch (30-tick boundary, D-20-03/D-20-13).
 * Grid boundary enforcement — NousRunner calls tryConsume before appendLoreContributed.
 *
 * Epoch = Math.floor(tick / epochLength). Resets automatically across epoch boundaries.
 * epochLength default = 30 (matches LORE_POLL_INTERVAL and Phase 16 sleep epoch).
 */
export class LoreQuotaTracker {
    /** Map<nousDid, Map<epoch, count>> */
    private readonly counts = new Map<string, Map<number, number>>();

    constructor(
        private readonly k: number = 3,
        private readonly epochLength: number = 30,
    ) {}
```

And, declared on the launcher (`grid/src/genesis/launcher.ts:116-122`):

```typescript
    /**
     * Phase 20 LORE-03 (D-20-03): LoreQuotaTracker — enforces K=3 lore contributions
     * per Nous per sleep epoch (30 ticks). Constructed once at launcher creation.
     *
     * Exposed as public readonly so callers can inject it as:
     *   new NousRunner(config, { loreDeps: { quotaTracker: launcher.loreQuotaTracker } })
     */
    readonly loreQuotaTracker: LoreQuotaTracker;
```

And constructed inside `GenesisLauncher.constructor` (launcher.ts:178-181):

```typescript
        // Phase 20 LORE-03 (D-20-03): Construct LoreQuotaTracker at Grid startup so
        // NousRunner can receive loreDeps: { quotaTracker: this.loreQuotaTracker } and
        // enforce K=3 per epoch. Default k=3, epochLength=30 (D-20-03/D-20-13).
        this.loreQuotaTracker = new LoreQuotaTracker();
```

**Try/catch defense-in-depth pattern** (`grid/src/audit/firehose-hub.ts:179-192` — the firehose listener that audit-reconcile.run() should mirror):

```typescript
    /**
     * Called from the audit listener. Never awaits. Never throws.
     * Enforces the broadcast allowlist — non-allowlisted entries are dropped.
     */
    private onAuditEvent(entry: AuditEntry): void {
        try {
            if (!isAllowlisted(entry.eventType)) return;
            for (const client of this._clients) {
                try {
                    client.enqueue(entry);
                } catch {
                    /* swallow per-client errors */
                }
            }
        } catch {
            /* swallow entire listener body (defense-in-depth) */
        }
    }
```

**What planner must replicate:**
- Class held as `readonly auditReconcile: AuditReconcile` on `GenesisLauncher` (mirrors `readonly loreQuotaTracker` at launcher.ts:122).
- Constructor takes `(store: IAuditStore, chain: AuditChain, gridName: string, logger: Logger)` — all dependencies injected, no module-level singletons reached from inside.
- Public readonly getters per D-31-C3: `get lastReconcileAt(): number`, `get persistedMaxId(): number | null`, `get lastPersistError(): { code: string; at: number } | null`.
- `run()` is async, never throws, always logs a heartbeat. Body wraps the MySQL query + replay loop in try/catch (mirrors firehose-hub.ts:179-192).
- Replay batch cap = 500 entries per cycle (D-31-C2).
- `INSERT IGNORE` re-uses the existing `AuditStore.append()` path (see analog below).

**Wiring into launcher** — re-uses the existing tick-listener pattern (`grid/src/genesis/launcher.ts:332-360`):

```typescript
        const relationshipCfgForTick = this.config.relationship ?? DEFAULT_RELATIONSHIP_CONFIG;
        this.clock.onTick(event => {
            for (const record of this.registry.active()) {
                this.registry.touch(record.did, event.tick);
            }
            this.audit.append('tick', 'system', {
                tick: event.tick,
                epoch: event.epoch,
                tickRateMs: this.clock.state.tickRateMs,
                timestamp: event.timestamp,
            });

            // Phase 12 Wave 3 — D-12-03: scan for proposals at deadline AFTER the tick
            // audit entry so proposal.tallied lands after the tick event in the chain.
            // Fire-and-forget (analogous to relationship snapshot scheduling) — the clock
            // is never blocked on async I/O.
            void this.governance.onTickClosed(event.tick);

            // D-9-03: Snapshot every N ticks (default 100). Fire-and-forget per OQ-2 —
            // tick is never blocked on MySQL I/O. Missed snapshots are losslessly
            // recoverable via rebuildFromChain() on restart.
            if (
                this.relationshipStorage &&
                event.tick > 0 &&
                event.tick % relationshipCfgForTick.snapshotCadenceTicks === 0
            ) {
                this.relationshipStorage.scheduleSnapshot(this.relationships.allEdges(), event.tick);
            }
        });
```

**What planner must replicate (verbatim style):**
- Add ONE more block inside the same `this.clock.onTick(event => {...})` body. Do NOT create a second `onTick` subscription — co-locate with relationship snapshot scheduling.
- The block: `if (this.auditReconcile && event.tick > 0 && event.tick % 60 === 0) { void this.auditReconcile.run(); }`.
- Use `void` to make fire-and-forget explicit (matches line 348 `void this.governance.onTickClosed(...)`).
- Comment block in the same style as lines 343-352, citing OBS-02 and D-31-C3/C4.

---

### `INSERT IGNORE` reuse — `grid/src/db/stores/audit-store.ts:15-33`

```typescript
    async append(gridName: string, entry: AuditEntry): Promise<void> {
        await this.db.execute(
            `INSERT IGNORE INTO audit_trail
                (grid_name, id, event_type, actor_did, target_did,
                 payload, prev_hash, event_hash, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                gridName,
                entry.id ?? 0,
                entry.eventType,
                entry.actorDid,
                entry.targetDid ?? null,
                JSON.stringify(entry.payload),
                entry.prevHash,
                entry.eventHash,
                entry.createdAt,
            ],
        );
    }
```

**What planner must replicate:** `AuditReconcile.run()` calls `this.store.append(this.gridName, entry)` for each missing tail entry — does NOT write its own SQL. Reuse keeps the `INSERT IGNORE` clause in exactly one place. The reconcile loop's responsibility is purely *which entries to replay*; the *how to write* belongs to `AuditStore`.

---

### `grid/src/main.ts` (MODIFIED — construct chain BEFORE launcher)

**Analog (self):** existing `dbConn ?` conditional construction at `main.ts:76-81`:

```typescript
    let store: GridStore | undefined;
    let dbConn: DatabaseConnection | undefined;

    // Connect to DB + run migrations if configured
    if (config.db) {
        dbConn = new DatabaseConnection(config.db);
        const runner = new MigrationRunner(dbConn);
        await runner.run();
        store = new GridStore(dbConn);
    }
```

And the launcher construction at `main.ts:69-70`:

```typescript
export async function createGridApp(config: GridAppConfig): Promise<GridApp> {
    const launcher = new GenesisLauncher(config.genesisConfig);
```

**What planner must do:**
- Move `new GenesisLauncher(config.genesisConfig)` to AFTER the `if (config.db) {...}` block.
- Inside the `if (config.db)` block, after `await runner.run();`, construct `const auditStore = new AuditStore(dbConn);` and `const chain = new PersistentAuditChain(auditStore, config.genesisConfig.gridName);` (per the sketch in CONTEXT.md D-31-A1).
- Pass `deps` arg: `const launcher = new GenesisLauncher(config.genesisConfig, chain ? { audit: chain } : undefined);`
- The `chain` variable is `PersistentAuditChain | undefined` — `undefined` keeps the no-DB unit-test path working unchanged.
- Import `AuditStore` and `PersistentAuditChain` from `./db/index.js` (verify these are exported there; if not, plan adds the export).

---

### `grid/src/genesis/launcher.ts` (MODIFIED — accept optional `deps` arg)

**Existing constructor signature** (`grid/src/genesis/launcher.ts:128`):

```typescript
    constructor(private readonly config: GenesisConfig) {
```

**Existing audit construction** (`grid/src/genesis/launcher.ts:138`):

```typescript
        this.audit = new AuditChain();
```

**What planner must replicate:**
- New constructor signature: `constructor(private readonly config: GenesisConfig, deps?: GenesisLauncherDeps)` where `GenesisLauncherDeps = { audit?: AuditChain }`.
- Change line 138 to: `this.audit = deps?.audit ?? new AuditChain();`
- `GenesisLauncherDeps` type is declared at the top of `launcher.ts` (near line 28 next to the existing `GenesisConfig`/`GridState` imports) and exported so `main.ts` can use it.
- Listener constructions at lines 147, 154, 168, 177 stay unchanged — they bind to `this.audit` which now points at the injected chain.

**Departure from prior pattern — `attachRelationshipStorage`:** Phase 31 does NOT use a post-construction setter for the audit chain. The precedent setter is at `launcher.ts:198-210`:

```typescript
    attachRelationshipStorage(pool: Pool): void {
        if (this.relationshipStorage !== null) {
            // Idempotent-by-reference: same pool is fine, different pool is a bug.
            // We compare the wrapped pool via a stored reference, exposed as getter.
            if (this.relationshipStorage.pool === pool) {
                return;
            }
            throw new Error(
                'GenesisLauncher.attachRelationshipStorage called twice with different pools',
            );
        }
        this.relationshipStorage = new RelationshipStorage(pool);
    }
```

**Why the departure (must be documented in the plan):** The listeners constructed at launcher.ts:147, 154, 168, 177 (DialogueAggregator, RelationshipListener, NormDetector, GovernanceEngine) bind to `this.audit` **synchronously inside the constructor**. Additionally, `main.ts:109` constructs `new Reviewer(launcher.audit, ...)` post-construction; the firehose hub later binds via `audit.onAppend` inside `buildServerWithHub`. A post-construction `attachAuditChain(chain)` would either:
- Leave the in-constructor listeners bound to the OLD plain `AuditChain` while the new `PersistentAuditChain` runs in parallel — **broken zero-diff invariant**; or
- Require every listener to be re-bound and the old chain copied entry-by-entry to the new one — fragile, error-prone, and dependent on construction order.

Constructor injection avoids both. The `attachRelationshipStorage` pattern remains valid for Phase 32+ (HealthWatchdog), where listeners do not exist at construction time.

---

### `grid/src/db/persistent-chain.ts` (MODIFIED — replace console.warn at line 35-38)

**Existing `console.warn` line (verbatim, lines 30-39)** — REPLACE EXACTLY this:

```typescript
        // Write to in-memory chain first (synchronous, source of truth)
        const entry = super.append(eventType, actorDid, payload, targetDid);

        // Mirror to store asynchronously (fire-and-forget)
        this.store.append(this.gridName, entry).catch(err =>
            console.warn(
                `[PersistentAuditChain] Failed to persist entry ${entry.id} (${eventType}):`,
                err,
            ),
        );
```

**What planner must replicate (the replacement, per D-31-B3 and OBS-03):**

```typescript
        // Write to in-memory chain first (synchronous, source of truth)
        const entry = super.append(eventType, actorDid, payload, targetDid);

        // Mirror to store asynchronously (fire-and-forget). On failure:
        // structured Pino log + record lastPersistError for /health/detailed (Phase 32).
        // NOTE: super.append() above already fired listeners synchronously — the
        // zero-diff invariant (chain.ts:51-58) is preserved regardless of DB outcome.
        this.store.append(this.gridName, entry).catch(err => {
            const code = (err as { code?: string })?.code ?? 'UNKNOWN';
            this._lastPersistError = { code, at: Date.now() };
            this.logger.warn({
                event: 'audit_persist_failed',
                entry_id: entry.id,
                event_type: eventType,
                error_message: err instanceof Error ? err.message : String(err),
                error_code: code,
            }, 'failed to persist audit entry');
        });
```

**Additional surface (D-31-C3) — add the `lastPersistError` getter to `PersistentAuditChain`:**

```typescript
    private _lastPersistError: { code: string; at: number } | null = null;
    get lastPersistError(): { code: string; at: number } | null {
        return this._lastPersistError;
    }
```

**Logger injection:** the class gains `private readonly logger = baseLogger.child({ module: 'persistent-chain' });` at the top of the class body. `baseLogger` is the singleton imported at the top of the file: `import { logger as baseLogger } from '../util/logger.js';`.

---

### Zero-diff invariant — `grid/src/audit/chain.ts:44-58` (DO NOT TOUCH)

**Verbatim (the listener fan-out ordering)** — this is the line range planner must NOT modify. PersistentAuditChain's behavior depends on it being unchanged:

```typescript
        // Commit FIRST — observers see a consistent chain.
        this.entries.push(entry);
        this.lastHash = eventHash;

        // Fan-out AFTER commit. Per-listener try/catch: a broken observer
        // must never corrupt chain state nor throw out of append().
        // (Mirrors WorldClock.onTick — see grid/src/clock/ticker.ts:55-61.)
        for (const listener of this.appendListeners) {
            try {
                listener(entry);
            } catch {
                // Swallow — see PITFALLS.md C1. Observability of listener
                // errors is deferred to Phase 2+ (per 01-CONTEXT.md decisions).
            }
        }

        return entry;
    }
```

**Why it matters for Phase 31:** `PersistentAuditChain.append()` (persistent-chain.ts:31) calls `super.append(...)` FIRST. `super.append()` (chain.ts:45-46) commits the entry and updates `lastHash`, THEN fires listeners (chain.ts:51-58). Only AFTER all of that does control return to `PersistentAuditChain.append()`, which then schedules the fire-and-forget DB write. The regression test `audit-persistence-wiring.test.ts` (per CONTEXT.md Claude's-discretion item 'c') asserts chain head hash is byte-identical with vs without DB attached — this only holds because the order is in-memory commit → listener fan-out → DB write, in that order.

---

### `scripts/check-no-silent-catch.mjs` (NEW — CI gate)

**Analog (exact match):** `scripts/check-rig-invariants.mjs` — regex over file globs, walkDir helper, exit code on violation, EXCLUDE_DIR / EXCLUDE_FILE patterns.

**Excerpt from `scripts/check-rig-invariants.mjs` (lines 1-50, 62-94):**

```javascript
#!/usr/bin/env node
/**
 * scripts/check-rig-invariants.mjs
 *
 * CI gate enforcing T-10-12 (no httpServer/wsHub in rig code) and T-10-13 (no bypass flags).
 * Cloned from scripts/check-replay-readonly.mjs pattern.
 *
 * RULE 1 (T-10-12): scripts/rig.mjs must NOT reference httpServer.listen or wsHub.
 *   Defense: prevents headless rig from accidentally opening a network surface.
 *
 * Exit codes:
 *   0 — no violations found, rig code is clean.
 *   1 — at least one violation found; output identifies file:line:match.
 *
 * Excludes: *.test.ts, *.d.ts, node_modules/, dist/, build/, .next/
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RIG_SCRIPT = join(ROOT, 'scripts', 'rig.mjs');
const RIG_BENCH_RUNNER = join(ROOT, 'scripts', 'rig-bench-runner.mjs');
const RIG_SRC_DIR = join(ROOT, 'grid', 'src', 'rig');

const SCAN_TARGETS = [RIG_SCRIPT, RIG_BENCH_RUNNER];

const FORBIDDEN_SYMBOLS_RE = /httpServer\.listen|wsHub/g;
const BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g;

const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
            yield* walkDir(p);
        } else if (e.isFile() && /\.(ts|mjs|js)$/.test(e.name)) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}

function scanFile(filePath, rules) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines — the gate targets code-level violations only.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
        for (const { name, re } of rules) {
            re.lastIndex = 0;
            if (re.test(line)) {
                violations.push({ file: relative(ROOT, filePath), line: i + 1, rule: name, text: line.trim() });
            }
        }
    }
    return violations;
}
```

**What planner must replicate:**
- Shebang `#!/usr/bin/env node` + module-level JSDoc citing OBS-03 / D-31-B3 / "Phase 31 Audit Pipeline Persistence".
- `SCAN_DIRS = [join(ROOT, 'grid', 'src', 'db'), join(ROOT, 'grid', 'src', 'audit')];` (scope per CONTEXT.md — broader rollout deferred).
- Same `walkDir` generator and `scanFile` helper (clone verbatim).
- Same `EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/]` and `EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next'])`.
- Same comment-line skip (`trimmed.startsWith('//') || ...`).
- Same exit code contract: `0` clean, `1` violations (with `file:line:rule:text` table printed).

**The forbidden regex is the variable part** (planner's discretion per CONTEXT.md item 'c'). At minimum, the regex must match the canonical `.catch(err => console.warn(...))` shape but also:
- `.catch(e => console.log(...))`
- `.catch((err) => console.warn(...))` (parens)
- `.catch(err => { console.warn(...); })` (block body)
- multiline `.catch(...)` calls

Suggested starting pattern: `/\.catch\s*\(\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*\{?\s*console\.(?:warn|log|debug|error)\b/`. The plan should include test fixtures (positive: shape in persistent-chain.ts:35-38 PRE-fix; negative: structured Pino call, plain console.log outside .catch).

---

### `scripts/backfill-audit-trail.mjs` (NEW — one-shot backfill CLI)

**Analog:** `scripts/replay-verify.mjs` — ESM `.mjs` with top-level work, `import { ... } from 'node:fs'`, `createHash`, CLI exit codes documented at top of file.

**Excerpt from `scripts/replay-verify.mjs` (lines 1-47):**

```javascript
#!/usr/bin/env node
/**
 * scripts/replay-verify.mjs
 *
 * REPLAY-01 verification CLI.
 *
 * Given a tarball produced by `grid/src/export/tarball-builder.ts`, this
 * tool reads the file, extracts its embedded `manifest.json`, rebuilds the
 * canonical pass-1 tarball (identical to what the producer hashed during its
 * first pass), recomputes the SHA-256, and compares it to `manifest.tarball_hash`.
 *
 * Exit codes:
 *   0  — verified; rebuild hash matches manifest.tarball_hash.
 *   1  — verification failed; hashes differ (tampering or non-canonical producer).
 *   2  — tarball is missing one of the four expected entries.
 *   3  — manifest.json could not be parsed as JSON.
 *   4  — manifest.tarball_hash does not match HEX64_RE.
 *  64  — usage error (no path provided or file not found).
 */

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
```

**What planner must replicate:**
- Shebang + JSDoc header citing OBS-04 / D-31-D1 / D-31-D2.
- Documented exit code table at top: `0` success, `1` REST fetch failed, `2` mysql connect failed, `3` divergence > limit and `--limit` was not provided, `64` usage error.
- Required flags per D-31-D1: `--grid`, `--rest-url`, `--since` (optional), `--limit` (optional), `--dry-run` (optional).
- `mysql2/promise` direct connection (mirrors `grid/src/db/connection.ts`'s pool config; no need to import grid TS).
- REST client uses native `fetch` (Node 22 has it; grid's `engines.node` is `>=20` which also has it).
- `INSERT IGNORE` matches the SQL at `audit-store.ts:17-20` — copy the column list verbatim so the script and the live writer are identical.
- `--dry-run` prints divergence + first/last entries that would be inserted; never opens a write transaction.
- ESM with top-level await OK (per CONTEXT.md Claude's-discretion item 'e').

**Pagination strategy (Claude's discretion per CONTEXT.md item 'd'):** page size 100. The grid REST endpoint `GET /api/v1/audit/trail?limit=N` does not currently support cursor pagination, so the script uses `?limit=N&offset=...` until the response is shorter than `limit`. (If a cursor is added later, swap in `?after=<id>`.)

---

### `grid/test/audit-persistence-wiring.test.ts` + `grid/test/audit-reconcile.test.ts` (NEW)

**Analog:** any existing `grid/test/*.test.ts` (vitest). Plan should follow standard vitest shape (no special pattern needed). Coverage per CONTEXT.md Claude's-discretion item 'g':

| Test | Asserts |
|------|---------|
| (a) launcher.audit is `PersistentAuditChain` when db configured | `expect(launcher.audit.constructor.name).toBe('PersistentAuditChain')` after `createGridApp({ ...config, db: testDbConfig })` |
| (b) launcher.audit is plain `AuditChain` when db absent | mirror with `db: undefined` |
| (c) chain head hash identical with/without DB attached after N appends (zero-diff regression) | construct two launchers, append the same N events to each, assert `launcher1.audit.head === launcher2.audit.head` |
| (d) AuditReconcile replay batch cap = 500 entries per cycle | populate chain with 1000 entries, run reconcile once, assert exactly 500 INSERT IGNORE calls observed (mock store) |
| (e) divergence > threshold logs at warn level | mock logger, assert `logger.warn` called when divergence > 10; `logger.info` when divergence ≤ 10 |
| (f) INSERT IGNORE idempotency | call `store.append` twice with the same entry, assert no error and row count unchanged (uses test mysql container OR mock store with collision tracking) |

Skip integration tests requiring real MySQL — those are HUMAN-UAT territory.

---

### `grid/package.json` (MODIFIED)

**Existing dep block** (`grid/package.json:18-32`):

```json
  "dependencies": {
    "@fastify/cookie": "^11.0.2",
    "@fastify/cors": "^10.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/websocket": "^11.2.0",
    "@noesis/protocol": "*",
    "better-sqlite3": "^12.9.0",
    "fastify": "^5.0.0",
    "jose": "^6.2.3",
    "libsodium-wrappers": "^0.8.4",
    "mysql2": "^3.9.0",
    "ethers": "^6.0.0",
    "siwe": "^3.0.0",
    "smol-toml": "^1.6.1",
    "tar": "^7.5.13"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^20.0.0",
    "@types/tar": "^6.1.13",
    "eslint": "^9.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
```

**What planner must do:**
- Add `"pino": "^10.0.0"` to `dependencies` (D-31-B2 pin at major 10).
- Add `"pino-pretty": "^11.0.0"` to `devDependencies` (D-31-B2 dev-only).
- No other dep changes. Do NOT add `prom-client`, `winston`, `pino-mysql`, or any OpenTelemetry package — all four are explicitly rejected in the research file.

---

### `.github/workflows/*` (MODIFIED — register new CI gate)

**Existing workflow shape** (`.github/workflows/rig-invariants.yml:1-28`):

```yaml
name: rig-invariants

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  invariants:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: grid/package.json

      - name: T-10-12 + T-10-13 grep gates
        run: node scripts/check-rig-invariants.mjs
```

**What planner must do:** Add a step to the existing workflow (preferred — minimize CI surface), e.g.:

```yaml
      - name: OBS-03 no-silent-catch gate
        run: node scripts/check-no-silent-catch.mjs
```

Alternative: create a new `.github/workflows/observability-gates.yml` with the same shape. CONTEXT.md does not constrain which; surgical preference (CLAUDE.md "Surgical Changes" rule) is to add a step to an existing workflow.

---

### `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` (NEW)

**Analog:** any prior phase's `*-HUMAN-UAT.md`. Content fully specified by CONTEXT.md D-31-D3 cutover sequence (steps 1-9). No code excerpt needed — this is a doc the operator follows step-by-step. Plan must include the explicit `docker compose build grid && docker compose up -d grid` line in step 6, per CONTEXT.md `<specifics>` note 3.

---

## Shared Patterns

### Pattern 1: Pino structured-event shape

**Source:** D-31-B3, OBS-03, research H4 ("structured logging on every flush attempt"). The shape is defined in CONTEXT.md.

**Apply to:** Every `logger.warn/info/error` call in this phase (PersistentAuditChain failure path; AuditReconcile heartbeat; backfill script).

**Canonical shape:**

```typescript
logger.warn({
    event: 'audit_persist_failed',          // closed enum, top-level key
    entry_id: entry.id,
    event_type: eventType,
    error_message: err instanceof Error ? err.message : String(err),
    error_code: (err as { code?: string })?.code,
}, 'failed to persist audit entry');         // free-text message LAST
```

**Closed event-name enum for Phase 31:** `'audit_persist_failed'`, `'audit_reconcile_ok'`, `'audit_reconcile_replay'`. (Future phases will extend with `'firehose_frame_dropped'` etc.)

**Rationale:** `grep '"event":"audit_reconcile_ok"'` is the operator's diagnostic primitive. No free-text-parsing.

---

### Pattern 2: Fire-and-forget DB writes from synchronous event paths

**Source:** `grid/src/db/persistent-chain.ts:34` (the existing `.catch(...)` body — pattern, not bug); `grid/src/genesis/launcher.ts:348` (`void this.governance.onTickClosed(event.tick)`).

**Apply to:** Every place in Phase 31 where MySQL is written from a hot path (tick listener, append listener). NEVER `await` MySQL inside a synchronous event handler — the clock is never blocked on I/O.

**Canonical shape (from launcher.ts:348):**

```typescript
            // Fire-and-forget (analogous to relationship snapshot scheduling) — the clock
            // is never blocked on async I/O.
            void this.auditReconcile.run();
```

---

### Pattern 3: Defense-in-depth try/catch on listener / scheduled-task bodies

**Source:** `grid/src/audit/firehose-hub.ts:179-192` (firehose `onAuditEvent`); `grid/src/audit/chain.ts:51-58` (listener fan-out swallows).

**Apply to:** `AuditReconcile.run()` body (top-level try/catch around the entire body, separate inner try/catch around each `store.append` so one failed entry doesn't abort the remaining 499 in the batch). Mirror the firehose's "swallow at the boundary, log structured event, never re-throw" discipline.

---

### Pattern 4: Surgical CI gate (regex over file globs, exit 1 on violation)

**Source:** `scripts/check-rig-invariants.mjs` (shown above), `scripts/check-state-doc-sync.mjs`.

**Apply to:** `scripts/check-no-silent-catch.mjs`. Re-use the `walkDir` + `scanFile` helpers verbatim. Constants at the top, scan loop in the middle, structured failure print + `process.exit(1)` at the bottom.

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `grid/src/util/logger.ts` Pino setup | utility / config | First time Pino is used in-tree as a direct dep (it's a transitive dep via Fastify today). The *singleton-export* shape has an analog (Reviewer.ts), but the Pino config block itself has no in-repo precedent — planner uses Pino docs (CONTEXT.md cites `/pinojs/pino` Context7 ref) + the CONTEXT.md "Claude's discretion" guidance on redact keys / base config. |

---

## Metadata

**Analog search scope:**
- `grid/src/audit/`, `grid/src/db/`, `grid/src/genesis/`, `grid/src/review/`, `grid/src/lore/`, `grid/src/util/`, `grid/src/clock/` (TypeScript analogs)
- `scripts/check-*.mjs`, `scripts/replay-verify.mjs` (ESM CLI analogs)
- `.github/workflows/*.yml` (CI integration)
- `grid/package.json` (dep precedent)

**Files scanned:** 14 (Read tool); plus directory listings for skills, scripts/, workflows/.

**Pattern extraction date:** 2026-05-23

**Surgical-changes invariant (CLAUDE.md §3):** Every excerpt in this map traces to a specific file:line that the plan either preserves verbatim, replaces with a precisely-defined replacement, or replicates structurally. No "improve adjacent code" allowed — the opportunistic `console.*` sweep in CONTEXT.md is the ONE exception, scoped to `grid/src/db/` + `grid/src/audit/` only, and the audit confirms there is **only one** such call site (`persistent-chain.ts:35`). Plans should treat the "sweep" as a single-line change, not a refactor.
