/**
 * Phase 38 WIRE-02 — tryDid EdDSA Brain JWT branch
 *
 * Tests the new first-pass resolution path in tryDid that accepts
 * Brain-signed EdDSA JWTs with iss=did:noesis:nous:* and verifies
 * them against the brainTokenStore's stored public JWK.
 *
 * 6 test cases:
 *   1. EdDSA JWT with valid brain_tokens row → civic_member tier + operatorDid = iss
 *   2. EdDSA JWT but brain_tokens row revoked → null
 *   3. EdDSA JWT but no brain_tokens row → null (fall-through returns null anonymous)
 *   4. EdDSA JWT whose iss does NOT match did:noesis:nous: → falls through to ES256 path (then null)
 *   5. ES256 Civic-DID JWT path still works unchanged
 *   6. Tampered EdDSA signature → null (falls through, no matching ES256 row)
 */

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { tryDid } from '../../src/api/preHandlers/tryDid.js';
import type { TryDidServices } from '../../src/api/preHandlers/tryDid.js';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';
import { keyPairPromise } from '../../src/api/portal/auth.js';
import type { FastifyRequest } from 'fastify';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): FastifyRequest {
    return {
        headers,
        cookies,
    } as unknown as FastifyRequest;
}

/** Build a minimal BrainTokenStore stub with one record. */
function makeBrainStore(rec: BrainTokenRecord | null, revokedDids: string[] = []) {
    return {
        async getByDid(brainDid: string) {
            if (rec && rec.brainDid === brainDid) return rec;
            return null;
        },
        async isRevoked(brainDid: string) {
            return revokedDids.includes(brainDid);
        },
    } as unknown as import('../../src/db/stores/brain-token-store.js').BrainTokenStore;
}

const GRID = 'genesis';

/**
 * SECURITY (D-SEC-06): civic registry stub. `getByExistenceDid(iss)` returns the
 * ACTIVE civic-DID bound to that existence-DID — the authoritative binding tryDid
 * enforces `sub` against. `bindings` maps existence-DID → { civicDid, status }.
 */
function makeCivicStore(bindings: Record<string, { civicDid: string; status?: string }>) {
    return {
        async getByExistenceDid(_gridName: string, existenceDid: string) {
            const b = bindings[existenceDid];
            if (!b) return null;
            return {
                gridName: GRID,
                civicDid: b.civicDid,
                existenceDid,
                credentialJson: {},
                status: b.status ?? 'active',
                issuedAtTick: 1,
            };
        },
    } as unknown as import('../../src/civic-registry/civic-did-store.js').CivicDidStore;
}

/** The common wired-registry services: brain token + matching civic binding. */
function boundServices(rec: BrainTokenRecord, revokedDids: string[] = []): TryDidServices {
    return {
        brainTokenStore: makeBrainStore(rec, revokedDids),
        civicDidStore: makeCivicStore({ [NOUS_DID]: { civicDid: CIVIC_DID } }),
        gridName: GRID,
    };
}

/** Generate an Ed25519 JWK keypair and sign a Brain bearer JWT. */
async function makeBrainJwt(opts: {
    iss: string;
    sub: string;
    privateKeyOverride?: CryptoKey;
    expiresIn?: string;
}): Promise<{ jwt: string; publicKeyJwk: Record<string, unknown> }> {
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const actualPriv = opts.privateKeyOverride ?? privateKey;
    const jwk = await exportJWK(publicKey);
    const publicKeyJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: 'EdDSA' } as Record<string, unknown>;

    const jwt = await new SignJWT({ sub: opts.sub })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuer(opts.iss)
        .setIssuedAt()
        .setExpirationTime(opts.expiresIn ?? '1h')
        .sign(actualPriv);

    return { jwt, publicKeyJwk };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const NOUS_DID = 'did:noesis:nous:brain-001';
const CIVIC_DID = 'did:civic:noesis:member-001';

describe('tryDid — EdDSA Brain JWT branch', () => {
    it('valid EdDSA JWT with matching brain_tokens row → civic_member tier + operatorDid', async () => {
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });

        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };

        // D-SEC-06: registry binds NOUS_DID → CIVIC_DID, and the JWT's sub IS CIVIC_DID.
        const services = boundServices(rec);

        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);

        expect(result).not.toBeNull();
        expect(result?.tier).toBe('civic_member');
        expect(result?.did).toBe(CIVIC_DID);
        expect(result?.operatorDid).toBe(NOUS_DID);
    });

    // ── SECURITY (D-SEC-06) — subject/issuer binding ──────────────────────────
    it('SECURITY: valid Brain signature but sub ≠ the civic-DID bound to iss → null (impersonation blocked)', async () => {
        // Attacker holds a real Brain token for NOUS_DID (their own key), but signs a JWT
        // asserting a DIFFERENT victim civic-DID as sub. Pre-fix this returned the victim.
        const victimCivicDid = 'did:civic:noesis:victim-999';
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: victimCivicDid });

        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };
        // Registry binds NOUS_DID → CIVIC_DID (NOT the victim).
        const services = boundServices(rec);

        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('SECURITY: valid Brain signature but iss has NO active civic-DID in the registry → null', async () => {
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });
        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID, publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400, revoked: false,
        };
        // Registry has NO binding for NOUS_DID.
        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(rec),
            civicDidStore: makeCivicStore({}),
            gridName: GRID,
        };
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('binding is enforced-when-present: with NO civic registry wired (legacy harness) the Brain JWT still resolves', async () => {
        // D-SEC-06 is conditional: the registry is ALWAYS wired with brainTokenStore in
        // production (main.ts), so the binding is always enforced on a real Grid. Legacy
        // unit harnesses that wire a Brain store WITHOUT a registry keep the prior behavior.
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });
        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID, publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400, revoked: false,
        };
        const services: TryDidServices = { brainTokenStore: makeBrainStore(rec) };
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result?.tier).toBe('civic_member');
        expect(result?.did).toBe(CIVIC_DID);
    });

    it('SECURITY: bound civic-DID is revoked (status ≠ active) → null', async () => {
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });
        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID, publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400, revoked: false,
        };
        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(rec),
            civicDidStore: makeCivicStore({ [NOUS_DID]: { civicDid: CIVIC_DID, status: 'revoked' } }),
            gridName: GRID,
        };
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('EdDSA JWT but brain_tokens row is revoked → null', async () => {
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });

        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: true,
        };

        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(rec, [NOUS_DID]),
        };

        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('EdDSA JWT but no brain_tokens row → null', async () => {
        const { jwt } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });

        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(null),
        };

        // No record → brainTokenStore returns null → falls through
        // Falls through to ES256 path (no portal key match) → null
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('EdDSA JWT with iss not matching did:noesis:nous: pattern → falls through to null', async () => {
        // Use a civic DID as the issuer — does NOT match NOUS_DID_RE
        const { jwt } = await makeBrainJwt({ iss: 'did:civic:noesis:not-a-brain', sub: CIVIC_DID });

        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(null),
        };

        // iss doesn't match NOUS_DID_RE → EdDSA branch never entered
        // Falls through to ES256 path → alg=EdDSA, won't match ES256 → null
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }), services);
        expect(result).toBeNull();
    });

    it('Tampered EdDSA signature → null', async () => {
        const { jwt, publicKeyJwk } = await makeBrainJwt({ iss: NOUS_DID, sub: CIVIC_DID });

        // Tamper: replace the last 4 chars of the signature (third JWT segment)
        const parts = jwt.split('.');
        const sig = parts[2];
        const tampered = sig.slice(0, -4) + (sig.endsWith('AAAA') ? 'BBBB' : 'AAAA');
        const tamperedJwt = `${parts[0]}.${parts[1]}.${tampered}`;

        const rec: BrainTokenRecord = {
            brainDid: NOUS_DID,
            publicKeyJwk,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        };

        const services: TryDidServices = {
            brainTokenStore: makeBrainStore(rec),
        };

        // jwtVerify throws on bad sig → caught → falls through to ES256 path → null
        const result = await tryDid(makeReq({ authorization: `Bearer ${tamperedJwt}` }), services);
        expect(result).toBeNull();
    });

    it('ES256 Civic-DID JWT path still works unchanged', async () => {
        // Mint an ES256 JWT with the portal signing key
        const { privateKey, publicKey } = await keyPairPromise;

        const jwt = await new SignJWT({ sub: CIVIC_DID })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        // No brainTokenStore needed — goes straight to ES256 path
        const result = await tryDid(makeReq({ authorization: `Bearer ${jwt}` }));

        expect(result).not.toBeNull();
        expect(result?.tier).toBe('civic_member');
        expect(result?.did).toBe(CIVIC_DID);
        expect(result?.operatorDid).toBeUndefined();
    });
});
