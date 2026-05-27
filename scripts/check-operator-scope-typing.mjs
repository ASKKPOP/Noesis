#!/usr/bin/env node
/**
 * Phase 39 — TENANT-02 / D-39-10
 * CI gate: every exported function in grid/src/operator/data/ must include
 * `operatorDid: string` as a parameter.
 *
 * Usage: node scripts/check-operator-scope-typing.mjs
 * Exit 0: all functions have operatorDid: string parameter.
 * Exit 1: one or more functions are missing the parameter.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const TARGET_DIR = join(ROOT, 'grid', 'src', 'operator', 'data');

// Matches: export function foo(   OR   export async function foo(
const EXPORT_FN_RE = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;

function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            yield* walkDir(p);
        } else if (e.isFile() && /\.ts$/.test(e.name) && !e.name.endsWith('.d.ts')) {
            yield p;
        }
    }
}

/**
 * Returns a list of violations: { file, fn } for every exported function
 * whose signature does not include `operatorDid: string`.
 */
function scanFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const violations = [];

    let match;
    EXPORT_FN_RE.lastIndex = 0;
    while ((match = EXPORT_FN_RE.exec(text)) !== null) {
        const fnName = match[1];
        const parenStart = match.index + match[0].length; // position after the opening (

        // Extract parameter list: find matching closing paren
        let depth = 1;
        let i = parenStart;
        while (i < text.length && depth > 0) {
            if (text[i] === '(') depth++;
            else if (text[i] === ')') depth--;
            i++;
        }
        const params = text.slice(parenStart, i - 1);

        if (!params.includes('operatorDid: string')) {
            violations.push({
                file: relative(ROOT, filePath),
                fn: fnName,
            });
        }
    }
    return violations;
}

const allViolations = [];
for (const filePath of walkDir(TARGET_DIR)) {
    allViolations.push(...scanFile(filePath));
}

if (allViolations.length === 0) {
    console.log(`[check-operator-scope-typing] OK — all exported functions in grid/src/operator/data/ include operatorDid: string parameter.`);
    process.exit(0);
}

console.error('[check-operator-scope-typing] VIOLATIONS FOUND — missing operatorDid: string parameter:');
for (const v of allViolations) {
    console.error(`  ${v.file}  function ${v.fn}`);
}
process.exit(1);
