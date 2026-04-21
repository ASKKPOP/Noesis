/**
 * Brain hash-state client — fetches the 4 component hashes from the Brain
 * over HTTP for the H5 delete flow (AGENCY-05 D-03).
 *
 * The delete route calls this BEFORE tombstoning so the pre-deletion state
 * can be captured. If the Brain is unreachable or returns a malformed body
 * the route 503s and the Nous stays alive (SC#3 invariant).
 *
 * D-03 (4-key closed tuple): psyche_hash, thymos_hash, telos_hash,
 * memory_stream_hash — exactly these 4, nothing more. Extra keys or missing
 * keys → BrainMalformedResponseError.
 *
 * The route passes `brainFetch` so tests can inject a mock without monkey-
 * patching the global `fetch`.
 *
 * See: 08-CONTEXT D-03, D-05, D-06, D-10.
 */

import type { StateHashComponents } from '../../audit/state-hash.js';
import { HEX64_RE } from '../../audit/state-hash.js';

/** Brain was unreachable or timed out. Nous stays active — no tombstone. */
export class BrainUnreachableError extends Error {
    constructor(cause: unknown) {
        super(`Brain unreachable: ${cause instanceof Error ? cause.message : String(cause)}`);
        this.name = 'BrainUnreachableError';
        if (cause instanceof Error && cause.stack) this.cause = cause;
    }
}

/** Brain returned a non-200 status for the DID. */
export class BrainUnknownDidError extends Error {
    constructor(did: string, status: number) {
        super(`Brain returned ${status} for DID ${did}`);
        this.name = 'BrainUnknownDidError';
    }
}

/**
 * Brain returned 200 but the body did not conform to the 4-key closed tuple
 * (D-03) or a value was not a 64-hex string (D-05).
 */
export class BrainMalformedResponseError extends Error {
    constructor(detail: string) {
        super(`Brain malformed response: ${detail}`);
        this.name = 'BrainMalformedResponseError';
    }
}

/** The 4 key names in the exact canonical order (D-03). */
const EXPECTED_KEYS = [
    'memory_stream_hash',
    'psyche_hash',
    'telos_hash',
    'thymos_hash',
] as const; // sorted for structural check

/**
 * Fetch and validate the Brain's 4-component hash state for a given DID.
 *
 * @param brainBaseUrl  Base URL of the Brain HTTP API (e.g. "http://127.0.0.1:7700").
 *                      The client appends `/api/v1/nous/<did>/state_hash`.
 * @param did           Target Nous DID.
 * @param brainFetch    `fetch`-compatible function (injectable for testing).
 * @param timeoutMs     Abort timeout in milliseconds (default 5 000 ms).
 *
 * @throws BrainUnreachableError  on network error or timeout.
 * @throws BrainUnknownDidError   on non-200 HTTP status.
 * @throws BrainMalformedResponseError  on invalid JSON or schema mismatch.
 */
export async function fetchBrainHashState(
    brainBaseUrl: string,
    did: string,
    brainFetch: typeof fetch,
    timeoutMs = 5_000,
): Promise<StateHashComponents> {
    const url = `${brainBaseUrl}/api/v1/nous/${encodeURIComponent(did)}/state_hash`;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await brainFetch(url, { signal: controller.signal });
    } catch (err) {
        clearTimeout(timerId);
        throw new BrainUnreachableError(err);
    } finally {
        clearTimeout(timerId);
    }

    if (!response.ok) {
        throw new BrainUnknownDidError(did, response.status);
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch (err) {
        throw new BrainMalformedResponseError(`JSON parse failure: ${err instanceof Error ? err.message : String(err)}`);
    }

    // D-03: exactly 4 keys, no more, no less.
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new BrainMalformedResponseError('body must be a plain object');
    }

    const actualKeys = Object.keys(body as Record<string, unknown>).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new BrainMalformedResponseError(
            `expected keys ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    const rec = body as Record<string, unknown>;

    // D-05: each value must be a 64-hex string.
    for (const key of EXPECTED_KEYS) {
        const v = rec[key];
        if (typeof v !== 'string' || !HEX64_RE.test(v)) {
            throw new BrainMalformedResponseError(
                `${key} must be a 64-hex string, got ${JSON.stringify(v)}`,
            );
        }
    }

    return {
        psyche_hash:        rec['psyche_hash'] as string,
        thymos_hash:        rec['thymos_hash'] as string,
        telos_hash:         rec['telos_hash'] as string,
        memory_stream_hash: rec['memory_stream_hash'] as string,
    };
}
