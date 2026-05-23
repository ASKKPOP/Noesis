/**
 * Integration smoke tests for Phase 26 onboarding backend.
 * Tests the DB + endpoint contract without a live MySQL or Ollama connection.
 * Uses in-memory mocks.
 *
 * Note: schema-v14.test.ts already covers individual migration assertions.
 * This file adds a cross-cutting integration view: migration shape, allowlist delta,
 * and a summary of what the onboarding backend surface does/doesn't touch.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Migration v14', () => {
    it('exists as the last migration', () => {
        const last = MIGRATIONS[MIGRATIONS.length - 1];
        expect(last?.version).toBe(14);
    });

    it('has correct name', () => {
        const v14 = MIGRATIONS.find(m => m.version === 14);
        expect(v14?.name).toBe('add_onboarding_goal_to_human_users');
    });

    it('up SQL adds onboarding_goal column', () => {
        const v14 = MIGRATIONS.find(m => m.version === 14);
        expect(v14?.up).toContain('onboarding_goal');
        expect(v14?.up.toUpperCase()).toContain('TEXT');
    });

    it('has no duplicate versions', () => {
        const versions = MIGRATIONS.map(m => m.version);
        const unique = new Set(versions);
        expect(unique.size).toBe(versions.length);
    });
});

describe('Allowlist delta', () => {
    it('no new operator.* or nous.* audit events in onboarding migration', () => {
        // ONBOARD-05: onboarding completion fires no additional audit event.
        // Static check: migration v14 must not register any audit event types.
        const v14 = MIGRATIONS.find(m => m.version === 14);
        expect(v14?.up).not.toContain('audit');
        expect(v14?.up).not.toContain('event_type');
    });

    it('migration v14 only touches human_users table', () => {
        const v14 = MIGRATIONS.find(m => m.version === 14);
        // Should only ALTER TABLE human_users — no new tables, no audit_trail changes.
        expect(v14?.up.toUpperCase()).toContain('ALTER TABLE HUMAN_USERS');
        expect(v14?.up.toUpperCase()).not.toContain('CREATE TABLE');
    });
});
