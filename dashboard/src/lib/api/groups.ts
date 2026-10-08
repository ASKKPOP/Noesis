/**
 * Groups REST wrappers (Phase 71) — public reads of the founding Groups.
 *
 *   - GET /api/v1/groups           → fetchGroups
 *   - GET /api/v1/groups/:groupId  → fetchGroupDetail
 *
 * Same error model as economy.ts: any non-2xx or fetch rejection is
 * { ok: false, error: { kind } }; a 404 on detail is reported as 'not_found'.
 */
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export interface GroupSummary {
    group_id: string;
    kind: string;
    domain: string;
    display_name: string;
    ring: number;
    sector_deg: number;
    status: string;
}
export interface GroupMember { member_hash: string; role: string; joined_at_tick: number }
export interface GroupProject {
    project_id: string;
    title: string;
    status: 'active' | 'completed' | 'abandoned';
    produced_blueprint_hash: string | null;
    started_at_tick: number;
    completed_at_tick: number | null;
}
export interface GroupDetail {
    group: GroupSummary;
    members: GroupMember[];
    member_count: number;
    projects: GroupProject[];
}

export type GroupsResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: { kind: 'network' | 'not_found' } };

export async function fetchGroups(signal?: AbortSignal): Promise<GroupsResult<GroupSummary[]>> {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/groups`, { cache: 'no-store', signal });
        if (!res.ok) return { ok: false, error: { kind: 'network' } };
        const body = (await res.json()) as { groups?: GroupSummary[] };
        return { ok: true, data: Array.isArray(body.groups) ? body.groups : [] };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
}

export async function fetchGroupDetail(groupId: string, signal?: AbortSignal): Promise<GroupsResult<GroupDetail>> {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/groups/${encodeURIComponent(groupId)}`, { cache: 'no-store', signal });
        if (res.status === 404) return { ok: false, error: { kind: 'not_found' } };
        if (!res.ok) return { ok: false, error: { kind: 'network' } };
        return { ok: true, data: (await res.json()) as GroupDetail };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
}
