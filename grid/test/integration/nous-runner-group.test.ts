/**
 * O1a — NousRunner dispatches join_group / leave_group to GroupStore.
 *
 * Covers:
 *   1. join_group → groupStore.joinGroup called with runner DID + metadata
 *   2. leave_group → groupStore.leaveGroup called with runner DID + metadata
 *   3. Missing/invalid metadata → safe drop (no store call, no throw)
 *   4. groupStore absent → safe no-op (legacy runner tests unaffected)
 *
 * Sole-producer invariant: NousRunner calls groupStore.joinGroup/leaveGroup
 * (which emit group.member_*). It NEVER calls audit.append('group.*') directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { Reviewer } from '../../src/review/index.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
    MemoryEntry,
} from '../../src/integration/types.js';
import type { GroupStore } from '../../src/economy/group-store.js';

const NOUS_DID = 'did:noesis:group-test';

function makeBridge(): IBrainBridge {
    return {
        connected: true,
        sendTick: (_p: TickParams) => Promise.resolve([]),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) =>
            Promise.resolve({ entries: [] as MemoryEntry[] }),
        forceTelos: (_t: Record<string, unknown>) =>
            Promise.resolve({ telos_hash_before: '0'.repeat(64), telos_hash_after: '0'.repeat(64) }),
    };
}

function seedEnv() {
    const registry = new NousRegistry();
    const audit = new AuditChain();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });

    space.addRegion({
        id: 'agora', name: 'Agora', description: 'x',
        regionType: 'public', capacity: 10, properties: {},
    });
    registry.spawn(
        { name: 'GroupTester', did: NOUS_DID, publicKey: 'pk-gt', region: 'agora' },
        'test.noesis', 0, 100,
    );
    Reviewer.resetForTesting();
    const reviewer = new Reviewer(audit, registry);
    return { registry, audit, space, economy, reviewer };
}

function makeGroupStore(): Pick<GroupStore, 'joinGroup' | 'leaveGroup'> & {
    joinGroup: ReturnType<typeof vi.fn>;
    leaveGroup: ReturnType<typeof vi.fn>;
} {
    return {
        joinGroup: vi.fn().mockResolvedValue({ id: 1 } as never),
        leaveGroup: vi.fn().mockResolvedValue({ id: 2 } as never),
    };
}

function makeRunner(
    env: ReturnType<typeof seedEnv>,
    groupStore?: Pick<GroupStore, 'joinGroup' | 'leaveGroup'>,
): NousRunner {
    return new NousRunner({
        nousDid: NOUS_DID,
        nousName: 'GroupTester',
        bridge: makeBridge(),
        space: env.space,
        audit: env.audit,
        registry: env.registry,
        economy: env.economy,
        reviewer: env.reviewer,
        groupStore: groupStore as GroupStore | undefined,
    });
}

function joinAction(overrides: Partial<{ group_id: string; role: string }> = {}): BrainAction {
    return {
        action_type: 'join_group',
        channel: '',
        text: '',
        metadata: {
            group_id: overrides.group_id ?? 'g:aegis',
            role: overrides.role ?? 'member',
        },
    } as unknown as BrainAction;
}

function leaveAction(overrides: Partial<{ group_id: string; reason: string }> = {}): BrainAction {
    return {
        action_type: 'leave_group',
        channel: '',
        text: '',
        metadata: {
            group_id: overrides.group_id ?? 'g:aegis',
            reason: overrides.reason ?? 'voluntary',
        },
    } as unknown as BrainAction;
}

describe('NousRunner — group actions (O1a)', () => {
    let env: ReturnType<typeof seedEnv>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        env = seedEnv();
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('join_group → groupStore.joinGroup called with runner DID + role + tick', async () => {
        const groupStore = makeGroupStore();
        const runner = makeRunner(env, groupStore);

        await runner.executeActions([joinAction()], 100);

        expect(groupStore.joinGroup).toHaveBeenCalledTimes(1);
        expect(groupStore.joinGroup).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                groupId: 'g:aegis',
                memberCivicDid: NOUS_DID,
                role: 'member',
                tick: 100,
            }),
        );
        // Sole-producer: NousRunner never calls audit.append('group.*') directly.
        expect(env.audit.query({ eventType: 'group.member_joined' })).toHaveLength(0);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('leave_group → groupStore.leaveGroup called with runner DID + reason + tick', async () => {
        const groupStore = makeGroupStore();
        const runner = makeRunner(env, groupStore);

        await runner.executeActions([leaveAction()], 101);

        expect(groupStore.leaveGroup).toHaveBeenCalledTimes(1);
        expect(groupStore.leaveGroup).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                groupId: 'g:aegis',
                memberCivicDid: NOUS_DID,
                reason: 'voluntary',
                tick: 101,
            }),
        );
        expect(env.audit.query({ eventType: 'group.member_left' })).toHaveLength(0);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('join_group missing role → safe drop, no store call', async () => {
        const groupStore = makeGroupStore();
        const runner = makeRunner(env, groupStore);
        const action = {
            action_type: 'join_group',
            channel: '',
            text: '',
            metadata: { group_id: 'g:aegis' }, // role missing
        } as unknown as BrainAction;

        await runner.executeActions([action], 102);

        expect(groupStore.joinGroup).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('join_group invalid role → safe drop, no store call', async () => {
        const groupStore = makeGroupStore();
        const runner = makeRunner(env, groupStore);

        await runner.executeActions([joinAction({ role: 'bogus' })], 103);

        expect(groupStore.joinGroup).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('leave_group invalid reason → safe drop, no store call', async () => {
        const groupStore = makeGroupStore();
        const runner = makeRunner(env, groupStore);

        await runner.executeActions([leaveAction({ reason: 'dunno' })], 104);

        expect(groupStore.leaveGroup).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('groupStore absent (no injection) → safe no-op, does not throw', async () => {
        // Legacy runner without groupStore — must not throw.
        const runner = makeRunner(env, undefined);

        await expect(
            runner.executeActions([joinAction()], 1),
        ).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(warnSpy.mock.calls[0]![0] as string);
        expect(logged.event).toBe('group.dispatch.not_wired');
    });

    it('groupStore error is caught — does not propagate out of the dispatch loop', async () => {
        const groupStore = makeGroupStore();
        groupStore.joinGroup.mockRejectedValue(new Error('db_unavailable'));
        const runner = makeRunner(env, groupStore);

        // Should NOT throw — errors are caught and warned.
        await expect(runner.executeActions([joinAction()], 5)).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});
