#!/usr/bin/env node
/**
 * STATE.md doc-sync regression gate (Phase 5 / D-11, extended Phase 8 / AGENCY-05,
 * extended Phase 10a / DRIVE-03, extended Phase 10b / BIOS-02).
 *
 * Asserts the .planning/STATE.md Accumulated Context stays in sync with the
 * frozen broadcast allowlist invariant from grid/src/audit/broadcast-allowlist.ts.
 *
 * Exits 0 when STATE.md is in sync.
 * Exits 1 with a diagnostic when drift is detected.
 *
 * Invariants enforced:
 *   1. STATE.md mentions "21 events" (the Phase-10b post-ship count).
 *   2. All 21 allowlist members appear textually in STATE.md.
 *   3. The phantom `trade.countered` only appears inside a deferred/phantom/never-emitted
 *      context block — never as a live/allowlisted event.
 *
 * Phase 6 bumped the allowlist to 16 events by adding 5 operator.* members.
 * Phase 7 (Plan 07-03, DIALOG-02) bumped it to 17 by appending `telos.refined`.
 * Phase 8 (Plan 08-02, AGENCY-05) bumped it to 18 by appending `operator.nous_deleted`.
 * Phase 10a (Plan 10a-02, DRIVE-03) bumped it to 19 by appending `ananke.drive_crossed`.
 * Phase 10b (Plan 10b-03, BIOS-02) bumped it to 21 by appending `bios.birth` + `bios.death`.
 * Any future phase that extends the allowlist must bump the count literal here
 * and append its members to the `required` array.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const statePath = resolve(repoRoot, '.planning/STATE.md');

if (!existsSync(statePath)) {
  console.error(`[state-doc-sync] FAIL: ${statePath} not found`);
  process.exit(1);
}

const state = readFileSync(statePath, 'utf8');
const failures = [];

// 1. Canonical "21 events" assertion must appear at least once in Accumulated Context.
if (!/21\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "21 events" — Phase 10b allowlist count assertion missing.');
}

// 2. Phantom `trade.countered` must NOT appear as a live/shipped event.
//    It is allowed inside a "deferred" / "future" / "phantom" / "never emitted" context window (±200 chars).
const phantomRegex = /trade\.countered/g;
const phantomMatches = [...state.matchAll(phantomRegex)];
for (const m of phantomMatches) {
  const start = Math.max(0, m.index - 200);
  const end = Math.min(state.length, m.index + 200);
  const ctx = state.slice(start, end).toLowerCase();
  const isMarkedDeferred =
    ctx.includes('deferred') ||
    ctx.includes('future') ||
    ctx.includes('phantom') ||
    ctx.includes('never emitted') ||
    ctx.includes('not emitted') ||
    ctx.includes('not allowlisted');
  if (!isMarkedDeferred) {
    failures.push(
      `STATE.md mentions \`trade.countered\` at index ${m.index} without deferred/phantom qualifier — remove or annotate.`
    );
  }
}

// 3. Every allowlist member MUST appear textually in STATE.md.
const required = [
  'nous.spawned',
  'nous.moved',
  'nous.spoke',
  'nous.direct_message',
  'trade.proposed',
  'trade.reviewed',
  'trade.settled',
  'law.triggered',
  'tick',
  'grid.started',
  'grid.stopped',
  // Phase 6 additions (AGENCY-01..04):
  'operator.inspected',
  'operator.paused',
  'operator.resumed',
  'operator.law_changed',
  'operator.telos_forced',
  // Phase 7 addition (DIALOG-02 / Plan 07-03):
  'telos.refined',
  // Phase 8 addition (AGENCY-05 / Plan 08-02):
  'operator.nous_deleted',
  // Phase 10a addition (DRIVE-03 / Plan 10a-02):
  'ananke.drive_crossed',
  // Phase 10b additions (BIOS-02 / Plan 10b-03):
  'bios.birth',
  'bios.death',
];
for (const event of required) {
  const pattern = new RegExp(event.replace(/\./g, '\\.'));
  if (!pattern.test(state)) {
    failures.push(`STATE.md is missing allowlist member \`${event}\` in the Accumulated Context enumeration.`);
  }
}

if (failures.length > 0) {
  console.error('[state-doc-sync] FAIL — doc drift detected:');
  for (const f of failures) console.error('  • ' + f);
  console.error('\nFix: edit .planning/STATE.md to restore the Phase 5 reconciliation (see 05-CONTEXT.md §D-11).');
  process.exit(1);
}

console.log('[state-doc-sync] OK — STATE.md is in sync with the 21-event allowlist.');
process.exit(0);
