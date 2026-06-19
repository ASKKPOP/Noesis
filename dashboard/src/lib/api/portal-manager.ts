/**
 * Portal Manager v1 — dashboard API client for the Tier-3 reviewer-queue
 * READ endpoint on the Grid.
 *
 * GET {NEXT_PUBLIC_GRID_ORIGIN}/api/v1/portal-manager/registrations[?status=]
 *
 * AUTH: the real boundary is the server-trusted Portal session cookie — this
 * client sends `credentials: 'include'` so the cross-origin httpOnly portal-session
 * cookie reaches api.${DOMAIN} (same pattern as portal/auth + siwe-auth). The route
 * is additionally gated behind GRID_ADMIN_ENABLED on the Grid (503 admin_disabled
 * when off). The x-operator-tier / x-operator-id headers remain only as a secondary
 * intent signal — they are NO LONGER the boundary. Non-2xx maps to a
 * discriminated-union error exposing only `kind` (mirrors operator.ts) — raw error
 * text never leaks to callers.
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
    | 'unauthorized'    // 401 portal_session_required/tier_missing / 403 operator_scope_required/tier_too_low / 400 invalid_operator_id
    | 'admin_disabled'  // 503 { error: 'admin_disabled' } — console gated off in this environment
    | 'db_unavailable'  // 503 { error: 'db_unavailable' } — registration store unavailable
    | 'network';        // fetch rejection or any other non-2xx

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
    // 503 is disambiguated by body.error (admin_disabled vs db_unavailable) below.
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
            // The real auth is the server-trusted Portal session cookie — send it
            // cross-origin (api.${DOMAIN}). The headers below are a secondary signal.
            credentials: 'include',
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
        // Disambiguate 503: admin_disabled (console gated off) vs db_unavailable.
        if (resp.status === 503) {
            let code: string | undefined;
            try { code = ((await resp.json()) as { error?: string }).error; } catch { /* keep undefined */ }
            return { ok: false, error: { kind: code === 'admin_disabled' ? 'admin_disabled' : 'db_unavailable' } };
        }
        return { ok: false, error: { kind: STATUS_TO_KIND[resp.status] ?? 'network' } };
    }

    return { ok: true, data: (await resp.json()) as RegistrationsResponse };
}
