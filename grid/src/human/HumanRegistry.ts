/**
 * HumanRegistry — in-memory store for human Portal users.
 *
 * Phase 22 WEB3-02: DID format `did:noesis:human:<lowercased-eth-address>`.
 * Persistence to human_users MySQL table is handled by the auth route layer
 * (Plan 22-02) — this class is the in-process source of truth.
 */

import type { HumanRecord, CreateHumanParams } from './types.js';

/** DID regex — WEB3-05. Also matches Nous DIDs; narrowed by prefix here. */
export const HUMAN_DID_RE = /^did:noesis:human:0x[0-9a-f]{40}$/i;

export class HumanRegistry {
    /** Key: `${gridName}:${lowercased_eth_address}` */
    private readonly byAddress = new Map<string, HumanRecord>();
    /** Key: `${gridName}:${did}` */
    private readonly byDid = new Map<string, HumanRecord>();

    /**
     * Create a new human user. Throws if eth_address already registered
     * in the same grid.
     */
    createHuman(params: CreateHumanParams): HumanRecord {
        const address = params.eth_address.toLowerCase();
        const addrKey = `${params.grid_name}:${address}`;

        if (this.byAddress.has(addrKey)) {
            throw new Error(`HumanRegistry.createHuman: address already registered: ${address}`);
        }

        const did = `did:noesis:human:${address}`;
        const record: HumanRecord = {
            did,
            eth_address: address,
            grid_name: params.grid_name,
            created_at: new Date(),
        };

        this.byAddress.set(addrKey, record);
        this.byDid.set(`${params.grid_name}:${did}`, record);
        return record;
    }

    /** Find by Ethereum address (case-insensitive). */
    findByAddress(gridName: string, eth_address: string): HumanRecord | undefined {
        return this.byAddress.get(`${gridName}:${eth_address.toLowerCase()}`);
    }

    /** Find by DID. */
    findByDid(gridName: string, did: string): HumanRecord | undefined {
        return this.byDid.get(`${gridName}:${did}`);
    }

    /** Return all human records for a grid (used by tests). */
    listByGrid(gridName: string): HumanRecord[] {
        return [...this.byAddress.values()].filter(r => r.grid_name === gridName);
    }
}
