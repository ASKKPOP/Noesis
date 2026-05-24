/**
 * Shared Brain HTTP error classes — reused by brain-hash-state-client.ts and
 * cognitive-snapshot-client.ts (Phase 25a).
 *
 * Extracted from brain-hash-state-client.ts (D-25a-01 foundation).
 * Constructor signatures and message formats are identical to the originals.
 */

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
 * Brain returned 200 but the body did not conform to the expected schema
 * or a value was not a 64-hex string.
 */
export class BrainMalformedResponseError extends Error {
    constructor(detail: string) {
        super(`Brain malformed response: ${detail}`);
        this.name = 'BrainMalformedResponseError';
    }
}
