/**
 * Phase 39 — Operator quota data accessors (TENANT-03 / D-39-07 / D-39-10)
 * CI gate: check-operator-scope-typing.mjs requires operatorDid: string in all exports.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface QuotaRecord {
    brainProcessLimit: number;
    eventRatePerDidPerMin: number;
    p2pBandwidthCapBytes: number | null;
}

export async function getQuotaLimit(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<number> {
    // Per-operator override takes precedence
    const [overrides] = await pool.query<Array<{ brain_process_limit: number } & RowDataPacket>>(
        `SELECT brain_process_limit FROM operator_quota_overrides
         WHERE grid_name = ? AND operator_did = ? LIMIT 1`,
        [gridName, operatorDid],
    );
    if (overrides[0]) return overrides[0].brain_process_limit;

    // Fall back to grid_config global default
    const [rows] = await pool.query<Array<{ config_value: string } & RowDataPacket>>(
        `SELECT config_value FROM grid_config
         WHERE grid_name = ? AND config_key = 'quota.brain_processes_default' LIMIT 1`,
        [gridName],
    );
    return rows[0] ? (JSON.parse(rows[0].config_value) as number) : 3;
}

export async function getEventRateLimit(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<number> {
    const [overrides] = await pool.query<Array<{ event_rate_per_did_per_min: number } & RowDataPacket>>(
        `SELECT event_rate_per_did_per_min FROM operator_quota_overrides
         WHERE grid_name = ? AND operator_did = ? LIMIT 1`,
        [gridName, operatorDid],
    );
    if (overrides[0]) return overrides[0].event_rate_per_did_per_min;

    // Default 600 req/min per D-39-08
    const [rows] = await pool.query<Array<{ config_value: string } & RowDataPacket>>(
        `SELECT config_value FROM grid_config
         WHERE grid_name = ? AND config_key = 'quota.event_rate_per_did_per_min_default' LIMIT 1`,
        [gridName],
    );
    return rows[0] ? (JSON.parse(rows[0].config_value) as number) : 600;
}

export async function getFullQuota(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<QuotaRecord> {
    const [rows] = await pool.query<Array<QuotaRecord & RowDataPacket>>(
        `SELECT brain_process_limit AS brainProcessLimit,
                event_rate_per_did_per_min AS eventRatePerDidPerMin,
                p2p_bandwidth_cap_bytes AS p2pBandwidthCapBytes
         FROM operator_quota_overrides
         WHERE grid_name = ? AND operator_did = ? LIMIT 1`,
        [gridName, operatorDid],
    );
    if (rows[0]) return rows[0];
    // Defaults
    const brainProcessLimit = await getQuotaLimit(pool, gridName, operatorDid);
    const eventRatePerDidPerMin = await getEventRateLimit(pool, gridName, operatorDid);
    return { brainProcessLimit, eventRatePerDidPerMin, p2pBandwidthCapBytes: null };
}

export async function setQuotaOverride(
    pool: Pool,
    gridName: string,
    operatorDid: string,
    patch: Partial<QuotaRecord>,
): Promise<void> {
    const current = await getFullQuota(pool, gridName, operatorDid);
    const limit = patch.brainProcessLimit ?? current.brainProcessLimit;
    const rate = patch.eventRatePerDidPerMin ?? current.eventRatePerDidPerMin;
    const bw = patch.p2pBandwidthCapBytes !== undefined ? patch.p2pBandwidthCapBytes : current.p2pBandwidthCapBytes;
    await pool.query(
        `INSERT INTO operator_quota_overrides
             (grid_name, operator_did, brain_process_limit, event_rate_per_did_per_min, p2p_bandwidth_cap_bytes)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             brain_process_limit = VALUES(brain_process_limit),
             event_rate_per_did_per_min = VALUES(event_rate_per_did_per_min),
             p2p_bandwidth_cap_bytes = VALUES(p2p_bandwidth_cap_bytes)`,
        [gridName, operatorDid, limit, rate, bw],
    );
}
