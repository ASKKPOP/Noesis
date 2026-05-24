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
                'SELECT did, name, region, personality_seed, spawned_at_tick, ousia FROM nous_registry WHERE human_owner = ? LIMIT 1',
                [humanDid],
            ) as [Array<{ did: string; name: string; region: string; personality_seed: string | null; spawned_at_tick: number; ousia: number }>, unknown];
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
}
