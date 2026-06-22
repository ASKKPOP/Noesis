/**
 * H1 (first version) — Moon = config, not rewrite.
 *
 * A second Grid is a GenesisConfig carrying the Moon GridEnvironment + its own
 * Polis, registered from config. No cross-grid travel (that's v3.1+).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { GENESIS_CONFIG, MOON_CONFIG } from '../../src/genesis/presets.js';
import { gridRecordFromConfig } from '../../src/registry/grid-record-from-config.js';
import { GRID_ENVIRONMENTS, EARTH_ORBIT } from '../../src/registry/grid-environments.js';
import { configFromEnv } from '../../src/main.js';

describe('GenesisConfig carries a GridEnvironment', () => {
    it('GENESIS_CONFIG is Earth-orbit', () => {
        expect(GENESIS_CONFIG.environment).toEqual(EARTH_ORBIT);
        expect(GENESIS_CONFIG.environment.name).toBe('Earth-orbit');
    });

    it('MOON_CONFIG is the Moon body, named Moon, with the standard civic regions reused', () => {
        expect(MOON_CONFIG.gridName).toBe('Moon');
        expect(MOON_CONFIG.environment).toEqual(GRID_ENVIRONMENTS['Moon']);
        expect(MOON_CONFIG.environment.gravity_ms2).toBeCloseTo(1.62);
        // The 6-zone civic city is seeded per grid_name (ParcelStore), not from
        // config.regions; Moon reuses the standard abstract regions + laws.
        expect(MOON_CONFIG.regions.length).toBe(GENESIS_CONFIG.regions.length);
        expect(MOON_CONFIG.laws).toBe(GENESIS_CONFIG.laws);
    });
});

describe('gridRecordFromConfig — register a Grid from its config (D-V3-31 Polis naming)', () => {
    it('derives the Genesis record exactly (no behaviour change)', () => {
        const r = gridRecordFromConfig(GENESIS_CONFIG);
        expect(r).toMatchObject({
            gridId: 'genesis',
            name: 'Genesis',
            polisName: 'Genesis Polis',
            status: 'active',
            environment: EARTH_ORBIT,
        });
    });

    it('derives the Moon record with Moon Polis + Moon environment', () => {
        const r = gridRecordFromConfig(MOON_CONFIG);
        expect(r).toMatchObject({
            gridId: 'moon',
            name: 'Moon',
            polisName: 'Moon Polis',   // D-V3-31: <GridName> Polis
            status: 'active',
        });
        expect(r.environment.name).toBe('Moon');
    });
});

describe('configFromEnv — GRID_ENV selects the body', () => {
    const PRIOR_ENV = process.env.GRID_ENV;
    const PRIOR_NAME = process.env.GRID_NAME;
    afterEach(() => {
        if (PRIOR_ENV === undefined) delete process.env.GRID_ENV; else process.env.GRID_ENV = PRIOR_ENV;
        if (PRIOR_NAME === undefined) delete process.env.GRID_NAME; else process.env.GRID_NAME = PRIOR_NAME;
    });

    it('GRID_ENV=Moon yields the Moon environment', () => {
        process.env.GRID_ENV = 'Moon';
        process.env.GRID_NAME = 'Moon';
        const cfg = configFromEnv();
        expect(cfg.genesisConfig.environment.name).toBe('Moon');
        expect(cfg.genesisConfig.gridName).toBe('Moon');
    });

    it('unset GRID_ENV defaults to Earth-orbit', () => {
        delete process.env.GRID_ENV;
        const cfg = configFromEnv();
        expect(cfg.genesisConfig.environment.name).toBe('Earth-orbit');
    });

    it('an unknown GRID_ENV falls back to Earth-orbit (getEnvironment default)', () => {
        process.env.GRID_ENV = 'Pluto';
        const cfg = configFromEnv();
        expect(cfg.genesisConfig.environment.name).toBe('Earth-orbit');
    });
});
