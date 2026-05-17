/**
 * LoreQuotaTracker — Phase 20 LORE-03.
 * Enforces K=3 lore contributions per Nous per sleep epoch (30-tick boundary, D-20-03/D-20-13).
 * Grid boundary enforcement — NousRunner calls tryConsume before appendLoreContributed.
 *
 * Epoch = Math.floor(tick / epochLength). Resets automatically across epoch boundaries.
 * epochLength default = 30 (matches LORE_POLL_INTERVAL and Phase 16 sleep epoch).
 */
export class LoreQuotaTracker {
    /** Map<nousDid, Map<epoch, count>> */
    private readonly counts = new Map<string, Map<number, number>>();

    constructor(
        private readonly k: number = 3,
        private readonly epochLength: number = 30,
    ) {}

    /**
     * Attempt to consume one quota slot for the given Nous at the given tick.
     * Returns true if allowed (count < K); false if quota exhausted for this epoch.
     */
    tryConsume(nousDid: string, tick: number): boolean {
        const epoch = Math.floor(tick / this.epochLength);
        let epochs = this.counts.get(nousDid);
        if (!epochs) {
            epochs = new Map<number, number>();
            this.counts.set(nousDid, epochs);
        }
        const current = epochs.get(epoch) ?? 0;
        if (current >= this.k) {
            return false;
        }
        epochs.set(epoch, current + 1);
        return true;
    }

    /** Prune stale epoch data (keep only last 2 epochs per DID) for memory hygiene. */
    pruneStaleEpochs(currentTick: number): void {
        const currentEpoch = Math.floor(currentTick / this.epochLength);
        for (const [did, epochs] of this.counts) {
            for (const epoch of epochs.keys()) {
                if (epoch < currentEpoch - 1) epochs.delete(epoch);
            }
            if (epochs.size === 0) this.counts.delete(did);
        }
    }
}
