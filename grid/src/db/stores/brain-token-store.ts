/**
 * Phase 38 WIRE-02 — Brain bearer-token persistence layer.
 *
 * Persists to brain_tokens (migration v25).
 * One row per (grid_name, brain_did).  The primary key is the pair; Brain DIDs
 * are scoped to the Grid they registered with.
 *
 * Key invariants:
 *  - insert() uses INSERT IGNORE — re-registration of the same brain_did with
 *    the same (or different) key is a silent no-op.  Use upsert() for key rotation.
 *  - upsert() uses ON DUPLICATE KEY UPDATE to overwrite public_key_jwk + timestamps
 *    and reset revoked=0 + revoked_at_tick=NULL.  This is the key-rotation path:
 *    Brain registers a fresh Ed25519 key → Grid accepts and clears any prior revocation.
 *  - revoke() only updates rows where revoked=0 (idempotent; second call returns false).
 */

import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface BrainTokenRecord {
    brainDid: string;
    publicKeyJwk: Record<string, unknown>;  // {kty, crv, x, alg}
    issuedAt: number;                        // unix seconds
    expiresAt: number;                       // unix seconds
    revoked: boolean;
    operatorDid: string | null;             // Phase 39 TENANT-01 — null until claimed via /operator/me/brains
}

interface BrainTokenRow extends RowDataPacket {
    brain_did: string;
    public_key_jwk: string | Record<string, unknown>;
    issued_at: number;
    expires_at: number;
    revoked: number;  // TINYINT(1) — mysql2 returns as number
    operator_did: string | null;
}

function rowToRecord(row: BrainTokenRow): BrainTokenRecord {
    const publicKeyJwk =
        typeof row.public_key_jwk === 'string'
            ? (JSON.parse(row.public_key_jwk) as Record<string, unknown>)
            : row.public_key_jwk;
    return {
        brainDid: row.brain_did,
        publicKeyJwk,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        revoked: row.revoked === 1,
        operatorDid: row.operator_did ?? null,
    };
}

export class BrainTokenStore {
    private readonly gridName: string;
    private readonly pool: Pool;

    constructor(opts: { gridName: string; pool: Pool }) {
        this.gridName = opts.gridName;
        this.pool = opts.pool;
    }

    /**
     * INSERT IGNORE — re-registration of an already-known brain_did is a silent no-op.
     * Use upsert() to update the public key or clear a revocation.
     */
    async insert(rec: BrainTokenRecord): Promise<void> {
        await this.pool.query(
            `INSERT IGNORE INTO brain_tokens
                (grid_name, brain_did, public_key_jwk, issued_at, expires_at, revoked)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [
                this.gridName,
                rec.brainDid,
                JSON.stringify(rec.publicKeyJwk),
                rec.issuedAt,
                rec.expiresAt,
            ],
        );
    }

    /**
     * INSERT … ON DUPLICATE KEY UPDATE — key-rotation path.
     *
     * Re-registering a new public key after rotation clears any prior revocation
     * (revoked=0, revoked_at_tick=NULL).  This is intentional: if a Brain was
     * revoked but the operator rotates the key legitimately (e.g., after a
     * security incident is resolved), the new key registration re-admits the Brain.
     * The operator must ensure this matches their intent before re-registering.
     */
    async upsert(rec: BrainTokenRecord): Promise<void> {
        await this.pool.query(
            `INSERT INTO brain_tokens
                (grid_name, brain_did, public_key_jwk, issued_at, expires_at, revoked)
             VALUES (?, ?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE
                public_key_jwk   = VALUES(public_key_jwk),
                issued_at        = VALUES(issued_at),
                expires_at       = VALUES(expires_at),
                revoked          = 0,
                revoked_at_tick  = NULL`,
            [
                this.gridName,
                rec.brainDid,
                JSON.stringify(rec.publicKeyJwk),
                rec.issuedAt,
                rec.expiresAt,
            ],
        );
    }

    async getByDid(brainDid: string): Promise<BrainTokenRecord | null> {
        const [rows] = await this.pool.query<BrainTokenRow[]>(
            `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked
             FROM brain_tokens
             WHERE grid_name = ? AND brain_did = ?
             LIMIT 1`,
            [this.gridName, brainDid],
        );
        return rows[0] ? rowToRecord(rows[0]) : null;
    }

    /**
     * Mark a Brain token revoked.  Returns true if a row was updated (i.e. the
     * brain_did was known and not already revoked), false otherwise.
     */
    async revoke(brainDid: string, atTick: number): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE brain_tokens
             SET revoked = 1, revoked_at_tick = ?
             WHERE grid_name = ? AND brain_did = ? AND revoked = 0`,
            [atTick, this.gridName, brainDid],
        );
        return result.affectedRows === 1;
    }

    /**
     * Returns true if the brain_did row exists AND revoked=1.
     * Returns false if the row does not exist (unknown Brain DID) — the caller
     * decides whether an unknown DID should be treated as rejected or not-yet-registered.
     */
    async isRevoked(brainDid: string): Promise<boolean> {
        const [rows] = await this.pool.query<BrainTokenRow[]>(
            `SELECT revoked FROM brain_tokens WHERE grid_name = ? AND brain_did = ? LIMIT 1`,
            [this.gridName, brainDid],
        );
        if (!rows[0]) return false;
        return rows[0].revoked === 1;
    }

    /**
     * Phase 39 TENANT-01 — Claim ownership of a Brain token.
     *
     * Atomic UPDATE WHERE operator_did IS NULL — first claimer wins (T-39-02-01).
     * Returns true if the claim succeeded, false if the Brain is already owned or unknown.
     */
    async setOwner(brainDid: string, operatorDid: string): Promise<boolean> {
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE brain_tokens SET operator_did = ?
             WHERE grid_name = ? AND brain_did = ? AND operator_did IS NULL`,
            [operatorDid, this.gridName, brainDid],
        );
        return result.affectedRows === 1;
    }

    /**
     * Phase 39 TENANT-01 — List active (non-revoked) tokens owned by an operator.
     */
    async findByOperator(operatorDid: string): Promise<BrainTokenRecord[]> {
        const [rows] = await this.pool.query<BrainTokenRow[]>(
            `SELECT brain_did, public_key_jwk, issued_at, expires_at, revoked, operator_did
             FROM brain_tokens
             WHERE grid_name = ? AND operator_did = ? AND revoked = 0`,
            [this.gridName, operatorDid],
        );
        return rows.map(rowToRecord);
    }

    /**
     * Phase 39 TENANT-01 / D-39-06 — Count active non-expired tokens for an operator.
     * Used for quota enforcement at claim time.
     */
    async countActiveByOperator(operatorDid: string): Promise<number> {
        const [rows] = await this.pool.query<Array<{ cnt: number } & RowDataPacket>>(
            `SELECT COUNT(*) AS cnt FROM brain_tokens
             WHERE grid_name = ? AND operator_did = ? AND revoked = 0
               AND expires_at > UNIX_TIMESTAMP()`,
            [this.gridName, operatorDid],
        );
        return rows[0]?.cnt ?? 0;
    }
}
