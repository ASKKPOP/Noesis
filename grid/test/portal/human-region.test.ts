/**
 * Task 1 tests — migration v10 + HumanRecord/Registry region field.
 *
 * Phase 24 PORTAL-04: region column on human_users, region field on HumanRecord,
 * createHuman defaults region to 'agora'.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';

describe('Migration v10 — region column', () => {
    it('MIGRATIONS array contains exactly one entry with version 10', () => {
        const v10 = MIGRATIONS.filter(m => m.version === 10);
        expect(v10).toHaveLength(1);
    });

    it('v10 migration is named add_region_to_human_users', () => {
        const v10 = MIGRATIONS.find(m => m.version === 10);
        expect(v10?.name).toBe('add_region_to_human_users');
    });

    it('v10 up SQL adds region column with ALTER TABLE', () => {
        const v10 = MIGRATIONS.find(m => m.version === 10);
        expect(v10?.up).toContain('ALTER TABLE human_users');
        expect(v10?.up).toContain('region');
    });
});

describe('HumanRecord — region field', () => {
    let registry: HumanRegistry;

    beforeEach(() => {
        registry = new HumanRegistry();
    });

    it('createHuman produces region = agora when params.region is undefined', () => {
        const record = registry.createHuman({
            eth_address: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
            grid_name: 'genesis',
        });
        expect(record.region).toBe('agora');
    });

    it('createHuman produces region = provided value when params.region is supplied', () => {
        const record = registry.createHuman({
            eth_address: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
            grid_name: 'genesis',
            region: 'market',
        });
        expect(record.region).toBe('market');
    });

    it('HumanRecord has a region field', () => {
        const record = registry.createHuman({
            eth_address: '0x1234567890ABCDEF1234567890abcdef12345678',
            grid_name: 'genesis',
        });
        expect(typeof record.region).toBe('string');
    });
});
