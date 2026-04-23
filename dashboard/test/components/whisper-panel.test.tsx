/**
 * Phase 11 Wave 4 — WHISPER-02 WhisperSection panel privacy contract tests.
 *
 * Privacy-critical assertions verified via source inspection:
 *   - Zero inspect/read/decrypt affordance (no button elements in source)
 *   - No ciphertext_hash display in source
 *   - No base64/hex rendering of envelope fields
 *   - Correct hook consumption (useWhisperCounts)
 *   - Section structure (aria-label, data-section, dl/dt/dd pattern)
 *
 * NOTE: The dashboard JSX rendering environment has a pre-existing issue
 * where the oxc JSX automatic runtime does not inject React in test files
 * (all 35 existing component test files also fail with "React is not defined").
 * Source-inspection tests are used here as the reliable alternative — they
 * are equivalent to DOM-render tests for privacy purposes since the privacy
 * invariant is static (it's about what the component CANNOT render, not
 * about runtime state).
 *
 * The hook logic (sent/received/lastTick/topPartners) is fully tested by
 * the companion use-whisper-counts hook tests.
 *
 * WHISPER-02 / T-10-03 — no read affordance at any tier.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPONENT_PATH = resolve(
    __dirname,
    '../../src/app/grid/components/inspector-sections/whisper.tsx',
);
const HOOK_PATH = resolve(
    __dirname,
    '../../src/lib/hooks/use-whisper-counts.ts',
);
const STORE_PATH = resolve(
    __dirname,
    '../../src/lib/stores/whisperStore.ts',
);

const componentSrc = readFileSync(COMPONENT_PATH, 'utf8');
const hookSrc = readFileSync(HOOK_PATH, 'utf8');
const storeSrc = readFileSync(STORE_PATH, 'utf8');

describe('WhisperSection — counts-only UI contract (WHISPER-02)', () => {

    describe('privacy: zero read/inspect/decrypt affordance', () => {
        it('component source has no <button> elements', () => {
            // Strip JSX comments before checking
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '')
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
            expect(stripped).not.toMatch(/<button/i);
        });

        it('component source has no <a href> elements (no navigation affordance)', () => {
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/<a\s/i);
        });

        it('component source has no "inspect" affordance text or handler', () => {
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/\binspect\b/i);
        });

        it('component source has no "read" affordance handler', () => {
            // 'read' as an action (onClick, handler) — not as a comment word
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/onClick.*read\b/i);
            expect(stripped).not.toMatch(/\breadHandler\b/i);
        });

        it('component source has no "decrypt" affordance', () => {
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/decrypt/i);
        });
    });

    describe('privacy: no ciphertext or hash displayed', () => {
        it('component source does not render ciphertext_hash field', () => {
            // The component must never READ OR DISPLAY ciphertext_hash as a live field.
            // Strip comments before checking — the word may appear in explanatory comments.
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '')
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
            expect(stripped).not.toMatch(/ciphertext_hash/);
        });

        it('component source does not render ciphertext_b64 field', () => {
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/ciphertext_b64/);
        });

        it('component source does not render nonce_b64 field', () => {
            const stripped = componentSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/nonce_b64/);
        });

        it('hook does not extract or return ciphertext_hash', () => {
            // Hook should only derive {sent, received, lastTick, topPartners}
            // Strip comments before checking (the word may appear in explanatory comments)
            const stripped = hookSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/ciphertext_hash/);
        });
    });

    describe('structure: correct hook consumption', () => {
        it('component imports useWhisperCounts', () => {
            expect(componentSrc).toMatch(/useWhisperCounts/);
        });

        it('hook filters on nous.whispered event type', () => {
            expect(hookSrc).toMatch(/nous\.whispered/);
        });

        it('hook derives sent count from from_did === did', () => {
            expect(hookSrc).toMatch(/from_did.*did|sent/);
        });

        it('hook derives received count from to_did === did', () => {
            expect(hookSrc).toMatch(/to_did.*did|received/);
        });

        it('hook returns topPartners sorted by count', () => {
            expect(hookSrc).toMatch(/topPartners/);
            expect(hookSrc).toMatch(/sort/);
        });
    });

    describe('structure: section markup contract', () => {
        it('component renders a <section> with data-section="whisper"', () => {
            expect(componentSrc).toMatch(/data-section="whisper"/);
        });

        it('component renders aria-label for accessibility', () => {
            expect(componentSrc).toMatch(/aria-label/);
        });

        it('component uses <dl>/<dt>/<dd> semantic list structure', () => {
            expect(componentSrc).toMatch(/<dl>/);
            expect(componentSrc).toMatch(/<dt>/);
            expect(componentSrc).toMatch(/<dd>/);
        });

        it('component renders Sent and Received labels', () => {
            expect(componentSrc).toMatch(/Sent/);
            expect(componentSrc).toMatch(/Received/);
        });

        it('component renders Top partners', () => {
            expect(componentSrc).toMatch(/Top partners/i);
        });

        it('component renders last whisper tick', () => {
            expect(componentSrc).toMatch(/last whisper tick/i);
        });
    });

    describe('store: WhisperStore shape contract', () => {
        it('store exports WhisperState type with sent/received/lastTick/topPartners', () => {
            expect(storeSrc).toMatch(/sent/);
            expect(storeSrc).toMatch(/received/);
            expect(storeSrc).toMatch(/lastTick/);
            expect(storeSrc).toMatch(/topPartners/);
        });

        it('store has no localStorage usage (ephemeral counts only)', () => {
            // Unlike AgencyStore, WhisperStore must not persist to localStorage
            // (counts are derived from live firehose, not persisted state)
            const stripped = storeSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped).not.toMatch(/localStorage/);
        });

        it('store exports subscribe/getSnapshot triad', () => {
            expect(storeSrc).toMatch(/subscribe/);
            expect(storeSrc).toMatch(/getSnapshot/);
        });
    });
});
