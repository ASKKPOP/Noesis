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
    | 'invalid_did'
    | 'unknown_nous'
    | 'nous_deleted'
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

// Status map for the delete route — different 400 semantic (invalid_did not invalid_tier)
const STATUS_TO_KIND_DELETE: Record<number, OperatorErrorKind> = {
    400: 'invalid_did',
    404: 'unknown_nous',
    410: 'nous_deleted',
    503: 'brain_unavailable',
};

/**
 * deleteNous — POST /api/operator/nous/:did/delete
 *
 * Phase 8 (AGENCY-05): H5 Sovereign irreversible deletion wrapper.
 * Error taxonomy mirrors postOperatorAction discipline — only `kind` is
 * exposed; raw err.message never leaks (T-08-45 mitigation).
 *
 * Status ladder:
 *   200 → ok: true, data: { tombstoned_at_tick, pre_deletion_state_hash }
 *   400 → invalid_did (DID shape failed Grid validation)
 *   404 → unknown_nous (DID not in roster)
 *   410 → nous_deleted (already tombstoned — 410 race, D-20)
 *   503 → brain_unavailable (Brain container offline)
 *   other non-2xx or fetch rejection (non-abort) → network
 *   AbortError is re-thrown so callers can distinguish user-cancel from failure.
 */
export async function deleteNous(
    did: string,
    baseUrl: string,
    signal?: AbortSignal,
): Promise<OperatorFetchResult<{ tombstoned_at_tick: number; pre_deletion_state_hash: string }>> {
    let resp: Response;
    try {
        resp = await fetch(`${baseUrl}/api/operator/nous/${did}/delete`, {
            method: 'POST',
            signal,
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
    if (resp.ok) {
        const data = await resp.json();
        return { ok: true, data };
    }
    return { ok: false, error: { kind: STATUS_TO_KIND_DELETE[resp.status] ?? 'network' } };
}

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
