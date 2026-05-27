/**
 * Phase 39 — GET + PATCH /api/v1/operator/me/settings
 * Placeholder for Phase 40 Local AI config. Initial shape: { local_ai: null, _version: 1 }.
 * Phase 40 will extend this with Ollama model selection and temperature settings.
 * Policy: portal_session_required (D-39-05).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { operatorScope } from '../../preHandlers/operatorScope.js';
import { getSettings, updateSettings } from '../../../operator/data/operator-settings-store.js';

export async function registerOperatorMeSettingsRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.get('/api/v1/operator/me/settings', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent

        const { pool, gridName } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const settings = await getSettings(pool, gridName, operatorDid);
        return reply.code(200).send(settings);
    });

    app.patch<{ Body: Record<string, unknown> }>('/api/v1/operator/me/settings', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent

        const { pool, gridName } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const patch = (req.body ?? {}) as Record<string, unknown>;
        const updated = await updateSettings(pool, gridName, operatorDid, patch as never);
        return reply.code(200).send(updated);
    });
}
