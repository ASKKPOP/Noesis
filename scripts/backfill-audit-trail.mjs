#!/usr/bin/env node
/**
 * scripts/backfill-audit-trail.mjs
 *
 * Phase 31 OBS-04 (D-31-D1, D-31-D2). One-shot audit-trail backfill CLI.
 *
 * Reads the live Grid's in-memory audit chain via REST and writes missing
 * entries to MySQL via direct mysql2/promise connection. Idempotent (INSERT IGNORE).
 * Reusable for any future stall window — the 2026-05-22 invocation is the first use.
 *
 * Usage:
 *   node scripts/backfill-audit-trail.mjs \
 *     --grid <gridName> \
 *     --rest-url <http://host:port> \
 *     [--since <ISO8601>] \
 *     [--limit <N>] \
 *     [--dry-run]
 *
 * MySQL credentials are read from env (NEVER from CLI args — credentials must
 * not appear in shell history or process listings):
 *   MYSQL_HOST       (default: localhost)
 *   MYSQL_PORT       (default: 3306)
 *   MYSQL_DATABASE   (required)
 *   MYSQL_USER       (required)
 *   MYSQL_PASSWORD   (required, may be empty string for passwordless local)
 *
 * Exit codes:
 *   0  — success: backfill complete (or dry-run reported divergence).
 *   1  — REST fetch failed (network, 5xx, or non-2xx).
 *   2  — MySQL connect failed OR mysql2 module not resolvable.
 *   3  — divergence exceeds --limit and --limit was explicitly set (operator-defined ceiling exceeded).
 *  64  — usage error: missing required flag or invalid value.
 *
 * Security note:
 *   --rest-url accepts arbitrary http(s) URLs. Operator is responsible for pointing
 *   it at a trusted Grid (e.g. http://localhost:8080). The script does NOT mask its
 *   stdout output, so DO NOT pipe `--dry-run` output to untrusted destinations if
 *   audit payloads contain sensitive material.
 */

const ROOT = process.cwd();

// ── 1. Resolve mysql2 (must work whether invoked from repo root or grid/). ────
let mysqlPromise;
try {
    mysqlPromise = await import('mysql2/promise');
} catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
        try {
            mysqlPromise = await import('../grid/node_modules/mysql2/promise.js');
        } catch {
            console.error('[backfill] mysql2 not resolvable from project root.');
            console.error('[backfill] Invoke as: cd grid && node ../scripts/backfill-audit-trail.mjs ...');
            process.exit(2);
        }
    } else {
        throw err;
    }
}
const mysql = mysqlPromise.default ?? mysqlPromise;

// ── 2. Parse CLI args. ────────────────────────────────────────────────────────
function parseArgs(argv) {
    const out = { dryRun: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--grid':      out.grid = argv[++i]; break;
            case '--rest-url':  out.restUrl = argv[++i]; break;
            case '--since':     out.since = argv[++i]; break;
            case '--limit':     out.limit = parseInt(argv[++i], 10); break;
            case '--dry-run':   out.dryRun = true; break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
            default:
                console.error(`[backfill] unknown flag: ${a}`);
                process.exit(64);
        }
    }
    return out;
}

function printUsage() {
    console.error('Usage: node scripts/backfill-audit-trail.mjs --grid <name> --rest-url <url> [--since <ISO>] [--limit <N>] [--dry-run]');
}

const args = parseArgs(process.argv);
if (!args.grid || !args.restUrl) {
    console.error('[backfill] --grid and --rest-url are required.');
    printUsage();
    process.exit(64);
}

if (args.since && Number.isNaN(Date.parse(args.since))) {
    console.error(`[backfill] --since must be a valid ISO 8601 timestamp, got: ${args.since}`);
    process.exit(64);
}

// Light URL validation — must be http(s) and parseable. Does NOT restrict hosts
// (operator responsibility per CONTEXT.md security note). Rejects file://, javascript:, etc.
try {
    const u = new URL(args.restUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error(`unsupported protocol: ${u.protocol}`);
    }
} catch (e) {
    console.error(`[backfill] --rest-url is not a valid http(s) URL: ${args.restUrl} (${e.message})`);
    process.exit(64);
}

// ── 3. Read MySQL config from env. ────────────────────────────────────────────
const dbConfig = {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? '',
};
if (!dbConfig.database || !dbConfig.user) {
    console.error('[backfill] MYSQL_DATABASE and MYSQL_USER env vars are required.');
    process.exit(64);
}

// ── 4. Fetch all entries from REST, paginated. ────────────────────────────────
const PAGE = 100;
const sinceMs = args.since ? Date.parse(args.since) : null;

async function fetchPage(offset) {
    const url = `${args.restUrl.replace(/\/$/, '')}/api/v1/audit/trail?limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`REST ${url} returned ${res.status} ${res.statusText}`);
    }
    return res.json();
}

let restEntries = [];
let restTotal = 0;
try {
    let offset = 0;
    for (;;) {
        const { entries, total } = await fetchPage(offset);
        restTotal = total;
        if (!entries || entries.length === 0) break;
        restEntries.push(...entries);
        if (entries.length < PAGE) break;
        offset += PAGE;
    }
} catch (e) {
    console.error(`[backfill] REST fetch failed: ${e.message}`);
    process.exit(1);
}

if (sinceMs !== null) {
    restEntries = restEntries.filter(e => e.createdAt >= sinceMs);
}

console.log(`[backfill] REST: fetched ${restEntries.length} entries (server total=${restTotal}, since=${args.since ?? 'all'})`);

// ── 5. Connect to MySQL and find what's missing. ──────────────────────────────
let conn;
try {
    conn = await mysql.createConnection(dbConfig);
} catch (e) {
    console.error(`[backfill] MySQL connect failed: ${e.message}`);
    process.exit(2);
}

const [maxRow] = await conn.execute(
    'SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS row_count FROM audit_trail WHERE grid_name = ?',
    [args.grid],
);
const dbMaxId = Number(maxRow[0].max_id);
const dbCount = Number(maxRow[0].row_count);
console.log(`[backfill] MySQL: grid_name='${args.grid}' rows=${dbCount} max_id=${dbMaxId}`);

const restMaxId = restEntries.length > 0 ? Math.max(...restEntries.map(e => e.id)) : 0;
const divergence = restEntries.length - dbCount;
console.log(`[backfill] divergence: in_memory=${restEntries.length} persisted=${dbCount} delta=${divergence}`);

if (args.limit !== undefined && Math.abs(divergence) > args.limit) {
    console.error(`[backfill] divergence ${Math.abs(divergence)} exceeds --limit ${args.limit}. Aborting.`);
    await conn.end();
    process.exit(3);
}

// Entries to insert: those whose id > dbMaxId. INSERT IGNORE handles any
// in-range duplicates safely (idempotent).
const missing = restEntries.filter(e => e.id > dbMaxId);
console.log(`[backfill] would insert ${missing.length} entries (id > ${dbMaxId}, up to id=${restMaxId})`);

if (missing.length > 0) {
    const first = missing[0];
    const last = missing[missing.length - 1];
    console.log(`[backfill] first missing: id=${first.id} ${first.eventType} @ ${new Date(first.createdAt).toISOString()}`);
    console.log(`[backfill] last  missing: id=${last.id} ${last.eventType} @ ${new Date(last.createdAt).toISOString()}`);
}

// ── 6. Dry-run short-circuit. ─────────────────────────────────────────────────
if (args.dryRun) {
    console.log('[backfill] --dry-run: no rows written.');
    await conn.end();
    process.exit(0);
}

// ── 7. Insert missing rows via INSERT IGNORE. ─────────────────────────────────
let inserted = 0;
let skipped = 0;
for (const entry of missing) {
    const [result] = await conn.execute(
        `INSERT IGNORE INTO audit_trail
            (grid_name, id, event_type, actor_did, target_did,
             payload, prev_hash, event_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            args.grid,
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
    // mysql2 affectedRows is 1 on insert, 0 on IGNORE collision.
    if (result.affectedRows > 0) inserted++;
    else skipped++;
}

console.log(`[backfill] DONE: inserted=${inserted} skipped(idempotent)=${skipped}`);
await conn.end();
process.exit(0);
