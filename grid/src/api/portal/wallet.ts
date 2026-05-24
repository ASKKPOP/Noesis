/**
 * Portal wallet routes — Cyber Coin transfer notification.
 *
 * Phase 23 gap / Phase 24 fix.
 *
 * Routes:
 *   POST /api/v1/portal/wallet/transfer — record best-effort human.transferred event
 *
 * Called by dashboard WalletPanel.notifyGrid() after an on-chain send confirms.
 * The raw recipient address and amount are intentionally NOT persisted —
 * only {asset, grid_name, human_did, tick} enter the audit chain.
 */

import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { appendHumanTransferred } from '../../audit/append-human-transferred.js';

const ALLOWED_ASSETS = new Set<string>(['ETH', 'USDT']);

export function registerPortalWalletRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // POST /api/v1/portal/wallet/transfer
    app.post('/api/v1/portal/wallet/transfer', async (req, reply) => {
        // 1. Verify JWT cookie — identify the caller.
        const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
        if (!token) {
            return reply.status(401).send({ error: 'not_authenticated' });
        }

        let humanDid: string;
        try {
            const { publicKey } = await keyPairPromise;
            const { payload } = await jwtVerify(token, publicKey);
            humanDid = payload['did'] as string;
            if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
                return reply.status(401).send({ error: 'invalid_token' });
            }
        } catch {
            return reply.status(401).send({ error: 'invalid_token' });
        }

        // 2. Validate body — only asset is used; to/amount are accepted but not stored.
        const body = req.body as Record<string, unknown> | undefined;
        const asset = typeof body?.asset === 'string' ? body.asset.toUpperCase() : '';
        if (!ALLOWED_ASSETS.has(asset)) {
            return reply.status(400).send({ error: 'invalid_asset', accepted: ['ETH', 'USDT'] });
        }

        // 3. Emit human.transferred — best-effort (errors do not fail the on-chain transfer).
        try {
            appendHumanTransferred(services.audit, {
                asset,
                grid_name: services.gridName,
                human_did: humanDid,
                tick: services.clock.state.tick,
            });
        } catch (err) {
            // Log but do not propagate — the on-chain transfer already happened.
            app.log.warn({ err }, 'appendHumanTransferred failed');
        }

        return reply.send({ ok: true });
    });
}
