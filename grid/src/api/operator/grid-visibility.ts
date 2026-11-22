/**
 * POST /api/v1/operator/grid/visibility — the Grid's creator switches it public ⇄ private
 * after creation (D-V3-41).
 *
 * The creator of a Grid launched from its own config is the operator who runs it, so this
 * is an H5 (Sovereign) action on the server-trusted operator_only gate. It is NOT a Polis
 * power and NOT a Grid Manager power (D-V3-36): visibility belongs to the creator alone.
 *
 * Body: {visibility: 'public' | 'private'}
 *   200 — {ok, grid_id, visibility, changed}; `changed:false` when it already was that
 *         (no audit event — one event per real change, sole producer appendOperatorEvent).
 *   400 — invalid_visibility      403 — tier_too_low / not_operator
 *   404 — unknown_grid            503 — grid_registry_unavailable
 *
 * The choice is saved (grid_visibility, v78) so it survives a restart; without a database
 * it holds until the Grid stops. Making a Grid private takes effect on the next request:
 * the private-Grid gate reads the registry on every public read.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import type { ApiError } from '../types.js';

export function registerGridVisibilityRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Body: { visibility?: unknown } }>('/api/v1/operator/grid/visibility', async (req, reply) => {
        const tier = req.didContext?.operatorTier ?? 0;
        if (tier < 5) { reply.code(403); return { error: 'tier_too_low' } satisfies ApiError; }
        const operatorId = req.didContext?.operatorId;
        if (!operatorId) { reply.code(403); return { error: 'not_operator' } satisfies ApiError; }

        const visibility = req.body?.visibility;
        if (visibility !== 'public' && visibility !== 'private') { reply.code(400); return { error: 'invalid_visibility' } satisfies ApiError; }

        const registry = services.gridRegistry;
        if (!registry) { reply.code(503); return { error: 'grid_registry_unavailable' } satisfies ApiError; }
        const gridId = (services.gridName ?? 'genesis').toLowerCase();
        const grid = registry.get(gridId);
        if (!grid) { reply.code(404); return { error: 'unknown_grid' } satisfies ApiError; }

        if ((grid.visibility ?? 'public') === visibility) return { ok: true, grid_id: gridId, visibility, changed: false };

        const tick = services.currentTick ? services.currentTick() : 0;
        if (services.pool) {
            await services.pool.query(
                `INSERT INTO grid_visibility (grid_name, visibility, changed_tick) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE visibility = VALUES(visibility), changed_tick = VALUES(changed_tick)`,
                [grid.name, visibility, tick],
            );
        }
        registry.setVisibility(gridId, visibility);
        appendOperatorEvent(services.audit, 'operator.grid_visibility_changed', operatorId, {
            tier: 'H5', action: 'grid_visibility', operator_id: operatorId, grid_id: gridId, visibility,
        });
        return { ok: true, grid_id: gridId, visibility, changed: true };
    });
}

/** The visibility the creator last saved for this Grid, or undefined if they never changed it. */
export async function savedGridVisibility(
    pool: { query(sql: string, params: unknown[]): Promise<unknown> },
    gridName: string,
): Promise<'public' | 'private' | undefined> {
    const [rows] = (await pool.query(`SELECT visibility FROM grid_visibility WHERE grid_name = ? LIMIT 1`, [gridName])) as [{ visibility: string }[]];
    const v = rows[0]?.visibility;
    return v === 'public' || v === 'private' ? v : undefined;
}
