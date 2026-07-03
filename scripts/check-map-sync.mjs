#!/usr/bin/env node
/**
 * scripts/check-map-sync.mjs
 *
 * Map-sync CI gate (space-viz canon).
 *
 * The canonical 3D orbital map is docs/noesis-genesis-core-map.html
 * (nous-space-visualizer skill). A synced copy is served by the dashboard
 * at /map from dashboard/public/genesis-core-map.html; that copy carries a
 * mandatory "SYNCED COPY" banner comment on its second line:
 *
 *   <!-- SYNCED COPY — canonical source: docs/noesis-genesis-core-map.html ... -->
 *
 * This gate loads both files, strips the banner line(s) from the synced
 * copy (the ONLY permitted difference), and fails if any remaining line
 * differs — reporting the first divergent line in each file so drift is
 * locatable without a manual diff.
 *
 * The fix for drift is always: edit the CANONICAL file, then re-copy it to
 * dashboard/public/ and re-add the banner. Never edit the copy directly.
 *
 * Exit codes:
 *   0 — in sync (identical after banner stripping).
 *   1 — drift found (or a file is missing, or the copy lost its banner).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const CANONICAL = join(ROOT, 'docs', 'noesis-genesis-core-map.html');
const SYNCED_COPY = join(ROOT, 'dashboard', 'public', 'genesis-core-map.html');

const BANNER_RE = /^<!--\s*SYNCED COPY\b/;

function loadLines(path, label) {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch (err) {
        console.error(`[check-map-sync] FAIL — cannot read ${label}: ${path} (${err.code ?? err.message})`);
        process.exit(1);
    }
    return text.split('\n');
}

const canonicalLines = loadLines(CANONICAL, 'canonical map');
const copyLinesRaw = loadLines(SYNCED_COPY, 'synced copy');

// Strip the known header difference: the SYNCED COPY banner comment line(s).
// Track original line numbers so drift reports point at the real file lines.
const copyLines = [];
const copyLineNos = []; // 1-based original line numbers in the synced copy
let bannerCount = 0;
for (let i = 0; i < copyLinesRaw.length; i++) {
    if (BANNER_RE.test(copyLinesRaw[i].trimStart())) {
        bannerCount++;
        continue;
    }
    copyLines.push(copyLinesRaw[i]);
    copyLineNos.push(i + 1);
}

if (bannerCount === 0) {
    console.error('[check-map-sync] FAIL — synced copy is missing its mandatory banner comment:');
    console.error(`  ${SYNCED_COPY}`);
    console.error('  Expected a line matching: <!-- SYNCED COPY — canonical source: docs/noesis-genesis-core-map.html ... -->');
    process.exit(1);
}

// Compare line-by-line (canonical lines vs banner-stripped copy lines).
const truncate = (s) => (s.length > 120 ? `${s.slice(0, 117)}...` : s);
const max = Math.max(canonicalLines.length, copyLines.length);
for (let i = 0; i < max; i++) {
    const a = canonicalLines[i];
    const b = copyLines[i];
    if (a === b) continue;

    console.error('[check-map-sync] DRIFT — the maps differ beyond the SYNCED COPY banner.');
    console.error(`  canonical: ${CANONICAL}:${i + 1}`);
    console.error(`    ${a === undefined ? '<end of file — canonical is shorter>' : truncate(a)}`);
    console.error(`  copy:      ${SYNCED_COPY}:${b === undefined ? copyLinesRaw.length : copyLineNos[i]}`);
    console.error(`    ${b === undefined ? '<end of file — copy is shorter>' : truncate(b)}`);
    console.error('');
    console.error('To fix: edit the canonical docs/noesis-genesis-core-map.html, then re-sync it to');
    console.error('dashboard/public/genesis-core-map.html keeping the SYNCED COPY banner as line 2.');
    console.error('Never hand-edit the copy (space-viz canon: one map, one source of truth).');
    process.exit(1);
}

console.log(
    `[check-map-sync] OK — canonical (${canonicalLines.length} lines) and synced copy are identical ` +
    `after stripping ${bannerCount} banner line${bannerCount === 1 ? '' : 's'}.`,
);
process.exit(0);
