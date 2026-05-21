/**
 * GET /api/v1/audit/drift-alerts — REST snapshot of the DriftDetector ring buffer.
 *
 * Returns the current list of non-allowlisted events detected at runtime.
 * Uses non-destructive peek() — repeated calls return the same result until
 * new drift events are detected.
 *
 * Response shape:
 *   { alerts: DriftAlert[] }
 *   status 200 always (empty array when no drift detected)
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

export function registerDriftAlertsRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.get('/api/v1/audit/drift-alerts', async () => {
        if (!services.driftDetector) {
            // Defensive — should never happen once server.ts wires the service.
            return { alerts: [] };
        }
        return { alerts: services.driftDetector.snapshot() };
    });
}
