/**
 * Rig types — Phase 14 Researcher Rigs.
 * RigConfig maps directly to GenesisConfig fields per RIG-01 zero-code-divergence rule.
 * No runtime logic in this file — pure type declarations consumed by scripts/rig.mjs (Wave 2).
 */
import type { SeedNous } from '../genesis/types.js';

/** Mirrors SeedNous; identical shape so manifest entries pass straight through. */
export type RigManifestEntry = SeedNous;

/** Parsed TOML config. EITHER nousManifest XOR nousManifestPath, never both (D-14-03). */
export interface RigConfig {
    readonly seed: string;                    // hex string ≥8 chars; first 8 chars used in schema name
    readonly configName: string;              // [a-z0-9-]+ — used in schema name
    readonly tickBudget: number;              // total ticks before tick_budget_exhausted exit
    readonly tickRateMs: number;              // 0 default per D-14-07; configurable for debug runs
    readonly operatorTierCap: 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
    readonly llmFixturePath?: string;         // absolute path to JSONL fixture file; absent => network LLM
    readonly permissive: boolean;             // D-14-05; mode selector, NOT a bypass
    readonly nousManifest?: readonly RigManifestEntry[];  // inline; mutually exclusive with nousManifestPath
    readonly nousManifestPath?: string;       // external JSONL; relative to TOML file dir; mutually exclusive
}

/** Frozen exit reasons per D-14-08; payload tuple closed at exactly these 3 values. */
export type RigExitReason = 'tick_budget_exhausted' | 'all_nous_dead' | 'operator_h5_terminate';

/**
 * chronos.rig_closed payload — closed 5-key tuple per D-14-08.
 * Emitted on Rig's own isolated audit chain ONLY.
 * NEVER added to grid/src/audit/broadcast-allowlist.ts.
 */
export interface RigClosedPayload {
    readonly seed: string;
    readonly tick: number;
    readonly exit_reason: RigExitReason;
    readonly chain_entry_count: number;
    readonly chain_tail_hash: string;         // SHA-256(canonicalStringify(lastEntry))
}

/** Helper to construct deterministic rig schema name (D-14-01). */
export function makeRigSchemaName(configName: string, seed: string): string {
    if (!/^[a-z0-9-]+$/.test(configName)) throw new Error(`Invalid configName: ${configName}`);
    if (seed.length < 8) throw new Error(`Seed must be ≥8 chars: ${seed}`);
    return `rig_${configName}_${seed.slice(0, 8).toLowerCase()}`;
}
