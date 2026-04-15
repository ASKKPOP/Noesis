/**
 * Spatial types — regions, connections, positions.
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

export interface MoveResult {
    success: boolean;
    fromRegion: string;
    toRegion: string;
    travelCost: number;
    error?: string;
}
