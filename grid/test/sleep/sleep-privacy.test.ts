import { describe, expect, it } from 'vitest';
import { HYPNOS_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN } from '../../src/audit/broadcast-allowlist.js';

describe('Hypnos privacy — D-16-10 / T-16-01', () => {
    it('HYPNOS_FORBIDDEN_KEYS contains all 6 forbidden keys', () => {
        const expected = ['ltm_content', 'concept_text', 'graph_data', 'episode_text', 'node_content', 'edge_content'];
        for (const k of expected) {
            expect(HYPNOS_FORBIDDEN_KEYS).toContain(k);
        }
    });

    it('FORBIDDEN_KEY_PATTERN matches ltm_content', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('ltm_content')).toBe(true);
    });

    it('FORBIDDEN_KEY_PATTERN matches concept_text', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('concept_text')).toBe(true);
    });

    it('FORBIDDEN_KEY_PATTERN matches graph_data', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('graph_data')).toBe(true);
    });

    it('FORBIDDEN_KEY_PATTERN matches episode_text', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('episode_text')).toBe(true);
    });

    it('FORBIDDEN_KEY_PATTERN matches node_content', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('node_content')).toBe(true);
    });

    it('FORBIDDEN_KEY_PATTERN matches edge_content', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('edge_content')).toBe(true);
    });

    it('ltm_snapshot_hash is NOT matched by FORBIDDEN_KEY_PATTERN (allowed field)', () => {
        expect(FORBIDDEN_KEY_PATTERN.test('ltm_snapshot_hash')).toBe(false);
    });
});
