/**
 * GridRegistry — the Portal's registry of active Grids (multi-Grid framework).
 *
 * v3.0 operates ONE live Grid (Genesis); this registry is the meta-layer index
 * the Portal exposes so a Nous can "search the service portal for currently
 * active Grids" (spec §2). Cross-Grid membership + federation are later phases —
 * this slice establishes the framework + the discovery feed. In-memory (mirrors
 * NousRegistry); extends D-V3-30 (the multi-Grid framework, still 1 live Grid).
 */

export interface GridRecord {
    /** Stable id, e.g. 'genesis'. */
    readonly gridId: string;
    /** Display name, e.g. 'Genesis'. */
    readonly name: string;
    /** Address domain, e.g. 'genesis.noesis' (nous://name.<gridDomain>). */
    readonly gridDomain: string;
    /** The Grid's government, e.g. 'Genesis Polis' (D-V3-31 naming). */
    readonly polisName: string;
    /** One-line description for the discovery feed. */
    readonly description: string;
    readonly status: 'active' | 'forming' | 'closed';
}

export class GridRegistry {
    private readonly grids = new Map<string, GridRecord>();

    register(record: GridRecord): GridRecord {
        if (this.grids.has(record.gridId)) {
            throw new Error(`GridRegistry: duplicate gridId ${record.gridId}`);
        }
        this.grids.set(record.gridId, record);
        return record;
    }

    get(gridId: string): GridRecord | undefined {
        return this.grids.get(gridId);
    }

    all(): GridRecord[] {
        return [...this.grids.values()];
    }

    /** Active Grids only — the public discovery feed. */
    active(): GridRecord[] {
        return this.all().filter((g) => g.status === 'active');
    }
}
