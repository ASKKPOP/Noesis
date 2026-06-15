/**
 * Groups & Holdings · Phase 69 — GroupStore research-project ops (MOCK Pool).
 *
 * startProject → civic_group_projects row + group.project_started.
 * completeProject → status=completed + produced blueprint hash + group.project_completed.
 * listProjects maps rows. Money-free; treasury deferred to the on-chain rails.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { GroupStore } from '../../src/economy/group-store.js';
import { AuditChain } from '../../src/audit/chain.js';

const GROUP = 'genesis:group:aegis';
const PROJECT = '0b2e7a14-9c1d-4f6e-8a3b-5d7c9e1f2a4b';
const HEX64 = 'a'.repeat(64);

function makeMockPool(opts: { selectRows?: unknown[] } = {}): Pool {
    const selectRows = opts.selectRows ?? [];
    const query = vi.fn().mockImplementation((sql: string) => {
        if (/^\s*select/i.test(sql)) return Promise.resolve([selectRows, []]);
        return Promise.resolve([{ affectedRows: 1 } as ResultSetHeader, []]);
    });
    return { query } as unknown as Pool;
}

describe('GroupStore.startProject', () => {
    it('records a project and emits group.project_started (no title on chain)', async () => {
        const audit = new AuditChain();
        const store = new GroupStore(makeMockPool(), 'genesis');

        await store.startProject(audit, { groupId: GROUP, projectId: PROJECT, title: 'Railgun R&D', tick: 30 });

        const started = audit.query({ eventType: 'group.project_started' });
        expect(started).toHaveLength(1);
        expect(started[0].actorDid).toBe(GROUP);
        expect(JSON.stringify(started[0].payload)).not.toContain('Railgun');
    });
});

describe('GroupStore.completeProject', () => {
    it('completes a project and emits group.project_completed with the blueprint hash', async () => {
        const audit = new AuditChain();
        const store = new GroupStore(makeMockPool(), 'genesis');

        await store.completeProject(audit, { groupId: GROUP, projectId: PROJECT, blueprintHash: HEX64, tick: 80 });

        const done = audit.query({ eventType: 'group.project_completed' });
        expect(done).toHaveLength(1);
        expect((done[0].payload as { blueprint_hash: string }).blueprint_hash).toBe(HEX64);
    });
});

describe('GroupStore.listProjects', () => {
    it('maps project rows', async () => {
        const pool = makeMockPool({
            selectRows: [
                { project_id: PROJECT, group_id: GROUP, title: 'Railgun R&D', status: 'completed', produced_blueprint_hash: HEX64, started_at_tick: 30, completed_at_tick: 80 },
            ],
        });
        const store = new GroupStore(pool, 'genesis');

        const projects = await store.listProjects(GROUP);

        expect(projects).toHaveLength(1);
        expect(projects[0].projectId).toBe(PROJECT);
        expect(projects[0].status).toBe('completed');
        expect(projects[0].producedBlueprintHash).toBe(HEX64);
    });
});
