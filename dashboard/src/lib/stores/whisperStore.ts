/**
 * WhisperStore — SSR-safe singleton for whisper activity counts.
 *
 * Phase 11 WHISPER-02 / D-11-15 counts-only UI contract.
 *
 * Clone of dashboard/src/lib/stores/agency-store.ts (Plan 06-06 / 10a-05).
 * Implements subscribe/getSnapshot triad for React useSyncExternalStore.
 *
 * State shape:
 *   sent:        number — whispers sent from the inspected DID
 *   received:    number — whispers received by the inspected DID
 *   lastTick:    number | null — tick of the most recent whisper involving DID
 *   topPartners: Array<{did: string, count: number}> — top-5 by total count
 *
 * PRIVACY (WHISPER-02):
 *   - NO ciphertext_hash stored or exposed
 *   - NO plaintext stored or exposed
 *   - NO localStorage persistence (counts are ephemeral, derived from firehose)
 *   - Counts visible at all H tiers per D-11-15 (no H-tier gating)
 *
 * NO Date.now, NO Math.random — wall-clock discipline for whisper data.
 * (Date.now is allowed for display timestamps but not for whisper payload processing.)
 *
 * See: 11-CONTEXT.md D-11-15. WHISPER-02.
 */

export interface WhisperPartner {
    readonly did: string;
    readonly count: number;
}

export interface WhisperState {
    readonly sent: number;
    readonly received: number;
    readonly lastTick: number | null;
    readonly topPartners: readonly WhisperPartner[];
}

type Listener = () => void;

const INITIAL_STATE: WhisperState = {
    sent: 0,
    received: 0,
    lastTick: null,
    topPartners: [],
};

export class WhisperStore {
    private state: WhisperState = { ...INITIAL_STATE };
    private readonly listeners = new Set<Listener>();
    /** Per-partner counts: Map<did, {sent, received}> keyed on the INSPECTED DID's perspective. */
    private partnerCounts = new Map<string, number>();
    private currentInspectedDid: string | null = null;

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): WhisperState => this.state;

    private notify(): void {
        for (const listener of this.listeners) listener();
    }

    /**
     * Record a whisper entry for the inspected DID.
     * Call from use-whisper-counts.ts whenever a 'nous.whispered' entry appears.
     */
    recordWhisper(
        entry: { from_did: string; to_did: string; tick: number },
        inspectedDid: string,
    ): void {
        // SSR guard — store is purely in-memory, no server-side logic needed.
        if (typeof window === 'undefined') return;

        // If the inspected DID changed, reset all counters.
        if (inspectedDid !== this.currentInspectedDid) {
            this.reset(inspectedDid);
            return;
        }

        let { sent, received, lastTick } = this.state;

        if (entry.from_did === inspectedDid) {
            sent += 1;
            const partner = entry.to_did;
            this.partnerCounts.set(partner, (this.partnerCounts.get(partner) ?? 0) + 1);
        } else if (entry.to_did === inspectedDid) {
            received += 1;
            const partner = entry.from_did;
            this.partnerCounts.set(partner, (this.partnerCounts.get(partner) ?? 0) + 1);
        } else {
            // This entry doesn't involve the inspected DID — skip.
            return;
        }

        if (lastTick === null || entry.tick > lastTick) {
            lastTick = entry.tick;
        }

        this.state = {
            sent,
            received,
            lastTick,
            topPartners: this.computeTopPartners(),
        };
        this.notify();
    }

    /** Reset all counts for a new inspected DID. */
    reset(newInspectedDid: string | null): void {
        this.currentInspectedDid = newInspectedDid;
        this.partnerCounts = new Map();
        this.state = { ...INITIAL_STATE };
        this.notify();
    }

    private computeTopPartners(): WhisperPartner[] {
        return Array.from(this.partnerCounts.entries())
            .map(([did, count]) => ({ did, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
}

/** Module-level singleton. Tests should construct fresh WhisperStore instances. */
export const whisperStore = new WhisperStore();
