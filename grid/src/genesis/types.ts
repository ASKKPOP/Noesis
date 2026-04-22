/**
 * Genesis types — Grid world configuration and bootstrap.
 */

import type { Region, RegionConnection } from '../space/types.js';
import type { Law } from '../logos/types.js';
import type { EconomyConfig } from '../economy/types.js';
import type { RelationshipConfig } from '../relationships/index.js';

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
    /**
     * Phase 7 DIALOG-01 (D-25): optional dialogue-aggregation tuning.
     * Defaults applied by GenesisLauncher when omitted: windowTicks=5,
     * minExchanges=2.
     */
    dialogue?: {
        windowTicks: number;
        minExchanges: number;
    };
    /**
     * Phase 9 REL-01: optional relationship engine tuning.
     * Defaults applied by GenesisLauncher when omitted (DEFAULT_RELATIONSHIP_CONFIG).
     * Per-Grid overridable for researcher rigs.
     */
    relationship?: RelationshipConfig;
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
