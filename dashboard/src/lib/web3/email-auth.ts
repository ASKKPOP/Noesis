/**
 * Email authentication utilities — sign-in and sign-up via Grid API.
 *
 * Follows the same pattern as siwe-auth.ts: plain async functions that
 * POST to the Grid backend and return a HumanUser on success.
 *
 * Backend endpoints expected:
 *   POST /api/v1/portal/auth/email/signin  { email, password }  → HumanUser
 *   POST /api/v1/portal/auth/email/signup  { email, password }  → HumanUser
 */

import type { HumanUser } from './siwe-auth';

export interface EmailAuthParams {
    email: string;
    password: string;
    /** Base URL for the Grid API — defaults to '' (same origin) */
    gridApiBase?: string;
}

/**
 * Sign in with email + password.
 *
 * @throws Error with backend `error` field message on 4xx.
 * @throws Error('sign_in_failed') on network/unexpected errors.
 */
export async function signInWithEmail(params: EmailAuthParams): Promise<HumanUser> {
    const base = params.gridApiBase ?? '';
    let res: Response;
    try {
        res = await fetch(`${base}/api/v1/portal/auth/email/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: params.email, password: params.password }),
        });
    } catch {
        throw new Error('sign_in_failed');
    }

    if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'sign_in_failed' })) as { error: string };
        throw new Error(errData.error ?? 'sign_in_failed');
    }

    return res.json() as Promise<HumanUser>;
}

/**
 * Create a new account with email + password.
 *
 * @throws Error with backend `error` field message on 4xx.
 * @throws Error('sign_up_failed') on network/unexpected errors.
 */
export async function signUpWithEmail(params: EmailAuthParams): Promise<HumanUser> {
    const base = params.gridApiBase ?? '';
    let res: Response;
    try {
        res = await fetch(`${base}/api/v1/portal/auth/email/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: params.email, password: params.password }),
        });
    } catch {
        throw new Error('sign_up_failed');
    }

    if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'sign_up_failed' })) as { error: string };
        throw new Error(errData.error ?? 'sign_up_failed');
    }

    return res.json() as Promise<HumanUser>;
}
