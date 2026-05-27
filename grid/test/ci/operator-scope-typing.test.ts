/**
 * Phase 39 — CI gate: check-operator-scope-typing.mjs
 * Tests D-39-10: every exported function in grid/src/operator/data/ must include operatorDid: string
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = '/Users/desirey/Programming/src/Noesis';
const GRID_CWD = join(PROJECT_ROOT, 'grid');
const SCRIPT_PATH = join(PROJECT_ROOT, 'scripts', 'check-operator-scope-typing.mjs');

/**
 * runScript: run the CI gate script.
 * targetDir must be a path RELATIVE to PROJECT_ROOT, or an ABSOLUTE path outside PROJECT_ROOT.
 * The script does: join(ROOT, process.env.CHECK_OPERATOR_SCOPE_TARGET_DIR)
 * where ROOT = /Users/desirey/Programming/src/Noesis.
 * For temp dirs outside PROJECT_ROOT, pass the absolute path directly as the env var;
 * the script will then join(ROOT, absolutePath) which on most systems resolves to absolutePath
 * when the second argument is absolute (Node.js path.join behavior: if any part is absolute,
 * everything preceding it is discarded). So passing an absolute tmp path works correctly.
 */
function runScript(targetDirEnv: string): { exitCode: number; stdout: string; stderr: string } {
    try {
        const stdout = execSync(`node ${SCRIPT_PATH}`, {
            cwd: GRID_CWD,
            env: { ...process.env, CHECK_OPERATOR_SCOPE_TARGET_DIR: targetDirEnv },
            encoding: 'utf8',
        });
        return { exitCode: 0, stdout, stderr: '' };
    } catch (err: unknown) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        return {
            exitCode: e.status ?? 1,
            stdout: e.stdout ?? '',
            stderr: e.stderr ?? '',
        };
    }
}

/**
 * Create a temp dir INSIDE the project root so we can compute a proper relative path.
 * path.join(ROOT, relPath) only works correctly with relative paths — absolute tmp paths
 * outside ROOT would be joined as subdirectories. Using a dir inside ROOT avoids this.
 */
function makeTempDir(): string {
    const name = `operator-scope-typing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dir = join(PROJECT_ROOT, '.test-tmp', name);
    mkdirSync(dir, { recursive: true });
    return dir;
}

/** Convert an absolute path inside PROJECT_ROOT to a ROOT-relative path for the env var. */
function toRelPath(dir: string): string {
    if (!dir.startsWith(PROJECT_ROOT + '/')) {
        throw new Error(`makeTempDir must create dirs inside PROJECT_ROOT. Got: ${dir}`);
    }
    return dir.slice(PROJECT_ROOT.length + 1);
}

describe('Phase 39: check-operator-scope-typing.mjs CI gate (D-39-10)', () => {
    it('exits 0 when all exported functions in grid/src/operator/data/ include operatorDid: string parameter', () => {
        // Run against the real operator/data directory — all functions must already be compliant.
        const result = runScript('grid/src/operator/data');
        expect(result.exitCode).toBe(0);
    });

    it('exits 1 when any exported function is missing operatorDid: string parameter — reports file + function name', () => {
        const dir = makeTempDir();
        try {
            // Write a TypeScript file with an exported function missing operatorDid
            writeFileSync(
                join(dir, 'bad-store.ts'),
                `import type { Pool } from 'mysql2/promise';\n` +
                `export function badFn(pool: Pool, gridName: string): Promise<void> {\n` +
                `    return Promise.resolve();\n` +
                `}\n`,
            );
            const result = runScript(toRelPath(dir));
            expect(result.exitCode).toBe(1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('exits 0 on an empty grid/src/operator/data/ directory (no files to check)', () => {
        const dir = makeTempDir();
        try {
            const result = runScript(toRelPath(dir));
            expect(result.exitCode).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('handles export async function correctly (not just export function)', () => {
        const dir = makeTempDir();
        try {
            writeFileSync(
                join(dir, 'async-store.ts'),
                `import type { Pool } from 'mysql2/promise';\n` +
                `export async function asyncFn(pool: Pool, gridName: string, operatorDid: string): Promise<void> {\n` +
                `    return Promise.resolve();\n` +
                `}\n`,
            );
            // async function WITH operatorDid: string → exit 0
            const result = runScript(toRelPath(dir));
            expect(result.exitCode).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('does NOT flag functions with operatorDid in a different position (e.g., second param)', () => {
        const dir = makeTempDir();
        try {
            writeFileSync(
                join(dir, 'second-pos-store.ts'),
                `import type { Pool } from 'mysql2/promise';\n` +
                `export function fn(pool: Pool, operatorDid: string, other: string): Promise<void> {\n` +
                `    return Promise.resolve();\n` +
                `}\n`,
            );
            // operatorDid is the second param — should still pass (not flagged)
            const result = runScript(toRelPath(dir));
            expect(result.exitCode).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
