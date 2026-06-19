/**
 * Portal Manager v1 — dashboard API client for the Tier-3 reviewer-queue
 * READ endpoint on the Grid.
 *
 * GET {NEXT_PUBLIC_GRID_ORIGIN}/api/v1/portal-manager/registrations[?status=]
 *
 * Operator-gated: the caller supplies x-operator-tier / x-operator-id headers
 * (the same header-trust mechanism every operator.* route uses). Non-2xx maps
 * to a discriminated-union error exposing only `kind` (mirrors operator.ts) —
 * raw error text never leaks to callers.
 */

const GRID_ORIGIN = (): string => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationRow {
    application_id: string;
    grid_name: string;
    status: RegistrationStatus;
    civic_did: string | null;
    reason_code: string | null;
    requested_at_tick: number;
    decided_at_tick: number | null;
    /** SHA-256 of the human operator-DID — the raw DID is never returned. */
    human_did_hash: string;
}

export interface RegistrationsResponse {
    grid_name: string;
    applications: RegistrationRow[];
    counts: { pending: number; approved: number; rejected: number; total: number };
    activity: { registrations_total: number; civic_dids_issued: number };
}

export type PortalManagerErrorKind =
    | 'unauthorized'   // 401 tier_missing / 403 tier_too_low / 400 invalid_operator_id
    | 'db_unavailable' // 503
    | 'network';       // fetch rejection or any other non-2xx

export interface PortalManagerFetchError {
    readonly kind: PortalManagerErrorKind;
}

export type PortalManagerResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: PortalManagerFetchError };

const STATUS_TO_KIND: Record<number, PortalManagerErrorKind> = {
    400: 'unauthorized',
    401: 'unauthorized',
    403: 'unauthorized',
    503: 'db_unavailable',
};

export interface OperatorHeaders {
    tier: number | string;
    operatorId: string;
}

/**
 * fetchRegistrations — GET the reviewer queue with operator headers.
 * `status` optionally filters to one status group (counts stay grid-wide).
 */
export async function fetchRegistrations(
    op: OperatorHeaders,
    status?: RegistrationStatus,
    signal?: AbortSignal,
): Promise<PortalManagerResult<RegistrationsResponse>> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    let resp: Response;
    try {
        resp = await fetch(`${GRID_ORIGIN()}/api/v1/portal-manager/registrations${qs}`, {
            method: 'GET',
            signal,
            headers: {
                accept: 'application/json',
                'x-operator-tier': String(op.tier),
                'x-operator-id': op.operatorId,
            },
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }

    if (!resp.ok) {
        return { ok: false, error: { kind: STATUS_TO_KIND[resp.status] ?? 'network' } };
    }

    return { ok: true, data: (await resp.json()) as RegistrationsResponse };
}
