import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * RIG-05: rig exit tarball reuses Phase 13 buildExportTarball UNCHANGED.
 * Determinism contract: same TOML config + same seed → same tarball SHA-256 across N runs
 * (modulo timestamp suffix in filename — hash is over content, not filename).
 *
 * Requires MySQL to be available. Tests are skipped when MySQL is not reachable.
 */

const REPO_ROOT = resolve(process.cwd(), '..');
const RIG_SCRIPT = resolve(REPO_ROOT, 'scripts', 'rig.mjs');
const SMALL_10_CONFIG = 'config/rigs/small-10.toml';

/** Quick MySQL connectivity probe — returns true if MySQL accepts connections. */
function mysqlAvailable(): boolean {
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

/** Run rig.mjs once and return the SHA-256 hash from stdout. */
function runRigAndGetHash(): string {
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
    const m = r.stdout.match(/sha256=([0-9a-f]{64})/);
    expect(m).toBeTruthy();
    // Cleanup tarball
    for (const f of readdirSync(REPO_ROOT).filter((n) => /^rig_small-10_d4e5f6a7_\d+\.tar$/.test(n))) {
        unlinkSync(resolve(REPO_ROOT, f));
    }
    return m![1];
}

describe('Rig exit tarball integrity (RIG-05)', () => {
    it.skipIf(!MYSQL_UP)('produces stable SHA-256 across 3 rig.mjs runs with the same config', () => {
        const hashes: string[] = [];
        for (let i = 0; i < 3; i++) {
            hashes.push(runRigAndGetHash());
        }
        expect(hashes[0]).toBe(hashes[1]);
        expect(hashes[1]).toBe(hashes[2]);
    }, 360_000);  // 3 runs × 120s each
});
