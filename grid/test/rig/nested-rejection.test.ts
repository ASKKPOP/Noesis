import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nested Rig rejection tests (D-14-02, RIG-02).
 * Both tests turn GREEN in Wave 2 — scripts/rig.mjs now exists with NOESIS_RIG_PARENT guard.
 */
describe('Nested Rig rejection (D-14-02, RIG-02)', () => {
    it('rig.mjs exits non-zero with NOESIS_RIG_PARENT set', () => {
        const rigScript = join(process.cwd(), '..', 'scripts', 'rig.mjs');
        if (!existsSync(rigScript)) {
            expect.fail('scripts/rig.mjs does not exist — was Wave 2 task run?');
        }
        const r = spawnSync('node', [rigScript, 'config/rigs/small-10.toml'], {
            env: { ...process.env, NOESIS_RIG_PARENT: '1' }, encoding: 'utf8',
        });
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/nested rig/i);
    });

    it('rig.mjs sets NOESIS_RIG_PARENT=1 in its own env before bootstrapping Grid', () => {
        // Verified by reading scripts/rig.mjs source: the script sets
        // process.env.NOESIS_RIG_PARENT = '1' AFTER the guard check passes.
        // This ensures any child process that re-invokes rig.mjs is rejected at entry.
        // We verify this by reading the source file and asserting the key line exists.
        const rigScript = join(process.cwd(), '..', 'scripts', 'rig.mjs');
        if (!existsSync(rigScript)) {
            expect.fail('scripts/rig.mjs does not exist');
        }
        const src = readFileSync(rigScript, 'utf8');
        // The guard check must come FIRST
        expect(src).toMatch(/NOESIS_RIG_PARENT.*=.*'1'/);
        // The set must happen AFTER the check
        const guardIdx = src.indexOf("if (process.env.NOESIS_RIG_PARENT === '1')");
        const setIdx = src.indexOf("process.env.NOESIS_RIG_PARENT = '1'");
        expect(guardIdx).toBeGreaterThanOrEqual(0);
        expect(setIdx).toBeGreaterThanOrEqual(0);
        expect(setIdx).toBeGreaterThan(guardIdx);
    });
});
