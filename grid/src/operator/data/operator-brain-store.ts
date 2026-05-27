/**
 * Phase 39 — Operator Brain data accessors (TENANT-01 / D-39-10)
 * CI gate: check-operator-scope-typing.mjs requires operatorDid: string in all exports.
 */
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { BrainTokenRecord } from '../../db/stores/brain-token-store.js';

interface BrainTokenRow extends RowDataPacket {
    brain_did: string;
    public_key_jwk: string;
    issued_at: number;
    expires_at: number;
    revoked: number;
    operator_did: string | null;
}

function rowToRecord(row: BrainTokenRow): BrainTokenRecord {
    return {
        brainDid: row.brain_did,
        publicKeyJwk: JSON.parse(row.public_key_jwk) as Record<string, unknown>,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        revoked: row.revoked === 1,
        operatorDid: row.operator_did,
    };
}

export async function findByOperator(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<BrainTokenRecord[]> {
    const [rows] = await pool.query<BrainTokenRow[]>(
        `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked, operator_did
         FROM brain_tokens
         WHERE grid_name = ? AND operator_did = ? AND revoked = 0`,
        [gridName, operatorDid],
    );
    return rows.map(rowToRecord);
}

export async function countActiveByOperator(
    pool: Pool,
    gridName: string,
    operatorDid: string,
): Promise<number> {
    const [rows] = await pool.query<Array<{ cnt: number } & RowDataPacket>>(
        `SELECT COUNT(*) AS cnt FROM brain_tokens
         WHERE grid_name = ? AND operator_did = ? AND revoked = 0
           AND expires_at > UNIX_TIMESTAMP()`,
        [gridName, operatorDid],
    );
    return rows[0]?.cnt ?? 0;
}

export async function setOwner(
    pool: Pool,
    gridName: string,
    operatorDid: string,
    brainDid: string,
): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE brain_tokens SET operator_did = ?
         WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`,
        [operatorDid, gridName, brainDid],
    );
    return result.affectedRows === 1;
}
