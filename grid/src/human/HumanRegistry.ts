/**
 * HumanRegistry — in-memory store for human Portal users.
 *
 * Phase 22 WEB3-02: DID format `did:noesis:human:<lowercased-eth-address>`.
 * Phase 25: email-only users use `did:noesis:human:email:<uuid>`.
 * Persistence to human_users MySQL table is handled by the auth route layer
 * (Plan 22-02) — this class is the in-process source of truth.
 */

import { randomUUID } from 'node:crypto';
import type { HumanRecord, CreateHumanParams } from './types.js';

/** DID regex — WEB3-05. Matches both SIWE and email-auth DIDs. */
export const HUMAN_DID_RE =
    /^did:noesis:human:(0x[0-9a-f]{40}|email:[0-9a-f-]{36})$/i;

export class HumanRegistry {
    /** Key: `${gridName}:${lowercased_eth_address}` */
    private readonly byAddress = new Map<string, HumanRecord>();
    /** Key: `${gridName}:${lowercased_email}` */
    private readonly byEmail = new Map<string, HumanRecord>();
    /** Key: `${gridName}:${did}` */
    private readonly byDid = new Map<string, HumanRecord>();
    /** Key: `${gridName}:${lowercased_email}` — password hashes kept separate from public record */
    private readonly passwordHashes = new Map<string, string>();

    /**
     * Create a new human user.
     * - SIWE users: provide eth_address (required), email omitted.
     * - Email users: provide email + password_hash, eth_address omitted.
     * Throws if eth_address or email already registered in the same grid.
     */
    createHuman(params: CreateHumanParams): HumanRecord {
        let did: string;
        let address: string | null = null;

        if (params.eth_address) {
            address = params.eth_address.toLowerCase();
            const addrKey = `${params.grid_name}:${address}`;
            if (this.byAddress.has(addrKey)) {
                throw new Error(`HumanRegistry.createHuman: address already registered: ${address}`);
            }
            did = `did:noesis:human:${address}`;
        } else if (params.email) {
            const emailKey = `${params.grid_name}:${params.email.toLowerCase()}`;
            if (this.byEmail.has(emailKey)) {
                throw new Error(`HumanRegistry.createHuman: email already registered: ${params.email}`);
            }
            did = `did:noesis:human:email:${randomUUID()}`;
        } else {
            throw new Error('HumanRegistry.createHuman: either eth_address or email is required');
        }

        const record: HumanRecord = {
            did,
            eth_address: address,
            email: params.email ? params.email.toLowerCase() : null,
            grid_name: params.grid_name,
            region: params.region ?? 'agora',
            created_at: new Date(),
        };

        if (address) {
            this.byAddress.set(`${params.grid_name}:${address}`, record);
        }
        if (record.email) {
            const emailKey = `${params.grid_name}:${record.email}`;
            this.byEmail.set(emailKey, record);
            if (params.password_hash) {
                this.passwordHashes.set(emailKey, params.password_hash);
            }
        }
        this.byDid.set(`${params.grid_name}:${did}`, record);
        return record;
    }

    /** Retrieve the stored password hash for an email user (for verification only). */
    getPasswordHash(gridName: string, email: string): string | undefined {
        return this.passwordHashes.get(`${gridName}:${email.toLowerCase()}`);
    }

    /** Find by Ethereum address (case-insensitive). */
    findByAddress(gridName: string, eth_address: string): HumanRecord | undefined {
        return this.byAddress.get(`${gridName}:${eth_address.toLowerCase()}`);
    }

    /** Find by email address (case-insensitive). */
    findByEmail(gridName: string, email: string): HumanRecord | undefined {
        return this.byEmail.get(`${gridName}:${email.toLowerCase()}`);
    }

    /** Find by DID. */
    findByDid(gridName: string, did: string): HumanRecord | undefined {
        return this.byDid.get(`${gridName}:${did}`);
    }

    /** Return all human records for a grid (used by tests). */
    listByGrid(gridName: string): HumanRecord[] {
        return [
            ...this.byAddress.values(),
            ...[...this.byEmail.values()].filter(r => !r.eth_address),
        ].filter(r => r.grid_name === gridName);
    }
}
