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

// 1. Canonical event count assertion must appear at least once in STATE.md.
//    (Phase 13 established 27 events; STATE.md was restructured in Phase 33 Plan 33-01
//    to enumerate all 53 v2.5-era events. v3.0 STATE.md tracks 56 (v2.6 end-state) → 68 (Phase 43).
//    Accept any of: "53 events" (v2.5), "56 events" (v2.6), or "68 events" (v3.0 Phase 43).)
if (!/(?:53|56|68)\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "53 events" / "56 events" / "68 events" — allowlist count assertion missing.');
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
  // Phase 33 additions (D-33-A1 / OBS-08, OBS-09, OBS-08b):
  'portal.auth.login',
  'portal.auth.register',
  'human.identified',
  // Phase 43 addition (FORK-04 / D-43-04): operator.nous_forked at position 68.
  'operator.nous_forked',
  // Phase 44 additions (MKT-06 / D-44-01): market.* at positions 69-72.
  'market.listing_created',
  'market.bid_placed',
  'market.settled',
  'market.disputed',
  // Phase 45 additions (IRS-04): irs.* at positions 73-75.
  'irs.tax_collected',
  'irs.disbursement_authorized',
  'irs.disbursement_executed',
  // Phase 46 additions (CIVGOV-06): gov.* at positions 76-81.
  'gov.bill_drafted',
  'gov.bill_cosponsored',
  'gov.session_opened',
  'gov.session_closed',
  'gov.law_enacted',
  'gov.law_repealed',
  // Phase 48b additions (LAND-01..05 / D-48b-01): zoning.* + treasury.* at positions 82-86.
  'zoning.parcel_purchased',
  'treasury.parcel_revenue',
  'zoning.structure_built',
  'zoning.structure_joined',
  'zoning.structure_left',
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

// 7. Phase 33 D-33-D3: ALLOWLIST_MEMBERS literal-count + 3 new event-name presence assertions.
//    Phase 33 D-33-A1 expands the allowlist from 53 to 56 by adding
//    portal.auth.login (pos 54), portal.auth.register (pos 55), human.identified (pos 56).
function checkAllowlistCount() {
  const allowlistPath = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
  if (!existsSync(allowlistPath)) {
    failures.push(`checkAllowlistCount: ${allowlistPath} not found — cannot verify count.`);
    return;
  }
  const text = readFileSync(allowlistPath, 'utf8');

  // Count quoted entries in ALLOWLIST_MEMBERS (each on its own line, starting with leading whitespace + quote).
  // Current target: 125 members. Growth since Phase 48b (86): the Economic Reality Loop +
  // Organs + Loop-Wiring programs (parallel, Phases 80+) added L1b due.* (107→110), L2b
  // procurement.* (110→116), L3b orbital.object_built (117), O2b human.approval.* (118→120),
  // and W4 portal.account_endowed (121, D-MONEY-09 model-first endowment); Phase 47 Police
  // adds police.complaint_filed + police.investigation_opened (121 → 123).
  const arrayMatch = text.match(/export const ALLOWLIST_MEMBERS:[^=]*=\s*\[([\s\S]*?)\] as const;/);
  if (!arrayMatch) {
    failures.push('checkAllowlistCount: could not locate ALLOWLIST_MEMBERS array literal in broadcast-allowlist.ts');
    return;
  }
  const arrayBody = arrayMatch[1];
  const members = arrayBody.match(/^\s+'[a-z][a-z0-9_.]+'/gm) ?? [];
  if (members.length !== 125) {
    failures.push(
      `ALLOWLIST_MEMBERS count mismatch: expected 125 entries, found ${members.length}.\n` +
      `  Phase 48b reached 86; the Economic Reality Loop / Organs / Loop-Wiring programs grew it\n` +
      `  to 120 (due.* / procurement.* / orbital.* / human.approval.*); W4 adds\n` +
      `  portal.account_endowed (121, D-MONEY-09). Bump this literal + append below when extending.`,
    );
  }

  // Phase 45 IRS-04: the 3 irs.* events at positions 73-75.
  if (!text.includes("'irs.tax_collected'")) {
    failures.push('ALLOWLIST_MEMBERS missing irs.tax_collected (Phase 45 IRS-04, position 73).');
  }
  if (!text.includes("'irs.disbursement_authorized'")) {
    failures.push('ALLOWLIST_MEMBERS missing irs.disbursement_authorized (Phase 45 IRS-04, position 74).');
  }
  if (!text.includes("'irs.disbursement_executed'")) {
    failures.push('ALLOWLIST_MEMBERS missing irs.disbursement_executed (Phase 45 IRS-04, position 75).');
  }
  // Phase 46 CIVGOV-06: the 6 gov.* events at positions 76-81.
  for (const [name, pos] of [
    ['gov.bill_drafted', 76], ['gov.bill_cosponsored', 77], ['gov.session_opened', 78],
    ['gov.session_closed', 79], ['gov.law_enacted', 80], ['gov.law_repealed', 81],
  ]) {
    if (!text.includes(`'${name}'`)) {
      failures.push(`ALLOWLIST_MEMBERS missing ${name} (Phase 46 CIVGOV-06, position ${pos}).`);
    }
  }
  // Phase 48b LAND-01..05: the 5 zoning.*/treasury.* events at positions 82-86.
  for (const [name, pos] of [
    ['zoning.parcel_purchased', 82], ['treasury.parcel_revenue', 83], ['zoning.structure_built', 84],
    ['zoning.structure_joined', 85], ['zoning.structure_left', 86],
  ]) {
    if (!text.includes(`'${name}'`)) {
      failures.push(`ALLOWLIST_MEMBERS missing ${name} (Phase 48b LAND-01..05, position ${pos}).`);
    }
  }

  // W4 (D-MONEY-09): portal.account_endowed at position 121 (model-first endowment).
  if (!text.includes("'portal.account_endowed'")) {
    failures.push('ALLOWLIST_MEMBERS missing portal.account_endowed (W4 D-MONEY-09, position 121).');
  }
  // Position-by-name checks for Phase 33's 3 entries (preserved).
  if (!text.includes("'portal.auth.login'")) {
    failures.push('ALLOWLIST_MEMBERS missing portal.auth.login (Phase 33 D-33-A1, position 54).');
  }
  if (!text.includes("'portal.auth.register'")) {
    failures.push('ALLOWLIST_MEMBERS missing portal.auth.register (Phase 33 D-33-A1, position 55).');
  }
  if (!text.includes("'human.identified'")) {
    failures.push('ALLOWLIST_MEMBERS missing human.identified (Phase 33 D-33-A1, position 56).');
  }
  // Phase 43 D-43-04: operator.nous_forked at position 68 (index 67).
  if (!text.includes("'operator.nous_forked'")) {
    failures.push('ALLOWLIST_MEMBERS missing operator.nous_forked (Phase 43 D-43-04, position 68).');
  }
}

checkAllowlistCount();
checkChronosPrefixBan();
checkRigPrefixBan();

if (failures.length > 0) {
  console.error('[state-doc-sync] FAIL — doc drift detected:');
  for (const f of failures) console.error('  • ' + f);
  console.error('\nFix: edit .planning/STATE.md to restore the Phase 5 reconciliation (see 05-CONTEXT.md §D-11).');
  process.exit(1);
}

console.log('[state-doc-sync] OK — STATE.md is in sync (v2.5: 53 events + Phase 46: 81 members in broadcast-allowlist.ts).');
process.exit(0);
