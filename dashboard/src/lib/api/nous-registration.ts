/**
 * Nous registration through the Portal (D-V3-39) — dashboard client.
 *
 *   POST /api/v1/portal/nous/:nousId/claim         → claimNous
 *   POST /api/v1/portal/nous/:nousId/registration  → fileNousRegistration
 *   GET  /api/v1/portal-reviewer/nous-registrations → fetchReviewQueue
 *   POST /api/v1/portal-reviewer/nous-registrations/:requestId/prescreen → prescreenRegistration
 *
 * All four authenticate with the Portal session cookie. A refusal is returned as
 * the Grid's own error code so the caller can say exactly what went wrong.
 */

const GRID_ORIGIN = (): string => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

export type RegistrationStatus = 'requested' | 'polis_pending' | 'approved' | 'rejected';

export interface ReviewRow {
    request_id: string;
    nous_did: string;
    type: string;
    status: RegistrationStatus;
    reason_code: string | null;
    filed_tick: number;
    registrant_did_hash: string;
    registrant_is_operator: boolean;
    founding_nous: boolean;
}

/** `code` is the Grid's error string, or 'network' when the Grid did not answer. */
export type RegistrationResult<T> = { ok: true; data: T } | { ok: false; code: string };

async function call<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<RegistrationResult<T>> {
    let resp: Response;
    try {
        resp = await fetch(`${GRID_ORIGIN()}${path}`, {
            ...init,
            signal,
            credentials: 'include',
            headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) },
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        return { ok: false, code: 'network' };
    }
    const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) return { ok: false, code: typeof body.error === 'string' ? body.error : `http_${resp.status}` };
    return { ok: true, data: body as T };
}

export function claimNous(nousDid: string): Promise<RegistrationResult<{ ok: true }>> {
    return call(`/api/v1/portal/nous/${encodeURIComponent(nousDid)}/claim`, { method: 'POST' });
}

export function fileNousRegistration(
    nousDid: string,
    brainPublicKeyX: string,
): Promise<RegistrationResult<{ status: 'requested'; request_id: string }>> {
    return call(`/api/v1/portal/nous/${encodeURIComponent(nousDid)}/registration`, {
        method: 'POST',
        body: JSON.stringify({ brain_public_key_x: brainPublicKeyX }),
    });
}

export function fetchReviewQueue(
    status?: RegistrationStatus,
    signal?: AbortSignal,
): Promise<RegistrationResult<{ registrations: ReviewRow[] }>> {
    const qs = status ? `?status=${status}` : '';
    return call(`/api/v1/portal-reviewer/nous-registrations${qs}`, { method: 'GET' }, signal);
}

export function prescreenRegistration(
    requestId: string,
    pass: boolean,
    reason?: string,
): Promise<RegistrationResult<{ status: 'approved' | 'rejected'; reason_code?: string }>> {
    return call(`/api/v1/portal-reviewer/nous-registrations/${encodeURIComponent(requestId)}/prescreen`, {
        method: 'POST',
        body: JSON.stringify(reason ? { pass, reason } : { pass }),
    });
}

/** The Grid's refusal codes, in the words a person would use. */
const REFUSAL: Record<string, string> = {
    not_authenticated: 'Your session has ended. Sign in again.',
    invalid_token: 'Your session has ended. Sign in again.',
    unknown_nous: 'The Grid does not know a Nous with that ID.',
    invalid_brain_public_key: 'That is not a Brain public key. Copy the 43-character key your Brain prints when it starts.',
    not_owner: 'You have not claimed this Nous.',
    founding_nous_operator_only: 'Sophia, Hermes and Themis can only be registered by a Grid operator.',
    civic_did_required: 'You need to be a citizen of the Genesis Grid before you can register a Nous.',
    already_registered: 'This Nous is already a citizen.',
    refile_next_tick: 'The Grid has not moved on since the last filing for this Nous. Wait a moment and file again.',
    registration_exists: 'A registration for this Nous is already in progress or approved.',
    not_operator: 'Only a Grid operator can review registrations.',
    portal_session_required: 'Sign in to the Portal to review registrations.',
    portal_manager_disabled: 'The reviewer panel is switched off on this Grid.',
    bad_state: 'This registration was already decided.',
    not_found: 'That registration no longer exists.',
    network: 'The Grid did not answer. Try again.',
};

export function refusalText(code: string): string {
    return REFUSAL[code] ?? `The Grid refused the request (${code.replace(/_/g, ' ')}).`;
}
