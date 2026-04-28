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
 * Phase 11 (Plan 11-00, WHISPER-04) bumped it to 22 by appending `nous.whispered`.
 * Phase 12 (Plan 12-00, VOTE-01..04) bumped it to 26 by appending the four governance events.
 * Phase 13 (Plan 13-04, REPLAY-02) bumped it to 27 by appending `operator.exported`.
 * Phase 14 (Plans 14-01..14-05, RIG-01..05 / D-14-08) added two prefix hard-bans:
 *   - chronos.*: chronos.rig_closed is rig-internal, never broadcast
 *   - rig.*: future rig-internal events follow the same isolation rule
 * Allowlist count remains 27 (no Phase 14 additions).
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

// 1. Canonical "27 events" assertion must appear at least once in Accumulated Context.
if (!/27\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "27 events" — Phase 13 allowlist count assertion missing.');
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
  // Phase 11 addition (WHISPER-04 / Plan 11-00):
  'nous.whispered',
  // Phase 12 additions (VOTE-01..04 / Plan 12-00):
  'proposal.opened',
  'ballot.committed',
  'ballot.revealed',
  'proposal.tallied',
  // Phase 13 addition (REPLAY-02 / Plan 13-04 / D-13-09). Closed 6-tuple operator.exported event.
  // ALWAYS keep this in sync with grid/src/audit/broadcast-allowlist.ts ALLOWLIST_MEMBERS.
  'operator.exported',
];
for (const event of required) {
  const pattern = new RegExp(event.replace(/\./g, '\\.'));
  if (!pattern.test(state)) {
    failures.push(`STATE.md is missing allowlist member \`${event}\` in the Accumulated Context enumeration.`);
  }
}

// 4. replay.* prefix hard-ban: no string-quoted token starting with 'replay.' may
//    ever appear in the ALLOWLIST_MEMBERS array.
//    Phase 13 D-13 §deferred: ReplayGrid runs an isolated chain; nothing it does
//    ever reaches production. replay.* event names are permanently banned.
function checkReplayPrefixBan() {
  const allowlistPath = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
  if (!existsSync(allowlistPath)) {
    failures.push(`checkReplayPrefixBan: ${allowlistPath} not found — cannot verify ban.`);
    return;
  }
  const text = readFileSync(allowlistPath, 'utf8');
  // Match any string-quoted token starting with 'replay.' or "replay."
  const re = /['"]replay\./g;
  const matches = text.match(re);
  if (matches && matches.length > 0) {
    failures.push(
      `REPLAY PREFIX HARD-BAN VIOLATION: ${allowlistPath} contains a 'replay.*' token.\n` +
      `  Phase 13 D-13 §deferred bans replay.* allowlist members:\n` +
      `  > ReplayGrid runs its own isolated chain; nothing it does ever reaches production.\n` +
      `  Reference: .planning/phases/13-operator-replay-export/13-CONTEXT.md §deferred`
    );
  }
}

checkReplayPrefixBan();

// 5. chronos.* prefix hard-ban (Phase 14 D-14-08).
//    chronos.rig_closed is the closed 5-key tuple emitted on the Rig's isolated AuditChain
//    when a Researcher Rig terminates. It MUST NOT appear in the production broadcast
//    allowlist — Rigs are headless, off-broadcast, and researcher-internal by construction.
function checkChronosPrefixBan() {
  const allowlistPath = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
  if (!existsSync(allowlistPath)) {
    failures.push(`checkChronosPrefixBan: ${allowlistPath} not found — cannot verify ban.`);
    return;
  }
  const text = readFileSync(allowlistPath, 'utf8');
  const re = /['"]chronos\./g;
  const matches = text.match(re);
  if (matches && matches.length > 0) {
    failures.push(
      `CHRONOS PREFIX HARD-BAN VIOLATION: ${allowlistPath} contains a 'chronos.*' token.\n` +
      `  Phase 14 D-14-08 bans chronos.* allowlist members:\n` +
      `  > chronos.rig_closed lives ONLY on the Rig's isolated AuditChain; it is never broadcast.\n` +
      `  Reference: .planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-08`
    );
  }
}

// 6. rig.* prefix hard-ban (Phase 14 D-14-08).
//    Future rig-internal events (rig.*) follow the same isolation rule as chronos.rig_closed:
//    they are emitted on the Rig's isolated AuditChain only and MUST NOT cross into production
//    broadcast.
function checkRigPrefixBan() {
  const allowlistPath = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
  if (!existsSync(allowlistPath)) {
    failures.push(`checkRigPrefixBan: ${allowlistPath} not found — cannot verify ban.`);
    return;
  }
  const text = readFileSync(allowlistPath, 'utf8');
  const re = /['"]rig\./g;
  const matches = text.match(re);
  if (matches && matches.length > 0) {
    failures.push(
      `RIG PREFIX HARD-BAN VIOLATION: ${allowlistPath} contains a 'rig.*' token.\n` +
      `  Phase 14 D-14-08 bans rig.* allowlist members:\n` +
      `  > Rig-internal events live on the Rig's isolated AuditChain only; never broadcast.\n` +
      `  Reference: .planning/phases/14-researcher-rigs/14-CONTEXT.md §D-14-08`
    );
  }
}

checkChronosPrefixBan();
checkRigPrefixBan();

if (failures.length > 0) {
  console.error('[state-doc-sync] FAIL — doc drift detected:');
  for (const f of failures) console.error('  • ' + f);
  console.error('\nFix: edit .planning/STATE.md to restore the Phase 5 reconciliation (see 05-CONTEXT.md §D-11).');
  process.exit(1);
}

console.log('[state-doc-sync] OK — STATE.md is in sync with the 27-event allowlist.');
process.exit(0);
