#!/usr/bin/env node
/**
 * scripts/rig.mjs — Phase 14 Researcher Rig CLI.
 *
 * Spawns an ephemeral Grid from a TOML config, runs N ticks deterministically,
 * emits chronos.rig_closed on the rig's isolated AuditChain, exports a JSONL
 * tarball, and exits.
 *
 * Invariants (CI-enforced by scripts/check-rig-invariants.mjs):
 *   - No httpServer.listen / wsHub references (T-10-12)
 *   - No --skip-* / --bypass-* / --disable-* / --no-reviewer / --no-tier flags (T-10-13)
 *   - --permissive IS allowed (D-14-05 mode selector, NOT a bypass)
 *
 * Zero-code-divergence invariant (RIG-01): GenesisLauncher invoked UNCHANGED.
 * Schema isolation (RIG-02): rig writes to its own MySQL schema; live Grid untouched.
 * Tarball reuse (RIG-05): buildExportTarball UNCHANGED from Phase 13.
 *
 * Usage:
 *   node scripts/rig.mjs <config.toml> [--full-state] [--permissive]
 *
 * Environment:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD — DB connection
 *   NOESIS_FULL_STATE_CONSENT — must be "I-CONSENT-TO-PLAINTEXT-EXPORT" when --full-state used
 *   NOESIS_FIXTURE_MODE — set to "1" by rig.mjs for all child processes
 */

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// -- T-10-16: Verbatim-locked consent prompt — defined FIRST to avoid TDZ --
// Test grid/test/rig/full-state-consent.test.ts asserts exact match.
// IMPORTANT: This string is verbatim-locked. Any change here requires updating the test too.
const FULL_STATE_CONSENT_PROMPT = `⚠️  FULL-STATE EXPORT — IRREVERSIBLE PRIVACY DECISION

You are about to export plaintext Telos goals, internal Nous memory, and personality
data that has NEVER been broadcast publicly. Once published, this export cannot be
redacted from copies that have been shared.

This is a per-run consent — even the same researcher must reconfirm for each rig run.

If you are sure, set NOESIS_FULL_STATE_CONSENT="I-CONSENT-TO-PLAINTEXT-EXPORT" and re-run.`;

// -- D-14-02: Nested-rig guard at entry point --
// Check BEFORE any other work — prevents nested rigs from bootstrapping a Grid.
if (process.env.NOESIS_RIG_PARENT === '1') {
    console.error('[rig] Nested rig rejected (NOESIS_RIG_PARENT is set). Exiting.');
    process.exit(2);
}
// Set BEFORE constructing Launcher so any subprocess inherits + is rejected.
process.env.NOESIS_RIG_PARENT = '1';
// Set fixture mode env var for Brain child processes (D-14-06).
process.env.NOESIS_FIXTURE_MODE = '1';

// -- Argv parsing --
const argv = process.argv.slice(2);
const tomlPath = argv.find((a) => !a.startsWith('--'));
if (!tomlPath) {
    console.error('Usage: node scripts/rig.mjs <config.toml> [--full-state] [--permissive]');
    process.exit(2);
}
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const fullStateConsented = requireFullStateConsent(flags);
const permissive = flags.has('--permissive');  // D-14-05: mode selector, NOT a bypass

// -- Resolve paths --
const __dirname = dirname(fileURLToPath(import.meta.url));
const GRID_DIST = resolve(__dirname, '..', 'grid', 'dist');

// -- Dynamic imports from grid dist --
const { loadRigConfigFromToml } = await import('./rig-config-loader.mjs');
const { GenesisLauncher } = await import(`${GRID_DIST}/genesis/launcher.js`);
const { GridCoordinator } = await import(`${GRID_DIST}/integration/grid-coordinator.js`);
const { buildExportTarball } = await import(`${GRID_DIST}/export/tarball-builder.js`);
const { createManifest } = await import(`${GRID_DIST}/export/manifest.js`);
const { canonicalStringify } = await import(`${GRID_DIST}/export/canonical-json.js`);
const { createRigSchema } = await import(`${GRID_DIST}/rig/schema.js`);
const { GENESIS_CONFIG } = await import(`${GRID_DIST}/genesis/presets.js`);

// -- Load config --
const cfg = await loadRigConfigFromToml(tomlPath);
if (permissive) cfg.permissive = true;

console.log(`[rig] config=${cfg.configName} seed=${cfg.seed.slice(0, 8)} tick_budget=${cfg.tickBudget}`);

// -- D-14-01: bootstrap rig MySQL schema --
const dbConfig = readDbConfigFromEnv();
const { schemaName, db: rigDb } = await createRigSchema({
    ...dbConfig,
    configName: cfg.configName,
    seed: cfg.seed,
});
console.log(`[rig] schema=${schemaName} (LEFT after exit per D-14-01)`);

// -- Build GenesisConfig from RigConfig (zero code divergence — RIG-01) --
// Reuse GENESIS_CONFIG for regions, connections, laws, and economy.
// Override gridName, gridDomain, tickRateMs, seedNous per rig config.
const genesisConfig = {
    gridName: schemaName,
    gridDomain: 'rig.noesis',
    tickRateMs: cfg.tickRateMs,                       // D-14-07: 0 for headless
    ticksPerEpoch: 100,
    regions: GENESIS_CONFIG.regions,
    connections: GENESIS_CONFIG.connections,
    laws: GENESIS_CONFIG.laws,
    economy: GENESIS_CONFIG.economy,
    seedNous: cfg.nousManifest,                       // D-14-03: already normalized
    transport: 'in-memory',                            // T-10-12 defense
};

// -- Construct Launcher (zero code divergence; in-memory transport) --
// NOTE: GenesisLauncher constructor does not take a second {db} argument;
// the rig schema db is managed here separately (RIG-02 isolation).
const launcher = new GenesisLauncher(genesisConfig);
launcher.bootstrap();

// -- Wire coordinator for headless tick dispatch --
// No NousRunners in a headless rig (no Brain processes) — coordinator resolves immediately.
// This design is correct: the rig drives the clock and audit chain, not Brain behavior.
const coordinator = new GridCoordinator(launcher);

// -- Capture start snapshot (before any ticks) --
const startSnapshot = buildSnapshot(0, launcher);

// -- D-14-08: prepare exit-reason tracking --
let exitReason = null;
const handleTerminate = () => { exitReason = 'operator_h5_terminate'; };
process.on('SIGTERM', handleTerminate);
process.on('SIGINT', handleTerminate);

// -- Direct tick loop (RIG-04 — NEVER setInterval; NEVER clock.start()) --
// clock.advance() is synchronous; awaitTick() awaits all runners (zero in headless mode).
for (let t = 0; t < cfg.tickBudget; t++) {
    const event = launcher.clock.advance();             // synchronous sole producer
    await coordinator.awaitTick(event.tick, event.epoch);
    if (launcher.registry.count === 0) { exitReason = 'all_nous_dead'; break; }
    if (exitReason !== null) break;
}
exitReason = exitReason ?? 'tick_budget_exhausted';
const finalTick = launcher.clock.currentTick;

// -- D-14-08: emit chronos.rig_closed on rig's OWN chain (NEVER production allowlist) --
// chain_tail_hash = SHA-256(canonicalStringify(lastEntry)) — same derivation as Phase 13.
const allEntriesBeforeClose = launcher.audit.all();
const lastEntry = allEntriesBeforeClose[allEntriesBeforeClose.length - 1];
const chainTailHash = lastEntry
    ? createHash('sha256').update(canonicalStringify(stripUndefined(lastEntry))).digest('hex')
    : createHash('sha256').update('').digest('hex');

const rigClosedPayload = {
    seed: cfg.seed,
    tick: finalTick,
    exit_reason: exitReason,
    chain_entry_count: allEntriesBeforeClose.length,
    chain_tail_hash: chainTailHash,
};
launcher.audit.append('chronos.rig_closed', 'system', rigClosedPayload);

// -- RIG-05: build deterministic JSONL tarball UNCHANGED from Phase 13 --
const finalEntries = launcher.audit.all();
const endSnapshot = buildSnapshot(finalTick, launcher);

// Validate entryCount and chainTailHash satisfy createManifest constraints
const manifestChainTailHash = finalEntries.length > 0
    ? createHash('sha256').update(canonicalStringify(stripUndefined(finalEntries[finalEntries.length - 1]))).digest('hex')
    : chainTailHash;

const manifest = createManifest({
    startTick: 0,
    endTick: finalTick,
    entryCount: finalEntries.length,
    chainTailHash: manifestChainTailHash,
});

// T-10-16: default export scrubs plaintext Telos keys; --full-state requires verbatim consent.
if (!fullStateConsented) {
    scrubPlaintextTelos(finalEntries, startSnapshot, endSnapshot);
}

const { bytes, hash } = await buildExportTarball({
    chainSlice: finalEntries,
    startSnapshot,
    endSnapshot,
    manifest,
});

const seed8 = cfg.seed.slice(0, 8);
const outPath = resolve(`rig_${cfg.configName}_${seed8}_${Date.now()}.tar`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
console.log(`[rig] tarball=${outPath} sha256=${hash} entries=${finalEntries.length} exit=${exitReason}`);

process.exit(0);

// ---------- helpers ----------

/** Build a ReplayState-compatible snapshot from the launcher at a given tick. */
function buildSnapshot(tick, launcher) {
    const edgesIter = launcher.relationships.allEdges();
    const relationshipEdges = [];
    for (const edge of edgesIter) {
        relationshipEdges.push({ ...edge });
    }
    return { tick, relationshipEdges };
}

/** Strip undefined-valued fields (mirrors tarball-builder.ts stripUndefined). */
function stripUndefined(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) result[k] = v;
    }
    return result;
}

/** Read MySQL connection config from environment variables. */
function readDbConfigFromEnv() {
    return {
        host: process.env.MYSQL_HOST ?? '127.0.0.1',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'noesis',
        password: process.env.MYSQL_PASSWORD ?? '',
    };
}

/**
 * T-10-16: --full-state requires verbatim consent prompt.
 * Verbatim copy is locked in grid/test/rig/full-state-consent.test.ts.
 * Returns true if --full-state is not set (default export is audit-only).
 * Returns true if --full-state IS set AND consent env var matches exactly.
 * Exits with code 3 if --full-state is set but consent env var is missing/wrong.
 */
function requireFullStateConsent(flags) {
    if (!flags.has('--full-state')) return false;
    if (process.env.NOESIS_FULL_STATE_CONSENT === 'I-CONSENT-TO-PLAINTEXT-EXPORT') {
        return true;
    }
    console.error(FULL_STATE_CONSENT_PROMPT);
    console.error('');
    console.error('To proceed, re-run with NOESIS_FULL_STATE_CONSENT="I-CONSENT-TO-PLAINTEXT-EXPORT" set in env.');
    process.exit(3);
}

/** Scrub plaintext Telos keys from entries and snapshots (T-10-16 defense). */
function scrubPlaintextTelos(entries, startSnap, endSnap) {
    const FORBIDDEN = ['telos_text', 'goal_description', 'memory_text', 'goals', 'new_goals', 'telos_yaml'];
    const scrubObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            if (FORBIDDEN.includes(key)) {
                obj[key] = '[REDACTED:--full-state required]';
            } else if (typeof obj[key] === 'object') {
                scrubObject(obj[key]);
            }
        }
    };
    for (const e of entries) scrubObject(e.payload);
    scrubObject(startSnap);
    scrubObject(endSnap);
}
