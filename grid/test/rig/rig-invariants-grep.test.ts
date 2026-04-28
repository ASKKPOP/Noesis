import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const GATE_SCRIPT = join(process.cwd(), '..', 'scripts', 'check-rig-invariants.mjs');

function runGateInDir(dir: string): { code: number; stdout: string; stderr: string } {
    const r = spawnSync('node', [GATE_SCRIPT], {
        cwd: dir, encoding: 'utf8',
    });
    return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('check-rig-invariants.mjs', () => {
    it('exits 0 when rig.mjs is absent (no false positive on missing file)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rig-gate-'));
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        mkdirSync(join(dir, 'grid', 'src', 'rig'), { recursive: true });
        const r = runGateInDir(dir);
        expect(r.code).toBe(0);
    });

    it('exits 1 when rig.mjs contains httpServer.listen (T-10-12)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rig-gate-'));
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        mkdirSync(join(dir, 'grid', 'src', 'rig'), { recursive: true });
        writeFileSync(join(dir, 'scripts', 'rig.mjs'), `httpServer.listen(8080);\n`);
        const r = runGateInDir(dir);
        expect(r.code).toBe(1);
        expect(r.stderr).toMatch(/T-10-12/);
    });

    it('exits 1 when rig.mjs contains a bypass flag like --skip-audit (T-10-13)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rig-gate-'));
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        mkdirSync(join(dir, 'grid', 'src', 'rig'), { recursive: true });
        writeFileSync(join(dir, 'scripts', 'rig.mjs'), `if (args.includes('--skip-audit')) { /* bad */ }\n`);
        const r = runGateInDir(dir);
        expect(r.code).toBe(1);
        expect(r.stderr).toMatch(/T-10-13/);
    });

    it('exits 0 when rig.mjs uses --permissive (NOT a bypass per D-14-05)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rig-gate-'));
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        mkdirSync(join(dir, 'grid', 'src', 'rig'), { recursive: true });
        writeFileSync(join(dir, 'scripts', 'rig.mjs'), `if (args.includes('--permissive')) { /* fine */ }\n`);
        const r = runGateInDir(dir);
        expect(r.code).toBe(0);
    });

    it('also scans grid/src/rig/** for bypass flags', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rig-gate-'));
        mkdirSync(join(dir, 'scripts'), { recursive: true });
        mkdirSync(join(dir, 'grid', 'src', 'rig'), { recursive: true });
        writeFileSync(join(dir, 'grid', 'src', 'rig', 'foo.ts'), `const x = '--bypass-tier-cap';\n`);
        const r = runGateInDir(dir);
        expect(r.code).toBe(1);
    });
});
