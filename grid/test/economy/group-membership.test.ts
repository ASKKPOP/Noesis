/**
 * Groups & Holdings · Phase 63 — GroupStore membership ops (MOCK Pool).
 *
 * join → civic_group_members row + one group.member_joined (member DID HASHED).
 * leave → status='departed' + one group.member_left. listMembers maps rows.
 */
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { GroupStore } from '../../src/economy/group-store.js';
import { AuditChain } from '../../src/audit/chain.js';

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');
const DID = 'did:civic:noesis:nous:alice';
const GROUP = 'genesis:group:aegis';

function makeMockPool(opts: { affectedRows?: number; selectRows?: unknown[] } = {}): Pool {
    const affectedRows = opts.affectedRows ?? 1;
    const selectRows = opts.selectRows ?? [];
    const query = vi.fn().mockImplementation((sql: string) => {
        if (/^\s*select/i.test(sql)) return Promise.resolve([selectRows, []]);
        return Promise.resolve([{ affectedRows } as ResultSetHeader, []]);
    });
    return { query } as unknown as Pool;
}

describe('GroupStore.joinGroup', () => {
    it('inserts a member and emits group.member_joined with the HASHED DID as actor', async () => {
        const pool = makeMockPool();
        const audit = new AuditChain();
        const store = new GroupStore(pool, 'genesis');

        await store.joinGroup(audit, { groupId: GROUP, memberCivicDid: DID, role: 'member', tick: 5 });

        const joined = audit.query({ eventType: 'group.member_joined' });
        expect(joined).toHaveLength(1);
        expect(joined[0].actorDid).toBe(sha256Hex(DID));
        // raw DID must NOT appear anywhere in the payload
        expect(JSON.stringify(joined[0].payload)).not.toContain(DID);
    });
});

describe('GroupStore.leaveGroup', () => {
    it('marks the member departed and emits group.member_left', async () => {
        const pool = makeMockPool();
        const audit = new AuditChain();
        const store = new GroupStore(pool, 'genesis');

        await store.leaveGroup(audit, { groupId: GROUP, memberCivicDid: DID, reason: 'voluntary', tick: 9 });

        const left = audit.query({ eventType: 'group.member_left' });
        expect(left).toHaveLength(1);
        expect(left[0].actorDid).toBe(sha256Hex(DID));
    });
});

describe('GroupStore.listMembers', () => {
    it('maps active member rows', async () => {
        const pool = makeMockPool({
            selectRows: [
                { group_id: GROUP, member_civic_did: DID, role: 'founder', joined_at_tick: 5, status: 'active' },
            ],
        });
        const store = new GroupStore(pool, 'genesis');

        const members = await store.listMembers(GROUP);

        expect(members).toHaveLength(1);
        expect(members[0].role).toBe('founder');
        expect(members[0].memberCivicDid).toBe(DID);
    });
});
