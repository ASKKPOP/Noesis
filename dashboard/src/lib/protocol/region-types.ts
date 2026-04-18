/**
 * SYNC: grid/src/space/types.ts (interfaces Region, RegionConnection, NousPosition)
 *
 * Dashboard-side mirror of the Grid spatial types. Server-only types
 * (MoveResult, MoveError) are not mirrored here — they live behind the
 * POST /regions/:id/travel endpoint which the dashboard does not call.
 *
 * Update this file in lockstep with the Grid-side original.
 */

export interface Region {
    id: string;
    name: string;
    description: string;
    regionType: 'public' | 'restricted' | 'private';
    capacity: number;
    properties: Record<string, unknown>;
}

export interface RegionConnection {
    fromRegion: string; // Region ID
    toRegion: string;   // Region ID
    travelCost: number; // Ticks required to travel
    bidirectional: boolean;
}

export interface NousPosition {
    nousDid: string;
    regionId: string;
    arrivedAt: number; // Unix timestamp
}
