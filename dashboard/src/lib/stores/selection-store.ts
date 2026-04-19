/**
 * SelectionStore — framework-agnostic singleton tracking which Nous (if any)
 * the operator is currently inspecting. Shape mirrors the Phase-3 store
 * contract (subscribe/getSnapshot) so React's useSyncExternalStore can bind
 * to it without any React import here.
 *
 * Invariants (Plan 04-04 Task 1):
 *   - Current state is a `string | null`.
 *   - selectNous(did) validates via DID_REGEX; invalid input (including
 *     attacker-controlled strings arriving from `#nous=...`) falls through
 *     to null. Never throws. — Threat T-04-17 (tampering) / T-04-20b.
 *   - Same-value writes are a no-op: listeners are not notified and
 *     getSnapshot returns the SAME reference (stability required by
 *     useSyncExternalStore to avoid tearing).
 *   - No React import — the store is pure TypeScript, identical in shape to
 *     the Phase-3 FirehoseStore / PresenceStore / HeartbeatStore so the
 *     existing StoresProvider can thread it through the same context.
 *
 * DID_REGEX is duplicated here (not imported from grid/) per Plan 04-04
 * <interfaces> — the dashboard cannot cross the package boundary.
 */

export const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

export class SelectionStore {
    private current: string | null = null;
    private readonly listeners = new Set<() => void>();

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): string | null => this.current;

    selectNous(did: string | null): void {
        const next = did !== null && DID_REGEX.test(did) ? did : null;
        if (next === this.current) return;
        this.current = next;
        for (const listener of this.listeners) listener();
    }

    clear(): void {
        this.selectNous(null);
    }
}

/**
 * Convenience singleton for the common case where the whole app shares one
 * selection. Tests and parallel trees (e.g. Storybook) can instantiate a
 * fresh SelectionStore to avoid cross-test leakage.
 */
export const selectionStore = new SelectionStore();
