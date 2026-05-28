/**
 * forkTokenStore — in-memory one-time download token store for fork archives.
 *
 * Tokens are issued by the POST /fork/:nousDid handler after the audit event
 * is committed. Each token is consumed atomically on first GET /download access.
 *
 * Security properties (T-43-token):
 *   - One-time: consume() deletes the entry before returning it.
 *   - TTL: 5-minute expiry enforced at consume time (Date.now() > expiresAt).
 *   - Bound to nousDid: download route checks entry.nousDid === params.nousDid.
 *   - No persistence: tokens live in-memory only; server restart clears all tokens.
 *
 * See: T-43-token, FORK-01.
 */

export interface ForkTokenEntry {
    readonly nousDid: string;
    readonly archiveBytes: Buffer;
    readonly expiresAt: number;  // Date.now() + 5 * 60_000
}

const _store = new Map<string, ForkTokenEntry>();

export const forkTokenStore = {
    put(token: string, entry: ForkTokenEntry): void {
        _store.set(token, entry);
    },

    /** Atomically consume a token. Returns the entry on first call; undefined on second call,
     *  expired token, or unknown token. Always deletes the entry (one-time semantics). */
    consume(token: string): ForkTokenEntry | undefined {
        const e = _store.get(token);
        if (!e) return undefined;
        // Always delete (one-time semantics) even if expired
        _store.delete(token);
        if (Date.now() > e.expiresAt) return undefined;
        return e;
    },

    /** Test helper — clear all tokens. */
    _clear(): void { _store.clear(); },

    /** Test helper — count stored tokens. */
    _size(): number { return _store.size; },
};
