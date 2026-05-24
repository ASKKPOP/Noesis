---
phase: 31-audit-pipeline-persistence
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - .github/workflows/rig-invariants.yml
  - grid/package.json
  - grid/src/db/audit-reconcile.ts
  - grid/src/db/index.ts
  - grid/src/db/persistent-chain.ts
  - grid/src/genesis/launcher.ts
  - grid/src/main.ts
  - grid/src/util/logger.ts
  - grid/test/audit-persistence-wiring.test.ts
  - grid/test/audit-reconcile.test.ts
  - scripts/backfill-audit-trail.mjs
  - scripts/check-no-silent-catch.mjs
findings:
  critical: 0
  warning: 7
  info: 9
  total: 16
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 31 delivers a solid foundation for OBS-01..04. The zero-diff invariant (R-31-01) is correctly preserved by ordering `super.append()` before the fire-and-forget store mirror, the replay batch cap (R-31-02 = 500) is enforced and unit-tested, and credential handling in the backfill script properly uses env-only secrets. Tests give meaningful coverage of happy paths and recovery semantics, and the OBS-03 logger redact list addresses the most obvious leak vectors.

The findings below cluster around three themes:

1. **Concurrency hygiene in `AuditReconcile.run()`** — fire-and-forget invocation from the tick loop has no in-flight guard, so a long-running cycle (e.g. during a MySQL outage) can overlap with the next tick-driven call, piling SELECTs and concurrent replays on a degraded DB.
2. **Operational safety of the backfill script** — the INSERT loop is missing a try/catch wrapping `conn.end()` (connection leak on partial failure), `--limit` accepts NaN silently, and there is no bounded memory protection on the REST fetch step.
3. **CI gate false-negative surface** — `check-no-silent-catch.mjs` is line-scoped (won't catch a `console.warn` in a multi-line `.catch(err => { ... })` block) and the workflow caches against `grid/package.json` instead of a lockfile, so cache invalidation may be incorrect.

None of these block the Phase 31 ship — the invariants and contracts hold — but several deserve follow-up before Phase 32's `/health/detailed` consumes the surfaced getters and before the next real backfill invocation.

---

## Warnings

### WR-01: AuditReconcile.run() has no in-flight guard — overlapping cycles possible during MySQL slowness

**File:** `grid/src/db/audit-reconcile.ts:73-158` (and `grid/src/genesis/launcher.ts:402-404`)
**Issue:** `run()` is invoked as `void this.auditReconcile.run()` from the tick callback every 60 ticks (~30s at default tickRateMs=500ms). Nothing prevents a second invocation from starting while the first is still awaiting `db.query()` or the per-entry `store.append()` loop. During a MySQL slowdown (the precise scenario this loop exists to detect), a single cycle could take much longer than 30s — and each subsequent tick boundary will fire another concurrent `run()`. Consequences:

- Multiple `SELECT MAX(id) FROM audit_trail WHERE grid_name = ?` queries pile up on an already-degraded DB.
- `_persistedMaxId` and `_lastPersistError` writes race (last-writer-wins; values can flicker non-monotonically).
- `_lastReconcileAt` may move backwards if an older cycle completes after a newer one (the value is written inside `try`/`catch` at completion, not at start).
- `INSERT IGNORE` saves us from data corruption, but redundant work and connection-pool exhaustion remain risks.

**Fix:** Add a single in-flight latch:

```typescript
export class AuditReconcile {
    private _running = false;
    // ... existing fields

    async run(): Promise<void> {
        if (this._running) {
            // Previous cycle still in flight (e.g. MySQL slow). Skip — next tick will retry.
            log.warn({ event: 'audit_reconcile_skipped', reason: 'in_flight' }, 'reconcile already running');
            return;
        }
        this._running = true;
        try {
            // ... existing body
        } finally {
            this._running = false;
        }
    }
}
```

The skip log preserves the "silence is the alarm" invariant from D-31-C1 — operators see overlap explicitly rather than via mysterious latency.

---

### WR-02: backfill script INSERT loop has no try/catch — connection leak + partial-state ambiguity on mid-loop failure

**File:** `scripts/backfill-audit-trail.mjs:208-236`
**Issue:** The `for (const entry of missing)` loop calls `await conn.execute(...)` without a wrapping try/catch. If any single INSERT throws (deadlock, constraint violation, network blip), three bad things happen:

1. The script exits via the unhandled rejection, **never calling `conn.end()`** → MySQL connection leaked until OS kills the process.
2. The "DONE: inserted=N skipped=M" summary log is never emitted → operator can't tell what was committed vs. lost without a separate DB query.
3. The process exits with no defined exit code (Node default = 1, but not the documented `2` for DB failure).

The MAX(id) query on line 171-174 has the same problem — failure leaks the connection.

**Fix:** Wrap the DB phase in try/catch/finally:

```javascript
let inserted = 0;
let skipped = 0;
try {
    const [maxRow] = await conn.execute(
        'SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS row_count FROM audit_trail WHERE grid_name = ?',
        [args.grid],
    );
    // ... existing logic up through the loop

    for (const entry of missing) {
        try {
            const [result] = await conn.execute(/* ... */);
            if (result.affectedRows > 0) inserted++;
            else skipped++;
        } catch (err) {
            console.error(`[backfill] insert failed at id=${entry.id}: ${err.message}`);
            console.error(`[backfill] partial state: inserted=${inserted} skipped=${skipped} remaining=${missing.length - inserted - skipped}`);
            await conn.end();
            process.exit(2);
        }
    }
    console.log(`[backfill] DONE: inserted=${inserted} skipped(idempotent)=${skipped}`);
} finally {
    await conn.end().catch(() => {});
}
process.exit(0);
```

---

### WR-03: `--limit` arg accepts NaN silently — operator ceiling becomes a no-op

**File:** `scripts/backfill-audit-trail.mjs:71, 183-187`
**Issue:** `parseInt(argv[++i], 10)` returns `NaN` if the next arg isn't numeric (e.g. `--limit abc` or `--limit --dry-run` when the value is forgotten). `Math.abs(divergence) > NaN` is always `false`, so the abort guard at line 183 is silently bypassed and the script proceeds to backfill without the operator-defined ceiling. This is exactly the kind of safety-net failure the limit exists to prevent.

**Fix:** Validate immediately after parsing, mirroring the `--since` validation pattern that already exists at line 96-99:

```javascript
case '--limit':
    out.limit = parseInt(argv[++i], 10);
    if (Number.isNaN(out.limit) || out.limit < 0) {
        console.error(`[backfill] --limit must be a non-negative integer, got: ${argv[i]}`);
        process.exit(64);
    }
    break;
```

---

### WR-04: `check-no-silent-catch.mjs` regex is line-scoped — multi-line `.catch` blocks slip through

**File:** `scripts/check-no-silent-catch.mjs:53, 88-112`
**Issue:** The forbidden-pattern regex matches on a single trimmed line. The following common shape — which is the exact anti-pattern this gate exists to block — would not be detected:

```typescript
this.store.append(name, entry).catch((err) => {
    // any number of intermediate lines / comments
    console.warn('failed', err);
});
```

`scanFile` iterates `for (const line of lines)` and only tests each line in isolation. The opening `.catch(err => {` line has no `console.X`, and the `console.warn(...)` line has no `.catch(` — neither rule fires. Given the explicit context note that this gate's correctness matters for false-negative risk, this is the most important finding in the review.

**Fix:** Either (a) join multi-line `.catch(...) => { ... }` blocks before regex-matching, or (b) add a second-pass scan that flags any `console.warn|log|debug|error` call inside a `.catch` block. The simplest robust approach is a brace-balance walk:

```javascript
function scanFileMultiLine(filePath, rules) {
    const text = readFileSync(filePath, 'utf8');
    const violations = [];
    // Find every `.catch(` opening, then walk to the matching `)` collecting body.
    const catchRe = /\.catch\s*\(/g;
    let match;
    while ((match = catchRe.exec(text)) !== null) {
        const start = match.index;
        const body = extractParenBody(text, start + match[0].length - 1);
        if (/console\.(?:warn|log|debug|error)\b/.test(body)) {
            const lineNo = text.slice(0, start).split('\n').length;
            violations.push({
                file: relative(ROOT, filePath),
                line: lineNo,
                rule: 'no-silent-catch-console-multiline',
                text: text.slice(start, start + 80).replace(/\n/g, ' ⏎ '),
            });
        }
    }
    return violations;
}
```

Also note: `re.lastIndex = 0` on line 100 is a no-op because none of the rule regexes use the `/g` or `/y` flag. Either remove the line or add `/g` if you switch to `exec`-based scanning.

---

### WR-05: Reverse-divergence (`dbMaxId > inMemoryLength`) is silently masked to zero

**File:** `grid/src/db/audit-reconcile.ts:85`
**Issue:** `const divergence = Math.max(0, inMemoryLength - dbMaxId);` discards information when the DB has *more* entries than memory. While this should be impossible in single-instance operation, it can happen in real-world scenarios:

- A previous instance was killed mid-write; rows landed in DB but the in-memory chain was not rehydrated from `loadAll()` on the new instance.
- Two grid processes briefly write to the same `grid_name` (operational mistake, but exactly what a watchdog should catch).
- A backfill script ran against the wrong grid name.

The heartbeat will log `divergence: 0, replayed: 0, remaining: 0` and the operator has no signal that state is wrong in an unexpected direction.

**Fix:** Track both directions explicitly:

```typescript
const inMemoryLength = this.chain.length;
const memoryAhead = Math.max(0, inMemoryLength - dbMaxId);
const dbAhead = Math.max(0, dbMaxId - inMemoryLength);

if (dbAhead > 0) {
    log.error(
        { event: 'audit_reconcile_db_ahead', db_max_id: dbMaxId, in_memory_length: inMemoryLength, db_ahead: dbAhead },
        'reconcile: DB has more entries than in-memory chain — possible multi-writer or stale rehydrate',
    );
    // Still update lastReconcileAt but do NOT attempt replay.
    this._lastReconcileAt = Date.now();
    return;
}
// proceed with existing memoryAhead-based replay logic
```

---

### WR-06: `PersistentAuditChain.append()` has unbounded fire-and-forget queue

**File:** `grid/src/db/persistent-chain.ts:63-73`
**Issue:** Each `append()` schedules `this.store.append(...).catch(...)` and returns immediately. There is no backpressure — if MySQL is slow but not failing, pending promises accumulate without bound in the Node event loop. A sustained burst (e.g. tick storm or replay of a long buffered queue) could exhaust heap with held-over `AuditEntry` references inside the promise closures.

The AuditReconcile loop and `INSERT IGNORE` will save data correctness, but heap pressure on the grid process itself is not bounded.

**Fix:** Either (a) track in-flight count with a soft cap and degrade-loud when exceeded, or (b) use a small p-queue / single-flight serializer so writes are sequential per-grid:

```typescript
private _inFlight = 0;
private static readonly IN_FLIGHT_WARN = 1000;

override append(/* ... */): AuditEntry {
    const entry = super.append(eventType, actorDid, payload, targetDid);

    this._inFlight++;
    if (this._inFlight > PersistentAuditChain.IN_FLIGHT_WARN) {
        log.warn({ event: 'audit_persist_backlog', in_flight: this._inFlight }, 'persist backlog above threshold');
    }
    this.store.append(this.gridName, entry)
        .catch((err: unknown) => { /* existing log + lastPersistError */ })
        .finally(() => { this._inFlight--; });

    return entry;
}
```

Phase 32's `/health/detailed` would naturally surface `_inFlight` alongside `lastPersistError`.

---

### WR-07: `evmConfirmTx` swallows fetch errors and has no timeout — RPC outage hangs requests indefinitely

**File:** `grid/src/main.ts:193-211`
**Issue:** Two problems compound here:

1. `try { ... } catch { return { confirmed: false } }` discards the error entirely — no log, no metric. If RPC starts returning 5xx or malformed JSON, every payment confirmation silently reports unconfirmed and the operator has no signal until users complain.
2. `await fetch(evmRpcUrl, { ... })` has no `AbortController` / timeout. If the RPC endpoint accepts the TCP connection but never responds, the fetch hangs forever, accumulating leaked sockets and pending route handlers.

Note: this file is outside the OBS-03 CI-gate scope (grid/src/db + grid/src/audit only, per intentional scoping in `check-no-silent-catch.mjs`), so it's not a gate violation. But the symptom is the same anti-pattern Phase 31 exists to prevent.

**Fix:**

```typescript
const evmConfirmTx = evmRpcUrl
    ? async (txHash: string): Promise<{ confirmed: boolean; from?: string }> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5_000);
          try {
              const receiptRes = await fetch(evmRpcUrl, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
                  signal: controller.signal,
              });
              const receiptJson = await receiptRes.json() as { result: { status: string; from?: string } | null };
              if (!receiptJson.result || receiptJson.result.status !== '0x1') return { confirmed: false };
              return { confirmed: true, from: receiptJson.result.from };
          } catch (err) {
              log.warn(
                  { event: 'evm_confirm_failed', tx: txHash, error_message: err instanceof Error ? err.message : String(err) },
                  'evm confirm tx failed',
              );
              return { confirmed: false };
          } finally {
              clearTimeout(timer);
          }
      }
    : undefined;
```

---

## Info

### IN-01: GitHub Actions cache key points to `package.json`, not `package-lock.json`

**File:** `.github/workflows/rig-invariants.yml:22`
**Issue:** `cache-dependency-path: grid/package.json` — the canonical key for `actions/setup-node` npm caching is the lockfile. Using `package.json` means cache invalidation fires on version-range edits but NOT on resolved-version changes (which is what actually matters for `npm ci`). It also means the cache key may stay stable across security updates to transitive deps, defeating the cache's purpose for reproducibility.
**Fix:** Change to `cache-dependency-path: grid/package-lock.json` (assuming the lockfile is committed — `npm ci` on line 33 requires it). If no lockfile is committed, that itself is the higher-priority bug: switch `npm ci` to `npm install` or commit the lockfile.

---

### IN-02: `main.ts` snapshot-on-shutdown uses silent `console.warn` (mirrors OBS-03 anti-pattern outside CI-gate scope)

**File:** `grid/src/main.ts:270-272`
**Issue:** `.catch(err => console.warn('[Grid] Snapshot failed on shutdown:', err))` is exactly the shape the Phase 31 CI gate forbids in `grid/src/db/` and `grid/src/audit/`. It's outside scope, but if shutdown snapshot ever fails, the message is lost in stdout noise rather than emitted as structured JSON. Worth tracking for the broader rollout the CI-gate comments mention.
**Fix:** Replace with `log.warn({ event: 'snapshot_shutdown_failed', error_message: err.message }, 'snapshot failed on shutdown')` once the structured logger is imported into main.ts.

---

### IN-03: Logger redact list is missing several common credential keys

**File:** `grid/src/util/logger.ts:33-55`
**Issue:** The redact list covers `password`, `signature`, `nonce`, `cookie`, `jwt`, `authorization`, `secret`, `token` (+ wildcard variants). Notable omissions that show up in this codebase or are common in JS ecosystems:

- `private_key` / `privateKey` (used by SIWE/ethers flows)
- `api_key` / `apiKey`
- `bearer`
- `session` / `sessionId`
- `csrf` / `csrfToken`
- `email` (PII, often desired-redacted)

The file's docblock claims the list "mirrors Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS" — worth cross-checking against that source-of-truth list before Phase 33 lands and the two diverge.
**Fix:** Add the missing keys plus their `*.` wildcard variants. Consider extracting to a `SENSITIVE_KEYS` constant shared between this file and Phase 33's forbidden-keys check to enforce parity.

---

### IN-04: AuditReconcile divergence assumes contiguous ids from 1 — gaps would cause silent over-replay

**File:** `grid/src/db/audit-reconcile.ts:84-85`
**Issue:** The comment "chain.length is monotonic and matches the max id (ids start at 1)" is true today but brittle. If a future operation introduces id gaps in `audit_trail` (manual cleanup, sharding, multi-grid id reuse), `inMemoryLength - dbMaxId` will under-report divergence and miss missing entries that fall below `dbMaxId`. The replay filter `e.id > dbMaxId` (line 100) compounds the assumption.
**Fix:** Either (a) lock the invariant by querying `COUNT(*)` instead of `MAX(id)` and replaying based on a set-difference of ids, or (b) add a runtime assertion that `dbCount === dbMaxId` and log `audit_reconcile_gaps_detected` when violated. Option (b) is cheaper and gives operators an early-warning signal without changing replay semantics.

---

### IN-05: backfill script REST fetch is unbounded — entire chain loaded into memory

**File:** `scripts/backfill-audit-trail.mjs:139-150`
**Issue:** `restEntries.push(...entries)` accumulates all REST-paginated entries into memory before any DB work begins. For a Grid that has been running for months (millions of audit entries), this is unbounded heap consumption. The Phase 31 use case (2026-05-22 stall window) was small, but the script is documented as reusable for "any future stall window."
**Fix:** Stream pages directly into the INSERT loop. Combined with the WR-02 try/catch fix, the pipeline becomes constant-memory regardless of chain size:

```javascript
let inserted = 0, skipped = 0, scanned = 0;
let offset = 0;
for (;;) {
    const { entries, total } = await fetchPage(offset);
    if (!entries || entries.length === 0) break;
    for (const entry of entries) {
        if (sinceMs !== null && entry.createdAt < sinceMs) continue;
        if (entry.id <= dbMaxId) { scanned++; continue; }
        // INSERT IGNORE here
    }
    if (entries.length < PAGE) break;
    offset += PAGE;
}
```

---

### IN-06: `attachRelationshipStorage` / `attachNormStorage` rely on `pool` getter that isn't visible in this file

**File:** `grid/src/genesis/launcher.ts:238, 265`
**Issue:** The idempotency check `this.relationshipStorage.pool === pool` assumes `RelationshipStorage` exposes a public `pool` getter (same for `NormStorage`). This is a cross-file coupling — a future refactor that renames or removes that getter will only fail at runtime, not at TypeScript compile time if it's typed as `Pool`. Worth adding an interface (e.g. `interface PoolBacked { readonly pool: Pool }`) and constraining the storage type to it.
**Fix:** Define `interface PoolBacked { readonly pool: Pool }` in db/types.ts and have `RelationshipStorage`/`NormStorage` implement it. Then the idempotency check is compile-time enforced.

---

### IN-07: `result.affectedRows` accessed without type narrowing — silent crash on unexpected mysql2 response shape

**File:** `scripts/backfill-audit-trail.mjs:230`
**Issue:** `if (result.affectedRows > 0) inserted++; else skipped++;` assumes `result` is a `ResultSetHeader`. If mysql2 ever returns an array (e.g. multi-statement INSERT), `result.affectedRows` would be `undefined`, `undefined > 0` is `false`, and every insert would be counted as "skipped" — silently corrupting the audit summary. The previous `[maxRow]` destructure (line 171) does NOT prevent this on the subsequent `conn.execute` calls because each call returns a fresh result.
**Fix:** Narrow the type explicitly:

```javascript
const [result] = await conn.execute(/* ... */);
const affected = (result && typeof result === 'object' && 'affectedRows' in result)
    ? Number(result.affectedRows)
    : 0;
if (affected > 0) inserted++; else skipped++;
```

---

### IN-08: `audit-persistence-wiring.test.ts` zero-diff test uses only 10 events — invariant claims "N identical appends"

**File:** `grid/test/audit-persistence-wiring.test.ts:81-103`
**Issue:** R-31-01 is stated as "byte-identical with and without DB attached after N identical append() calls" but the test pins N=10. While 10 is enough to catch the listener-ordering regression the test exists to prevent, a property-based test (or at minimum N=100, N=1000) would catch subtler issues like hash-chain drift after long sequences.
**Fix:** Add a parameterized variant: `it.each([10, 100, 1000])('produces byte-identical head after %i appends', (n) => ...)`. Property-based via `fast-check` would be the gold standard but the simple parameterization is a 3-line change.

---

### IN-09: `check-no-silent-catch.mjs` excludes test files but not the script itself

**File:** `scripts/check-no-silent-catch.mjs:37`
**Issue:** `EXCLUDE_FILE_PATTERNS` excludes `.test.ts` and `.d.ts`. The scanner only walks `grid/src/db/` and `grid/src/audit/`, so the script's own `walkDir` swallow at line 73 (`if (err && err.code === 'ENOENT') return;`) isn't in scope. But the swallow IS a silent catch — it returns early without logging. If a SCAN_DIR is accidentally renamed or deleted, the gate passes with zero violations and zero files scanned. The CI would not flag this regression.
**Fix:** After scan completes, assert at least one file was inspected per SCAN_DIR; exit nonzero with a clear "scanned 0 files in <dir>" message if not. This guards against silent gate erosion if directories move.

```javascript
let totalScanned = 0;
for (const dir of SCAN_DIRS) {
    let scannedInDir = 0;
    for (const file of walkDir(dir)) {
        scannedInDir++;
        allViolations.push(...scanFile(file, RULES));
    }
    if (scannedInDir === 0) {
        console.error(`[check-no-silent-catch] FAIL: scanned 0 files in ${dir} — directory missing or empty?`);
        process.exit(1);
    }
    totalScanned += scannedInDir;
}
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
