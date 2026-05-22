/**
 * Operator routes barrel — wires all /api/v1/operator/* handlers.
 *
 * Called once by buildServerWithHub (src/api/server.ts). Individual route
 * registrars are colocated in this subtree per CONTEXT 06's Claude's
 * Discretion bullet 4: keep operator endpoints isolated from Phase 4's
 * inspector/economy routes so the AGENCY-03 producer-boundary invariant
 * (all operator.* writes go through appendOperatorEvent) stays auditable
 * via a single directory scan.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { registerClockOperatorRoutes } from './clock-pause-resume.js';
import { registerGovernanceOperatorRoutes } from './governance-laws.js';
import { registerMemoryQueryRoute } from './memory-query.js';
import { registerTelosForceRoute } from './telos-force.js';
import { registerDeleteNousRoute } from './delete-nous.js';
import { relationshipsRoutes } from './relationships.js';
import { registerReplayExportRoute } from './export-replay.js';
import { registerMuteBroadcastRoute } from './mute-broadcast.js';
import { registerForceSleepRoute } from './force-sleep.js';
import { registerQuarantineRoute } from './quarantine.js';
import { registerSlashCoinRoute } from './slash-coin.js';
import { registerBanHumanRoute } from './ban-human.js';
import { registerFreezeWalletRoute } from './freeze-wallet.js';
import { registerSpawnSystemNousRoute } from './spawn-system-nous.js';

export function registerOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    registerClockOperatorRoutes(app, services);
    registerGovernanceOperatorRoutes(app, services);
    registerMemoryQueryRoute(app, services);
    registerTelosForceRoute(app, services);
    // Phase 8 AGENCY-05: H5 Sovereign Operations — Nous deletion.
    registerDeleteNousRoute(app, services);
    // Phase 9 REL-04: Relationship graph endpoints (H1/H2/H5 tier-graded).
    relationshipsRoutes(app, services);
    // Phase 13 REPLAY-02: H5 Sovereign Operations — operator replay export.
    registerReplayExportRoute(app, services);
    // Phase 25b SANCTION-01: H3 — mute Nous broadcast emissions.
    registerMuteBroadcastRoute(app, services);
    // Phase 25b SANCTION-04: H3 — force Nous into Hypnos sleep cycle.
    registerForceSleepRoute(app, services);
    // Phase 25b SANCTION-03: H4 — quarantine Nous (excludes from peer-discovery).
    registerQuarantineRoute(app, services);
    // Phase 25b SANCTION-02: H4 — slash Nous ousia balance (punitive debit).
    registerSlashCoinRoute(app, services);
    // Phase 25b SANCTION-05: H5 — ban human (full portal access revoked).
    registerBanHumanRoute(app, services);
    // Phase 25b SANCTION-06: H5 — freeze human wallet (Grid-side flag; zero-custody per D-25b-NEW-4).
    registerFreezeWalletRoute(app, services);
    // Phase 25b D-25b-12: H5 — spawn system-tier Nous (researcher class, did:noesis:system:*).
    registerSpawnSystemNousRoute(app, services);
}
