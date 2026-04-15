/**
 * Nous Registry — tracks all Nous in the Grid.
 *
 * Handles spawning, lookup, lifecycle transitions, and status management.
 */

import type { NousRecord, SpawnRequest, LifecyclePhase } from './types.js';

const LIFECYCLE_ORDER: LifecyclePhase[] = ['spawning', 'infant', 'adolescent', 'maturity', 'elder'];

export class NousRegistry {
    private readonly records = new Map<string, NousRecord>();
    private readonly nameIndex = new Map<string, string>(); // name → did

    /** Spawn a new Nous into the Grid. */
    spawn(req: SpawnRequest, gridDomain: string, tick: number, initialOusia: number): NousRecord {
        if (this.records.has(req.did)) {
            throw new Error(`Nous already registered: ${req.did}`);
        }
        if (this.nameIndex.has(req.name.toLowerCase())) {
            throw new Error(`Name already taken: ${req.name}`);
        }

        const record: NousRecord = {
            did: req.did,
            name: req.name,
            ndsAddress: `nous://${req.name.toLowerCase()}.${gridDomain}`,
            publicKey: req.publicKey,
            humanOwner: req.humanOwner,
            region: req.region,
            lifecyclePhase: 'spawning',
            reputation: 0,
            ousia: initialOusia,
            spawnedAtTick: tick,
            lastActiveTick: tick,
            status: 'active',
        };

        this.records.set(req.did, record);
        this.nameIndex.set(req.name.toLowerCase(), req.did);
        return record;
    }

    /** Get a Nous by DID. */
    get(did: string): NousRecord | undefined {
        return this.records.get(did);
    }

    /** Find a Nous by name (case-insensitive). */
    findByName(name: string): NousRecord | undefined {
        const did = this.nameIndex.get(name.toLowerCase());
        return did ? this.records.get(did) : undefined;
    }

    /** Resolve an NDS address to a record. */
    resolve(ndsAddress: string): NousRecord | undefined {
        for (const record of this.records.values()) {
            if (record.ndsAddress === ndsAddress) return record;
        }
        return undefined;
    }

    /** Advance lifecycle phase. */
    advanceLifecycle(did: string): LifecyclePhase | null {
        const record = this.records.get(did);
        if (!record) return null;

        const idx = LIFECYCLE_ORDER.indexOf(record.lifecyclePhase);
        if (idx === -1 || idx >= LIFECYCLE_ORDER.length - 1) return null;

        record.lifecyclePhase = LIFECYCLE_ORDER[idx + 1];
        return record.lifecyclePhase;
    }

    /** Suspend a Nous. */
    suspend(did: string): boolean {
        const record = this.records.get(did);
        if (!record || record.status !== 'active') return false;
        record.status = 'suspended';
        return true;
    }

    /** Exile a Nous. */
    exile(did: string): boolean {
        const record = this.records.get(did);
        if (!record) return false;
        record.status = 'exiled';
        record.lifecyclePhase = 'exiled';
        return true;
    }

    /** Reinstate a suspended Nous. */
    reinstate(did: string): boolean {
        const record = this.records.get(did);
        if (!record || record.status !== 'suspended') return false;
        record.status = 'active';
        return true;
    }

    /** Update last active tick. */
    touch(did: string, tick: number): void {
        const record = this.records.get(did);
        if (record) record.lastActiveTick = tick;
    }

    /** List all active Nous. */
    active(): NousRecord[] {
        return [...this.records.values()].filter(r => r.status === 'active');
    }

    /** List all Nous in a region. */
    inRegion(region: string): NousRecord[] {
        return this.active().filter(r => r.region === region);
    }

    /** Total registered Nous. */
    get count(): number {
        return this.records.size;
    }

    /** All records. */
    all(): NousRecord[] {
        return [...this.records.values()];
    }
}
