/**
 * ReplayGrid — configuration-over-fork wrapper providing an isolated, read-only
 * view of a Grid world reconstructed from an AuditEntry slice.
 *
 * PRIMARY THREAT MITIGATION: REPLAY-03 / T-10-07 / T-10-08
 *
 * This class NEVER holds a writable AuditChain reference. The `audit` field
 * is typed and runtime-typed as ReadOnlyAuditChain, which throws on any
 * append() call. The type-system defense and the runtime throw together
 * enforce that no replay code can accidentally write to what would be the
 * live audit chain.
 *
 * Construction order MIRRORS GenesisLauncher exactly (D-9-04) with three
 * substitutions:
 *   1. `audit: AuditChain` → `audit: ReadOnlyAuditChain` (T-10-07 defense)
 *   2. No network server / no WebSocket hub (no network surface, T-10-12 discipline)
 *   3. No real Brain bridges / no clock (static replay harness)
 *
 * Pitfall mitigation (chain.ts:74): loadEntries() is silent — onAppend
 * listeners do NOT fire during construction. rebuildFromChain() must be
 * called EXPLICITLY after construction to reconstruct derived listener state
 * (RelationshipListener edges, GovernanceEngine proposals). This class
 * exposes rebuildFromChain() as a public method so consumers can call it
 * after any additional listener registration.
 *
 * Decision reference: D-13-03 (13-CONTEXT.md §canonical_refs).
 */

import type { AuditEntry } from '../audit/types.js';
import { NousRegistry } from '../registry/registry.js';
import { DialogueAggregator } from '../dialogue/index.js';
import { RelationshipListener, DEFAULT_RELATIONSHIP_CONFIG } from '../relationships/index.js';
import { LogosEngine } from '../logos/engine.js';
import { GovernanceEngine } from '../governance/engine.js';
import { createInMemoryStore } from '../governance/store.js';
import type { GovernanceStore } from '../governance/store.js';
import { ReadOnlyAuditChain } from './readonly-chain.js';

/**
 * Options for creating a ReplayGrid via the ReplayGridOptions constructor path.
 * Provided for API compatibility with the plan interface contract (D-13-03).
 */
export interface ReplayGridOptions {
    readonly entries: ReadonlyArray<AuditEntry>;
    readonly seed: string;
    readonly transport: 'in-memory';  // literal — T-10-12 defense: never 'websocket'
    readonly fixedTime?: number;      // optional FIXED_TIME for deterministic Brain bridge fakes
}

/**
 * ReplayGrid — isolated read-only Grid harness.
 *
 * Constructor accepts either:
 *   - `(entries: AuditEntry[], gridName: string)` — positional form used by tests
 *   - Designed to be consistent with the ReplayGridOptions shape above
 *
 * No network server. No WebSocket hub. No background timers. No clock.start().
 * The replay grid is static; consumers query state directly via the
 * public subsystem fields or via buildStateAtTick().
 */
export class ReplayGrid {
    /**
     * The read-only audit chain holding the replayed entries.
     * T-10-07: append() always throws. Object identity is NEVER the same as
     * any live GenesisLauncher's audit chain (isolation invariant).
     */
    readonly audit: ReadOnlyAuditChain;

    /**
     * Nous registry reconstructed from spawned-entry replay.
     * Note: nous.spawned events do NOT go through registry.spawn() during replay
     * (no side-effects); the registry starts empty. Derived state comes from
     * RelationshipListener.
     */
    readonly registry: NousRegistry;

    /**
     * Dialogue aggregator wired to the readonly audit chain (onAppend never fires
     * during construction; rebuildFromChain is not needed for aggregator state
     * in the replay context because dialogue windows are transient, not persisted).
     */
    readonly aggregator: DialogueAggregator;

    /**
     * Relationship listener wired to the readonly audit chain.
     * onAppend is registered at construction; listeners do NOT fire during
     * loadEntries (chain.ts:74). Call rebuildFromChain() explicitly to
     * reconstruct edge state.
     */
    readonly relationships: RelationshipListener;

    /**
     * Governance engine backed by an in-memory store.
     * Proposal/ballot state is reconstructed via explicit replay in rebuildFromChain().
     */
    readonly governance: GovernanceEngine;

    /** The backing governance store (in-memory, isolated per ReplayGrid instance). */
    readonly governanceStore: GovernanceStore;

    /** Logos engine for law evaluation (empty at construction; populated via rebuildFromChain if needed). */
    readonly logos: LogosEngine;

    constructor(entries: ReadonlyArray<AuditEntry>, gridName: string) {
        // ── Step 1: audit (ReadOnlyAuditChain) ────────────────────────────────────
        // Restores entries silently via super.loadEntries — no onAppend listeners fired.
        // T-10-07: this instance is NEVER the live launcher's audit chain.
        this.audit = new ReadOnlyAuditChain(entries as AuditEntry[]);

        // ── Step 2: registry ───────────────────────────────────────────────────────
        // Fresh registry — no Nous pre-spawned. Replay reads entries directly via
        // the audit chain; it does not re-execute registry.spawn() side effects.
        this.registry = new NousRegistry();

        // ── Step 3: logos (needed by GovernanceEngine) ────────────────────────────
        this.logos = new LogosEngine();

        // ── Step 4: aggregator (D-9-04 order: AFTER audit, BEFORE relationships) ──
        // DialogueAggregator registers an onAppend listener at construction.
        // Since the chain is ReadOnly, append() will never fire — the listener
        // exists but is permanently dormant.
        this.aggregator = new DialogueAggregator(this.audit, { windowTicks: 5, minExchanges: 2 });

        // ── Step 5: relationships (D-9-04 order: AFTER aggregator) ─────────────────
        // RelationshipListener registers an onAppend listener at construction.
        // Same as aggregator: listener is dormant. rebuildFromChain() must be
        // called explicitly to populate edge state (chain.ts:74 caveat).
        this.relationships = new RelationshipListener(this.audit, DEFAULT_RELATIONSHIP_CONFIG);

        // ── Step 6: governance ────────────────────────────────────────────────────
        this.governanceStore = createInMemoryStore(gridName);
        this.governance = new GovernanceEngine(
            this.audit,
            this.governanceStore,
            this.registry,
            this.logos,
        );
    }

    /**
     * Reconstruct derived subsystem state from the loaded audit entries.
     *
     * MUST be called after construction (and after any additional listener
     * registration) to populate:
     *   - RelationshipListener edges (walks audit.all() manually — no append fires)
     *
     * Mirrors GenesisLauncher.bootstrap() end sequence (D-9-04 / P-9-02):
     *   "AuditChain.loadEntries() does NOT fire onAppend. Manual replay is
     *    required to reconstruct the derived view."
     *
     * T-10-07: this method never invokes audit append at any point.
     */
    rebuildFromChain(): void {
        // RelationshipListener.rebuildFromChain() walks audit.all() manually
        // (no onAppend involvement), clearing existing edges and replaying each
        // entry through handleEntry() to reconstruct warmth/weight/valence.
        this.relationships.rebuildFromChain();
    }
}
