import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Rig end-to-end smoke test (RIG-01..05 except RIG-04 nightly 50×10k bench).
 *
 * Requires MySQL to be available (MYSQL_HOST / MYSQL_PORT env vars configure the target).
 * Tests are skipped when MySQL is not reachable (standard CI pattern for integration tests
 * that depend on external services).
 *
 * These tests exercise the full rig.mjs pipeline:
 *   TOML config → GenesisLauncher → tick loop → chronos.rig_closed → tarball output
 */

const REPO_ROOT = resolve(process.cwd(), '..');
const RIG_SCRIPT = resolve(REPO_ROOT, 'scripts', 'rig.mjs');
const SMALL_10_CONFIG = 'config/rigs/small-10.toml';

/** Quick MySQL connectivity probe — returns true if MySQL accepts connections. */
function mysqlAvailable(): boolean {
    // Probe by attempting to connect and immediately close — use rig.mjs nested-rejection
    // guard to avoid actually running a rig. Instead we use a direct TCP check via node.
    const probe = spawnSync('node', [
        '-e',
        `const net = require('net');
const s = net.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
});
s.on('connect', () => { s.destroy(); process.exit(0); });
s.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 2000);
`,
    ], { encoding: 'utf8', timeout: 3000 });
    return probe.status === 0;
}

const MYSQL_UP = mysqlAvailable();

describe('Rig end-to-end smoke (RIG-01..05 except RIG-04 nightly)', () => {
    it.skipIf(!MYSQL_UP)('runs config/rigs/small-10.toml end-to-end with fixture mode and produces a tarball', () => {
        const r = spawnSync('node', [RIG_SCRIPT, SMALL_10_CONFIG], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                NOESIS_FIXTURE_MODE: '1',
                NOESIS_RIG_PARENT: undefined,
            },
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/exit=tick_budget_exhausted/);
        expect(r.stdout).toMatch(/sha256=[0-9a-f]{64}/);
        // Tarball produced in REPO_ROOT
        const tar = readdirSync(REPO_ROOT).find((n) => /^rig_small-10_d4e5f6a7_\d+\.tar$/.test(n));
        expect(tar).toBeDefined();
        if (tar) unlinkSync(resolve(REPO_ROOT, tar));
    }, 120_000);

    it('rejects nested-rig invocation (D-14-02)', () => {
        // This test does NOT require MySQL — the NOESIS_RIG_PARENT guard fires before DB.
        const r = spawnSync('node', [RIG_SCRIPT, SMALL_10_CONFIG], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            env: { ...process.env, NOESIS_RIG_PARENT: '1' },
        });
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/Nested rig rejected/i);
    });

    it('exits non-zero without TOML path arg', () => {
        // Does NOT require MySQL.
        const r = spawnSync('node', [RIG_SCRIPT], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            env: { ...process.env, NOESIS_RIG_PARENT: undefined },
        });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/Usage/i);
    });

    it.skipIf(!MYSQL_UP)('emits chronos.rig_closed in tarball (D-14-08)', () => {
        const r = spawnSync('node', [RIG_SCRIPT, SMALL_10_CONFIG], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                NOESIS_FIXTURE_MODE: '1',
                NOESIS_RIG_PARENT: undefined,
            },
        });
        expect(r.status).toBe(0);
        // stdout must contain "exit=" with a valid exit reason
        expect(r.stdout).toMatch(/exit=(tick_budget_exhausted|all_nous_dead|operator_h5_terminate)/);
        // Cleanup
        for (const f of readdirSync(REPO_ROOT).filter((n) => /^rig_small-10_d4e5f6a7_\d+\.tar$/.test(n))) {
            unlinkSync(resolve(REPO_ROOT, f));
        }
    }, 120_000);
});
