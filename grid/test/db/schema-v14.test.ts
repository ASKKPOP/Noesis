/**
 * Phase 26 — Migration v14
 *
 * Validates that the onboarding_goal column migration (version 14) is correctly
 * defined in the MIGRATIONS array without version collisions.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 26: Migration v14 — add_onboarding_goal_to_human_users', () => {
    it('last migration is version 16 (Phase 28 added v15 + v16)', () => {
        const last = MIGRATIONS[MIGRATIONS.length - 1];
        expect(last.version).toBe(16);
    });

    it('version 14 name is add_onboarding_goal_to_human_users', () => {
        const m = MIGRATIONS.find(m => m.version === 14);
        expect(m).toBeDefined();
        expect(m!.name).toBe('add_onboarding_goal_to_human_users');
    });

    it('version 14 up SQL contains onboarding_goal TEXT NULL DEFAULT NULL', () => {
        const m = MIGRATIONS.find(m => m.version === 14);
        expect(m).toBeDefined();
        expect(m!.up).toContain('onboarding_goal');
        expect(m!.up.toUpperCase()).toContain('TEXT');
        expect(m!.up.toUpperCase()).toContain('NULL');
    });

    it('version 14 down SQL drops onboarding_goal column', () => {
        const m = MIGRATIONS.find(m => m.version === 14);
        expect(m).toBeDefined();
        expect(m!.down.toUpperCase()).toContain('DROP COLUMN');
        expect(m!.down).toContain('onboarding_goal');
    });

    it('no version appears twice in MIGRATIONS array', () => {
        const versions = MIGRATIONS.map(m => m.version);
        expect(new Set(versions).size).toBe(versions.length);
    });

    it('versions are sequential starting from 1', () => {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            expect(MIGRATIONS[i].version).toBe(i + 1);
        }
    });
});
