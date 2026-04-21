/**
 * Nous Registry — tracks all Nous in the Grid.
 *
 * Handles spawning, lookup, lifecycle transitions, and status management.
 */

import type { NousRecord, SpawnRequest, LifecyclePhase } from './types.js';
import type { SpatialMap } from '../space/map.js';

const LIFECYCLE_ORDER: LifecyclePhase[] = ['spawning', 'infant', 'adolescent', 'maturity', 'elder'];

export class NousRegistry {
    private readonly records = new Map<string, NousRecord>();
    private readonly nameIndex = new Map<string, string>(); // name → did

    /** Spawn a new Nous into the Grid. */
    spawn(req: SpawnRequest, gridDomain: string, tick: number, initialOusia: number): NousRecord {
        const existing = this.records.get(req.did);
        if (existing?.status === 'deleted') {
            throw new TypeError(
                `NousRegistry.spawn: DID ${req.did} is tombstoned (deletedAtTick=${existing.deletedAtTick}) and cannot be reused (D-04 — DID permanently reserved for audit integrity)`,
            );
        }
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

    /**
     * Atomically transfer Ousia between two Nous.
     *
     * Returns a tagged result. Performs no mutation unless success is true.
     * The result is atomic: all validation occurs before any balance change,
     * so a failed transfer leaves both records untouched.
     *
     * Failure modes:
     *   - invalid_amount: amount is not a positive integer
     *   - self_transfer:  fromDid === toDid
     *   - not_found:      either DID is absent from the registry
     *   - insufficient:   sender balance is below the requested amount
     */
    transferOusia(
        fromDid: string,
        toDid: string,
        amount: number,
    ):
        | { success: true; fromBalance: number; toBalance: number }
        | { success: false; error: 'not_found' | 'insufficient' | 'self_transfer' | 'invalid_amount' } {
        if (!Number.isInteger(amount) || amount <= 0) {
            return { success: false, error: 'invalid_amount' };
        }
        if (fromDid === toDid) {
            return { success: false, error: 'self_transfer' };
        }
        const from = this.records.get(fromDid);
        const to = this.records.get(toDid);
        if (!from || !to) {
            return { success: false, error: 'not_found' };
        }
        if (from.ousia < amount) {
            return { success: false, error: 'insufficient' };
        }
        from.ousia -= amount;
        to.ousia += amount;
        return { success: true, fromBalance: from.ousia, toBalance: to.ousia };
    }

    /**
     * Tombstone a Nous — AGENCY-05 soft-delete primitive.
     *
     * 1. Flips status 'active' → 'deleted' and stamps deletedAtTick.
     * 2. Evicts from SpatialMap (no further placements/moves possible).
     * 3. LEAVES the NousRecord in this.records — tombstoned records stay
     *    forever so audit-chain replay can always resolve actor/target DIDs.
     *
     * @throws TypeError on unknown DID, already-tombstoned DID, or invalid tick.
     */
    tombstone(did: string, tick: number, spatial: SpatialMap): void {
        if (!Number.isInteger(tick) || tick < 0) {
            throw new TypeError(`NousRegistry.tombstone: tick must be non-negative integer, got ${tick}`);
        }
        const record = this.records.get(did);
        if (!record) {
            throw new TypeError(`NousRegistry.tombstone: unknown DID ${did}`);
        }
        if (record.status === 'deleted') {
            throw new TypeError(
                `NousRegistry.tombstone: DID ${did} already tombstoned at tick ${record.deletedAtTick}`,
            );
        }
        // Flip status + stamp tick — replace the record with the new frozen shape.
        const tombstoned: NousRecord = { ...record, status: 'deleted', deletedAtTick: tick };
        this.records.set(did, tombstoned);
        // Evict from spatial index — no further moves/placements reach this DID.
        spatial.removeNous(did);
    }

    /**
     * Defensive no-op on tombstoned records. Throws on active records.
     * Exists for symmetry with tombstone(); production code calls tombstone()
     * directly (which handles spatial eviction internally).
     */
    removeNous(did: string): void {
        const record = this.records.get(did);
        if (!record) return;  // idempotent on unknown
        if (record.status !== 'deleted') {
            throw new TypeError(
                `NousRegistry.removeNous: DID ${did} is active — call tombstone() instead (D-02 soft-delete only)`,
            );
        }
        // no-op — the record stays for audit retention.
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

    /**
     * Load a set of pre-existing records into a fresh (empty) registry.
     * Used by GridStore.restore() to rebuild in-memory state from DB.
     * Safe to call on an empty registry only.
     */
    loadRecords(records: NousRecord[]): void {
        for (const record of records) {
            this.records.set(record.did, { ...record });
            this.nameIndex.set(record.name.toLowerCase(), record.did);
        }
    }
}
