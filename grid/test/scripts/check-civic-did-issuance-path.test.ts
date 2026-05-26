/**
 * Phase 37 Plan 04 — D-V3-33 Portal-gating constitutional CI gate test.
 *
 * Exercises scripts/check-civic-did-issuance-path.mjs against:
 *   A. The real repo (Plans 01/02/03 shipped — registry.ts is sole production importer).
 *      Gate MUST exit 0.
 *   B. Synthetic violators (non-approved .ts files importing append-registry-* tokens).
 *      Gate MUST exit 1 with violation output containing the file path + token.
 *   C. *.test.ts violators — gate MUST NOT flag them (test files are exempt).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// vitest runs from grid/ directory; repo root is one level up.
const REPO_ROOT = resolve(process.cwd(), '..');
const GATE_SCRIPT = join(REPO_ROOT, 'scripts', 'check-civic-did-issuance-path.mjs');

const VIOLATOR_PATH = join(REPO_ROOT, 'grid', 'src', '__test_violator_civic_issuance__.ts');
const VIOLATOR_TEST_PATH = join(REPO_ROOT, 'grid', 'src', '__test_violator_civic_issuance__.test.ts');

function runGate(): { stdout: string; stderr: string; code: number } {
    try {
        const stdout = execSync(`node ${GATE_SCRIPT}`, {
            cwd: REPO_ROOT,
            stdio: 'pipe',
        }).toString();
        return { stdout, stderr: '', code: 0 };
    } catch (err) {
        const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
        return {
            stdout: e.stdout?.toString() ?? '',
            stderr: e.stderr?.toString() ?? '',
            code: e.status ?? 1,
        };
    }
}

describe('check-civic-did-issuance-path CI gate', () => {
    afterEach(() => {
        // Clean up any synthetic violators left by tests.
        if (existsSync(VIOLATOR_PATH)) unlinkSync(VIOLATOR_PATH);
        if (existsSync(VIOLATOR_TEST_PATH)) unlinkSync(VIOLATOR_TEST_PATH);
    });

    it('exits 0 on the current repo (registry.ts is the only legitimate production importer)', () => {
        const { stdout, code } = runGate();
        expect(code).toBe(0);
        expect(stdout).toMatch(/\[check-civic-did-issuance-path\] OK —/);
    });

    it('exits 1 when an unauthorised file imports appendRegistryCivicDidIssued', () => {
        writeFileSync(
            VIOLATOR_PATH,
            '// synthetic violator — should never live in main\n' +
            "import { appendRegistryCivicDidIssued } from './audit/append-registry-civic-did-issued.js';\n" +
            'void appendRegistryCivicDidIssued;\n',
            'utf8',
        );
        const { stderr, code } = runGate();
        expect(code).toBe(1);
        expect(stderr).toMatch(/VIOLATIONS FOUND/);
        expect(stderr).toContain('__test_violator_civic_issuance__.ts');
        expect(stderr).toContain('append-registry-civic-did-issued');
        expect(stderr).toMatch(/D-V3-33/);
    });

    it('exits 1 when an unauthorised file imports appendRegistryBusinessDidDissolved', () => {
        writeFileSync(
            VIOLATOR_PATH,
            "import { appendRegistryBusinessDidDissolved } from './audit/append-registry-business-did-dissolved.js';\n" +
            'void appendRegistryBusinessDidDissolved;\n',
            'utf8',
        );
        const { stderr, code } = runGate();
        expect(code).toBe(1);
        expect(stderr).toMatch(/VIOLATIONS FOUND/);
        expect(stderr).toContain('append-registry-business-did-dissolved');
    });

    it('does NOT flag *.test.ts files that import producer modules (test files are exempt)', () => {
        writeFileSync(
            VIOLATOR_TEST_PATH,
            "import { appendRegistryCivicDidIssued } from './audit/append-registry-civic-did-issued.js';\n" +
            'void appendRegistryCivicDidIssued;\n',
            'utf8',
        );
        const { stdout, code } = runGate();
        expect(code).toBe(0);
        expect(stdout).toMatch(/\[check-civic-did-issuance-path\] OK —/);
    });
});
