/**
 * Portal auth routes — SIWE authentication, JWT issuance.
 *
 * Phase 22 WEB3-01 through WEB3-06.
 *
 * Routes:
 *   GET  /api/v1/portal/auth/nonce   — fresh nonce (5-min TTL)
 *   POST /api/v1/portal/auth/verify  — SIWE verify → JWT cookie
 *   POST /api/v1/portal/auth/logout  — clear JWT cookie
 *   GET  /api/v1/portal/auth/me      — current user from JWT
 *
 * NOTE: server.ts must register @fastify/cookie before these routes are called.
 * This is handled in buildServerWithHub via: import fastifyCookie from '@fastify/cookie';
 *   await app.register(fastifyCookie);
 */

import { createHash, randomUUID } from 'node:crypto';
import { SiweMessage } from 'siwe';
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { appendHumanJoined } from '../../audit/append-human-joined.js';

export const COOKIE_NAME = 'noesis_portal_token';
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** In-memory nonce store. Key = nonce string, Value = created timestamp (ms). */
const nonceMap = new Map<string, number>();

/** ES256 key pair — generated once at module load (WEB3-03). Exported for wallet route JWT verification. */
export const keyPairPromise = generateKeyPair('ES256');

export function registerPortalAuthRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // GET /api/v1/portal/auth/nonce
    app.get('/api/v1/portal/auth/nonce', async (_req, reply) => {
        const nonce = randomUUID();
        // Prune expired entries before adding a new one (CR-01: prevent unbounded growth).
        const now = Date.now();
        for (const [k, ts] of nonceMap) {
            if (now - ts > NONCE_TTL_MS) nonceMap.delete(k);
        }
        nonceMap.set(nonce, now);
        return reply.send({ nonce });
    });

    // POST /api/v1/portal/auth/verify
    app.post<{
        Body: { message: unknown; signature: unknown };
    }>('/api/v1/portal/auth/verify', async (req, reply) => {
        if (!services.humanRegistry) {
            return reply.status(503).send({ error: 'human_registry_unavailable' });
        }

        const body = req.body ?? ({} as { message: unknown; signature: unknown });
        const { message, signature } = body;
        if (typeof message !== 'object' || message === null || typeof signature !== 'string') {
            return reply.status(400).send({ error: 'invalid_request' });
        }

        let siweMessage: SiweMessage;
        try {
            siweMessage = new SiweMessage(message as Record<string, unknown>);
        } catch {
            return reply.status(400).send({ error: 'invalid_siwe_message' });
        }

        const nonce = siweMessage.nonce;
        const nonceCreatedAt = nonceMap.get(nonce);
        if (nonceCreatedAt === undefined) {
            return reply.status(401).send({ error: 'nonce_unknown' });
        }
        if (Date.now() - nonceCreatedAt > NONCE_TTL_MS) {
            nonceMap.delete(nonce);
            return reply.status(401).send({ error: 'nonce_expired' });
        }
        nonceMap.delete(nonce); // consume nonce — prevents replay (T-22-02-02)

        let verifyResult: Awaited<ReturnType<typeof siweMessage.verify>>;
        try {
            verifyResult = await siweMessage.verify({ signature, nonce });
        } catch {
            return reply.status(401).send({ error: 'invalid_signature' });
        }
        if (!verifyResult.success) {
            return reply.status(401).send({ error: 'invalid_signature' });
        }

        const ethAddress = siweMessage.address; // checksummed from SIWE
        const gridName = services.gridName;
        const humanRegistry = services.humanRegistry;

        // Find or create human record (WEB3-06: human.joined fires on first connect only).
        let human = humanRegistry.findByAddress(gridName, ethAddress);
        const isNew = human === undefined;
        if (!human) {
            human = humanRegistry.createHuman({ eth_address: ethAddress, grid_name: gridName });

            // WEB3-04: SHA-256 hash of lowercased ETH address — raw address never in audit chain.
            const eth_address_hash = createHash('sha256')
                .update(ethAddress.toLowerCase())
                .digest('hex');

            appendHumanJoined(services.audit, {
                human_did: human.did,
                eth_address_hash,
                grid_name: gridName,
                tick: services.clock.state.tick,
            });
        }

        // Issue JWT (ES256, 24h, WEB3-03).
        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({
            did: human.did,
            eth_address: human.eth_address,
            grid_name: gridName,
            region: human.region,                        // NEW — per D-03/D-07
            created_at: human.created_at.toISOString(), // NEW — per D-07
        })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(privateKey);

        reply.setCookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env['NODE_ENV'] === 'production',
            path: '/',
            maxAge: 24 * 60 * 60, // seconds
        });

        return reply.send({
            did: human.did,
            eth_address: human.eth_address,
            region: human.region,
            created_at: human.created_at.toISOString(),
            is_new: isNew,
        });
    });

    // POST /api/v1/portal/auth/logout
    app.post('/api/v1/portal/auth/logout', async (_req, reply) => {
        reply.clearCookie(COOKIE_NAME, { path: '/' });
        return reply.send({ ok: true });
    });

    // GET /api/v1/portal/auth/me
    app.get('/api/v1/portal/auth/me', async (req, reply) => {
        const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
        if (!token) {
            return reply.status(401).send({ error: 'not_authenticated' });
        }
        try {
            const { publicKey } = await keyPairPromise;
            const { payload } = await jwtVerify(token, publicKey);
            return reply.send({
                did: payload['did'],
                eth_address: payload['eth_address'],
                region: (payload['region'] as string | undefined) ?? 'agora',       // NEW — per D-07
                created_at: (payload['created_at'] as string | undefined) ?? null,  // NEW — per D-07
            });
        } catch {
            return reply.status(401).send({ error: 'invalid_token' });
        }
    });
}
