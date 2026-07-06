/**
 * Portal routes barrel — wires all /api/v1/portal/* handlers.
 *
 * Phase 22 WEB3-01 to WEB3-06.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { registerPortalAuthRoutes } from './auth.js';
import { registerPortalWalletRoutes } from './wallet.js';
import { registerFrozenCheck } from './check-frozen.js';
import { registerPortalChatRoutes } from './chat.js';
import { registerPortalNousRoutes } from './nous.js';
import { registerSpawnRoutes } from './spawn.js';
import { registerCommunityRoutes } from './community.js';
import { registerSupportRoutes } from './support.js';
import { registerPortalCivicRoutes } from './civic.js';
import { registerPortalDiscoverRoutes } from './discover.js';
import { registerPortalGridsRoutes } from './grids.js';
import { registerPortalManagerRoutes } from './portal-manager.js';

export function registerPortalRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // Auth routes first — SIWE populates session.humanDid which check-frozen reads.
    registerPortalAuthRoutes(app, services);
    // Frozen/banned check — registered after auth so session is available.
    registerFrozenCheck(app, services);
    registerPortalWalletRoutes(app, services);
    registerPortalChatRoutes(app, services);
    registerPortalNousRoutes(app, services);
    // Human Civic-DID applications (D-V3-33 Portal → Polis → Registry pipeline).
    registerPortalCivicRoutes(app, services);
    // Spec §2: discovery — search organizations (Groups) + pointer to the Houses feed.
    registerPortalDiscoverRoutes(app, services);
    // Spec §2: search active Grids (multi-Grid framework).
    registerPortalGridsRoutes(app, services);
    // Tier-3 Portal Manager v1 (Henry-side meta-ops): READ-ONLY reviewer queue
    // over human_civic_applications. Observe-only — emits no audit events.
    registerPortalManagerRoutes(app, services);
    // Phase 28: human-spawned Nous routes (SPAWN-01..06).
    // Deps are constructed inline; audit/tick/gridName are optional (skipped when humanPool absent).
    void registerSpawnRoutes(app, {
        spawnNous: (name, did, publicKey, region, humanOwner, personalitySeed) =>
            services.launcher?.spawnNous(name, did, publicKey, region, humanOwner, personalitySeed),
        queryHasNous: async (humanDid) => {
            if (!services.humanPool) return false;
            const [rows] = await services.humanPool.query(
                'SELECT 1 FROM nous_registry WHERE human_owner = ? LIMIT 1',
                [humanDid],
            ) as [unknown[], unknown];
            return rows.length > 0;
        },
        confirmTxPaid: async (txHash) => {
            if (!services.evmConfirmTx) return { confirmed: false };
            return services.evmConfirmTx(txHash);
        },
        recordPayment: async (txHash, humanDid, nousDid) => {
            if (!services.humanPool) return;
            await services.humanPool.query(
                'INSERT IGNORE INTO spawn_payments (tx_hash, human_did, nous_did, confirmed) VALUES (?, ?, ?, 1)',
                [txHash, humanDid, nousDid],
            );
        },
        isPaymentClaimed: async (txHash) => {
            if (!services.humanPool) return false;
            const [rows] = await services.humanPool.query(
                'SELECT 1 FROM spawn_payments WHERE tx_hash = ? AND nous_did IS NOT NULL LIMIT 1',
                [txHash],
            ) as [unknown[], unknown];
            return rows.length > 0;
        },
        queryNameTaken: async (name) => {
            if (!services.humanPool) return false;
            const [rows] = await services.humanPool.query(
                'SELECT 1 FROM nous_registry WHERE name = ? LIMIT 1',
                [name],
            ) as [unknown[], unknown];
            return rows.length > 0;
        },
        getOwnedNous: async (humanDid) => {
            if (!services.humanPool) return null;
            const [rows] = await services.humanPool.query(
                'SELECT did, name, region, personality_seed, spawned_at_tick, balance_wei FROM nous_registry WHERE human_owner = ? LIMIT 1',
                [humanDid],
            ) as [Array<{ did: string; name: string; region: string; personality_seed: string | null; spawned_at_tick: number; balance_wei: number }>, unknown];
            if (!rows.length) return null;
            const row = rows[0]!;
            return {
                did: row.did,
                name: row.name,
                region: row.region,
                personality_seed: row.personality_seed ?? 'Explorer',
                spawned_at_tick: row.spawned_at_tick,
            };
        },
        audit: services.audit,
        currentTick: () => services.clock.state.tick,
        gridName: () => services.gridName,
    });
    // Phase 29: community routes (COM-01 through COM-05).
    registerCommunityRoutes(app, {
        humanPool: services.humanPool,
        audit: services.audit,
        gridName: services.gridName,
    });
    // Phase 30: support routes (HELP-02 progress endpoint; HELP-05 tickets added in Plan 05).
    registerSupportRoutes(app, services);
}
