#!/usr/bin/env node
/**
 * scripts/check-verification.mjs
 *
 * Static half of the Triple Verification Rule (.planning/implementation/verification.md).
 * The dynamic half — TLC and `lake build` — is verification/run.sh.
 *
 * Fails when:
 *   1. a row of verification/PROPERTIES.md has an empty cell, names a missing file,
 *      or names a file that does not contain the property's ID;
 *   2. a property ID appears in a spec, a proof or a property test but not in the registry;
 *   3. a Lean file contains sorry / admit / axiom / native_decide;
 *   4. a .tla file has no .cfg beside it.
 *
 * It cannot tell whether a task that changed logic added properties at all. That is review.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /P-[A-Z0-9]+-\d+/g;
const SKIP = new Set(['node_modules', '.git', '.lake', '.tools', 'target', 'dist', '.next', '.venv']);
const SKIP_PATHS = new Set(['contracts/lib', 'contracts/out', 'contracts/cache']);
const errors = [];

function walk(dir, keep, found = []) {
    if (!existsSync(dir)) return found;
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (SKIP.has(name) || SKIP_PATHS.has(relative(ROOT, path))) continue;
        if (statSync(path).isDirectory()) walk(path, keep, found);
        else if (keep(path)) found.push(path);
    }
    return found;
}
const rel = (p) => relative(ROOT, p);

// 1. Registry rows.
const registry = new Set();
const rows = readFileSync(join(ROOT, 'verification/PROPERTIES.md'), 'utf8')
    .split('\n')
    .filter((line) => /^\|\s*P-[A-Z0-9]+-\d+\s*\|/.test(line));
for (const row of rows) {
    const [id, sentence, ...legs] = row.split('|').slice(1, -1).map((c) => c.trim());
    if (registry.has(id)) errors.push(`${id}: listed twice`);
    registry.add(id);
    if (!sentence) errors.push(`${id}: no property sentence`);
    if (legs.length !== 3) { errors.push(`${id}: expected 3 leg cells, found ${legs.length}`); continue; }
    ['TLA+', 'Lean', 'property test'].forEach((leg, i) => {
        const cell = legs[i];
        if (/^N\/A \(V-9\.[123]\)/.test(cell)) return;
        if (!cell) { errors.push(`${id}: ${leg} cell is empty — NOT VERIFIED`); return; }
        const file = join(ROOT, cell);
        if (!existsSync(file)) { errors.push(`${id}: ${leg} file not found: ${cell}`); return; }
        if (!readFileSync(file, 'utf8').includes(id)) errors.push(`${id}: ${cell} does not mention ${id}`);
    });
}

// 2. IDs used but not registered.
const tla = walk(join(ROOT, 'verification/tla'), (p) => p.endsWith('.tla'));
const lean = walk(join(ROOT, 'verification/lean'), (p) => p.endsWith('.lean'));
const tests = walk(ROOT, (p) => /\.property\.test\.[cm]?[jt]sx?$|_properties\.(py|rs)$|\.invariant\.t\.sol$/.test(p));
for (const file of [...tla, ...lean, ...tests]) {
    for (const id of new Set(readFileSync(file, 'utf8').match(ID) ?? [])) {
        if (!registry.has(id)) errors.push(`${rel(file)}: ${id} is not in verification/PROPERTIES.md`);
    }
}

// 3. Lean escape hatches.
for (const file of lean) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const m = line.match(/\b(sorry|admit|native_decide)\b|^\s*axiom\b/);
        if (m) errors.push(`${rel(file)}:${i + 1}: forbidden \`${(m[1] ?? 'axiom')}\``);
    });
}

// 4. Every spec has a config.
for (const file of tla) {
    if (!existsSync(file.replace(/\.tla$/, '.cfg'))) errors.push(`${rel(file)}: no .cfg beside it`);
}

if (errors.length === 0) {
    console.log(`[check-verification] OK — ${registry.size} properties, ${tla.length} TLA+ spec(s), ${lean.length} Lean file(s), ${tests.length} property-test file(s).`);
    process.exit(0);
}
console.error('[check-verification] FAILED:');
for (const e of errors) console.error(`  ${e}`);
process.exit(1);
