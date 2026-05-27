/**
 * Phase 39 — Operator settings data accessors (D-39-04 / D-39-10)
 * Placeholder for Phase 40 Local AI config. Initial shape: { local_ai: null, _version: 1 }.
 * CI gate: check-operator-scope-typing.mjs requires operatorDid: string in all exports.
 */
import type { Pool } from 'mysql2/promise';

export interface OperatorSettings {
    local_ai: null;   // Phase 40 will replace with { model: string, temperature: number, ... }
    _version: 1;
}

const DEFAULT_SETTINGS: OperatorSettings = { local_ai: null, _version: 1 };

/**
 * Returns operator settings. Phase 39 returns the default placeholder for all operators.
 * Phase 40 will introduce a settings persistence table and replace this implementation.
 */
export async function getSettings(
    _pool: Pool,
    _gridName: string,
    operatorDid: string,
): Promise<OperatorSettings> {
    void operatorDid; // operatorDid required for CI gate; Phase 40 will use it for DB lookup
    return { ...DEFAULT_SETTINGS };
}

/**
 * Updates operator settings. Phase 39 is a no-op placeholder — returns merged result.
 * Phase 40 will persist settings to a dedicated table.
 */
export async function updateSettings(
    _pool: Pool,
    _gridName: string,
    operatorDid: string,
    _patch: Partial<OperatorSettings>,
): Promise<OperatorSettings> {
    void operatorDid; // operatorDid required for CI gate; Phase 40 will use it for DB write
    return { ...DEFAULT_SETTINGS };
}
