/**
 * Phase 37 — government-session unit tests.
 *
 * Verifies verifyGovernmentSession rejects operator-DIDs and non-government JWTs,
 * and accepts valid government session JWTs with court_conviction_ref.
 *
 * REG-04 invariant: operator-DID revocation is FORBIDDEN (court_order_required).
 */

import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import { verifyGovernmentSession, GOV_SESSION_ISSUER_DID } from '../../src/civic-registry/government-session.js';

async function mintJwt(claims: Record<string, unknown>): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .sign(privateKey);
}

describe('verifyGovernmentSession', () => {
    it('returns court_order_required when authHeader is undefined', async () => {
        const result = await verifyGovernmentSession(undefined);
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_order_required when authHeader is empty string', async () => {
        const result = await verifyGovernmentSession('');
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_order_required when authHeader does not start with Bearer', async () => {
        const result = await verifyGovernmentSession('Basic xyz');
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_order_required for garbage JWT after Bearer', async () => {
        const result = await verifyGovernmentSession('Bearer not.a.jwt');
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_order_required for valid JWT with operator-DID iss (REG-04 invariant)', async () => {
        const token = await mintJwt({
            iss: 'did:noesis:human:0xabc',
            court_conviction_ref: 'case-001',
        });
        const result = await verifyGovernmentSession(`Bearer ${token}`);
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_order_required for valid JWT with random non-gov iss', async () => {
        const token = await mintJwt({
            iss: 'did:some:other:issuer',
            court_conviction_ref: 'case-001',
        });
        const result = await verifyGovernmentSession(`Bearer ${token}`);
        expect(result).toEqual({ ok: false, reason: 'court_order_required' });
    });

    it('returns court_conviction_ref_required when iss is correct but court_conviction_ref is missing', async () => {
        const token = await mintJwt({
            iss: GOV_SESSION_ISSUER_DID,
        });
        const result = await verifyGovernmentSession(`Bearer ${token}`);
        expect(result).toEqual({ ok: false, reason: 'court_conviction_ref_required' });
    });

    it('returns court_conviction_ref_required when court_conviction_ref is empty string', async () => {
        const token = await mintJwt({
            iss: GOV_SESSION_ISSUER_DID,
            court_conviction_ref: '',
        });
        const result = await verifyGovernmentSession(`Bearer ${token}`);
        expect(result).toEqual({ ok: false, reason: 'court_conviction_ref_required' });
    });

    it('returns ok: true with courtConvictionRef when all conditions are met', async () => {
        const token = await mintJwt({
            iss: GOV_SESSION_ISSUER_DID,
            court_conviction_ref: 'case-001',
        });
        const result = await verifyGovernmentSession(`Bearer ${token}`);
        expect(result).toEqual({ ok: true, courtConvictionRef: 'case-001' });
    });
});
