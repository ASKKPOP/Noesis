import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGroups, fetchGroupDetail } from './groups';

function jsonResp(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
const GROUP = { group_id: 'genesis:group:helix', kind: 'business', domain: 'biotech', display_name: 'Helix', ring: 2, sector_deg: 72, status: 'active' };

afterEach(() => { vi.unstubAllGlobals(); });

describe('groups API client (Phase 71)', () => {
    it('fetchGroups returns the group list', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResp({ groups: [GROUP], count: 1 })));
        const r = await fetchGroups();
        expect(r).toEqual({ ok: true, data: [GROUP] });
    });

    it('fetchGroupDetail URL-encodes the colon-bearing group id', async () => {
        const f = vi.fn().mockResolvedValue(jsonResp({ group: GROUP, members: [], member_count: 0, projects: [] }));
        vi.stubGlobal('fetch', f);
        const r = await fetchGroupDetail(GROUP.group_id);
        expect(r.ok).toBe(true);
        expect(String(f.mock.calls[0]![0])).toContain('/api/v1/groups/genesis%3Agroup%3Ahelix');
    });

    it('maps 404 to not_found and other failures to network', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResp({ error: 'unknown_group' }, 404)));
        expect(await fetchGroupDetail('x')).toEqual({ ok: false, error: { kind: 'not_found' } });
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
        expect(await fetchGroups()).toEqual({ ok: false, error: { kind: 'network' } });
    });
});
