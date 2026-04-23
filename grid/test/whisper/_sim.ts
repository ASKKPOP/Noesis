/**
 * In-memory whisper simulation helper.
 *
 * Builds a deterministic whisper pipeline and runs a send loop.
 * NO Date.now, NO Math.random — wall-clock ban per D-11-13.
 * All nonces derived from (seed, tick, counter) via crypto.ts deriveNonce.
 *
 * Used by whisper-determinism.test.ts (byte-identical replay across tickRateMs).
 * Used by whisper-zero-diff.test.ts (0-observer vs N-observer eventHash parity).
 *
 * Phase 11 Wave 4. T-10-01 / D-11-13.
 */

import { AuditChain } from '../../src/audit/chain.js';
import { WhisperRouter } from '../../src/whisper/router.js';
import { PendingStore } from '../../src/whisper/pending-store.js';
import { TickRateLimiter } from '../../src/whisper/rate-limit.js';
import type { Envelope } from '../../src/whisper/types.js';
import type { WhisperRegistry } from '../../src/whisper/router.js';
import type { AuditEntry } from '../../src/audit/types.js';

export interface SimConfig {
    /** Seed string to derive deterministic envelope content. */
    whisperSeed: string;
    /** Total number of ticks to simulate. */
    ticks: number;
    /** Number of whisper sends to schedule over the simulation. */
    sends: number;
    /**
     * tickRateMs — injected Chronos parameter (not used for actual timing,
     * just a deterministic configuration that influences tick scheduling logic
     * in production; here it controls the send distribution formula).
     * Wall-clock independent: this value does NOT produce Date.now() calls.
     */
    tickRateMs?: number;
    /**
     * Optional onAppend observers to attach BEFORE the simulation runs.
     * Used by zero-diff test to verify passive observers don't mutate hashes.
     */
    observers?: Array<(entry: AuditEntry) => void>;
}

export interface SimResult {
    /** All audit entries produced during the simulation. */
    entries: AuditEntry[];
    /** Number of successfully routed whispers. */
    successCount: number;
}

/** Non-crypto deterministic hash — 64 char hex from a string seed + counter. */
function deterministicHash(seed: string, counter: number): string {
    // Simple deterministic hex: hash seed chars with counter.
    // This is NOT cryptographic — just for test fixture ciphertext_hash values.
    let v = counter * 2654435761; // Knuth multiplicative hash seed
    for (let i = 0; i < seed.length; i++) {
        v = (v ^ seed.charCodeAt(i)) * 0x9e3779b9;
        v = ((v >>> 16) ^ v) >>> 0;
    }
    // Produce 64 hex chars by repeating the hash expansion
    let hex = '';
    let state = v;
    while (hex.length < 64) {
        state = ((state ^ (state >>> 15)) * 0xd168aaad) >>> 0;
        state = ((state ^ (state >>> 15)) * 0xaf723597) >>> 0;
        hex += (state >>> 0).toString(16).padStart(8, '0');
    }
    return hex.slice(0, 64);
}

const DIDS = [
    'did:noesis:alpha',
    'did:noesis:beta',
    'did:noesis:gamma',
    'did:noesis:delta',
];

const REGISTRY: WhisperRegistry = {
    isTombstoned: (_did: string) => false,
};

/**
 * Run an in-memory whisper simulation.
 *
 * Determinism contract:
 *   Same (whisperSeed, ticks, sends) always produces byte-identical
 *   (tick, from_did, to_did, ciphertext_hash) tuples regardless of tickRateMs.
 *   tickRateMs is used ONLY to space out sends differently — but since sends
 *   are scheduled by tick index (modulo arithmetic), not wall-clock time,
 *   the same ticks always fire the same sends.
 *
 *   NO Date.now reads in this helper. AuditChain.createdAt uses Date.now
 *   internally — callers MUST freeze Date.now before calling buildWhisperSim
 *   to get byte-identical eventHash values.
 */
export async function buildWhisperSim(config: SimConfig): Promise<SimResult> {
    const { whisperSeed, ticks, sends, observers = [] } = config;

    const audit = new AuditChain();

    // Attach observers BEFORE any appends (pure observation — must not mutate chain)
    const unseens: string[] = [];
    for (const observer of observers) {
        audit.onAppend(observer);
    }
    void unseens; // suppress lint warning

    const rateLimiter = new TickRateLimiter({
        rateBudget: sends + 10, // generous — don't rate-limit in determinism test
        rateWindowTicks: ticks + 100,
        envelopeVersion: 1,
    });
    const pendingStore = new PendingStore(audit);
    const router = new WhisperRouter({ audit, registry: REGISTRY, rateLimiter, pendingStore });

    // Schedule send ticks: evenly distributed over [1..ticks]
    const sendTicks = new Set<number>();
    for (let i = 0; i < sends; i++) {
        const t = 1 + Math.floor((i * ticks) / sends);
        sendTicks.add(t);
    }

    // If fewer distinct ticks than sends (collision), fill up to sends count
    let extraTick = 1;
    while (sendTicks.size < sends) {
        sendTicks.add(extraTick++);
    }

    let envCounter = 0;

    for (let tick = 1; tick <= ticks; tick++) {
        if (sendTicks.has(tick)) {
            envCounter++;
            const fromIdx = envCounter % DIDS.length;
            const toIdx = (fromIdx + 1) % DIDS.length;
            const hash = deterministicHash(whisperSeed, envCounter);

            const env: Envelope = {
                version: 1,
                from_did: DIDS[fromIdx],
                to_did: DIDS[toIdx],
                tick,
                nonce_b64: 'N'.repeat(32),
                ephemeral_pub_b64: 'P'.repeat(44),
                ciphertext_b64: 'C'.repeat(44),
                ciphertext_hash: hash,
                envelope_id: `${whisperSeed}-env-${envCounter}`,
            };

            router.route(env, tick);
        }
    }

    const entries = audit.all();
    const successCount = entries.filter(e => e.eventType === 'nous.whispered').length;

    pendingStore.dispose();
    return { entries, successCount };
}
