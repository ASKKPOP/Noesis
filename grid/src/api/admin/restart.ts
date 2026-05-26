/**
 * Admin restart API — triggers docker compose restart for a service.
 *
 * SECURITY: requires /var/run/docker.sock mounted into the Grid container
 * AND GRID_ADMIN_ENABLED=true. Without these, returns 503.
 *
 * Tier gate: H5 (sovereign) — restarting a container is irreversible WRT
 * any in-flight state that wasn't persisted.
 */

import type { FastifyInstance } from 'fastify';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger as baseLogger } from '../../util/logger.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import type { ApiError } from '../types.js';

const log = baseLogger.child({ module: 'admin-restart' });
const execAsync = promisify(exec);

/** Services this endpoint is allowed to restart. Mirrors docker-compose.yml service names. */
const RESTARTABLE_SERVICES = new Set([
    'grid',
    'nous-sophia',
    'nous-hermes',
    'nous-themis',
    'steward',
    'dashboard',
    // Deliberately NOT 'mysql' — restarting MySQL during operations causes audit chain divergence.
]);

function tierGate(req: { headers: Record<string, string | string[] | undefined> }, minTier: number): ApiError | null {
    const tierHeader = req.headers['x-operator-tier'];
    if (typeof tierHeader !== 'string') return { error: 'tier_missing' };
    const tierNum = parseInt(tierHeader, 10);
    if (!Number.isFinite(tierNum)) return { error: 'tier_missing' };
    if (tierNum < minTier) return { error: 'tier_too_low' };
    const opIdHeader = req.headers['x-operator-id'];
    if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) return { error: 'invalid_operator_id' };
    return null;
}

export function registerAdminRestartRoute(app: FastifyInstance): void {
    const adminEnabled = process.env.GRID_ADMIN_ENABLED === 'true';
    const dockerEnabled = process.env.GRID_ADMIN_DOCKER_ENABLED === 'true';

    app.post<{ Params: { service: string } }>(
        '/api/v1/admin/restart/:service',
        async (req, reply) => {
            if (!adminEnabled) {
                reply.code(503);
                return { error: 'admin_disabled' };
            }
            if (!dockerEnabled) {
                reply.code(503);
                return {
                    error: 'docker_unavailable',
                    hint: 'Set GRID_ADMIN_DOCKER_ENABLED=true and mount /var/run/docker.sock into the Grid container',
                };
            }

            const gateErr = tierGate(req, 5);
            if (gateErr) {
                reply.code(gateErr.error === 'tier_missing' || gateErr.error === 'invalid_operator_id' ? 401 : 403);
                return gateErr;
            }

            const service = req.params.service;
            if (!RESTARTABLE_SERVICES.has(service)) {
                reply.code(400);
                return { error: 'service_not_restartable', allowed: Array.from(RESTARTABLE_SERVICES) };
            }

            try {
                // Detect docker compose binary (v2 plugin vs v1 standalone)
                const projectDir = process.env.GRID_ADMIN_PROJECT_DIR || '/project';
                const cmd = `cd ${projectDir} && docker compose restart ${service}`;
                const { stdout, stderr } = await execAsync(cmd, { timeout: 30_000 });
                log.warn(
                    {
                        event: 'admin_service_restarted',
                        operator_id: req.headers['x-operator-id'],
                        service,
                        stdout: stdout.slice(0, 500),
                        stderr: stderr.slice(0, 500),
                    },
                    `Admin restarted service: ${service}`,
                );
                return { ok: true, service, restart_completed: true };
            } catch (err) {
                log.error({ event: 'admin_restart_failed', service, error: String(err) }, 'Restart failed');
                reply.code(500);
                return {
                    error: 'restart_failed',
                    detail: err instanceof Error ? err.message : String(err),
                };
            }
        },
    );
}
