/**
 * Genesis types — Grid world configuration and bootstrap.
 */

import type { Region, RegionConnection } from '../space/types.js';
import type { Law } from '../logos/types.js';
import type { EconomyConfig } from '../economy/types.js';

export interface GenesisConfig {
    gridName: string;
    gridDomain: string;         // e.g. "genesis.noesis"
    tickRateMs: number;         // Clock speed (default: 30000)
    ticksPerEpoch: number;      // Ticks per epoch (default: 100)
    regions: Region[];          // Initial regions
    connections: RegionConnection[];  // Initial connections
    laws: Law[];                // Founding laws
    economy: Partial<EconomyConfig>;
    seedNous: SeedNous[];       // Initial Nous to spawn
}

export interface SeedNous {
    name: string;
    did: string;
    publicKey: string;
    region: string;             // Starting region ID
    humanOwner?: string;
    personality?: Record<string, unknown>;
}

export interface GridState {
    gridName: string;
    gridDomain: string;
    tick: number;
    epoch: number;
    nousCount: number;
    regionCount: number;
    activeLaws: number;
    auditEntries: number;
    running: boolean;
    startedAt: number;
}
