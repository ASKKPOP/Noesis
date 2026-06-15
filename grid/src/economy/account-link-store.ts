/**
 * Wallet-proof (D-MONEY-02) — binds a Civic-DID to its on-chain NousAccount address,
 * proven by an EVM signature from the account owner's EOA.
 *
 * The owner signs `accountLinkMessage(civicDid, account)` with the same key that owns the
 * NousAccount; `verifyAndLink` recovers that EOA (ethers `verifyMessage`) and persists the
 * binding. The raw DID + addresses live Grid-side (MySQL `civic_account_links`, source of
 * truth); only hashes are meant to cross the audit boundary. The audit event + HTTP route
 * are wired in the Phase 70 money rails. On-chain proof that `owner == NousAccount.owner()`
 * is deferred to an indexer.
 */
import { randomUUID, createHash } from 'node:crypto';
import { verifyMessage, getAddress, isAddress } from 'ethers';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** The exact message the account owner signs to bind a Civic-DID to an account. */
export function accountLinkMessage(civicDid: string, account: string): string {
    return `Noēsis account link\nCivic-DID: ${civicDid}\nAccount: ${getAddress(account)}`;
}

/** Raised when the address is malformed or the signature does not verify. */
export class AccountLinkError extends Error {}

export interface AccountLinkRow extends RowDataPacket {
    link_id: string;
    grid_name: string;
    civic_did: string;
    nous_account: string;
    owner_address: string;
    signature_hash: string;
    verified_at_tick: number;
}

export interface AccountLink {
    readonly civicDid: string;
    readonly nousAccount: string; // checksummed
    readonly ownerAddress: string; // recovered EOA, checksummed
    readonly verifiedAtTick: number;
}

export class AccountLinkStore {
    constructor(
        private readonly pool: Pool,
        private readonly gridName: string = 'genesis',
    ) {}

    /**
     * Verify the owner's EVM signature over the binding message and persist the link.
     * Idempotent on (grid, civic_did, account): a re-proof refreshes the row. Returns the
     * recovered owner EOA. Throws {@link AccountLinkError} on a bad address/signature.
     */
    async verifyAndLink(args: {
        civicDid: string;
        nousAccount: string;
        signature: string;
        tick: number;
    }): Promise<AccountLink> {
        const { civicDid, nousAccount, signature, tick } = args;
        if (!isAddress(nousAccount)) {
            throw new AccountLinkError('invalid_account_address');
        }
        const account = getAddress(nousAccount); // checksummed
        let owner: string;
        try {
            owner = verifyMessage(accountLinkMessage(civicDid, account), signature);
        } catch {
            throw new AccountLinkError('invalid_signature');
        }
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_account_links
                (link_id, grid_name, civic_did, nous_account, owner_address, signature_hash, verified_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                owner_address = VALUES(owner_address),
                signature_hash = VALUES(signature_hash),
                verified_at_tick = VALUES(verified_at_tick)`,
            [randomUUID(), this.gridName, civicDid, account, owner, sha256Hex(signature), tick],
        );
        return { civicDid, nousAccount: account, ownerAddress: owner, verifiedAtTick: tick };
    }

    /** Resolve the most-recent account link for a Civic-DID (DB source of truth). */
    async getByCivicDid(civicDid: string): Promise<AccountLink | null> {
        const [rows] = await this.pool.query<AccountLinkRow[]>(
            `SELECT * FROM civic_account_links
              WHERE grid_name = ? AND civic_did = ?
              ORDER BY verified_at_tick DESC LIMIT 1`,
            [this.gridName, civicDid],
        );
        const r = rows[0];
        return r
            ? {
                  civicDid: r.civic_did,
                  nousAccount: r.nous_account,
                  ownerAddress: r.owner_address,
                  verifiedAtTick: r.verified_at_tick,
              }
            : null;
    }
}
