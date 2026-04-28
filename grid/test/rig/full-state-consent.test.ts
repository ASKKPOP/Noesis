import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * T-10-16 defense: --full-state consent prompt copy is VERBATIM-LOCKED.
 * Any change to the wording REQUIRES updating this test.
 * Clones the IrreversibilityDialog Phase 8/13 verbatim-test pattern.
 *
 * These tests do NOT require MySQL — they verify the CLI behavior without
 * actually running a rig (the NOESIS_RIG_PARENT guard or --full-state rejection
 * happen before any DB connection is attempted, or the source is inspected directly).
 */

/** Verbatim-locked consent prompt (D-14-05, T-10-16). Any change here requires updating rig.mjs too. */
const VERBATIM_PROMPT = [
    '⚠️  FULL-STATE EXPORT — IRREVERSIBLE PRIVACY DECISION',
    '',
    'You are about to export plaintext Telos goals, internal Nous memory, and personality',
    'data that has NEVER been broadcast publicly. Once published, this export cannot be',
    'redacted from copies that have been shared.',
    '',
    'This is a per-run consent — even the same researcher must reconfirm for each rig run.',
    '',
    'If you are sure, set NOESIS_FULL_STATE_CONSENT="I-CONSENT-TO-PLAINTEXT-EXPORT" and re-run.',
].join('\n');

const RIG_SCRIPT = resolve(process.cwd(), '..', 'scripts', 'rig.mjs');

describe('--full-state consent prompt (T-10-16)', () => {
    it('rig.mjs source contains the verbatim consent prompt unchanged', () => {
        const src = readFileSync(RIG_SCRIPT, 'utf8');
        expect(src).toContain(VERBATIM_PROMPT);
    });

    it('--full-state without env var exits non-zero and prints the verbatim prompt to stderr', () => {
        // This test does NOT need MySQL — rig.mjs calls requireFullStateConsent() before
        // any DB connection when --full-state is set without the consent env var.
        const r = spawnSync('node', [RIG_SCRIPT, 'config/rigs/small-10.toml', '--full-state'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                NOESIS_FULL_STATE_CONSENT: '',
                // Prevent nested-rig rejection from interfering
                NOESIS_RIG_PARENT: undefined,
            },
            cwd: resolve(process.cwd(), '..'),
        });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain(VERBATIM_PROMPT);
    }, 15_000);

    it('FULL_STATE_CONSENT_PROMPT constant in rig.mjs contains all required lines', () => {
        // Extra guard: verify that the source constant contains every required line
        // of the verbatim prompt (the source uses a template literal; the test uses array.join).
        const src = readFileSync(RIG_SCRIPT, 'utf8');
        // The template literal form appears literally in the source — check key unique lines
        expect(src).toContain('FULL-STATE EXPORT — IRREVERSIBLE PRIVACY DECISION');
        expect(src).toContain('plaintext Telos goals, internal Nous memory, and personality');
        expect(src).toContain('NEVER been broadcast publicly');
        expect(src).toContain('per-run consent');
        expect(src).toContain('NOESIS_FULL_STATE_CONSENT="I-CONSENT-TO-PLAINTEXT-EXPORT"');
        // And that the whole joined prompt appears in the source as a literal string
        expect(src).toContain(VERBATIM_PROMPT);
    });
});
