/**
 * Phase 50 v2.6 → v3.0 Migration (Plan 2 + 3) — the migration ceremony state machine.
 *
 * Three steps, reversible until the first civic action:
 *   export  (--from-v2.6 --to-v3.0) : read v2.6 memory → write a v3.0 Brain init bundle (state 'exported')
 *   commit  (--commit)              : start v3.0 runtime; pre-Phase-37 audit becomes read-only context
 *   revert  (--revert)              : roll back IFF no post-migration *.civic.* action has committed;
 *                                     after the first civic action → 'migration_committed' (use Phase-43 fork)
 *
 * All I/O (v2.6 read, bundle write, state persistence, civic-action check, clock) is injected so the
 * ceremony logic is pure + unit-testable without a live v2.6 stack. Allowlist +0 (no new events).
 */

export interface NousBundleSummary {
    readonly nousName: string;
    readonly rowCount: number;
    readonly memoryHash: string;   // hex digest of the exported memory (integrity)
    readonly migrationTick: number;
}

export type MigrationPhase = 'exported' | 'committed' | 'reverted';

export interface MigrationState {
    readonly phase: MigrationPhase;
    readonly bundles: readonly NousBundleSummary[];
    readonly committedTick?: number;
}

export interface MigrationIO {
    readState(): MigrationState | null;
    writeState(state: MigrationState): void;
    /** Read the operator's v2.6 MySQL (Karpathy/Hypnos/Pneuma), write the v3.0 init bundle(s),
     *  and return one summary row per Nous. */
    exportV26Memory(): NousBundleSummary[];
    /** Delete the written v3.0 init bundle (revert). */
    deleteBundle(): void;
    /** True if any post-migration *.civic.* audit event has committed since `tick`. */
    hasCivicActionSince(tick: number): boolean;
    /** Current Grid tick / timestamp. */
    now(): number;
}

export type CommitResult = { ok: true; committedTick: number } | { ok: false; code: 'not_exported' };
export type RevertResult = { ok: true } | { ok: false; code: 'migration_committed' | 'nothing_to_revert' };

export class MigrationCeremony {
    constructor(private readonly io: MigrationIO) {}

    /** Step 1 — export v2.6 memory to a v3.0 bundle. No Grid network call. Returns the summary. */
    exportBundle(): NousBundleSummary[] {
        const bundles = this.io.exportV26Memory();
        this.io.writeState({ phase: 'exported', bundles });
        return bundles;
    }

    /** Step 2 — commit: start the v3.0 runtime. Requires a prior export. */
    commit(): CommitResult {
        const s = this.io.readState();
        if (!s || s.phase !== 'exported') return { ok: false, code: 'not_exported' };
        const committedTick = this.io.now();
        this.io.writeState({ phase: 'committed', bundles: s.bundles, committedTick });
        return { ok: true, committedTick };
    }

    /** Step 3 — revert: roll back to v2.6 IFF no post-migration civic action has committed. */
    revert(): RevertResult {
        const s = this.io.readState();
        if (!s || s.phase === 'reverted') return { ok: false, code: 'nothing_to_revert' };
        if (s.phase === 'committed' && typeof s.committedTick === 'number' && this.io.hasCivicActionSince(s.committedTick)) {
            return { ok: false, code: 'migration_committed' };
        }
        this.io.deleteBundle();
        this.io.writeState({ phase: 'reverted', bundles: s.bundles, committedTick: s.committedTick });
        return { ok: true };
    }
}

/** HTTP-equivalent status for a revert outcome (the CLI prints these; a route would return them). */
export function revertHttpStatus(r: RevertResult): number {
    if (r.ok) return 200;
    return r.code === 'migration_committed' ? 409 : 404;
}
