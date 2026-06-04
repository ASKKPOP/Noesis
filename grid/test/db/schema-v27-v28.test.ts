import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 39: Migrations v27 + v28 — operator tenancy schema', () => {
    it('last migration is version 28', () => {
        const last = MIGRATIONS.find(m => m.version === 28);
        expect(last.version).toBe(28);
    });

    describe('v27 — add_operator_did_to_brain_tokens', () => {
        it('v27 up SQL adds operator_did VARCHAR(255) NULL DEFAULT NULL to brain_tokens', () => {
            const m = MIGRATIONS.find(m => m.version === 27);
            expect(m).toBeDefined();
            expect(m!.up).toMatch(/operator_did\s+VARCHAR\(255\)\s+NULL/i);
            expect(m!.up).toMatch(/ALTER TABLE brain_tokens/i);
        });

        it('v27 up SQL adds idx_operator_did index', () => {
            const m = MIGRATIONS.find(m => m.version === 27);
            expect(m!.up).toMatch(/ADD INDEX idx_operator_did/i);
        });

        it('v27 down SQL drops idx_operator_did and operator_did column', () => {
            const m = MIGRATIONS.find(m => m.version === 27);
            expect(m!.down).toMatch(/DROP INDEX idx_operator_did/i);
            expect(m!.down).toMatch(/DROP COLUMN operator_did/i);
        });
    });

    describe('v28 — create_operator_quota_overrides', () => {
        it('v28 up SQL creates operator_quota_overrides table', () => {
            const m = MIGRATIONS.find(m => m.version === 28);
            expect(m).toBeDefined();
            expect(m!.up).toMatch(/CREATE TABLE IF NOT EXISTS operator_quota_overrides/i);
        });

        it('v28 up SQL includes brain_process_limit INT UNSIGNED NOT NULL DEFAULT 3', () => {
            const m = MIGRATIONS.find(m => m.version === 28);
            expect(m!.up).toMatch(/brain_process_limit\s+INT UNSIGNED NOT NULL DEFAULT 3/i);
        });

        it('v28 up SQL includes event_rate_per_did_per_min INT UNSIGNED NOT NULL DEFAULT 600', () => {
            const m = MIGRATIONS.find(m => m.version === 28);
            expect(m!.up).toMatch(/event_rate_per_did_per_min\s+INT UNSIGNED NOT NULL DEFAULT 600/i);
        });

        it('v28 down SQL drops operator_quota_overrides table', () => {
            const m = MIGRATIONS.find(m => m.version === 28);
            expect(m!.down).toMatch(/DROP TABLE IF EXISTS operator_quota_overrides/i);
        });
    });

    it('no migration version appears twice', () => {
        const versions = MIGRATIONS.map(m => m.version);
        const unique = new Set(versions);
        expect(unique.size).toBe(versions.length);
    });

    it('migrations are sequential starting from 1', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        sorted.forEach((m, i) => expect(m.version).toBe(i + 1));
    });
});
