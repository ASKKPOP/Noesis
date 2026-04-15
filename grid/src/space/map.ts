/**
 * Spatial Map — manages regions, connections, and Nous positions.
 */

import type { Region, RegionConnection, NousPosition, MoveResult } from './types.js';

export class SpatialMap {
    private readonly regions = new Map<string, Region>();
    private readonly connections: RegionConnection[] = [];
    private readonly positions = new Map<string, NousPosition>();

    addRegion(region: Region): void {
        this.regions.set(region.id, region);
    }

    getRegion(id: string): Region | undefined {
        return this.regions.get(id);
    }

    allRegions(): Region[] {
        return [...this.regions.values()];
    }

    addConnection(conn: RegionConnection): void {
        this.connections.push(conn);
    }

    /** Get all regions reachable from a given region. */
    getConnections(regionId: string): RegionConnection[] {
        return this.connections.filter(c =>
            c.fromRegion === regionId ||
            (c.bidirectional && c.toRegion === regionId)
        );
    }

    /** Get the travel cost between two regions (direct connection only). */
    getTravelCost(fromId: string, toId: string): number | null {
        const conn = this.connections.find(c =>
            (c.fromRegion === fromId && c.toRegion === toId) ||
            (c.bidirectional && c.fromRegion === toId && c.toRegion === fromId)
        );
        return conn ? conn.travelCost : null;
    }

    /** Place a Nous in a region. */
    placeNous(nousDid: string, regionId: string): void {
        if (!this.regions.has(regionId)) {
            throw new Error(`Region not found: ${regionId}`);
        }
        this.positions.set(nousDid, {
            nousDid,
            regionId,
            arrivedAt: Date.now(),
        });
    }

    /** Get a Nous's current position. */
    getPosition(nousDid: string): NousPosition | undefined {
        return this.positions.get(nousDid);
    }

    /** Get all Nous in a region. */
    getNousInRegion(regionId: string): NousPosition[] {
        return [...this.positions.values()].filter(p => p.regionId === regionId);
    }

    /** Attempt to move a Nous from one region to another. */
    moveNous(nousDid: string, toRegionId: string): MoveResult {
        const position = this.positions.get(nousDid);
        if (!position) {
            return { success: false, fromRegion: '', toRegion: toRegionId, travelCost: 0, error: 'Nous not placed on map' };
        }

        const toRegion = this.regions.get(toRegionId);
        if (!toRegion) {
            return { success: false, fromRegion: position.regionId, toRegion: toRegionId, travelCost: 0, error: 'Destination region not found' };
        }

        if (position.regionId === toRegionId) {
            return { success: false, fromRegion: position.regionId, toRegion: toRegionId, travelCost: 0, error: 'Already in that region' };
        }

        const cost = this.getTravelCost(position.regionId, toRegionId);
        if (cost === null) {
            return { success: false, fromRegion: position.regionId, toRegion: toRegionId, travelCost: 0, error: 'No connection between regions' };
        }

        // Check capacity
        const occupants = this.getNousInRegion(toRegionId);
        if (occupants.length >= toRegion.capacity) {
            return { success: false, fromRegion: position.regionId, toRegion: toRegionId, travelCost: cost, error: 'Destination region at capacity' };
        }

        const fromRegion = position.regionId;
        this.positions.set(nousDid, {
            nousDid,
            regionId: toRegionId,
            arrivedAt: Date.now(),
        });

        return { success: true, fromRegion, toRegion: toRegionId, travelCost: cost };
    }

    /** Return copies of all current positions (used by GridStore.snapshot). */
    allPositions(): NousPosition[] {
        return [...this.positions.values()].map(p => ({ ...p }));
    }

    /**
     * Load a set of pre-existing positions into the map.
     * Used by GridStore.restore() to rebuild spatial state from DB.
     * Does NOT validate against known regions — caller ensures consistency.
     */
    loadPositions(positions: NousPosition[]): void {
        for (const pos of positions) {
            this.positions.set(pos.nousDid, { ...pos });
        }
    }

    /** Count of Nous on the map. */
    get nousCount(): number {
        return this.positions.size;
    }
}
