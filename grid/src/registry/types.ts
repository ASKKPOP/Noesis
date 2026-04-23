/**
 * Registry types — Nous registration and lifecycle in the Grid.
 */

export type LifecyclePhase = 'spawning' | 'infant' | 'adolescent' | 'maturity' | 'elder' | 'exiled';

export interface NousRecord {
    did: string;                // did:noesis:...
    name: string;               // Display name
    ndsAddress: string;         // nous://name.grid_domain
    publicKey: string;
    humanOwner?: string;        // human ID (optional, Nous can be autonomous)
    region: string;             // Current region ID
    lifecyclePhase: LifecyclePhase;
    reputation: number;         // 0.0 - 1.0
    ousia: number;              // Current balance
    spawnedAtTick: number;
    lastActiveTick: number;
    status: 'active' | 'suspended' | 'exiled' | 'deleted';
    /** Phase 8 (AGENCY-05). Stamped by tombstone(). Absent on active records. */
    deletedAtTick?: number;
}

export interface SpawnRequest {
    name: string;
    did: string;
    publicKey: string;
    region: string;             // Starting region
    humanOwner?: string;
    personality?: Record<string, unknown>;
}
