/**
 * Phase 12 Wave 4 — Governance type drift detector (VOTE-07 / T-09-17 / D-12-11).
 *
 * Clone of dashboard/test/lib/whisper-types.drift.test.ts (Phase 11 pattern).
 *
 * Reads grid/src/governance/types.ts AND brain/src/noesis_brain/governance/types.py
 * as plain text and asserts the dashboard mirror at
 * dashboard/src/lib/protocol/governance-types.ts declares identical shapes.
 *
 * Detects drift on four KEYS arrays, four payload interface key sets,
 * BallotChoice union members, and GOVERNANCE_FORBIDDEN_KEYS.
 *
 * Does NOT use a full TS/Python AST — regex extraction of literal arrays and
 * interface bodies is sufficient. False-fail (too strict) is acceptable;
 * false-pass (silently allows drift) is not.
 *
 * T-09-17 mitigation: any change to grid governance types that is not mirrored
 * in the dashboard mirror will fail this test and block CI.
 *
 * Phase 12 Wave 4 — VOTE-07 / T-09-17.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── File paths ────────────────────────────────────────────────────────────────

const GRID_TYPES_PATH = resolve(__dirname, '../../../grid/src/governance/types.ts');
const BRAIN_TYPES_PATH = resolve(__dirname, '../../../brain/src/noesis_brain/governance/types.py');
const DASH_TYPES_PATH = resolve(__dirname, '../../src/lib/protocol/governance-types.ts');

const gridSrc = readFileSync(GRID_TYPES_PATH, 'utf8');
const brainSrc = readFileSync(BRAIN_TYPES_PATH, 'utf8');
const dashSrc = readFileSync(DASH_TYPES_PATH, 'utf8');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the elements of a TypeScript const array literal by name.
 * Handles:
 *   - single-line: NAME = ['a', 'b', 'c'] as const
 *   - multi-line arrays
 *   - `as const` suffix (stripped)
 *   - single-line comment lines inside array (skipped)
 * Returns sorted string[] for order-independent comparison.
 */
function extractTsKeysArray(source: string, name: string): string[] {
    // Match `export const NAME = [` ... `] as const` or `]`
    const pattern = new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const)?`, 'm');
    const match = source.match(pattern);
    if (!match) return [];
    const body = match[1];
    // Split on commas to handle both single-line and multi-line forms
    return body
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token && !token.startsWith('//') && !token.startsWith('\n//'))
        // Remove surrounding quotes of any variety and trailing newlines
        .map((token) => token.replace(/[\n\r]/g, '').trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
        .sort();
}

/**
 * Extract the elements of a Python tuple literal by name.
 * Handles both single-line and multi-line tuples:
 *   NAME = ("a", "b", "c")
 *   NAME = (
 *       "a",
 *       "b",
 *   )
 */
function extractPyTuple(source: string, name: string): string[] {
    const pattern = new RegExp(`${name}\\s*=\\s*\\(([\\s\\S]*?)\\)`, 'm');
    const match = source.match(pattern);
    if (!match) return [];
    const body = match[1];
    // Split on commas to handle both single-line and multi-line forms
    return body
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token && !token.startsWith('#'))
        .map((token) => token.replace(/[\n\r]/g, '').trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .sort();
}

/**
 * Extract the field names from a TypeScript `interface Name { ... }` block.
 * Returns sorted string[].
 */
function extractTsInterfaceKeys(source: string, name: string): string[] {
    const pattern = new RegExp(`interface\\s+${name}\\s*\\{([^}]*)\\}`, 'm');
    const match = source.match(pattern);
    if (!match) return [];
    const body = match[1];
    return body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
        .map((line) => {
            // Extract the key name: `readonly foo: type;`
            const fieldMatch = line.match(/^(?:readonly\s+)?(\w+)\s*[?:]?:/);
            return fieldMatch ? fieldMatch[1] : null;
        })
        .filter((k): k is string => Boolean(k))
        .sort();
}

/**
 * Extract the field names from a Python @dataclass `class Name: ...` block.
 * Robustly skips docstrings (which contain blank lines that would break
 * a simple \n\n-terminated approach). Collects `name: type` lines after the docstring.
 * Returns sorted string[].
 */
function extractPyDataclassKeys(source: string, name: string): string[] {
    const classStart = source.search(new RegExp(`class\\s+${name}[^:]*:`));
    if (classStart === -1) return [];
    // Grab everything from the class definition to end of source
    const rest = source.slice(classStart);
    const lines = rest.split('\n');

    const fields: string[] = [];
    let inDocstring = false;
    let docstringDone = false;
    let bodyStarted = false;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!bodyStarted) {
            // First non-empty line after class header
            if (trimmed) bodyStarted = true;
            else continue;
        }

        // Track triple-quoted docstrings (Python style)
        if (!inDocstring && !docstringDone && trimmed.startsWith('"""')) {
            inDocstring = true;
            // Single-line docstring: `"""..."""`
            if (trimmed.length > 6 && trimmed.endsWith('"""') && trimmed !== '"""') {
                inDocstring = false;
                docstringDone = true;
            }
            continue;
        }
        if (inDocstring) {
            if (trimmed.endsWith('"""')) {
                inDocstring = false;
                docstringDone = true;
            }
            continue;
        }

        // After docstring: collect field lines; stop at blank line or next class
        if (!trimmed || trimmed.startsWith('@dataclass') || trimmed.startsWith('class ') || trimmed.startsWith('#')) {
            if (fields.length > 0 && !trimmed) break; // blank line after fields = end
            continue;
        }

        const fieldMatch = trimmed.match(/^(\w+)\s*:/);
        if (fieldMatch) {
            fields.push(fieldMatch[1]);
        }
    }

    return fields.sort();
}

/**
 * Extract BallotChoice union members from TS source.
 * Handles: `type BallotChoice = 'yes' | 'no' | 'abstain';`
 */
function extractTsUnionMembers(source: string, name: string): string[] {
    const pattern = new RegExp(`type\\s+${name}\\s*=([^;]+)`, 'm');
    const match = source.match(pattern);
    if (!match) return [];
    return match[1]
        .split('|')
        .map((m) => m.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
        .sort();
}

// ── Tests: KEYS arrays ────────────────────────────────────────────────────────

describe('governance-types drift detector (T-09-17 / VOTE-07)', () => {

    describe('PROPOSAL_OPENED_KEYS', () => {
        it('grid and dashboard declare identical PROPOSAL_OPENED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'PROPOSAL_OPENED_KEYS');
            const dashKeys = extractTsKeysArray(dashSrc, 'PROPOSAL_OPENED_KEYS');
            expect(gridKeys.length, 'PROPOSAL_OPENED_KEYS must not be empty').toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('brain declares identical PROPOSAL_OPENED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'PROPOSAL_OPENED_KEYS');
            const brainKeys = extractPyTuple(brainSrc, 'PROPOSAL_OPENED_KEYS');
            expect(brainKeys).toEqual(gridKeys);
        });
    });

    describe('BALLOT_COMMITTED_KEYS', () => {
        it('grid and dashboard declare identical BALLOT_COMMITTED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'BALLOT_COMMITTED_KEYS');
            const dashKeys = extractTsKeysArray(dashSrc, 'BALLOT_COMMITTED_KEYS');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('brain declares identical BALLOT_COMMITTED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'BALLOT_COMMITTED_KEYS');
            const brainKeys = extractPyTuple(brainSrc, 'BALLOT_COMMITTED_KEYS');
            expect(brainKeys).toEqual(gridKeys);
        });
    });

    describe('BALLOT_REVEALED_KEYS', () => {
        it('grid and dashboard declare identical BALLOT_REVEALED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'BALLOT_REVEALED_KEYS');
            const dashKeys = extractTsKeysArray(dashSrc, 'BALLOT_REVEALED_KEYS');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('brain declares identical BALLOT_REVEALED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'BALLOT_REVEALED_KEYS');
            const brainKeys = extractPyTuple(brainSrc, 'BALLOT_REVEALED_KEYS');
            expect(brainKeys).toEqual(gridKeys);
        });
    });

    describe('PROPOSAL_TALLIED_KEYS', () => {
        it('grid and dashboard declare identical PROPOSAL_TALLIED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'PROPOSAL_TALLIED_KEYS');
            const dashKeys = extractTsKeysArray(dashSrc, 'PROPOSAL_TALLIED_KEYS');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('brain declares identical PROPOSAL_TALLIED_KEYS', () => {
            const gridKeys = extractTsKeysArray(gridSrc, 'PROPOSAL_TALLIED_KEYS');
            const brainKeys = extractPyTuple(brainSrc, 'PROPOSAL_TALLIED_KEYS');
            expect(brainKeys).toEqual(gridKeys);
        });
    });

    // ── Interface key sets ────────────────────────────────────────────────────

    describe('payload interface key parity', () => {
        it('ProposalOpenedPayload: grid and dashboard have identical fields', () => {
            const gridKeys = extractTsInterfaceKeys(gridSrc, 'ProposalOpenedPayload');
            const dashKeys = extractTsInterfaceKeys(dashSrc, 'ProposalOpenedPayload');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('BallotCommittedPayload: grid and dashboard have identical fields', () => {
            const gridKeys = extractTsInterfaceKeys(gridSrc, 'BallotCommittedPayload');
            const dashKeys = extractTsInterfaceKeys(dashSrc, 'BallotCommittedPayload');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('BallotRevealedPayload: grid and dashboard have identical fields', () => {
            const gridKeys = extractTsInterfaceKeys(gridSrc, 'BallotRevealedPayload');
            const dashKeys = extractTsInterfaceKeys(dashSrc, 'BallotRevealedPayload');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('ProposalTalliedPayload: grid and dashboard have identical fields', () => {
            const gridKeys = extractTsInterfaceKeys(gridSrc, 'ProposalTalliedPayload');
            const dashKeys = extractTsInterfaceKeys(dashSrc, 'ProposalTalliedPayload');
            expect(gridKeys.length).toBeGreaterThan(0);
            expect(dashKeys).toEqual(gridKeys);
        });

        it('ProposalTalliedPayload: brain dataclass has identical fields', () => {
            const gridKeys = extractTsInterfaceKeys(gridSrc, 'ProposalTalliedPayload');
            const brainKeys = extractPyDataclassKeys(brainSrc, 'ProposalTalliedPayload');
            expect(brainKeys).toEqual(gridKeys);
        });
    });

    // ── BallotChoice union ────────────────────────────────────────────────────

    it('BallotChoice: grid and dashboard union members are identical', () => {
        const gridMembers = extractTsUnionMembers(gridSrc, 'BallotChoice');
        const dashMembers = extractTsUnionMembers(dashSrc, 'BallotChoice');
        expect(gridMembers.length).toBeGreaterThan(0);
        expect(dashMembers).toEqual(gridMembers);
    });

    // ── SYNC headers ──────────────────────────────────────────────────────────

    it('grid types.ts has SYNC headers pointing to both brain and dashboard', () => {
        const syncMatches = gridSrc.match(/SYNC:\s*mirrors/g) ?? [];
        expect(
            syncMatches.length,
            'grid/src/governance/types.ts should have ≥2 SYNC: mirrors headers',
        ).toBeGreaterThanOrEqual(2);
        expect(gridSrc).toMatch(/brain\/src\/noesis_brain\/governance/);
        expect(gridSrc).toMatch(/dashboard\/src\/lib\/protocol\/governance-types/);
    });

    it('dashboard governance-types.ts has SYNC headers pointing to both grid and brain', () => {
        const syncMatches = dashSrc.match(/SYNC:\s*mirrors/g) ?? [];
        expect(
            syncMatches.length,
            'dashboard governance-types.ts should have ≥2 SYNC: mirrors headers',
        ).toBeGreaterThanOrEqual(2);
        expect(dashSrc).toMatch(/grid\/src\/governance\/types/);
        expect(dashSrc).toMatch(/brain\/src\/noesis_brain\/governance\/types/);
    });

    // ── Vote-weighting forbidden keys ─────────────────────────────────────────

    it('dashboard governance-types.ts does not declare vote-weighting fields (VOTE-06)', () => {
        const FORBIDDEN = ['weight', 'reputation', 'relationship_score', 'ousia_weight'];
        // Strip comments before checking
        const stripped = dashSrc
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        for (const f of FORBIDDEN) {
            expect(
                stripped,
                `dashboard governance-types.ts must not declare field "${f}"`,
            ).not.toMatch(new RegExp(`\\b${f}\\b\\s*:`));
        }
    });

    it('dashboard governance-types.ts does not declare proposal body text fields (VOTE-05)', () => {
        const FORBIDDEN = ['body_text', 'body', 'proposal_text', 'law_text'];
        const stripped = dashSrc
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        for (const f of FORBIDDEN) {
            expect(
                stripped,
                `dashboard governance-types.ts must not declare exported field "${f}"`,
            ).not.toMatch(new RegExp(`(?:^|[^a-zA-Z0-9_])${f}\\s*:`, 'm'));
        }
    });
});
