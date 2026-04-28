import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Nested Rig rejection (D-14-02, RIG-02)', () => {
    it('FAILS UNTIL Wave 2: rig.mjs exits non-zero with NOESIS_RIG_PARENT set', () => {
        const rigScript = join(process.cwd(), '..', 'scripts', 'rig.mjs');
        if (!existsSync(rigScript)) {
            expect.fail('Wave 2 must create scripts/rig.mjs with NOESIS_RIG_PARENT guard at entry');
        }
        const r = spawnSync('node', [rigScript, 'config/rigs/small-10.toml'], {
            env: { ...process.env, NOESIS_RIG_PARENT: '1' }, encoding: 'utf8',
        });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/nested rig/i);
    });

    it('FAILS UNTIL Wave 2: rig.mjs sets NOESIS_RIG_PARENT=1 in its own env before bootstrapping Grid', () => {
        expect.fail('Wave 2 must set process.env.NOESIS_RIG_PARENT="1" after the entry guard passes');
    });
});
