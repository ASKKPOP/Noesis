/**
 * A small Grid for the peer-message tests: real NousRunner, AuditChain, NousRegistry,
 * PeerMessageRouter, PresenceService and the real civic inbox/message routes; only the
 * database is replaced (InMemoryMessageQueue, a map of Civic-DIDs).
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { PeerMessageRouter, registeredCivicDidOf } from '../../src/integration/peer-messages.js';
import { PresenceService } from '../../src/civic-presence/presence-service.js';
import { registerCivicInboxRoutes } from '../../src/api/routes/civic-inbox.js';
import { registerCivicMessageRoute } from '../../src/api/routes/civic-message.js';
import type { GridServices } from '../../src/api/server.js';
import type { IBrainBridge } from '../../src/integration/types.js';
import { InMemoryMessageQueue } from './in-memory-message-queue.js';

export const GRID = 'genesis';
/** Holds an active Civic-DID but is not a Nous: the registry has never seen it. */
export const OUTSIDER = 'human';

const STUB_BRIDGE: IBrainBridge = {
    connected: false,
    sendTick: async () => [],
    sendMessage: async () => [],
    sendEvent: () => {},
    getState: async () => ({}),
    queryMemory: async () => ({ entries: [] }),
    forceTelos: async () => ({ telos_hash_before: '', telos_hash_after: '' }),
};

export const civicOf = (name: string): string => `did:civic:noesis:${name}`;
export const didOf = (name: string): string => `did:noesis:${name}`;
export const displayName = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

export interface World {
    readonly names: readonly string[];
    readonly audit: AuditChain;
    readonly registry: NousRegistry;
    readonly queue: InMemoryMessageQueue;
    /** Nous that currently hold an active Civic-DID. Remove a name to revoke it. */
    readonly citizens: Set<string>;
    readonly runners: Map<string, NousRunner>;
    readonly app: FastifyInstance;
    /** GET /api/v1/civic/inbox as `name`'s Brain. */
    inbox(name: string, query?: string): Promise<{ status: number; body: any }>;
    /** PATCH /api/v1/civic/inbox/ack as `name`'s Brain. Returns delivered_count. */
    ack(name: string, ids: number[]): Promise<number>;
    close(): Promise<void>;
}

export async function makeWorld(names: readonly string[], opts: { depthMax?: number } = {}): Promise<World> {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
    space.addRegion({ id: 'agora', name: 'Agora', description: 'x', regionType: 'public', capacity: 100, properties: {} });
    const queue = new InMemoryMessageQueue(opts.depthMax);
    const citizens = new Set(names);

    const router = new PeerMessageRouter({
        gridName: GRID,
        queue,
        // The production rule (main.ts) over a map instead of the Civic-DID table.
        civicDidOf: registeredCivicDidOf(registry, async (nousDid) => {
            if (nousDid === didOf(OUTSIDER)) return civicOf(OUTSIDER);
            const name = names.find((n) => didOf(n) === nousDid);
            return name !== undefined && citizens.has(name) ? civicOf(name) : null;
        }),
    });

    const runners = new Map<string, NousRunner>();
    for (const name of names) {
        registry.spawn({ name, did: didOf(name), publicKey: `pk-${name}`, region: 'agora' }, 'test.noesis', 0, 100);
        runners.set(name, new NousRunner({
            nousDid: didOf(name), nousName: displayName(name), bridge: STUB_BRIDGE,
            space, audit, registry, economy, peerMessages: router,
        }));
    }

    const presenceService = new PresenceService({
        gridName: GRID,
        messageQueueStore: queue.asStore(),
        presenceStore: { getPresence: async () => ({ presenceStatus: 'awake' }) },
        graceTimerRegistry: {},
        civicDidStore: {},
        audit,
        currentTick: () => 0,
    } as unknown as ConstructorParameters<typeof PresenceService>[0]);

    const app = Fastify({ logger: false });
    // The caller's Civic-DID comes from the verified token in production; here a header.
    app.addHook('onRequest', async (req) => {
        const who = req.headers['x-test-nous'];
        if (typeof who === 'string') req.didContext = { did: civicOf(who), tier: 'civic_member' };
    });
    const services = { presenceService, gridName: GRID } as unknown as GridServices;
    await registerCivicInboxRoutes(app, services);
    await registerCivicMessageRoute(app, services);

    return {
        names, audit, registry, queue, citizens, runners, app,
        async inbox(name, query = '') {
            const res = await app.inject({ method: 'GET', url: `/api/v1/civic/inbox${query}`, headers: { 'x-test-nous': name } });
            return { status: res.statusCode, body: res.json() };
        },
        async ack(name, ids) {
            const res = await app.inject({
                method: 'PATCH', url: '/api/v1/civic/inbox/ack',
                headers: { 'x-test-nous': name }, payload: { message_ids: ids },
            });
            return res.json().delivered_count as number;
        },
        close: () => app.close(),
    };
}
