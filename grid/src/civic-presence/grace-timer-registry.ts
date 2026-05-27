/**
 * Phase 41 / SLEEP-01 — Per-Civic-DID grace timer with WSS connection refcount.
 *
 * Multi-connection contract (RESEARCH.md Open Question 3):
 *   - incrementConnection(civicDid) — call on WSS connect
 *   - decrementConnection(civicDid) — call on WSS close; when count reaches 0,
 *                                     startGraceTimer is called automatically
 *   - heartbeat(civicDid) — POST /civic/presence cancels any pending timer
 *
 * OBS-R-32-02 contract: clear() MUST clearTimeout all pending timers in shutdown.
 */
export class GraceTimerRegistry {
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly refCounts = new Map<string, number>();

    /**
     * Increment WSS connection count for a Civic-DID. Cancels any pending grace
     * timer (the Nous is back online).
     */
    incrementConnection(civicDid: string): void {
        const prev = this.refCounts.get(civicDid) ?? 0;
        this.refCounts.set(civicDid, prev + 1);
        this.cancelGraceTimer(civicDid);
    }

    /**
     * Decrement WSS connection count. When count reaches 0, starts the grace timer.
     * @returns whether a grace timer was started (i.e. count reached 0)
     */
    decrementConnection(
        civicDid: string,
        onExpired: () => void,
        graceMs: number,
    ): boolean {
        const prev = this.refCounts.get(civicDid) ?? 0;
        const next = Math.max(0, prev - 1);
        if (next === 0) {
            this.refCounts.delete(civicDid);
            this.startGraceTimer(civicDid, onExpired, graceMs);
            return true;
        }
        this.refCounts.set(civicDid, next);
        return false;
    }

    /**
     * Heartbeat cancels any pending timer. Connection count is unaffected
     * (HTTP heartbeat does not imply WSS reconnect).
     */
    heartbeat(civicDid: string): void {
        this.cancelGraceTimer(civicDid);
    }

    startGraceTimer(civicDid: string, onExpired: () => void, graceMs: number): void {
        this.cancelGraceTimer(civicDid); // reset if already running
        const timer = setTimeout(() => {
            this.timers.delete(civicDid);
            try { onExpired(); } catch { /* swallow — timer callbacks never throw into event loop */ }
        }, graceMs);
        this.timers.set(civicDid, timer);
    }

    cancelGraceTimer(civicDid: string): void {
        const existing = this.timers.get(civicDid);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(civicDid);
        }
    }

    /** OBS-R-32-02 — call in WsFirehoseHub.close() to prevent post-shutdown timer leaks. */
    clear(): void {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.refCounts.clear();
    }

    /** Test inspection — number of active grace timers. */
    activeTimerCount(): number { return this.timers.size; }
    /** Test inspection — connection refcount for a Civic-DID. */
    connectionCount(civicDid: string): number { return this.refCounts.get(civicDid) ?? 0; }
}
