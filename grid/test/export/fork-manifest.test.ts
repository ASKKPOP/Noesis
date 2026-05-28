/**
 * Phase 43 Plan 02 — createForkManifest tests.
 *
 * Tests for grid/src/export/fork-manifest.ts.
 */
import { describe, it, expect } from 'vitest';
import { createForkManifest } from '../../src/export/fork-manifest.js';

function validInput() {
    return {
        exportedAt: '2026-05-27T12:00:00Z',
        exportedAtTick: 100,
        nousCivicDid: 'did:civic:noesis:abc',
        nousExistenceDid: 'did:noesis:nous:xyz',
        gridId: 'genesis',
        exportHash: 'a'.repeat(64),
        chainTailHash: 'b'.repeat(64),
        memoryFiles: ['nous.db'],
    };
}

describe('createForkManifest — schema (Plan 02)', () => {
    it('43-02-23: returns object with all required fields (format_version, exported_at, exported_at_tick, nous_civic_did, nous_existence_did, grid_id, export_hash, chain_tail_hash, memory_files, note)', () => {
        const manifest = createForkManifest(validInput());
        expect(manifest).toHaveProperty('format_version');
        expect(manifest).toHaveProperty('exported_at');
        expect(manifest).toHaveProperty('exported_at_tick');
        expect(manifest).toHaveProperty('nous_civic_did');
        expect(manifest).toHaveProperty('nous_existence_did');
        expect(manifest).toHaveProperty('grid_id');
        expect(manifest).toHaveProperty('export_hash');
        expect(manifest).toHaveProperty('chain_tail_hash');
        expect(manifest).toHaveProperty('memory_files');
        expect(manifest).toHaveProperty('note');
    });

    it('43-02-24: format_version is literal "1.0"', () => {
        const manifest = createForkManifest(validInput());
        expect(manifest.format_version).toBe('1.0');
    });

    it('43-02-25: throws TypeError when chainTailHash does not match HEX64_RE', () => {
        const input = { ...validInput(), chainTailHash: 'not-a-hex-hash' };
        expect(() => createForkManifest(input)).toThrow(TypeError);
    });

    it('43-02-26: throws TypeError when exportHash does not match HEX64_RE', () => {
        const input = { ...validInput(), exportHash: 'short' };
        expect(() => createForkManifest(input)).toThrow(TypeError);
    });

    it('43-02-27: memory_files is an array of strings', () => {
        const manifest = createForkManifest(validInput());
        expect(Array.isArray(manifest.memory_files)).toBe(true);
        for (const f of manifest.memory_files) {
            expect(typeof f).toBe('string');
        }
    });
});

describe('createForkManifest — content gates / T-43-secrets (Plan 02)', () => {
    it('43-02-28: JSON.stringify(manifest) does NOT contain SECRET, KEY, TOKEN, PASSWORD, MYSQL, or DATABASE_URL substrings', () => {
        const manifest = createForkManifest(validInput());
        const json = JSON.stringify(manifest);
        expect(json).not.toMatch(/SECRET|KEY|TOKEN|PASSWORD|MYSQL|DATABASE_URL/i);
    });
});
