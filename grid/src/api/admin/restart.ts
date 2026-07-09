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
import { operatorTierGate, type OperatorGrant } from '../preHandlers/operatorAuth.js';

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

export function registerAdminRestartRoute(app: FastifyInstance, allowlist: Map<string, OperatorGrant>): void {
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

            const gate = operatorTierGate(req.didContext?.operatorDid, allowlist, 5);
            if (!gate.ok) {
                reply.code(403);
                return { error: gate.error };
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
                        operator_id: gate.grant.operatorId,
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
