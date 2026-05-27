/**
 * Phase 40 — Operator settings data store (LOCAL-01, LOCAL-02)
 * Replaces Phase 39 stub with real MySQL persistence (migration v29).
 * CI gate: check-operator-scope-typing.mjs requires operatorDid: string in all exports.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface LocalAiSettings {
    small_model: string;
    primary_model: string;
    large_model: string;
    temperature: number;
    max_tokens: number;
    _version: 2;
}

export interface OperatorSettings {
    local_ai: LocalAiSettings;
    _version: 2;
}

const DEFAULT_LOCAL_AI: LocalAiSettings = {
    small_model: 'qwen3:4b',
    primary_model: 'qwen3:4b',
    large_model: 'qwen3:4b',
    temperature: 0.7,
    max_tokens: 2048,
    _version: 2,
};

const DEFAULT_SETTINGS: OperatorSettings = {
    local_ai: DEFAULT_LOCAL_AI,
    _version: 2,
};

/**
 * Returns operator settings. If no row exists for the operator, returns defaults (D-40-06).
 * Does NOT insert on GET — returns defaults only (Pitfall 3: write-on-read breaks idempotency).
 */
export async function getSettings(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<OperatorSettings> {
    const [rows] = await pool.execute<Array<{ settings: string } & RowDataPacket>>(
        'SELECT settings FROM operator_settings WHERE grid_name = ? AND operator_did = ? LIMIT 1',
        [gridName, operatorDid],
    );
    if (rows.length === 0) {
        return { ...DEFAULT_SETTINGS, local_ai: { ...DEFAULT_LOCAL_AI } };
    }
    return JSON.parse(rows[0].settings) as OperatorSettings;
}

/**
 * Merges patch into current settings and persists via upsert.
 * Returns the merged settings. Only merges top-level keys of OperatorSettings.
 */
export async function updateSettings(
    pool: Pool,
    gridName: string,
    operatorDid: string,
    patch: Partial<OperatorSettings>,
): Promise<OperatorSettings> {
    const current = await getSettings(pool, gridName, operatorDid);
    // Merge: patch may contain partial local_ai — deep merge local_ai sub-object
    const mergedLocalAi = patch.local_ai
        ? { ...current.local_ai, ...patch.local_ai }
        : current.local_ai;
    const updated: OperatorSettings = {
        local_ai: mergedLocalAi,
        _version: 2,
    };
    await pool.execute(
        `INSERT INTO operator_settings (grid_name, operator_did, settings)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
        [gridName, operatorDid, JSON.stringify(updated)],
    );
    return updated;
}
