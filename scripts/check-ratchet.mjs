#!/usr/bin/env node
/**
 * scripts/check-ratchet.mjs
 *
 * Ratchet gate for patterns that spread when agents copy them. Each rule counts
 * the occurrences in product source (tests excluded). The count may go down,
 * never up. Baselines live in scripts/ratchet-baseline.json.
 *
 * Run:    node scripts/check-ratchet.mjs
 * Lower:  node scripts/check-ratchet.mjs --update   (writes counts that went DOWN; never raises one)
 * Exit:   0 at or below every baseline · 1 a count rose (file list + what to do instead).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'ratchet-baseline.json');

const TS_ROOTS = ['grid/src', 'dashboard/src', 'protocol/src', 'steward/src'];
const TS_EXT = /\.(ts|tsx)$/;
const TEST_PATH = /(\.test\.|\.spec\.|__tests__\/|\/test\/|\.d\.ts$)/;

const RULES = [
    {
        id: 'inline-id-regex',
        roots: TS_ROOTS,
        ext: TS_EXT,
        pattern: /\b(?:const|let)\s+[A-Z0-9_]*(?:DID|HEX64|HEX|ADDRESS)[A-Z0-9_]*\s*=\s*\/\^/,
        skip: ['grid/src/util/id-patterns.ts'],
        fix:
            'Do not define a DID / HEX64 / address regex inline. There are already ~190 copies in a dozen ' +
            'different shapes, some case-sensitive and some not, so two emitters disagree on the same id. ' +
            'Import HEX64_RE from grid/src/util/id-patterns.ts. If you need a DID shape that is not there yet, ' +
            'add it there once as a named export and import it.',
    },
    {
        id: 'react-use-effect',
        roots: ['dashboard/src', 'steward/src'],
        ext: TS_EXT,
        pattern: /\buseEffect\s*\(/,
        fix:
            'Do not add useEffect in product code. Derive the value during render, or read live data through ' +
            'a store subscription (useSyncExternalStore over a store in dashboard/src/lib/stores/). ' +
            'An effect that syncs state into state, or fetches on mount, is the bug class this rule removes.',
    },
    {
        id: 'type-escape',
        roots: TS_ROOTS,
        ext: TS_EXT,
        pattern: /\bas unknown as\b|\bas any\b|:\s*any\b|<any>/,
        fix:
            'Do not escape the type system. Add the missing field to the real type, narrow with a type guard, ' +
            'or parse untrusted input with a validator that returns the typed value.',
    },
    {
        id: 'suppression',
        roots: [...TS_ROOTS, 'brain/src'],
        ext: /\.(ts|tsx|py)$/,
        pattern: /@ts-ignore|@ts-expect-error|eslint-disable|#\s*type:\s*ignore|#\s*noqa/,
        fix:
            'Do not silence a checker. Fix what it reports. If the checker is wrong for a whole class of code, ' +
            'change its config in one place instead of suppressing one line.',
    },
    {
        id: 'ui-timer',
        roots: ['dashboard/src', 'steward/src'],
        ext: TS_EXT,
        pattern: /\b(?:setTimeout|requestAnimationFrame|requestIdleCallback)\s*\(/,
        fix:
            'A timer in UI code is usually a fix for ordering: it hides a race instead of removing it. ' +
            'Wait for the real event (a promise, a store update, a transition end) instead.',
    },
];

function walk(dir, out) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const name of entries) {
        if (name === 'node_modules' || name === '.next' || name === '.venv' || name === '__pycache__') continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

function scan(rule) {
    const byFile = new Map();
    for (const root of rule.roots) {
        for (const full of walk(join(ROOT, root), [])) {
            const rel = relative(ROOT, full);
            if (!rule.ext.test(rel) || TEST_PATH.test(rel) || rule.skip?.includes(rel)) continue;
            let n = 0;
            for (const line of readFileSync(full, 'utf8').split('\n')) if (rule.pattern.test(line)) n++;
            if (n > 0) byFile.set(rel, n);
        }
    }
    let total = 0;
    for (const n of byFile.values()) total += n;
    return { total, byFile };
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const update = process.argv.includes('--update');
const risen = [];
const lowered = [];

for (const rule of RULES) {
    const { total, byFile } = scan(rule);
    const base = baseline[rule.id];
    if (typeof base !== 'number') {
        console.error(`[check-ratchet] rule "${rule.id}" has no baseline in scripts/ratchet-baseline.json`);
        process.exit(1);
    }
    if (total > base) risen.push({ rule, total, base, byFile });
    else if (total < base) lowered.push({ rule, total, base });
}

if (update && lowered.length > 0) {
    for (const { rule, total } of lowered) baseline[rule.id] = total;
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 4) + '\n');
}

for (const { rule, total, base } of lowered) {
    const verb = update ? 'lowered to' : 'can be lowered to';
    console.log(`[check-ratchet] ${rule.id}: ${base} → ${total} (${verb} ${total}${update ? '' : ' — run with --update'})`);
}

if (risen.length === 0) {
    console.log(`[check-ratchet] OK — ${RULES.length} rules at or below baseline.`);
    process.exit(0);
}

for (const { rule, total, base, byFile } of risen) {
    console.error(`\n[check-ratchet] ${rule.id}: ${total} occurrences, baseline ${base} (+${total - base}).`);
    console.error(`  ${rule.fix}`);
    console.error('  Files with occurrences (the new ones are in your diff):');
    for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.error(`    ${file}  ${n}`);
}
process.exit(1);
