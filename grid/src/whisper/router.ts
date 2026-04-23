/**
 * WhisperRouter — orchestrates the locked side-effect order for whisper sends.
 *
 * Phase 11 WHISPER-03 / WHISPER-05 / D-11-17 / D-11-18 / CONTEXT-11.
 *
 * ORDER (LOCKED — D-30 discipline clone):
 *   1. DID regex on from_did and to_did          — validation error (throws, not silent)
 *   2. Tombstone check (registry.isTombstoned)   — silent drop (return false, NO audit,
 *                                                   NO log per D-11-18)
 *   3. Rate-limit consume                        — silent drop (return false, NO audit,
 *                                                   NO log per D-11-08)
 *   4. appendNousWhispered(audit, from_did, ...) — sole-producer audit emit
 *   5. pendingStore.enqueue(envelope)            — queue for recipient pull
 *   6. return true
 *
 * ERROR LADDER:
 *   throws TypeError — DID regex failure (step 1): programmer error / malformed input
 *   return false     — tombstone or rate-limit silent drop: expected, no side effects
 *   return true      — success: audit emitted + envelope queued
 *
 * Tombstone rejection MUST be silent:
 *   - NO audit event (cannot leak liveness via audit chain — D-11-18)
 *   - NO log line (cannot leak tombstone status via logs — D-11-18)
 *   - NO 410-shaped response (router is internal, not an HTTP handler)
 *
 * All deps are injected — no global singletons. Production bootstrap
 * wires the same AuditChain + NousRegistry + TickRateLimiter + PendingStore
 * into both NousRunner (whisper_send case) and routes.ts (Wave 3).
 *
 * See: 11-CONTEXT.md D-11-17, D-11-18. T-11-W2-04 (liveness silence).
 *   T-11-W2-07 (invocation order non-determinism mitigated by this lock).
 */

import type { AuditChain } from '../audit/chain.js';
import { DID_RE, appendNousWhispered } from './appendNousWhispered.js';
import type { TickRateLimiter } from './rate-limit.js';
import type { PendingStore } from './pending-store.js';
import type { Envelope } from './types.js';

/**
 * Minimal registry interface needed by WhisperRouter.
 * Production: NousRegistry satisfies this via { get(did).status === 'deleted' }.
 * Tests: simple { isTombstoned: vi.fn() }.
 */
export interface WhisperRegistry {
    isTombstoned(did: string): boolean;
}

export interface WhisperRouterDeps {
    readonly audit: AuditChain;
    readonly registry: WhisperRegistry;
    readonly rateLimiter: TickRateLimiter;
    readonly pendingStore: PendingStore;
}

export class WhisperRouter {
    constructor(private readonly deps: WhisperRouterDeps) {}

    /**
     * Process a pre-encrypted whisper envelope through the locked side-effect order.
     *
     * @returns true on success; false on silent-drop (tombstone or rate-limit)
     * @throws TypeError on validation failure (step 1 DID regex)
     */
    route(env: Envelope, currentTick: number): boolean {
        // Step 1: DID regex on both sides — validation error (not a silent drop).
        if (!DID_RE.test(env.from_did)) {
            throw new TypeError(`WhisperRouter: invalid from_did: ${env.from_did}`);
        }
        if (!DID_RE.test(env.to_did)) {
            throw new TypeError(`WhisperRouter: invalid to_did: ${env.to_did}`);
        }

        // Step 2: Tombstone check — silent drop per D-11-18.
        // NO audit emit, NO log, NO 410. Just return false.
        if (this.deps.registry.isTombstoned(env.from_did)) return false;
        if (this.deps.registry.isTombstoned(env.to_did)) return false;

        // Step 3: Rate-limit — silent drop per D-11-08.
        if (!this.deps.rateLimiter.tryConsume(env.from_did, currentTick)) return false;

        // Step 4: Sole-producer audit emit (LOCKED — must come before enqueue).
        appendNousWhispered(this.deps.audit, env.from_did, {
            ciphertext_hash: env.ciphertext_hash,
            from_did: env.from_did,
            tick: env.tick,
            to_did: env.to_did,
        });

        // Step 5: Enqueue for recipient pull (LOCKED — must come after audit emit).
        this.deps.pendingStore.enqueue(env);

        return true;
    }
}
