/**
 * Phase 38 WIRE-02 — Brain bearer-token registration + revocation routes.
 *
 * Two endpoints:
 *   POST /api/v1/brain/token/register  — PUBLIC (existence-key signature gate in handler)
 *   POST /api/v1/brain/token/revoke    — government_only (onRequest hook enforces policy)
 *
 * Registration mirrors the Phase 37 REG-01 pattern: the request body carries an
 * Ed25519 signature over the canonical message so the route can be public while
 * still being cryptographically authenticated.
 *
 * Canonical message for the signature (UTF-8 of JSON.stringify with fixed key order):
 *   JSON.stringify({ brain_did, civic_did, public_key_jwk, issued_at, expires_at })
 *
 * Verification uses Node.js built-in crypto (KeyObject from JWK, verify(null, ...))
 * so no extra npm packages are needed.
 */

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { BrainTokenStore } from '../../db/stores/brain-token-store.js';

// DID regexes — kept inline so callers can read the intent directly.
const BRAIN_DID_RE = /^did:noesis:nous:[a-z0-9_\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

function currentTick(services: GridServices): number {
    return services.clock?.state?.tick ?? 0;
}

/**
 * Verify that `signatureB64url` is the Ed25519 signature of `message`
 * produced by the private key whose public component is the Ed25519 JWK
 * `{ kty:"OKP", crv:"Ed25519", x:"<b64url>" }`.
 *
 * Uses Node.js built-in crypto.verify (available from Node 15+, well-tested on 18+).
 * Returns false on any error (invalid JWK, wrong key type, bad signature).
 */
function verifyEd25519Sig(
    publicKeyJwk: Record<string, unknown>,
    message: Buffer,
    signatureB64url: string,
): boolean {
    try {
        if (
            publicKeyJwk['kty'] !== 'OKP' ||
            publicKeyJwk['crv'] !== 'Ed25519' ||
            typeof publicKeyJwk['x'] !== 'string'
        ) {
            return false;
        }

        // createPublicKey accepts { key: jwk, format: 'jwk' } directly (Node 15+)
        // Use 'unknown as ...' to satisfy the TypeScript overload for JsonWebKeyInput
        const jwkInput = {
            key: {
                kty: publicKeyJwk['kty'] as string,
                crv: publicKeyJwk['crv'] as string,
                x: publicKeyJwk['x'] as string,
            },
            format: 'jwk' as const,
        };
        const keyObject = createPublicKey(jwkInput as unknown as import('node:crypto').JsonWebKeyInput);

        const sigBuf = Buffer.from(signatureB64url, 'base64url');
        // crypto.verify(algo, data, key, signature) — null algo → uses key type algorithm
        return cryptoVerify(null, message, keyObject, sigBuf);
    } catch {
        return false;
    }
}

export async function registerBrainTokenRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    // ── POST /api/v1/brain/token/register ────────────────────────────────────
    // PUBLIC — ROUTE_DID_POLICY entry is 'public'; signature verification is
    // inside the handler via the existence-key signed request body.
    app.post<{ Body: Record<string, unknown> }>(
        '/api/v1/brain/token/register',
        async (req, reply) => {
            const store = services.brainTokenStore;
            if (!store) return reply.code(503).send({ error: 'brain_token_store_unavailable' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const brain_did = body['brain_did'];
            const civic_did = body['civic_did'];
            const public_key_jwk = body['public_key_jwk'];
            const issued_at = body['issued_at'];
            const expires_at = body['expires_at'];
            const signature = body['signature'];

            // Shape validation — all fields must be present and well-typed
            if (typeof brain_did !== 'string' || !BRAIN_DID_RE.test(brain_did)) {
                return reply.code(400).send({ error: 'invalid_request' });
            }
            if (typeof civic_did !== 'string' || !CIVIC_DID_RE.test(civic_did)) {
                return reply.code(400).send({ error: 'invalid_request' });
            }
            if (typeof public_key_jwk !== 'object' || public_key_jwk === null) {
                return reply.code(400).send({ error: 'invalid_request' });
            }
            if (typeof issued_at !== 'number') {
                return reply.code(400).send({ error: 'invalid_request' });
            }
            if (typeof expires_at !== 'number') {
                return reply.code(400).send({ error: 'invalid_request' });
            }
            if (typeof signature !== 'string' || signature.length === 0) {
                return reply.code(400).send({ error: 'invalid_request' });
            }

            const jwk = public_key_jwk as Record<string, unknown>;

            // Verify civic_did is active in the registry (when store is wired)
            const civicStore = services.civicDidStore;
            if (civicStore) {
                const civicRecord = await civicStore.get(services.gridName, civic_did);
                if (!civicRecord || civicRecord.status !== 'active') {
                    return reply.code(403).send({ error: 'civic_did_not_active' });
                }
            }

            // Verify Ed25519 signature over the canonical message.
            // Canonical message: JSON.stringify with keys in exact order:
            //   { brain_did, civic_did, public_key_jwk, issued_at, expires_at }
            const canonicalMessage = Buffer.from(
                JSON.stringify({ brain_did, civic_did, public_key_jwk, issued_at, expires_at }),
                'utf8',
            );

            const sigValid = verifyEd25519Sig(jwk, canonicalMessage, signature);
            if (!sigValid) {
                return reply.code(401).send({ error: 'invalid_signature' });
            }

            // Upsert — rotation path; clears any prior revocation on new key registration
            // operatorDid is NOT set here per D-39-01: ownership is claimed separately via
            // POST /api/v1/operator/me/brains (two-step Portal-gated claim model).
            await store.upsert({
                brainDid: brain_did,
                publicKeyJwk: jwk,
                issuedAt: issued_at,
                expiresAt: expires_at,
                revoked: false,
                operatorDid: null,
            });

            // Structured log (no audit event — Phase 38 allowlist delta is 0)
            req.log.info({ event: 'brain_token.registered', brain_did, civic_did });

            return reply.code(200).send({ ok: true, brain_did, expires_at });
        },
    );

    // ── POST /api/v1/brain/token/revoke ──────────────────────────────────────
    // government_only — the onRequest hook (policy.ts) enforces this policy and
    // sets req.didContext.tier='government' before the handler runs.
    app.post<{ Body: Record<string, unknown> }>(
        '/api/v1/brain/token/revoke',
        async (req, reply) => {
            const store = services.brainTokenStore;
            if (!store) return reply.code(503).send({ error: 'brain_token_store_unavailable' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const brain_did = body['brain_did'];

            if (typeof brain_did !== 'string' || !BRAIN_DID_RE.test(brain_did)) {
                return reply.code(400).send({ error: 'invalid_request' });
            }

            const tick = currentTick(services);
            const updated = await store.revoke(brain_did, tick);
            if (!updated) {
                return reply.code(404).send({ error: 'unknown_brain_did' });
            }

            req.log.info({ event: 'brain_token.revoked', brain_did, tick });

            return reply.code(200).send({ ok: true, brain_did, revoked: true });
        },
    );
}

// Re-export BrainTokenStore for server.ts convenience
export type { BrainTokenStore };
