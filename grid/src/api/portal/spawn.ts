/**
 * Portal spawn routes — human-initiated Nous creation.
 *
 * Phase 28 SPAWN-01..06.
 *
 * Routes:
 *   POST /api/v1/portal/nous/spawn         — confirm USDT payment, generate DID, spawn Nous
 *   GET  /api/v1/portal/nous/spawn/status/:txHash  — poll EVM RPC for tx confirmation
 *   GET  /api/v1/portal/nous/spawn/config  — expose SPAWN_COST_USDT + GRID_TREASURY_ADDRESS
 *   GET  /api/v1/portal/nous/spawn/check-name     — name uniqueness check
 *   GET  /api/v1/portal/human/me/nous      — return the authenticated human's owned Nous (or null)
 *
 * Security: all routes require valid JWT cookie (same guard as wallet.ts and chat.ts).
 * T-28-05: freeze gate added to check-frozen.ts covers POST /api/v1/portal/nous/spawn (Plan 01).
 */

import type { FastifyInstance } from 'fastify';
import { generateKeyPairSync } from 'node:crypto';
import { jwtVerify } from 'jose';
import type { ApiError } from '../types.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { appendNousSpawnedByHuman } from '../../audit/append-nous-spawned-by-human.js';
import type { AuditChain } from '../../audit/chain.js';

const SEED_ENUM = ['Explorer', 'Scholar', 'Merchant', 'Guardian'] as const;
type SeedType = typeof SEED_ENUM[number];
const NAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

/**
 * A personal Nous record returned by GET /api/v1/portal/human/me/nous.
 * The `personality_seed` field matches the nous_registry column name used by
 * the chat route's fallback prompt builder.
 */
export interface NousRecord {
    did: string;
    name: string;
    region: string;
    personality_seed: string;
    spawned_at_tick: number;
}

/**
 * Injectable dependencies for the spawn routes.
 * All data methods are required; audit/tick/gridName are optional and used only
 * in production wiring (absent in tests — no audit calls are made when omitted).
 */
export interface SpawnHumanNousDeps {
    /** Delegate to GenesisLauncher.spawnNous. */
    spawnNous(name: string, did: string, publicKey: string, region: string, humanOwner: string, personalitySeed: string): void;
    /** Returns true if the human already owns a Nous. */
    queryHasNous(humanDid: string): Promise<boolean>;
    /** Verifies the tx receipt on-chain. */
    confirmTxPaid(txHash: string): Promise<{ confirmed: boolean; amountUsdt?: string; from?: string }>;
    /** Records the payment row after successful spawn (idempotent). */
    recordPayment(txHash: string, humanDid: string, nousDid: string): Promise<void>;
    /** Returns true if a spawn_payments row already has a nous_did for this txHash (replay guard). */
    isPaymentClaimed(txHash: string): Promise<boolean>;
    /** Returns true if a Nous with this name already exists in nous_registry. */
    queryNameTaken(name: string): Promise<boolean>;
    /** Returns the human's owned Nous, or null if none. */
    getOwnedNous(humanDid: string): Promise<NousRecord | null>;
    /**
     * Optional: AuditChain used by appendNousSpawnedByHuman after a successful spawn.
     * When absent (e.g. in tests), the audit call is skipped.
     */
    audit?: AuditChain;
    /** Optional: returns the current grid tick (used with audit). */
    currentTick?: () => number;
    /** Optional: returns the grid name (used with audit). */
    gridName?: () => string;
}

interface SpawnBody {
    name: unknown;
    seed: unknown;
    region: unknown;
    tx_hash: unknown;
}

/** Extract and verify the human DID from the JWT cookie. Returns null and sends the error reply on failure. */
async function requireAuth(req: { cookies: Record<string, string | undefined> }, reply: { status: (code: number) => { send: (body: ApiError) => unknown } }): Promise<string | null> {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        reply.status(401).send({ error: 'not_authenticated' });
        return null;
    }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !did.startsWith('did:noesis:human:')) {
            reply.status(401).send({ error: 'invalid_token' });
            return null;
        }
        return did;
    } catch {
        reply.status(401).send({ error: 'invalid_token' });
        return null;
    }
}

/** Generate a base64-encoded SPKI public key for the spawned Nous (ed25519). */
function generatePublicKey(): string {
    const { publicKey } = generateKeyPairSync('ed25519');
    return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

/**
 * Derive the human-nous DID from the human DID and the chosen name.
 * Format: did:noesis:human-nous:<6-8 hex chars of ETH address>-<lowercased name>
 * Human DID format: did:noesis:human:0x<40 hex chars>
 */
function deriveDid(humanDid: string, name: string): string {
    // Extract the eth address portion (after 'did:noesis:human:')
    const ethAddr = humanDid.replace('did:noesis:human:', '').toLowerCase();
    // Use first 6 hex chars after '0x' prefix
    const addrPart = ethAddr.startsWith('0x') ? ethAddr.slice(2, 8) : ethAddr.slice(0, 6);
    return `did:noesis:human-nous:${addrPart}-${name.toLowerCase()}`;
}

/** Validate and parse the POST /spawn request body. Returns null on failure. */
function validateBody(body: SpawnBody): { name: string; seed: SeedType; region: string; tx_hash: string } | null {
    if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) return null;
    if (typeof body.seed !== 'string' || !(SEED_ENUM as readonly string[]).includes(body.seed)) return null;
    if (typeof body.region !== 'string' || body.region.length === 0 || body.region.length > 64) return null;
    if (typeof body.tx_hash !== 'string' || !TX_HASH_RE.test(body.tx_hash)) return null;
    return { name: body.name, seed: body.seed as SeedType, region: body.region, tx_hash: body.tx_hash };
}

export async function registerSpawnRoutes(app: FastifyInstance, deps: SpawnHumanNousDeps): Promise<void> {

    // POST /api/v1/portal/nous/spawn
    app.post('/api/v1/portal/nous/spawn', async (req, reply) => {
        // 1. Env gate — spawn feature must be explicitly enabled
        if (!process.env['ALLOW_HUMAN_SPAWNED_NOUS']) {
            return reply.status(503).send({ error: 'spawn_not_enabled' } satisfies ApiError);
        }

        // 2. Auth
        const humanDid = await requireAuth(
            req as unknown as { cookies: Record<string, string | undefined> },
            reply as unknown as { status: (code: number) => { send: (body: ApiError) => unknown } },
        );
        if (!humanDid) return;

        // 3. Body validation
        const parsed = validateBody((req.body as SpawnBody) ?? {} as SpawnBody);
        if (!parsed) {
            return reply.status(400).send({ error: 'invalid_body' } satisfies ApiError);
        }

        // 4. Payment replay guard — check before one-Nous cap to prevent replay attacks first
        if (await deps.isPaymentClaimed(parsed.tx_hash)) {
            return reply.status(409).send({ error: 'payment_already_claimed' } satisfies ApiError);
        }

        // 5. One-Nous cap (SPAWN-06)
        if (await deps.queryHasNous(humanDid)) {
            return reply.status(409).send({ error: 'already_owns_nous' } satisfies ApiError);
        }

        // 6. Name uniqueness
        if (await deps.queryNameTaken(parsed.name)) {
            return reply.status(409).send({ error: 'name_taken' } satisfies ApiError);
        }

        // 7. Payment confirmation (SPAWN-01) — verify independently via EVM RPC
        const confirm = await deps.confirmTxPaid(parsed.tx_hash);
        if (!confirm.confirmed) {
            return reply.status(400).send({ error: 'payment_not_confirmed' } satisfies ApiError);
        }

        // 8. Generate DID and public key
        const nousDid = deriveDid(humanDid, parsed.name);
        const publicKey = generatePublicKey();

        // 9. Spawn Nous
        try {
            deps.spawnNous(parsed.name, nousDid, publicKey, parsed.region, humanDid, parsed.seed);
        } catch (err) {
            req.log?.error({ err }, 'spawnNous failed');
            return reply.status(500).send({ error: 'spawn_failed' } satisfies ApiError);
        }

        // 10. Record payment (idempotency guard)
        await deps.recordPayment(parsed.tx_hash, humanDid, nousDid);

        // 11. Emit audit event (only when audit deps are wired — skipped in tests)
        if (deps.audit && deps.currentTick && deps.gridName) {
            appendNousSpawnedByHuman(deps.audit, {
                grid_name: deps.gridName(),
                nous_did: nousDid,
                owner_human_did: humanDid,
                tick: deps.currentTick(),
            });
        }

        return reply.status(200).send({ ok: true, nous_did: nousDid });
    });

    // GET /api/v1/portal/nous/spawn/status/:txHash
    // Polls EVM RPC for tx confirmation — no env gate (poll-able while ALLOW_HUMAN_SPAWNED_NOUS is unset)
    app.get<{ Params: { txHash: string } }>(
        '/api/v1/portal/nous/spawn/status/:txHash',
        async (req, reply) => {
            const humanDid = await requireAuth(
                req as unknown as { cookies: Record<string, string | undefined> },
                reply as unknown as { status: (code: number) => { send: (body: ApiError) => unknown } },
            );
            if (!humanDid) return;

            const { txHash } = req.params;
            if (!TX_HASH_RE.test(txHash)) {
                return reply.status(400).send({ error: 'invalid_body' } satisfies ApiError);
            }

            const res = await deps.confirmTxPaid(txHash);
            return reply.status(200).send({ confirmed: res.confirmed });
        },
    );

    // GET /api/v1/portal/nous/spawn/config
    app.get('/api/v1/portal/nous/spawn/config', async (req, reply) => {
        const humanDid = await requireAuth(
            req as unknown as { cookies: Record<string, string | undefined> },
            reply as unknown as { status: (code: number) => { send: (body: ApiError) => unknown } },
        );
        if (!humanDid) return;

        const cost_usdt = process.env['SPAWN_COST_USDT'] ?? '50';
        const treasury_address = process.env['GRID_TREASURY_ADDRESS'] ?? '';
        return reply.status(200).send({ cost_usdt, treasury_address });
    });

    // GET /api/v1/portal/nous/spawn/check-name?name=...
    app.get<{ Querystring: { name?: string } }>(
        '/api/v1/portal/nous/spawn/check-name',
        async (req, reply) => {
            const humanDid = await requireAuth(
                req as unknown as { cookies: Record<string, string | undefined> },
                reply as unknown as { status: (code: number) => { send: (body: ApiError) => unknown } },
            );
            if (!humanDid) return;

            const name = req.query.name;
            if (typeof name !== 'string' || !NAME_RE.test(name)) {
                return reply.status(400).send({ error: 'invalid_body' } satisfies ApiError);
            }

            const taken = await deps.queryNameTaken(name);
            return reply.status(200).send({ available: !taken });
        },
    );

    // GET /api/v1/portal/human/me/nous (SPAWN-05)
    app.get('/api/v1/portal/human/me/nous', async (req, reply) => {
        const humanDid = await requireAuth(
            req as unknown as { cookies: Record<string, string | undefined> },
            reply as unknown as { status: (code: number) => { send: (body: ApiError) => unknown } },
        );
        if (!humanDid) return;

        const nous = await deps.getOwnedNous(humanDid);
        return reply.status(200).send({ nous });
    });
}
