/**
 * signInWithEthereum — SIWE authentication utility.
 *
 * Phase 22 WEB3-01 to WEB3-03.
 *
 * Kept as a plain async function (not a hook) so it can be called
 * from event handlers and tested without a wagmi render context.
 * The signMessage callback is injected by the caller (auth page).
 */

import { SiweMessage } from 'siwe';

export interface HumanUser {
    did: string;
    eth_address: string;
    /** Present for email-authenticated users. */
    email?: string;
    /** Auto-assigned region — populated from /me after sign-in. */
    region?: string | null;
    /** ISO 8601 join timestamp — populated from /me after sign-in. */
    created_at?: string | null;
}

export interface SignInParams {
    address: string;   // checksummed EIP-55 address from wagmi
    chainId: number;
    /** wagmi signMessageAsync bound to the current wallet */
    signMessage: (message: string) => Promise<string>;
    /** Base URL for the Grid API — defaults to '' (same origin) */
    gridApiBase?: string;
}

/**
 * Full SIWE sign-in flow:
 *   1. GET nonce from Grid
 *   2. Build SIWE message
 *   3. Prompt wallet to sign
 *   4. POST verify to Grid → receives JWT cookie
 *   5. Return HumanUser
 *
 * @throws Error with message from Grid error field on 4xx responses.
 * @throws Error('sign_in_failed') on network/unexpected errors.
 */
export async function signInWithEthereum(params: SignInParams): Promise<HumanUser> {
    const base = params.gridApiBase ?? '';

    // Step 1 — fetch nonce.
    let nonce: string;
    try {
        const nonceRes = await fetch(`${base}/api/v1/portal/auth/nonce`);
        if (!nonceRes.ok) throw new Error('nonce_fetch_failed');
        const nonceData = await nonceRes.json() as { nonce: string };
        nonce = nonceData.nonce;
    } catch (err) {
        if (err instanceof Error && err.message !== 'nonce_fetch_failed') throw err;
        throw new Error('sign_in_failed');
    }

    // Step 2 — build SIWE message.
    const message = new SiweMessage({
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        address: params.address,
        statement: 'Sign in to Noēsis Portal',
        uri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        version: '1',
        chainId: params.chainId,
        nonce,
    });
    const preparedMessage = message.prepareMessage();

    // Step 3 — wallet sign.
    let signature: string;
    try {
        signature = await params.signMessage(preparedMessage);
    } catch {
        throw new Error('user_rejected_signature');
    }

    // Step 4 — POST verify.
    let verifyRes: Response;
    try {
        verifyRes = await fetch(`${base}/api/v1/portal/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // needed for httpOnly cookie
            body: JSON.stringify({ message: message.toMessage(), signature }),
        });
    } catch {
        throw new Error('sign_in_failed');
    }

    if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({ error: 'sign_in_failed' })) as { error: string };
        throw new Error(errData.error ?? 'sign_in_failed');
    }

    const userData = await verifyRes.json() as HumanUser;
    return { did: userData.did, eth_address: userData.eth_address };
}
