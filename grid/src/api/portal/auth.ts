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

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SiweMessage } from 'siwe';
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { HumanRecord } from '../../human/types.js';
import { appendHumanJoined } from '../../audit/append-human-joined.js';
import { appendHumanIdentified } from '../../audit/append-human-identified.js';
import { appendPortalAuthLogin } from '../../audit/append-portal-auth-login.js';
import { appendPortalAuthRegister } from '../../audit/append-portal-auth-register.js';
import { registerOAuthStubRoutes } from './oauth-stub.js';

const scryptAsync = promisify(scrypt);

/** Hash a plaintext password → `salt:hash` (hex). */
async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
}

/** Verify a plaintext password against a stored `salt:hash` string. */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hashHex] = stored.split(':');
    if (!salt || !hashHex) return false;
    const storedHash = Buffer.from(hashHex, 'hex');
    const candidate = (await scryptAsync(password, salt, 64)) as Buffer;
    return storedHash.length === candidate.length && timingSafeEqual(storedHash, candidate);
}

/**
 * Persist a newly-created human to the human_users table so the in-memory
 * registry survives a grid restart and onboarding (which reads/writes this
 * table on /me) can actually complete. Best-effort: a failure is logged but
 * never blocks sign-up (the in-memory registry still serves this session).
 * No-op when the pool is absent (in-memory test mode). Runs at most once per
 * human — HumanRegistry.createHuman guards against in-memory duplicates and the
 * registry is rehydrated from this table at boot.
 */
async function persistHuman(
    pool: GridServices['humanPool'],
    human: HumanRecord,
    passwordHash: string | null,
): Promise<void> {
    if (!pool) return;
    try {
        await pool.query(
            `INSERT INTO human_users (grid_name, did, eth_address, email, password_hash, region, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [human.grid_name, human.did, human.eth_address, human.email, passwordHash, human.region, human.created_at],
        );
    } catch (err) {
        console.error('[auth] failed to persist human to human_users (continuing in-memory)', err);
    }
}

export const COOKIE_NAME = 'noesis_portal_token';

/**
 * QA fix: the portal session cookie's `secure` flag used to be
 * `process.env.NODE_ENV === 'production'`. docker/Dockerfile.grid hardcodes
 * `ENV NODE_ENV=production` unconditionally (for the Node runtime build, not
 * as a signal about TLS) — so the LOCAL docker-compose stack, served over
 * plain HTTP, was also issuing Secure cookies. Browsers and HTTP clients
 * never send a Secure cookie back over a non-HTTPS connection, so every
 * portal_session_required route (portal/account/endow, and anything else
 * gated on a logged-in operator) was silently unusable in local dev — a
 * fresh email signup looked successful but the resulting session could
 * never actually authenticate a follow-up request.
 * Default true (matches prior always-secure behavior everywhere this env
 * var is unset, including AWS production); local docker-compose.yml sets
 * GRID_COOKIE_SECURE=false so local HTTP dev can actually use the cookie.
 */
const COOKIE_SECURE = process.env['GRID_COOKIE_SECURE'] !== 'false';

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
            await persistHuman(services.humanPool, human, null);

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

            // Phase 33 OBS-08b / D-33-A4 — universal identity-stamp event.
            // identity_hash reuses eth_address_hash (byte-identical SHA-256 of lowercased
            // ETH address) so /users can correlate Phase 22 human.joined entries with
            // Phase 33+ human.identified entries for the same SIWE human.
            appendHumanIdentified(services.audit, {
                grid_name: gridName,
                human_did: human.did,
                identity_hash: eth_address_hash,
                identity_method: 'siwe',
                tick: services.clock.state.tick,
            });

            // Phase 33 OBS-09 / D-33-A4 — portal-layer register event (fires only on first connect).
            appendPortalAuthRegister(services.audit, {
                human_did: human.did,
                method: 'siwe',
                tick: services.clock.state.tick,
            });
        }

        // Phase 33 OBS-08 / D-33-A4 — portal-layer login event. ALWAYS fires on every
        // SIWE verify success, regardless of isNew. Subsequent SIWE connects emit only
        // this event (no register, no identified) because the human row already exists.
        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'siwe',
            tick: services.clock.state.tick,
        });

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
            secure: COOKIE_SECURE,
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

    // POST /api/v1/portal/auth/email/signup
    app.post<{
        Body: { email: unknown; password: unknown };
    }>('/api/v1/portal/auth/email/signup', async (req, reply) => {
        if (!services.humanRegistry) {
            return reply.status(503).send({ error: 'human_registry_unavailable' });
        }

        const { email, password } = req.body ?? ({} as { email: unknown; password: unknown });
        if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8) {
            return reply.status(400).send({ error: 'invalid_request' });
        }

        const gridName = services.gridName;
        if (services.humanRegistry.findByEmail(gridName, email)) {
            return reply.status(409).send({ error: 'email_already_registered' });
        }

        const password_hash = await hashPassword(password);
        const human = services.humanRegistry.createHuman({
            email,
            password_hash,
            grid_name: gridName,
        });
        await persistHuman(services.humanPool, human, password_hash);

        // Phase 33 OBS-08b / D-33-A5 — universal identity event for email humans.
        // identity_hash = sha256(email.toLowerCase().trim()) — a new privacy-preserved
        // identifier with no Phase 22 analog (email humans have no eth_address). Email
        // path does NOT emit human.joined (Phase 22's SIWE-only contract preserved per D-33-A7).
        const email_hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

        appendHumanIdentified(services.audit, {
            grid_name: gridName,
            human_did: human.did,
            identity_hash: email_hash,
            identity_method: 'email',
            tick: services.clock.state.tick,
        });

        appendPortalAuthRegister(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });

        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });

        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({
            did: human.did,
            eth_address: human.eth_address,
            grid_name: gridName,
            region: human.region,
            created_at: human.created_at.toISOString(),
        })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(privateKey);

        reply.setCookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: COOKIE_SECURE,
            path: '/',
            maxAge: 24 * 60 * 60,
        });

        return reply.status(201).send({
            did: human.did,
            eth_address: human.eth_address,
            region: human.region,
            created_at: human.created_at.toISOString(),
            is_new: true,
        });
    });

    // POST /api/v1/portal/auth/email/signin
    app.post<{
        Body: { email: unknown; password: unknown };
    }>('/api/v1/portal/auth/email/signin', async (req, reply) => {
        if (!services.humanRegistry) {
            return reply.status(503).send({ error: 'human_registry_unavailable' });
        }

        const { email, password } = req.body ?? ({} as { email: unknown; password: unknown });
        if (typeof email !== 'string' || typeof password !== 'string') {
            return reply.status(400).send({ error: 'invalid_request' });
        }

        const gridName = services.gridName;
        const human = services.humanRegistry.findByEmail(gridName, email);
        if (!human) {
            return reply.status(401).send({ error: 'invalid_credentials' });
        }

        const storedHash = services.humanRegistry.getPasswordHash(gridName, email);
        if (!storedHash) {
            return reply.status(401).send({ error: 'invalid_credentials' });
        }

        const valid = await verifyPassword(password, storedHash);
        if (!valid) {
            return reply.status(401).send({ error: 'invalid_credentials' });
        }

        // Phase 33 OBS-08 / D-33-A6 — portal-layer login event for email signin.
        // Email signin emits ONLY this event (no register, no identified) — the human
        // row already exists and identity was stamped at signup time. Mirrors the
        // SIWE repeat-connect path: 1 entry per successful authentication.
        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });

        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({
            did: human.did,
            eth_address: human.eth_address,
            grid_name: gridName,
            region: human.region,
            created_at: human.created_at.toISOString(),
        })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(privateKey);

        reply.setCookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'strict',
            secure: COOKIE_SECURE,
            path: '/',
            maxAge: 24 * 60 * 60,
        });

        return reply.send({
            did: human.did,
            eth_address: human.eth_address,
            region: human.region,
            created_at: human.created_at.toISOString(),
            is_new: false,
        });
    });

    // Phase 36 / D-36-21 — OAuth stubs (501 Not Implemented; full PKCE in Phase 52-54).
    registerOAuthStubRoutes(app);

    // GET /api/v1/portal/auth/me
    app.get('/api/v1/portal/auth/me', async (req, reply) => {
        const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
        if (!token) {
            return reply.status(401).send({ error: 'not_authenticated' });
        }
        try {
            const { publicKey } = await keyPairPromise;
            const { payload } = await jwtVerify(token, publicKey);

            // Phase 26 ONBOARD-04: query onboarding_goal to derive onboarded boolean.
            // Fail-safe: DB unavailability returns onboarded: false rather than 503.
            let onboarded = false;
            try {
                const pool = services.humanPool;
                if (pool) {
                    const [rows] = await pool.query(
                        'SELECT onboarding_goal FROM human_users WHERE did = ? LIMIT 1',
                        [payload['did'] as string],
                    ) as [Array<{ onboarding_goal: string | null }>, unknown];
                    onboarded = rows.length > 0
                        && rows[0]?.onboarding_goal !== null
                        && rows[0]?.onboarding_goal !== undefined;
                }
            } catch (err) {
                // DB query failed — fail-safe: treat as not onboarded.
                // User will re-enter onboarding rather than silently skip it.
                console.warn('[/me] onboarding_goal query failed, defaulting to onboarded=false', err);
            }

            // Human Civic-DID (2026-06-10) — civic_member signal for the dashboard
            // (D-36-16 third tier). Fail-safe: lookup failure reports null (visitor).
            let civicDid: string | null = null;
            try {
                const civicStore = services.civicDidStore;
                if (civicStore) {
                    const civic = await civicStore.getByExistenceDid(
                        services.gridName,
                        payload['did'] as string,
                    );
                    if (civic && civic.status === 'active') civicDid = civic.civicDid;
                }
            } catch (err) {
                console.warn('[/me] civic_did lookup failed, defaulting to null', err);
            }

            return reply.send({
                did: payload['did'],
                eth_address: payload['eth_address'],
                region: (payload['region'] as string | undefined) ?? null,           // null for pre-migration tokens (WR-04)
                created_at: (payload['created_at'] as string | undefined) ?? null,  // NEW — per D-07
                onboarded,
                civic_did: civicDid,                                                 // active human Civic-DID or null
            });
        } catch {
            return reply.status(401).send({ error: 'invalid_token' });
        }
    });

    // PATCH /api/v1/portal/auth/me — Phase 26 ONBOARD-04: store onboarding_goal
    app.patch<{
        Body: { onboarding_goal?: unknown };
    }>('/api/v1/portal/auth/me', async (req, reply) => {
        // Auth guard (same pattern as GET /me)
        const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
        if (!token) return reply.status(401).send({ error: 'not_authenticated' });
        let did: unknown;
        try {
            const { publicKey } = await keyPairPromise;
            const { payload } = await jwtVerify(token, publicKey);
            did = payload['did'];
        } catch {
            return reply.status(401).send({ error: 'invalid_token' });
        }
        // Validate body
        const { onboarding_goal } = req.body ?? {};
        if (typeof onboarding_goal !== 'string' || onboarding_goal.trim().length === 0) {
            return reply.status(400).send({ error: 'invalid_request' });
        }
        const truncated = onboarding_goal.trim().slice(0, 2000);
        try {
            const pool = services.humanPool;
            if (pool) {
                await pool.query(
                    'UPDATE human_users SET onboarding_goal = ? WHERE did = ?',
                    [truncated, did as string],
                );
            }
        } catch (err) {
            console.error('[PATCH /me] failed to store onboarding_goal', err);
            return reply.status(500).send({ error: 'storage_failed' });
        }
        return reply.send({ ok: true });
    });
}
