/**
 * PresenceStore — derives "which Nous is in which region" from the audit
 * event stream (nous.spawned, nous.moved). The region-map component in
 * Plan 06 subscribes to this store via useSyncExternalStore.
 *
 * Invariants:
 *   - Two synchronized maps: did→{regionId,name} and regionId→Set<did>.
 *     Any handler that writes to one MUST write to the other.
 *   - Replay idempotency: entries with an id already applied are skipped.
 *     Unidentified entries (no id) are applied each time — server never
 *     emits events without ids on this channel, but the store is defensive.
 *   - Authoritative toRegion: nous.moved's toRegion wins. We remove the
 *     Nous from its ACTUAL current region (whatever the map says), not from
 *     the event's claimed fromRegion. This protects us from stale
 *     fromRegion data after a resubscribe.
 *   - Malformed payloads are silently ignored; the store never throws on
 *     untrusted input.
 *   - Snapshot stability: getSnapshot returns the same reference until a
 *     mutating operation (replay-guarded applyEvent / applyEvents).
 *   - Framework-agnostic: NO React import. Store is pure TypeScript.
 */

import type { AuditEntry } from '@/lib/protocol/audit-types';

export interface PresenceSnapshot {
    regionOf(did: string): string | null;
    inRegion(regionId: string): ReadonlySet<string>;
    nameOf(did: string): string | null;
    readonly allNous: ReadonlyMap<string, { readonly regionId: string; readonly name: string }>;
}

export class PresenceStore {
    private readonly nousByDid = new Map<string, { regionId: string; name: string }>();
    private readonly nousByRegion = new Map<string, Set<string>>();
    private readonly appliedIds = new Set<number>();
    private readonly listeners = new Set<() => void>();
    private cachedSnapshot: PresenceSnapshot | null = null;

    applyEvent(entry: AuditEntry): void {
        const changed = this.applyOne(entry);
        if (changed) this.invalidate();
    }

    applyEvents(entries: readonly AuditEntry[]): void {
        let anyChanged = false;
        for (const entry of entries) {
            if (this.applyOne(entry)) anyChanged = true;
        }
        if (anyChanged) this.invalidate();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    }

    getSnapshot(): PresenceSnapshot {
        if (this.cachedSnapshot !== null) return this.cachedSnapshot;

        // Freeze a point-in-time view so downstream readers cannot mutate
        // the internal maps.
        const nousCopy = new Map<string, { regionId: string; name: string }>();
        for (const [did, rec] of this.nousByDid) {
            nousCopy.set(did, { regionId: rec.regionId, name: rec.name });
        }
        const regionCopy = new Map<string, ReadonlySet<string>>();
        for (const [region, dids] of this.nousByRegion) {
            regionCopy.set(region, new Set(dids));
        }

        const EMPTY_SET: ReadonlySet<string> = new Set<string>();

        this.cachedSnapshot = Object.freeze({
            regionOf: (did: string): string | null => nousCopy.get(did)?.regionId ?? null,
            inRegion: (regionId: string): ReadonlySet<string> =>
                regionCopy.get(regionId) ?? EMPTY_SET,
            nameOf: (did: string): string | null => nousCopy.get(did)?.name ?? null,
            allNous: nousCopy,
        });
        return this.cachedSnapshot;
    }

    /**
     * @returns true if this entry changed store state, false otherwise.
     */
    private applyOne(entry: AuditEntry): boolean {
        if (entry.id !== undefined && this.appliedIds.has(entry.id)) {
            return false; // replay guard
        }

        let handled = false;
        switch (entry.eventType) {
            case 'nous.spawned':
                handled = this.handleSpawned(entry);
                break;
            case 'nous.moved':
                handled = this.handleMoved(entry);
                break;
            default:
                return false; // not relevant to presence
        }

        if (handled && entry.id !== undefined) {
            this.appliedIds.add(entry.id);
        }
        return handled;
    }

    private handleSpawned(entry: AuditEntry): boolean {
        const name = entry.payload['name'];
        const region = entry.payload['region'];
        if (typeof name !== 'string' || typeof region !== 'string') return false;
        return this.setNous(entry.actorDid, name, region);
    }

    private handleMoved(entry: AuditEntry): boolean {
        const name = entry.payload['name'];
        const toRegion = entry.payload['toRegion'];
        if (typeof toRegion !== 'string') return false;
        const effectiveName =
            typeof name === 'string' ? name : this.nousByDid.get(entry.actorDid)?.name ?? entry.actorDid;
        return this.setNous(entry.actorDid, effectiveName, toRegion);
    }

    /**
     * @returns true iff this call actually mutated store state (region or
     *          name differ from the existing record). A no-op update is not
     *          considered a mutation, so listeners are not notified.
     */
    private setNous(did: string, name: string, regionId: string): boolean {
        const existing = this.nousByDid.get(did);
        if (existing && existing.regionId === regionId && existing.name === name) {
            return false; // no net change
        }
        if (existing) {
            this.removeFromCurrentRegion(did, existing.regionId);
        }
        this.nousByDid.set(did, { regionId, name });
        let bucket = this.nousByRegion.get(regionId);
        if (!bucket) {
            bucket = new Set<string>();
            this.nousByRegion.set(regionId, bucket);
        }
        bucket.add(did);
        return true;
    }

    private removeFromCurrentRegion(did: string, currentRegionId: string): void {
        const bucket = this.nousByRegion.get(currentRegionId);
        if (!bucket) return;
        bucket.delete(did);
        if (bucket.size === 0) {
            this.nousByRegion.delete(currentRegionId);
        }
    }

    private invalidate(): void {
        this.cachedSnapshot = null;
        for (const listener of this.listeners) {
            listener();
        }
    }
}
