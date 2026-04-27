/**
 * Phase 12 Wave 0 RED stub — VOTE-01..04 sole-producer boundary.
 *
 * Clones grid/test/whisper/whisper-producer-boundary.test.ts (Phase 11).
 *
 * Four describe blocks — one per governance event. Each block enforces:
 *   1. Event literal appears ONLY in allowlist + sole-producer file + known consumers.
 *   2. No file except the sole-producer calls audit.append('event.literal', ...).
 *   3. Forbidden sibling strings (D-12-01) never appear in grid/src/.
 *
 * RED at Wave 0: the four sole-producer files do not yet exist.
 *   - File-exists probes for appendProposalOpened.ts, appendBallotCommitted.ts,
 *     appendBallotRevealed.ts, appendProposalTallied.ts all FAIL until Wave 2.
 *
 * Known consumers: initially empty ([] for all four events).
 *   If during Wave 2/3 a consumer genuinely must reference a governance event
 *   literal, append it to the corresponding KNOWN_CONSUMERS array in the same
 *   commit. Consumers that receive events via AuditChain.onAppend do NOT need
 *   to appear here (they never reference the string literal directly).
 *
 * Mitigates T-09-15 (operator elevation of privilege via governance path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

// ── proposal.opened ────────────────────────────────────────────────────────────

const SOLE_EMITTER_PROPOSAL_OPENED = 'governance/appendProposalOpened.ts';
const GOVERNANCE_TYPES_FILE = 'governance/types.ts';

// Known consumers that reference 'proposal.opened' but never call audit.append.
// governance/types.ts references it in SYNC docblock. Add Wave 2/3 consumers here.
const KNOWN_CONSUMERS_PROPOSAL_OPENED: string[] = [
    GOVERNANCE_TYPES_FILE,
];

describe("'proposal.opened' sole-producer boundary (VOTE-01 / D-12-01)", () => {
    it("'proposal.opened' literal appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/proposal\.opened/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_PROPOSAL_OPENED, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_PROPOSAL_OPENED].sort();
        expect(hits).toEqual(expected);
    });

    it('sole producer file appendProposalOpened.ts exists (RED until Wave 2)', () => {
        const emitterPath = join(GRID_SRC, SOLE_EMITTER_PROPOSAL_OPENED);
        expect(
            existsSync(emitterPath),
            `sole producer file missing: ${SOLE_EMITTER_PROPOSAL_OPENED} — create it in Wave 2`,
        ).toBe(true);
    });

    it('no file in grid/src/ except appendProposalOpened.ts directly emits proposal.opened via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_PROPOSAL_OPENED) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]proposal\.opened['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('proposal.opened forbidden siblings never appear in grid/src/ (D-12-01)', () => {
        const siblings = ['proposal.created', 'proposal.draft', 'proposal.submitted'];
        const hits: Array<{ sibling: string; file: string }> = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            for (const s of siblings) {
                if (src.includes(s)) {
                    hits.push({ sibling: s, file: relative(GRID_SRC, file).replace(/\\/g, '/') });
                }
            }
        }
        expect(hits).toEqual([]);
    });
});

// ── ballot.committed ───────────────────────────────────────────────────────────

const SOLE_EMITTER_BALLOT_COMMITTED = 'governance/appendBallotCommitted.ts';

const KNOWN_CONSUMERS_BALLOT_COMMITTED: string[] = [
    GOVERNANCE_TYPES_FILE,
];

describe("'ballot.committed' sole-producer boundary (VOTE-02 / D-12-01)", () => {
    it("'ballot.committed' literal appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/ballot\.committed/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_BALLOT_COMMITTED, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_BALLOT_COMMITTED].sort();
        expect(hits).toEqual(expected);
    });

    it('sole producer file appendBallotCommitted.ts exists (RED until Wave 2)', () => {
        const emitterPath = join(GRID_SRC, SOLE_EMITTER_BALLOT_COMMITTED);
        expect(
            existsSync(emitterPath),
            `sole producer file missing: ${SOLE_EMITTER_BALLOT_COMMITTED} — create it in Wave 2`,
        ).toBe(true);
    });

    it('no file in grid/src/ except appendBallotCommitted.ts directly emits ballot.committed via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_BALLOT_COMMITTED) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]ballot\.committed['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('ballot.committed forbidden siblings never appear in grid/src/ (D-12-01)', () => {
        const siblings = ['ballot.cast', 'vote.committed', 'vote.cast'];
        const hits: Array<{ sibling: string; file: string }> = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            for (const s of siblings) {
                if (src.includes(s)) {
                    hits.push({ sibling: s, file: relative(GRID_SRC, file).replace(/\\/g, '/') });
                }
            }
        }
        expect(hits).toEqual([]);
    });
});

// ── ballot.revealed ────────────────────────────────────────────────────────────

const SOLE_EMITTER_BALLOT_REVEALED = 'governance/appendBallotRevealed.ts';

const KNOWN_CONSUMERS_BALLOT_REVEALED: string[] = [
    GOVERNANCE_TYPES_FILE,
];

describe("'ballot.revealed' sole-producer boundary (VOTE-03 / D-12-01)", () => {
    it("'ballot.revealed' literal appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/ballot\.revealed/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_BALLOT_REVEALED, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_BALLOT_REVEALED].sort();
        expect(hits).toEqual(expected);
    });

    it('sole producer file appendBallotRevealed.ts exists (RED until Wave 2)', () => {
        const emitterPath = join(GRID_SRC, SOLE_EMITTER_BALLOT_REVEALED);
        expect(
            existsSync(emitterPath),
            `sole producer file missing: ${SOLE_EMITTER_BALLOT_REVEALED} — create it in Wave 2`,
        ).toBe(true);
    });

    it('no file in grid/src/ except appendBallotRevealed.ts directly emits ballot.revealed via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_BALLOT_REVEALED) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]ballot\.revealed['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('ballot.revealed forbidden siblings never appear in grid/src/ (D-12-01)', () => {
        const siblings = ['ballot.cast', 'vote.revealed', 'vote.cast'];
        const hits: Array<{ sibling: string; file: string }> = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            for (const s of siblings) {
                if (src.includes(s)) {
                    hits.push({ sibling: s, file: relative(GRID_SRC, file).replace(/\\/g, '/') });
                }
            }
        }
        expect(hits).toEqual([]);
    });
});

// ── proposal.tallied ───────────────────────────────────────────────────────────

const SOLE_EMITTER_PROPOSAL_TALLIED = 'governance/appendProposalTallied.ts';

const KNOWN_CONSUMERS_PROPOSAL_TALLIED: string[] = [
    GOVERNANCE_TYPES_FILE,
];

describe("'proposal.tallied' sole-producer boundary (VOTE-04 / D-12-01)", () => {
    it("'proposal.tallied' literal appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/proposal\.tallied/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_PROPOSAL_TALLIED, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_PROPOSAL_TALLIED].sort();
        expect(hits).toEqual(expected);
    });

    it('sole producer file appendProposalTallied.ts exists (RED until Wave 2)', () => {
        const emitterPath = join(GRID_SRC, SOLE_EMITTER_PROPOSAL_TALLIED);
        expect(
            existsSync(emitterPath),
            `sole producer file missing: ${SOLE_EMITTER_PROPOSAL_TALLIED} — create it in Wave 2`,
        ).toBe(true);
    });

    it('no file in grid/src/ except appendProposalTallied.ts directly emits proposal.tallied via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_PROPOSAL_TALLIED) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]proposal\.tallied['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('proposal.tallied forbidden siblings never appear in grid/src/ (D-12-01)', () => {
        const siblings = ['governance.tallied', 'governance.opened', 'proposal.resolved'];
        const hits: Array<{ sibling: string; file: string }> = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            for (const s of siblings) {
                if (src.includes(s)) {
                    hits.push({ sibling: s, file: relative(GRID_SRC, file).replace(/\\/g, '/') });
                }
            }
        }
        expect(hits).toEqual([]);
    });
});
