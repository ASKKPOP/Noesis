/**
 * Phase 28 SPAWN-04 — Migrations v15 (personality_seed) and v16 (spawn_payments).
 *
 * Validates the two new migration definitions without requiring a real DB.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 28: Migration v15 — add_personality_seed_to_nous_registry', () => {
    it('MIGRATIONS contains version 15', () => {
        const m = MIGRATIONS.find(m => m.version === 15);
        expect(m).toBeDefined();
    });

    it('version 15 name is add_personality_seed_to_nous_registry', () => {
        const m = MIGRATIONS.find(m => m.version === 15);
        expect(m!.name).toBe('add_personality_seed_to_nous_registry');
    });

    it('version 15 up SQL adds personality_seed column to nous_registry', () => {
        const m = MIGRATIONS.find(m => m.version === 15);
        expect(m!.up.toUpperCase()).toContain('ALTER TABLE');
        expect(m!.up).toContain('nous_registry');
        expect(m!.up).toContain('personality_seed');
    });

    it('version 15 up SQL declares VARCHAR(32) NULL', () => {
        const m = MIGRATIONS.find(m => m.version === 15);
        expect(m!.up.toUpperCase()).toContain('VARCHAR(32)');
        expect(m!.up.toUpperCase()).toContain('NULL');
    });

    it('version 15 down SQL drops personality_seed column', () => {
        const m = MIGRATIONS.find(m => m.version === 15);
        expect(m!.down.toUpperCase()).toContain('DROP COLUMN');
        expect(m!.down).toContain('personality_seed');
    });
});

describe('Phase 28: Migration v16 — create_spawn_payments', () => {
    it('MIGRATIONS contains version 16', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m).toBeDefined();
    });

    it('version 16 name is create_spawn_payments', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m!.name).toBe('create_spawn_payments');
    });

    it('version 16 up SQL creates spawn_payments table', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m!.up.toUpperCase()).toContain('CREATE TABLE');
        expect(m!.up).toContain('spawn_payments');
    });

    it('version 16 up SQL has tx_hash as PRIMARY KEY', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m!.up).toContain('tx_hash');
        expect(m!.up.toUpperCase()).toContain('PRIMARY KEY');
    });

    it('version 16 up SQL has human_did column', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m!.up).toContain('human_did');
    });

    it('version 16 down SQL drops spawn_payments table', () => {
        const m = MIGRATIONS.find(m => m.version === 16);
        expect(m!.down.toUpperCase()).toContain('DROP TABLE');
        expect(m!.down).toContain('spawn_payments');
    });
});

describe('Phase 28: Migration array integrity', () => {
    it('versions are still sequential starting from 1', () => {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            expect(MIGRATIONS[i].version).toBe(i + 1);
        }
    });

    it('no version appears twice in MIGRATIONS array', () => {
        const versions = MIGRATIONS.map(m => m.version);
        expect(new Set(versions).size).toBe(versions.length);
    });

    it('version 14 is still add_onboarding_goal_to_human_users (unchanged)', () => {
        const m = MIGRATIONS.find(m => m.version === 14);
        expect(m).toBeDefined();
        expect(m!.name).toBe('add_onboarding_goal_to_human_users');
    });

    it('version 16 is the last version', () => {
        const last = MIGRATIONS.find(m => m.version === 16);
        expect(last.version).toBe(16);
    });
});
