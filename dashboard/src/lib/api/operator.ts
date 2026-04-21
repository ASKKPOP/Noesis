/**
 * postOperatorAction — typed POST wrapper for `POST {origin}/api/v1/operator/*`
 * endpoints (H2 memory query, H3 clock/laws, H4 force-Telos).
 *
 * Mirrors `introspect.ts` fetchNousState — same discriminated-union error
 * shape, same AbortError re-throw discipline — but with the operator-specific
 * error taxonomy (`invalid_tier` replaces `invalid_did`).
 *
 * Error ladder (matches the Fastify 400→404→503 ladder from Plan 04-04,
 * PATTERNS.md §S-2):
 *   - 400 → invalid_tier     (body validation: missing/malformed tier field)
 *   - 404 → unknown_nous     (target_did not in roster)
 *   - 503 → brain_unavailable (brain container offline / refused)
 *   - any other non-2xx or fetch rejection (non-abort) → network
 *   - AbortError is re-thrown so callers distinguish user-cancel from failure.
 *
 * The `OperatorFetchError` discriminator exposes only `kind` — raw err.message
 * never leaks to callers (Task 1 Test 7 enforces `Object.keys === ['kind']`).
 */

export type OperatorErrorKind =
    | 'invalid_tier'
    | 'unknown_nous'
    | 'brain_unavailable'
    | 'network';

export interface OperatorFetchError {
    readonly kind: OperatorErrorKind;
}

export type OperatorFetchResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: OperatorFetchError };

const STATUS_TO_KIND: Record<number, OperatorErrorKind> = {
    400: 'invalid_tier',
    404: 'unknown_nous',
    503: 'brain_unavailable',
};

export async function postOperatorAction<T>(
    endpoint: string,
    origin: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<OperatorFetchResult<T>> {
    let resp: Response;
    try {
        resp = await fetch(`${origin}${endpoint}`, {
            method: 'POST',
            signal,
            headers: {
                'content-type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        // Intentional aborts re-throw so callers can distinguish user-cancel
        // from network loss (introspect.ts:70 discipline).
        if ((err as { name?: string }).name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }

    if (!resp.ok) {
        const kind = STATUS_TO_KIND[resp.status] ?? 'network';
        return { ok: false, error: { kind } };
    }

    return { ok: true, data: (await resp.json()) as T };
}
