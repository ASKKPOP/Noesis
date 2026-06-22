/**
 * Grid API Server — Fastify-based REST API for Grid services.
 *
 * Provides endpoints for health, grid status, domain management,
 * region queries, law inspection, and audit trail access.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import type { WorldClock } from '../clock/ticker.js';
import type { SpatialMap } from '../space/map.js';
import type { LogosEngine } from '../logos/engine.js';
import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import type { ShopRegistry } from '../economy/shop-registry.js';
import type { GroupStore } from '../economy/group-store.js';
import type { GridRegistry } from '../registry/grid-registry.js';
import type {
    GridStatus,
    NousRosterEntry,
    NousRosterResponse,
    ApiError,
    TradeRecord,
    TradesResponse,
    ShopsResponse,
} from './types.js';
import { WsHub } from './ws-hub.js';
import { WsFirehoseHub } from '../audit/firehose-hub.js';
import { DriftDetector } from '../audit/drift-detector.js';
import { registerAuditFirehoseRoute } from './routes/audit-firehose.js';
import { registerDriftAlertsRoute } from './routes/audit-drift-alerts.js';
import { registerHumansRoutes } from './routes/humans.js';
import { registerTickMetricsRoute } from './routes/tick-metrics.js';
import { HealthWatchdog } from '../diagnostics/health-watchdog.js';
import { registerHealthDetailedRoute } from './routes/health-detailed.js';
import { registerCivicMapRoute } from './routes/civic-map.js';
import { registerCivicMapZoneRoute } from './routes/civic-map-zone.js';
import { registerLibraryEntriesRoute } from './routes/library-entries.js';
import { registerMarketRoutes } from './routes/market.js';
import { registerIrsRoutes } from './routes/irs.js';
import { registerOrbitalRoutes } from './routes/orbital.js';
import { registerGovRoutes } from './routes/gov.js';
import { registerPolisBillsRoute } from './routes/polis-bills.js';
import { registerNousPublicProfileRoute } from './routes/nous-public-profile.js';
import { registerVisitorAuditTrailRoute } from './routes/visitor-audit-trail.js';
import { registerVisitorRateLimit } from './rate-limit/visitor-bucket.js';
import { registerPortalNotificationsRoutes } from './portal/notifications.js';
import { registerAdminConfigRoutes } from './admin/config.js';
import { registerAdminRestartRoute } from './admin/restart.js';
import { registerAdminNotificationsRoute } from './admin/notifications.js';
import { registerOperatorRoutes } from './operator/index.js';
import { registerPortalRoutes } from './portal/index.js';
import { registerCognitiveSnapshotRoute } from './operator/cognitive-snapshot.js';
import { tombstoneCheck, TombstonedDidError } from '../registry/tombstone-check.js';
import type { HumanRegistry } from '../human/index.js';
import fastifyCookie from '@fastify/cookie';
import { lookupPolicy } from './policy.js';
import { tryDid } from './preHandlers/tryDid.js';
import { requireDid, requirePortalSession } from './preHandlers/requireDid.js';
import type { RequireDidServices } from './preHandlers/requireDid.js';
import './preHandlers/types.js'; // module augmentation side-effect
import { verifyGovernmentSession, GOV_SESSION_ISSUER_DID } from '../civic-registry/index.js';
import { registerRegistryRoutes } from './routes/registry.js';
import { registerBrainTokenRoutes } from './routes/brain-token.js';
import { registerBrainWireRoutes } from './routes/brain-wire.js';
import { registerBrainFirehoseRoute } from './routes/brain-firehose.js';
import type { BrainTokenStore } from '../db/stores/brain-token-store.js';
import type { WireCoordinator } from './routes/brain-wire.js';
import { registerOperatorMeRoutes } from './routes/operator-me/index.js';
import { registerDidRateLimit } from './rate-limit/visitor-bucket.js';
import { registerCivicPresenceRoutes } from './routes/civic-presence.js';
import { registerCivicInboxRoutes } from './routes/civic-inbox.js';
import { registerCivicMessageRoute } from './routes/civic-message.js';
import { registerCivicDueRoutes } from './routes/civic-dues.js';
import { registerProcurementRoutes } from './routes/procurement.js';
import { registerApprovalRoutes } from './routes/approvals.js';
import { registerConversationRoutes } from './routes/conversation.js';
import { registerGridManagerPresenceRoute } from './routes/grid-manager-presence.js';
import { registerP2pRoutes } from './routes/p2p.js';
import { registerForkNousRoute } from './operator/fork-nous.js';
import { registerCivicParcelRoutes } from './routes/civic-parcels.js';

/**
 * Phase 6 AGENCY-02: normalized memory entry shape crossing the RPC boundary.
 *
 * Duplicated locally from `grid/src/integration/types.ts` so the API layer has
 * no direct dependency on integration types (keeps buildServer testable with a
 * stub runner that doesn't depend on the full IBrainBridge surface).
 */
export interface InspectorMemoryEntry {
    timestamp: string;
    kind: string;
    summary: string;
}

/**
 * Inspector runner accessor — returns an object that can report connection
 * state and fetch the brain's get_state dict. NousRunner satisfies this shape;
 * tests pass a fake. The accessor returns undefined when no runner exists for
 * the given DID.
 *
 * Phase 6 AGENCY-02 extensions: `queryMemory` (H2 Reviewer) and `forceTelos`
 * (H4 Driver). Both are optional on the interface so legacy test fakes that
 * only wire `getState` still compile — handlers must null-check at runtime.
 */
export interface InspectorRunner {
    connected: boolean;
    getState(): Promise<Record<string, unknown>>;
    queryMemory?(
        params: { query: string; limit?: number },
    ): Promise<{ entries: InspectorMemoryEntry[] }>;
    forceTelos?(
        newTelos: Record<string, unknown>,
    ): Promise<{ telos_hash_before: string; telos_hash_after: string }>;
    /**
     * Phase 25a OBS-BRAIN-HEALTH: tick-latency percentiles from in-memory ring buffer.
     * Optional so legacy fakes without Phase 25a wiring still compile.
     */
    getTickMetrics?(): { p50: number; p95: number; queue_depth: number; sample_count: number };
    /**
     * Phase 25b SANCTION-01: mute flag — suppresses broadcast emissions at runner boundary.
     * Optional so legacy fakes without Phase 25b wiring still compile.
     */
    muteFlag?: boolean;
    /**
     * Phase 25b SANCTION-04: force-sleep trigger — signals the runner to enter Hypnos sleep.
     * Optional so legacy fakes without Phase 25b wiring still compile.
     */
    triggerSleep?(): void | Promise<void>;
}

export interface GridServices {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
    /** NousRegistry — required by Plan 04-03 roster endpoint. Optional for
     *  legacy tests that don't exercise the new routes. */
    registry?: NousRegistry;
    /**
     * Phase 22 WEB3-02: HumanRegistry — in-memory store for Portal users.
     * Optional so legacy tests without Phase 22 wiring still compile.
     * When absent, portal auth routes return 503 human_registry_unavailable.
     */
    humanRegistry?: HumanRegistry;
    /** ShopRegistry — required by Plan 04-03 shops endpoint. */
    shops?: ShopRegistry;
    /** GroupStore — backs the portal discovery endpoint (organizations to join).
     *  Optional so legacy tests without Groups wiring still compile; route 503s when absent. */
    groupStore?: GroupStore;
    /** GridRegistry — backs the portal "search active Grids" endpoint (multi-Grid framework).
     *  Optional so legacy tests still compile; route 503s when absent. */
    gridRegistry?: GridRegistry;
    /** Runner lookup for the inspector proxy. Returns undefined if no runner
     *  is registered for the DID (→ 404 unknown_nous). */
    getRunner?: (did: string) => InspectorRunner | undefined;
    /**
     * Phase 7 DIALOG-01 (D-04): invoked by the clock-pause handler AFTER
     * WorldClock.pause() to drain the dialogue aggregator so windows cannot
     * span the pause boundary. Optional so legacy tests without a
     * DialogueAggregator wiring still compile.
     */
    drainDialogueOnPause?: () => void;
    /**
     * Phase 9 REL-04: relationship listener — provides getTopNFor, allEdges,
     * getEdge for the four relationship endpoints. Optional so legacy tests
     * without Phase 9 wiring still compile.
     */
    relationships?: {
        getTopNFor(did: string, n: number, currentTick: number): ReadonlyArray<{
            counterpartyDid: string;
            valence: number;
            weight: number;
            recency_tick: number;
            last_event_hash: string;
        }>;
        getEdge(didA: string, didB: string): import('../relationships/types.js').Edge | undefined;
        allEdges(): IterableIterator<import('../relationships/types.js').Edge>;
    };
    /**
     * Phase 9 REL-04: per-Grid relationship + decay config. Optional; routes
     * fall back to DEFAULT_RELATIONSHIP_CONFIG when absent.
     */
    config?: {
        relationship?: import('../relationships/types.js').RelationshipConfig;
    };
    /**
     * Phase 12 Wave 3 — governance plugin dependencies.
     * Optional so legacy tests without governance wiring still compile.
     * When present, registers the five governance Fastify routes.
     */
    governance?: {
        store: import('../governance/store.js').GovernanceStore;
        engine: import('../governance/engine.js').GovernanceEngine;
    };
    /**
     * Phase 19 NORM-01: NormStorage accessor for the GET /api/v1/grid/norms endpoint.
     * Optional so legacy tests without Phase 19 wiring still compile.
     * When absent, the route is not registered (→ 404).
     */
    norms?: {
        loadNorms(gridName: string): Promise<Array<{
            norm_id: string;
            fingerprint: string;
            crystallized_tick: number;
            participant_count: number;
            convergence_type: 'emergent' | 'coincidental';
            first_seen_tick: number;
        }>>;
    };
    /**
     * Phase 20 LORE-01: LoreStorage for GET /api/v1/grid/lore endpoint + listener instantiation.
     * Optional so legacy tests without Phase 20 wiring still compile.
     * When present, registers the lore route and instantiates LoreCitationListener and LoreCommonsListener.
     */
    lore?: {
        storage: import('../lore/LoreStorage.js').LoreStorage;
    };
    /**
     * Phase 25a OBS-FIREHOSE: WsFirehoseHub — unfiltered AuditChain → WebSocket fan-out.
     * Backs GET /api/v1/audit/firehose. Constructed and wired by buildServerWithHub.
     */
    firehoseHub?: WsFirehoseHub;
    /**
     * Phase 25a OBS-ALLOWLIST-MONITOR: DriftDetector — runtime non-allowlisted event monitor.
     * Backs GET /api/v1/audit/drift-alerts. Constructed and wired by buildServerWithHub.
     */
    driftDetector?: DriftDetector;
    /**
     * Phase 25a OBS-COGNITIVE-INSPECTOR: injectable fetch for Brain HTTP calls.
     * When absent, the route uses global `fetch`. Allows tests to inject mocks
     * without monkey-patching. Pattern mirrors delete-nous.ts (AGENCY-05 D-03).
     */
    brainFetch?: typeof fetch;
    /**
     * Phase 25a OBS-COGNITIVE-INSPECTOR: base URL for Brain HTTP API.
     * Defaults to `process.env.BRAIN_HTTP_BASE_URL` when absent.
     * Used by the cognitive-snapshot proxy to locate the target Brain instance.
     */
    brainBaseUrl?: string;
    /**
     * Phase 25b SANCTION-01/04: optional sanction_reasons DB writer.
     * When present, sanction routes write reason plaintext to the sanction_reasons table.
     * When absent (e.g. tests), the DB insert is skipped — the route still emits the audit event.
     * Production wiring passes a mysql2/promise Pool query wrapper from genesis/launcher.
     */
    sanctionReasonStore?: {
        insert(row: {
            reason_hash: string;
            plaintext: string;
            operator_id: string;
            event_type: string;
            target_did: string;
            tick: number;
        }): Promise<void>;
    };
    /**
     * Phase 25b SANCTION-05/06: human sanction DB operations (ban-human, freeze-wallet).
     * When present, routes check human existence and update banned/frozen flags.
     * When absent, the route returns 503 human_sanction_store_unavailable.
     * Production wiring passes a mysql2/promise Pool query wrapper from genesis/launcher.
     */
    humanSanctionStore?: {
        existsByDid(did: string): Promise<boolean>;
        setBanned(did: string): Promise<void>;
        setFrozen(did: string): Promise<void>;
        /** Phase 25b plan 13: portal preHandler reads flags to enforce freeze/ban at runtime. */
        getFlags(did: string): Promise<{ frozen: number; banned: number } | null>;
    };
    /**
     * Phase 26 ONBOARD-04: MySQL pool for onboarding_goal queries on GET /me and PATCH /me.
     * When present, GET /me returns `onboarded: boolean` derived from human_users.onboarding_goal.
     * When absent, GET /me returns `onboarded: false` (fail-safe default).
     */
    humanPool?: {
        query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
    };
    /**
     * Phase 28 SPAWN-01 + Phase 32 OBS-06/07 (D-32-G2): structural launcher contract
     * exposed to API routes. Phase 32 adds the HealthWatchdog accessor + attach
     * methods consumed by /health/detailed wiring. All Phase 32 fields are optional
     * — existing tests that omit them keep working.
     */
    launcher?: {
        spawnNous(name: string, did: string, publicKey: string, region: string, humanOwner?: string, personalitySeed?: string): void;
        // Phase 32 OBS-07: HealthWatchdog accessor + setters (optional for tests).
        readonly healthWatchdog?: import('../diagnostics/health-watchdog.js').HealthWatchdog | undefined;
        readonly auditReconcile?: import('../db/audit-reconcile.js').AuditReconcile | undefined;
        readonly clock?: { readonly currentTick: number; readonly running: boolean };
        attachHealthWatchdog?(wd: import('../diagnostics/health-watchdog.js').HealthWatchdog): void;
        attachFirehoseHub?(hub: { stats(): import('../audit/firehose-hub.js').FirehoseStats }): void;
    };
    /**
     * Phase 28 SPAWN-01: EVM RPC tx confirmation function for payment verification.
     * When present, GET /spawn/status and POST /spawn use this to verify USDT payment.
     * When absent, confirmTxPaid always returns { confirmed: false }.
     */
    evmConfirmTx?: (txHash: string) => Promise<{ confirmed: boolean; amountUsdt?: string; from?: string }>;
    /**
     * Phase 36 VIS-02: optional DID revocation store.
     * When present, tryDid consults isRevoked() after bearer verification.
     * Revoked Civic-DIDs are demoted to visitor tier (D-36-09).
     * When absent, revocation is skipped — Plan 05 wires the concrete store.
     */
    didStore?: { isRevoked(did: string): boolean | Promise<boolean> };
    /**
     * Phase 37 REG-01..04: Civic-DID persistence store.
     * When present, registry routes use this for insert/get/revoke operations.
     * When absent, registry routes return 503 civic_registry_unavailable.
     * Production wiring passes new CivicDidStore(pool) from genesis/launcher.
     */
    civicDidStore?: import('../civic-registry/civic-did-store.js').CivicDidStore;
    /**
     * Phase 58 HOUSE-1 (R-58-05 / D-58-07): civic-land registry + write-through store.
     * When present, civic-parcels routes read services.parcels.registry (read cache)
     * and persist via services.parcels.store (DB source of truth). Constructed in the
     * if (dbConn) block in main.ts (seed + hydrate on boot). When absent, civic-parcels
     * routes are unavailable. Closes the registry-not-wired bug class (R-H-01).
     */
    parcels?: {
        registry: import('../civic/parcel-registry.js').ParcelRegistry;
        store: import('../civic/parcel-store.js').ParcelStore;
    };
    /**
     * Phase 37 REG-03..06: Business-DID persistence store.
     * When present, business-did routes use this for insert/get/dissolve operations.
     * When absent, business routes return 503 business_registry_unavailable.
     * Production wiring passes new BusinessDidStore(pool) from genesis/launcher.
     */
    businessDidStore?: import('../civic-registry/business-did-store.js').BusinessDidStore;
    /**
     * Phase 38 WIRE-02: Brain bearer-token persistence store.
     * When present, brain-token routes use this for upsert/revoke operations.
     * When absent, brain-token routes return 503 brain_token_store_unavailable.
     * Production wiring passes new BrainTokenStore(pool) from genesis/launcher.
     */
    brainTokenStore?: BrainTokenStore;
    /**
     * Phase 36 VIS-01 VOTE-05: optional Polis bill store.
     * When present, polis-bills route queries getBill/listBills.
     * When absent, the route returns empty stubs (Phase 46 wires real Polis data).
     */
    polisStore?: {
        getBill(id: string): Record<string, unknown> | null;
        listBills(): Array<Record<string, unknown>>;
    };
    /**
     * Phase 38 WIRE-01: GridCoordinator accessor for the Brain-wire action dispatch route.
     * When present, POST /api/v1/brain/actions looks up the NousRunner via
     * coordinator.getRunnerByCivicDid(civicDid) and calls executeActions.
     * When absent, the route returns 503 coordinator_unavailable.
     * Production wiring passes the live GridCoordinator from GenesisLauncher.
     */
    coordinator?: WireCoordinator;
    /**
     * Phase 38 WIRE-03/WIRE-04: Brain event ingest store for offline replay dedup.
     * When present, POST /api/v1/brain/events/batch uses INSERT IGNORE to deduplicate
     * replayed events before dispatching to NousRunner.
     * When absent, the batch endpoint dispatches without dedup (test/unit mode only).
     * Production wiring passes new BrainEventIngestStore({gridName, pool}) from GenesisLauncher.
     */
    brainEventIngestStore?: import('../db/stores/brain-event-ingest-store.js').BrainEventIngestStore;
    /**
     * Phase 39 TENANT-01/02/03: MySQL Pool for operator/me/* routes.
     * When present, operator/me/* routes use operator/data/ accessors for DB queries.
     * When absent, operator/me/* routes return 503 db_unavailable.
     * Production wiring passes the pool from GenesisLauncher.
     */
    pool?: import('mysql2/promise').Pool;
    /**
     * Phase 39 TENANT-01: per-operator quota store (optional; field reserved for Steward Console wiring).
     * operator/me/* routes call operator-quota-store.ts functions directly via services.pool.
     */
    operatorQuotaStore?: import('../operator/data/operator-quota-store.js').QuotaRecord;
    /**
     * Phase 39 TENANT-01: per-operator settings store (optional; field reserved for Steward Console wiring).
     * operator/me/* routes call operator-settings-store.ts functions directly via services.pool.
     */
    operatorSettingsStore?: import('../operator/data/operator-settings-store.js').OperatorSettings;
    /**
     * Phase 41 SLEEP-01..05: presence + inbox service facade.
     * When absent, Phase 41 routes return 503 presence_service_unavailable.
     */
    presenceService?: import('../civic-presence/presence-service.js').PresenceService;
    /**
     * Phase 41 — current tick accessor for routes that write last_seen_tick.
     * Production: launcher passes `() => this.clock.currentTick`.
     * Tests: `() => 0` or a fixture tick.
     */
    currentTick?: () => number;
    /**
     * Phase 42 P2P-01..05: P2P peer store + SDP inbox + TURN shared secret.
     * When absent, Phase 42 routes return 503 p2p_service_unavailable.
     */
    p2pService?: import('../p2p/types.js').P2PService;
    /**
     * Phase 43 FORK-01 (T-43-auth): injectable operator ownership checker.
     * When present, fork route verifies operator owns the target Nous before building archive.
     * When absent, fork route rejects all requests with 403 cross_operator_forbidden (fail-safe).
     * Production: wires brainTokenStore.findByOperator + civicDidStore lookup.
     * Tests: inject a stub that returns true/false based on test scenario.
     */
    checkOperatorOwnsNous?: (operatorId: string, nousDid: string) => Promise<boolean>;
    /**
     * Phase 43 FORK-01: injectable existence-DID resolver for the fork manifest.
     * When absent, manifest uses 'did:noesis:nous:unknown' placeholder.
     * Production: wires civicDidStore to look up the existence-DID for the Civic-DID.
     */
    getExistenceDid?: (civicDid: string) => Promise<string>;
    /**
     * Phase 46 CIVGOV-01..06: Government v3 bill/session/law store.
     * When absent, gov routes fall back to a MySQL-backed store built from `pool`,
     * or return 503 service_unavailable if neither is present.
     * Tests inject an InMemoryGovBillStore.
     */
    govStore?: import('../gov/gov-bill-store.js').GovBillStore;
}

/**
 * DID regex used by /api/v1/nous/:did/state.
 * Matches `did:noesis:<slug>` where slug is alphanumeric + underscore + hyphen.
 * Case-insensitive. Exposed as a shared constant for Plan 04-06 to reuse.
 */
export const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

export interface WsHubOverrides {
    bufferCapacity?: number;
    watermarkBytes?: number;
}

export function buildServer(services: GridServices): FastifyInstance {
    return buildServerWithHub(services).app;
}

export function buildServerWithHub(
    services: GridServices,
    wsHubOptions?: WsHubOverrides,
): { app: FastifyInstance; wsHub: WsHub; firehoseHub: WsFirehoseHub; driftDetector: DriftDetector } {
    const app = Fastify({ logger: false });
    const startedAt = Date.now();

    // Phase 22: @fastify/cookie required for portal JWT cookie support (WEB3-03).
    void app.register(fastifyCookie);

    // Phase 36 D-36-05/07: visitor rate limiter — registered FIRST (before policy hook).
    // 120 req/min per IP. In-process Map; Phase 39 refactors to per-DID buckets.
    registerVisitorRateLimit(app);

    // Phase 36 VIS-02/VIS-04: global policy enforcement hook.
    // Uses onRequest (not preHandler) so it fires for ALL requests, including routes
    // that are not yet registered (e.g., future Plan 05 visitor routes). This ensures
    // default-deny: any unregistered route that matches civic_did_required will 401
    // before Fastify can return a 404.
    // Registration order: after cookie plugin so cookies are parsed, before route registration.
    void app.addHook('onRequest', async (req, reply) => {
        // CORS preflight requests must pass through — they carry no auth and are handled
        // by @fastify/cors before reaching any route handler.
        if (req.method === 'OPTIONS') return;

        const routePath = (req as { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
        const policy = lookupPolicy(req.method, routePath);
        if (policy === 'public') {
            // Public routes: still resolve context for downstream handlers that conditionally redact.
            const ctx = await tryDid(req, { didStore: services.didStore, brainTokenStore: services.brainTokenStore });
            req.didContext = ctx;
            return;
        }
        if (policy === 'portal_session_required') {
            const ctx = await requirePortalSession(req, reply, { didStore: services.didStore });
            if (!ctx) return; // 401 already sent
            req.didContext = ctx;
            return;
        }
        // Phase 37 (REG-04 / Pitfall 1 / Pitfall 6): government_only branch — enforces
        // court-order discipline before any civic-DID revoke or business-DID dissolve
        // handler is reached. Operators cannot revoke or dissolve (constitutional invariant
        // D-V3-18). The branch must run BEFORE the generic requireDid fall-through.
        // tier='government' (NOT 'civic_member') keeps Government sessions out of
        // civic_did_required-gated routes (Pitfall 6).
        if (policy === 'government_only') {
            const result = await verifyGovernmentSession(req.headers.authorization);
            if (!result.ok) {
                return reply.code(403).send({ error: result.reason });
            }
            req.didContext = { did: GOV_SESSION_ISSUER_DID, tier: 'government' };
            return;
        }
        // civic_did_required, business_did_required, police_only
        // (Plan 05/06 layer the sub-tier checks; this plan enforces civic_did_required minimum)
        // Phase 41 T-41-04: pass presenceService so frozen Civic-DIDs get 409.
        const requireDidServices: RequireDidServices = {
            didStore: services.didStore,
            brainTokenStore: services.brainTokenStore,
            presenceService: services.presenceService,
        };
        const ctx = await requireDid(req, reply, requireDidServices);
        if (!ctx) return;
        req.didContext = ctx;
    });

    // Phase 39 D-39-08: per-DID rate limit hook.
    // Registered AFTER the policy onRequest hook above so req.didContext is already populated.
    // DID-authenticated requests get 600 req/min (5× the anonymous visitor 120/min IP limit).
    registerDidRateLimit(app);

    // Dashboard CORS (dev): Next.js dev server runs on :3001 per 03-VALIDATION.md.
    // :3000 is included because `next dev` falls back to :3000 when :3001 is taken.
    // :3002 is the Steward Console.
    // Production (subdomain hosting): the dashboard/steward live on different
    // origins (dash./console.${DOMAIN}) so requests to api.${DOMAIN} are
    // cross-origin. Add those HTTPS origins via GRID_CORS_ORIGINS (comma-
    // separated); the localhost defaults are always kept for dev.
    const corsOrigins = [
        'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3002',
        ...(process.env.GRID_CORS_ORIGINS ?? '')
            .split(',')
            .map((o) => o.trim())
            .filter((o) => o.length > 0),
    ];
    void app.register(cors, {
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    });

    // --- Health ---

    app.get('/health', async () => {
        return { status: 'ok', timestamp: Date.now() };
    });

    // --- Grid Status ---

    app.get('/api/v1/grid/status', async (): Promise<GridStatus> => {
        const clockState = services.clock.state;
        return {
            name: services.gridName,
            tick: clockState.tick,
            epoch: clockState.epoch,
            nousCount: services.space.nousCount,
            regionCount: services.space.allRegions().length,
            activeLaws: services.logos.activeLaws().length,
            auditEntries: services.audit.length,
            uptime: Date.now() - startedAt,
        };
    });

    app.get('/api/v1/grid/clock', async () => {
        return services.clock.state;
    });

    // --- Regions ---

    app.get('/api/v1/grid/regions', async () => {
        return {
            regions: services.space.allRegions(),
            connections: services.space.allConnections(),
        };
    });

    app.get<{ Params: { id: string } }>('/api/v1/grid/regions/:id', async (req, reply) => {
        const region = services.space.getRegion(req.params.id);
        if (!region) {
            reply.code(404);
            return { error: 'Region not found', code: 404 };
        }
        return region;
    });

    // --- Plan 04-03: Nous roster + Inspector proxy ---

    app.get('/api/v1/grid/nous', async (): Promise<NousRosterResponse> => {
        const registry = services.registry;
        if (!registry) {
            // Legacy test harness path — no registry wired. Treat as empty roster.
            return { nous: [] };
        }
        const nous: NousRosterEntry[] = registry.active().map((r) => ({
            did: r.did,
            name: r.name,
            region: r.region,
            ousia: r.ousia,
            lifecyclePhase: r.lifecyclePhase,
            reputation: r.reputation,
            status: r.status,
        }));
        return { nous };
    });

    app.get<{ Params: { did: string } }>(
        '/api/v1/nous/:did/state',
        async (request, reply) => {
            const { did } = request.params;
            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // Tombstone check — 410 if DID already deleted (AGENCY-05 D-28).
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, did);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                    }
                    throw err;
                }
            }

            const getRunner = services.getRunner;
            const runner = getRunner ? getRunner(did) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }
            if (!runner.connected) {
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
            try {
                const state = await runner.getState();
                return state;
            } catch (err) {
                // Privacy invariant (T-04-12): never leak raw err.message.
                // Log server-side only, return fixed error shape.
                request.log.warn({ err, did }, 'brain get_state failed');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
        },
    );

    // --- Plan 04-03: Economy endpoints ---

    app.get<{ Querystring: { limit?: string; offset?: string } }>(
        '/api/v1/economy/trades',
        async (request): Promise<TradesResponse> => {
            // Limit: default 20, clamp max 100, NaN/invalid → default.
            const limitRaw = Number.parseInt(request.query.limit ?? '', 10);
            const limit = Number.isFinite(limitRaw) && limitRaw > 0
                ? Math.min(limitRaw, 100)
                : 20;
            // Offset: default 0, min 0, NaN/invalid → 0.
            const offsetRaw = Number.parseInt(request.query.offset ?? '', 10);
            const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

            // Total count of matching entries in the chain (pre-pagination).
            // AuditChain.query() does not expose a separate total, so we
            // compute it by running the filter without pagination.
            const allMatching = services.audit?.query({ eventType: 'trade.settled' }) ?? [];
            const total = allMatching.length;

            const page = services.audit?.query({
                eventType: 'trade.settled',
                limit,
                offset,
            }) ?? [];

            // W2 timestamp contract: AuditEntry.createdAt is Date.now() (ms).
            // Emit Unix SECONDS (integer) per the contract locked in api/types.ts.
            // Any value ≥ 10_000_000_000 would be ms — asserted by the test.
            const trades: TradeRecord[] = page.map((e) => ({
                actorDid: e.actorDid,
                counterparty: String(e.payload['counterparty'] ?? ''),
                amount: Number(e.payload['amount'] ?? 0),
                nonce: String(e.payload['nonce'] ?? ''),
                timestamp: Math.floor(e.createdAt / 1000),
            }));

            return { trades, total };
        },
    );

    app.get('/api/v1/economy/shops', async (): Promise<ShopsResponse> => {
        const shops = services.shops;
        if (!shops) return { shops: [] };
        // Defensive copy: frozen listings from ShopRegistry are not safe to
        // hand to callers (mutating would throw). Spread each level to emit
        // plain serializable objects.
        const out = shops.list().map((s) => ({
            ownerDid: s.ownerDid,
            name: s.name,
            listings: s.listings.map((l) => ({
                sku: l.sku,
                label: l.label,
                priceOusia: l.priceOusia,
            })),
        }));
        return { shops: out };
    });

    // --- Laws ---

    app.get('/api/v1/governance/laws', async () => {
        return { laws: services.logos.activeLaws() };
    });

    app.get<{ Params: { id: string } }>('/api/v1/governance/laws/:id', async (req, reply) => {
        const law = services.logos.getLaw(req.params.id);
        if (!law) {
            reply.code(404);
            return { error: 'Law not found', code: 404 };
        }
        return law;
    });

    // --- Phase 37 REG-01..06: DID Registry routes ---
    // Six endpoints under /api/v1/registry/* for Civic-DID + Business-DID lifecycle.
    // Policy enforcement (public, government_only, civic_did_required) delegated to onRequest hook.
    void registerRegistryRoutes(app, services);

    // --- Phase 38 WIRE-02: Brain bearer-token routes ---
    // Two endpoints: POST /api/v1/brain/token/{register,revoke}.
    // Policy enforcement delegated to onRequest hook (public / government_only).
    void registerBrainTokenRoutes(app, services);

    // --- Phase 39 TENANT-02/03: Operator fleet management routes ---
    // Five endpoints under /api/v1/operator/me/*. All portal_session_required.
    void registerOperatorMeRoutes(app, services);

    // --- Phase 41 SLEEP-01..05: Civic presence + inbox + message routes ---
    // Six endpoints: POST/GET /civic/presence, GET /civic/presence/me,
    // GET /civic/inbox, PATCH /civic/inbox/ack, POST /civic/message.
    // Policy enforcement delegated to onRequest hook per ROUTE_DID_POLICY.
    void registerCivicPresenceRoutes(app, services);
    void registerCivicInboxRoutes(app, services);
    void registerCivicMessageRoute(app, services);
    registerCivicDueRoutes(app, services);
    registerProcurementRoutes(app, services);
    registerApprovalRoutes(app, services);
    registerConversationRoutes(app, services);

    // --- Phase 41 SLEEP-02: Grid Manager presence overview (Steward Console Section 4) ---
    // GET /api/v1/grid-manager/presence-overview — portal_session_required (D-V3-36 Tier-2).
    void registerGridManagerPresenceRoute(app, services);

    // --- Phase 42 P2P-01..05: P2P signaling routes ---
    // Five endpoints: POST /p2p/announce, GET /p2p/peers/:did, POST /p2p/signal/:did,
    // GET /p2p/signal/inbox, GET /p2p/turn-credentials.
    // Policy enforcement delegated to onRequest hook per ROUTE_DID_POLICY (5 entries added in policy.ts).
    void registerP2pRoutes(app, services);

    // --- Phase 43 FORK-01: Right-to-fork endpoint ---
    // POST /api/v1/operator/fork/:nousDid — H4+ header-trust, builds .tar.gz, issues one-time token.
    // GET /api/v1/operator/fork/:nousDid/download?token=X — one-time archive download.
    // Policy: 'public' (header-trust handles auth internally, per all operator.* routes).
    registerForkNousRoute(app, services);

    // --- Phase 58 HOUSE-1 (NH1-06): Civic-parcels routes ---
    // GET feeds public; purchase/build/join/leave/entry-policy civic_did_required
    // (D-NH-07 Nous-only land). Registered only when the parcels service is wired
    // (mirrors the optional civicDidStore-style registrations).
    if (services.parcels) {
        registerCivicParcelRoutes(app, services);
    }

    // --- Phase 38 WIRE-01: Brain action dispatch route ---
    // POST /api/v1/brain/actions — civic_did_required (onRequest hook enforces).
    // Dispatches BrainAction[] through NousRunner.executeActions (R-31-01 sole-producer path).
    registerBrainWireRoutes(app, services);

    // --- Phase 6 Plan 04: Operator routes (AGENCY-02 H3 + AGENCY-03) ---
    // All operator.* audit writes inside this registrar go through
    // appendOperatorEvent — enforces tier-required + payload-privacy at the
    // single producer boundary.
    registerOperatorRoutes(app, services);

    // --- Phase 22: Portal auth routes (WEB3-01 to WEB3-06) ---
    registerPortalRoutes(app, services);

    // --- Phase 36 D-36-19: Portal notification queue endpoints ---
    registerPortalNotificationsRoutes(app, services);

    // --- Phase 25a OBS-HUMANS: Human profile + history routes ---
    registerHumansRoutes(app, services);

    // --- Phase 36 VIS-01: Visitor read routes ---
    // Registered AFTER humans routes; BEFORE governance/laws block.
    // Order: civic-map, civic-map-zone, library-entries, market-listings,
    //        polis-bills, nous-public-profile, visitor-audit-trail.
    registerCivicMapRoute(app, services);
    registerCivicMapZoneRoute(app, services);
    registerLibraryEntriesRoute(app, services);
    void registerMarketRoutes(app, services);
    void registerIrsRoutes(app, services);
    registerOrbitalRoutes(app, services);
    void registerGovRoutes(app, services);
    registerPolisBillsRoute(app, services);
    registerNousPublicProfileRoute(app, services);
    registerVisitorAuditTrailRoute(app, services);

    // --- Phase 25a OBS-BRAIN-HEALTH: Tick-metrics route ---
    registerTickMetricsRoute(app, services);

    // --- Phase 25a OBS-COGNITIVE-INSPECTOR: H3 cognitive-snapshot proxy ---
    registerCognitiveSnapshotRoute(app, services);

    // --- Phase 19 NORM-01: Crystallized norms endpoint ---
    // Registered only when norms service is provided (optional for legacy tests).
    if (services.norms) {
        app.get('/api/v1/grid/norms', async (_req, reply) => {
            const rows = await services.norms!.loadNorms(services.gridName);
            reply.code(200);
            return {
                norms: rows.map((r) => ({
                    norm_id: r.norm_id,
                    fingerprint: r.fingerprint,
                    crystallized_tick: r.crystallized_tick,
                    participant_count: r.participant_count,
                    convergence_type: r.convergence_type,
                    evidence_tick_range: [r.first_seen_tick, r.crystallized_tick],
                })),
            };
        });
    }

    // --- Phase 20 LORE-01: Lore Commons endpoint + listeners ---
    // Registered only when lore service is provided (optional for legacy tests).
    if (services.lore) {
        const loreSvc = services.lore;
        void app.register(async (instance) => {
            const { registerLoreRoutes } = await import('./routes/lore.js');
            const { LoreCitationListener, LoreCommonsListener } = await import('../lore/index.js');
            // Instantiate listeners so citation_count increments and lore_commons is populated.
            // These wire onto audit.onAppend() and must be active from startup.
            new LoreCitationListener(services.audit, loreSvc.storage, services.gridName);
            new LoreCommonsListener(services.audit, loreSvc.storage, services.gridName);
            await registerLoreRoutes(instance, loreSvc.storage, services.gridName);
        });
    }

    // --- Phase 21 CULTURE-01: Skill lineage endpoint ---
    // Always registered — audit chain is always present (unconditional, no optional guard).
    void app.register(async (instance) => {
        const { registerCultureRoutes } = await import('./routes/culture.js');
        await registerCultureRoutes(instance, services.audit);
    });

    // --- Phase 12 Wave 3: Governance proposal/ballot routes ---
    // Registered only when governance deps are provided (optional for legacy tests).
    if (services.governance && services.registry) {
        void app.register(async (instance) => {
            const { registerGovernanceRoutes } = await import('./governance/index.js');
            await registerGovernanceRoutes(instance, {
                audit: services.audit,
                store: services.governance!.store,
                registry: services.registry!,
                logos: services.logos,
            });
        });
    }

    // --- Audit ---
    // NOTE: GET /api/v1/audit/trail is now registered by registerVisitorAuditTrailRoute
    // (Phase 36 VIS-01 — see route registration block above). The previous inline route
    // is removed here to prevent duplicate route registration.

    app.get('/api/v1/audit/verify', async () => {
        const result = services.audit.verify();
        return result;
    });

    // --- WebSocket: /ws/events ---

    // Custom preClose replaces @fastify/websocket's defaultPreClose, which has a
    // double-`done()` bug: it calls `server.close(done)` AND `done()` synchronously.
    // When the underlying HTTP server was never `listen`ed (every `app.inject()` test
    // teardown), ws's `close(cb)` invokes the callback with `Error('The server is not
    // running')`, which rejects `app.close()` and fails the test in afterEach. We close
    // clients then call `server.close(() => done())` exactly once, swallowing that error.
    void app.register(fastifyWebsocket, {
        options: { maxPayload: 1_048_576 },
        preClose: function preClose(done: () => void): void {
            const server = (this as { websocketServer?: { clients?: Set<{ close(): void }>; close(cb?: () => void): void } }).websocketServer;
            if (server?.clients) {
                for (const client of server.clients) {
                    try { client.close(); } catch { /* socket already closing */ }
                }
            }
            if (!server) { done(); return; }
            server.close(() => done());
        },
    });

    const wsHub = new WsHub({
        audit: services.audit,
        gridName: services.gridName,
        bufferCapacity: wsHubOptions?.bufferCapacity,
        watermarkBytes: wsHubOptions?.watermarkBytes,
    });

    // Phase 25a: Firehose hub + drift detector (observer-only, no audit writes).
    const firehoseHub = new WsFirehoseHub(services.audit, services.gridName);
    const driftDetector = new DriftDetector(services.audit);
    services.firehoseHub = firehoseHub;
    services.driftDetector = driftDetector;

    // Phase 32 OBS-06/07 (D-32-G1): HealthWatchdog construction + wiring + route.
    // Construction order is mandatory:
    //   1. firehoseHub already exists (line above).
    //   2. Construct HealthWatchdog with launcher.auditReconcile + clockState getter.
    //   3. attachHealthWatchdog (must precede attachFirehoseHub).
    //   4. attachFirehoseHub (this also calls healthWatchdog.attachFirehoseStats).
    //   5. Register /health/detailed route at top level (NOT inside WS scope below).
    // Guard: only wire when services.launcher exposes the Phase 32 surface — tests
    // that pass a minimal launcher (or no launcher) skip Phase 32 entirely.
    if (
        services.launcher &&
        typeof services.launcher.attachHealthWatchdog === 'function' &&
        typeof services.launcher.attachFirehoseHub === 'function' &&
        services.launcher.clock !== undefined
    ) {
        const launcher = services.launcher as unknown as import('../genesis/launcher.js').GenesisLauncher;
        const healthWatchdog = new HealthWatchdog({
            auditReconcile: launcher.auditReconcile,
            clockState: () => ({ tick: launcher.clock.currentTick, running: launcher.clock.running }),
            // Phase 34.1 + 34.2 FOLLOWUP-34-01/02/04: pass the live AuditChain ref so
            // in_memory_length reads chain.length (not the persistedMaxId fallback that made
            // divergence permanently 0), lastPersistError merges tick-time failures from
            // PersistentAuditChain (set on every persist failure) with reconcile-time
            // failures from AuditReconcile, and lastPersistedId merges the live success
            // watermark from PersistentAuditChain with the per-cycle reconcile.persistedMaxId
            // (Phase 34.2 fixes the cached-value lag between reconcile cycles). The cast
            // tolerates both plain AuditChain (no lastPersistError / lastPersistedId getters)
            // and PersistentAuditChain (has both).
            auditChain: services.audit as {
                readonly length: number;
                readonly lastPersistError?: { code: string; at: number } | null;
                readonly lastPersistedId?: number | null;
            },
        });
        launcher.attachHealthWatchdog(healthWatchdog);
        launcher.attachFirehoseHub(firehoseHub);
        registerHealthDetailedRoute(app, services, launcher);
    }

    // M5: Origin check deferred — v1 binds 127.0.0.1. See Phase 4 for 0.0.0.0 hardening.
    // When binding 0.0.0.0 behind a reverse proxy, pair GRID_WS_SECRET with an origin
    // allowlist check here. See PITFALLS.md §M5 for the deployment-time checklist.
    //
    // Local-dev auth posture (02-CONTEXT.md §Local-dev auth posture):
    //   - If GRID_WS_SECRET env is set: require Authorization: Bearer <secret>
    //     header OR ?token=<secret> query param. Missing/mismatch → 1008 close.
    //   - If unset: permissive (developer default, 127.0.0.1 bind).
    // Phase 25a: REST drift-alerts route (registered at top-level, not inside WS scope).
    registerDriftAlertsRoute(app, services);

    // Local Management Site admin routes (post-v2.6, gated by GRID_ADMIN_ENABLED env).
    // When the env is absent or false, every /api/v1/admin/* returns 503 — admin
    // attack surface is fully gated and zero-overhead by default.
    registerAdminConfigRoutes(app);
    registerAdminRestartRoute(app);
    registerAdminNotificationsRoute(app);

    app.register(async (instance) => {
        // Phase 25a: firehose WS route registered inside the same plugin scope as /ws/events.
        // Phase 36 VIS-03: pass services so tryDid can consult didStore for revocation.
        registerAuditFirehoseRoute(instance, firehoseHub, services);
        // Phase 38 WIRE-01 (WSS) + WIRE-05 (per-DID filter): Brain firehose subscription.
        // Shares the same firehoseHub instance — per-DID filter applied in ClientConnection.trySend.
        registerBrainFirehoseRoute(instance, firehoseHub, services);

        instance.get('/ws/events', { websocket: true }, (socket, req) => {
            const secret = process.env.GRID_WS_SECRET;
            if (secret) {
                const headerAuth = (req.headers['authorization'] as string | undefined) ?? '';
                const bearer = headerAuth.startsWith('Bearer ')
                    ? headerAuth.substring('Bearer '.length)
                    : null;
                const q = req.query as { token?: unknown } | undefined;
                const queryToken = typeof q?.token === 'string' ? q.token : null;
                const presented = bearer ?? queryToken;
                if (presented !== secret) {
                    try {
                        socket.close(1008, 'unauthorized');
                    } catch {
                        /* swallow */
                    }
                    return;
                }
            }
            // Adapter: fastify/ws socket → ServerSocket shape expected by WsHub.
            const adapter = {
                get bufferedAmount() {
                    return socket.bufferedAmount;
                },
                send: (data: string) => socket.send(data),
                close: (code?: number, reason?: string) => socket.close(code, reason),
                on: (event: 'message' | 'close' | 'error', cb: (arg: never) => void) => {
                    if (event === 'message') {
                        socket.on('message', (data: Buffer) =>
                            (cb as (d: unknown) => void)(data.toString('utf8')),
                        );
                    } else if (event === 'close') {
                        socket.on('close', () => (cb as () => void)());
                    } else {
                        socket.on('error', (err: Error) =>
                            (cb as (e: Error) => void)(err),
                        );
                    }
                },
            };
            wsHub.onConnect(adapter, { headers: req.headers as Record<string, unknown> });
        });
    });

    // Lifecycle: drain hub before @fastify/websocket tears down sockets.
    // We use `preClose` so ByeFrame writes complete while sockets are still
    // OPEN — onClose fires AFTER the websocket plugin has already moved every
    // socket to CLOSING (readyState=2), at which point send() is a no-op.
    //
    // NOTE: callers who use graceful-shutdown signals (SIGTERM, etc.) should
    // also invoke `wsHub.close()` explicitly if they call `app.close()` after
    // other teardown steps that might race with @fastify/websocket.
    app.addHook('preClose', async () => {
        await wsHub.close();
        await firehoseHub.close();
        driftDetector.close();
    });

    return { app, wsHub, firehoseHub, driftDetector };
}
