/**
 * H1 (first version) — derive a GridRegistry record from a GenesisConfig.
 *
 * Replaces the hardcoded "Genesis Polis / EARTH_ORBIT" registration in main.ts so a
 * Grid launched with a different config (e.g. MOON_CONFIG) self-registers correctly:
 * Polis name per D-V3-31 (`<GridName> Polis`) and the config's GridEnvironment.
 */
import type { GenesisConfig } from '../genesis/types.js';
import type { GridRecord } from './grid-registry.js';

export function gridRecordFromConfig(config: GenesisConfig): GridRecord {
    return {
        gridId: config.gridName.toLowerCase(),
        name: config.gridName,
        gridDomain: config.gridDomain,
        polisName: `${config.gridName} Polis`,   // D-V3-31: per-Grid government naming
        description: config.description ?? `The ${config.gridName} Grid.`,
        status: 'active',
        environment: config.environment,
    };
}
