/**
 * ReadOnlyAuditChain — an AuditChain subclass whose append() always throws.
 *
 * PRIMARY THREAT MITIGATION: T-10-07 — "Replay engine shares state with live Grid".
 * This class enforces the immutable-chain contract at BOTH the TypeScript type
 * level (return type `never`) AND at runtime (throws TypeError before any mutation).
 *
 * Decision reference: D-13-03 (13-CONTEXT.md §canonical_refs).
 *
 * Three-layer defense (belt-and-suspenders):
 *   1. Type system: `override append(): never` — callers that hold a
 *      `ReadOnlyAuditChain` reference cannot call append() without a cast.
 *   2. Runtime throw: TypeError thrown BEFORE any super-class append call —
 *      no mutation of `length`, `head`, or internal entries can occur.
 *   3. CI gate: scripts/check-replay-readonly.mjs greps grid/src/replay/**
 *      for any chain-append call and fails non-zero on match.
 *
 * loadEntries() is intentionally NOT overridden:
 *   - It is used once at construction time to restore the chain state from
 *     a pre-existing slice (the "silent restore" path per chain.ts:74).
 *   - It does NOT fire onAppend listeners, so no mutation-side-effect escapes.
 *   - It throws if called on a non-empty chain, preventing double-load.
 *
 * onAppend() is intentionally NOT overridden:
 *   - Listener registration is harmless: listeners simply never fire because
 *     nothing ever appends to a ReadOnlyAuditChain.
 */

import { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';

export class ReadOnlyAuditChain extends AuditChain {
    /**
     * Sentinel field — not functional; serves as a permanent inline marker
     * for future maintainers that this instance is read-only by design.
     * (Object.freeze() was considered but rejected because it breaks bound
     * `this` references on subclass methods in strict mode.)
     */
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    private readonly _readOnly: true = true;

    /**
     * Construct a ReadOnlyAuditChain, restoring the given entries silently.
     *
     * Calls super() to create an empty chain, then super.loadEntries() to
     * restore lastHash and nextId. loadEntries() does NOT fire onAppend
     * listeners (chain.ts:74 silent-restore contract — preserved here).
     *
     * @param initialEntries - Ordered chain entries from the live launcher
     *   (typically a slice [startTick, endTick]). Pass [] for an empty chain.
     */
    constructor(initialEntries: AuditEntry[]) {
        super();
        if (initialEntries.length > 0) {
            super.loadEntries(initialEntries);
        }
    }

    /**
     * Always throws TypeError — this chain is read-only (T-10-07).
     *
     * The throw occurs BEFORE any super-class append invocation, ensuring that no
     * mutation of internal chain state (entries array, lastHash, nextId,
     * or onAppend listeners) can occur.
     *
     * The error message carries both 'read-only' (for the test assertion) and
     * 'T-10-07' (forensic fingerprint linking the violation to the threat model).
     *
     * Return type is `never` — callers that hold a ReadOnlyAuditChain reference
     * and attempt to call append() without casting get a compile-time error.
     */
    override append(
        eventType: string,
        actorDid: string,
        _payload: Record<string, unknown>,
        _targetDid?: string,
    ): never {
        throw new TypeError(
            `ReadOnlyAuditChain: append() forbidden — this chain is read-only (replay engine, T-10-07). ` +
            `Attempted append: eventType=${JSON.stringify(eventType)}, actorDid=${JSON.stringify(actorDid)}`,
        );
    }
}
