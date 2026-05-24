/**
 * Portal support routes — help center progress + support tickets.
 *
 * Phase 30 HELP-02: GET /api/v1/portal/human/me/progress
 * Phase 30 HELP-05: POST /api/v1/portal/support/tickets
 *                   GET  /api/v1/portal/support/tickets
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

export function registerSupportRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {

    /**
     * GET /api/v1/portal/human/me/progress
     *
     * Returns onboarding progress flags for the authenticated human.
     * Used by /portal/help/guide to show step completion checkmarks.
     *
     * Response: { onboarded: boolean, hasNous: boolean, hasChatted: boolean, hasTipped: boolean }
     *
     * Auth: JWT cookie required. Returns 401 if not authenticated.
     * Allowlist: NO audit event emitted (user-service action, D-15).
     */
    app.get('/api/v1/portal/human/me/progress', async (request, reply) => {
        const humanDid = (request as any).session?.humanDid as string | undefined;
        if (!humanDid) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (!services.humanPool) {
            // Grid not fully initialised — return zeroed flags
            return reply.send({ onboarded: false, hasNous: false, hasChatted: false, hasTipped: false });
        }

        // Check onboarded: onboarding_goal IS NOT NULL
        const [humanRows] = await services.humanPool.query(
            'SELECT onboarding_goal FROM human_users WHERE did = ? LIMIT 1',
            [humanDid],
        ) as [Array<{ onboarding_goal: string | null }>, unknown];
        const onboarded = humanRows.length > 0 && humanRows[0]!.onboarding_goal !== null;

        // Check hasNous: owns at least one Nous in nous_registry
        const [nousRows] = await services.humanPool.query(
            'SELECT 1 FROM nous_registry WHERE human_owner = ? LIMIT 1',
            [humanDid],
        ) as [unknown[], unknown];
        const hasNous = nousRows.length > 0;

        // hasChatted and hasTipped: check audit_trail for human.spoke and human.transferred
        // Use the actor_did column — human DID is the actor for these events.
        // Default false if audit trail query fails or grid_name unknown.
        let hasChatted = false;
        let hasTipped = false;
        try {
            const gridName = services.gridName;
            const [spokeRows] = await services.humanPool.query(
                'SELECT 1 FROM audit_trail WHERE grid_name = ? AND actor_did = ? AND event_type = ? LIMIT 1',
                [gridName, humanDid, 'human.spoke'],
            ) as [unknown[], unknown];
            hasChatted = spokeRows.length > 0;

            const [tipRows] = await services.humanPool.query(
                'SELECT 1 FROM audit_trail WHERE grid_name = ? AND actor_did = ? AND event_type = ? LIMIT 1',
                [gridName, humanDid, 'human.transferred'],
            ) as [unknown[], unknown];
            hasTipped = tipRows.length > 0;
        } catch {
            // Audit trail check failed — non-fatal, flags stay false
        }

        return reply.send({ onboarded, hasNous, hasChatted, hasTipped });
    });

    // Ticket routes added in Phase 30 Plan 05

    const VALID_SUBJECTS = new Set([
        'Bug Report',
        'Feature Request',
        'Account Issue',
        'Payment Issue',
        'Other',
    ]);

    /**
     * POST /api/v1/portal/support/tickets
     *
     * Creates a support ticket for the authenticated human.
     * Body: { subject: string, message: string, attachment_url?: string }
     * Returns: { id: string, status: 'open' }
     *
     * Validation:
     * - subject must be one of VALID_SUBJECTS
     * - message must be 1-1000 characters
     * - attachment_url: ignored in v1 (D-14: file upload deferred)
     *
     * No audit event emitted (allowlist stays at 53 — D-15).
     */
    app.post('/api/v1/portal/support/tickets', async (request, reply) => {
        const humanDid = (request as any).session?.humanDid as string | undefined;
        if (!humanDid) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (!services.humanPool) {
            return reply.status(503).send({ error: 'Service unavailable' });
        }

        const body = request.body as Record<string, unknown>;
        const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
        const message = typeof body?.message === 'string' ? body.message.trim() : '';

        if (!VALID_SUBJECTS.has(subject)) {
            return reply.status(400).send({
                error: `Invalid subject. Must be one of: ${[...VALID_SUBJECTS].join(', ')}`,
            });
        }
        if (message.length < 1 || message.length > 1000) {
            return reply.status(400).send({ error: 'Message must be 1-1000 characters.' });
        }

        const id = randomUUID();
        await services.humanPool.query(
            `INSERT INTO support_tickets (id, human_did, subject, message, attachment_url, status)
             VALUES (?, ?, ?, ?, NULL, 'open')`,
            [id, humanDid, subject, message],
        );

        return reply.status(201).send({ id, status: 'open' });
    });

    /**
     * GET /api/v1/portal/support/tickets
     *
     * Returns the authenticated human's own support tickets (last 20, newest first).
     * Returns: { tickets: Array<{ id, subject, status, created_at }> }
     */
    app.get('/api/v1/portal/support/tickets', async (request, reply) => {
        const humanDid = (request as any).session?.humanDid as string | undefined;
        if (!humanDid) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (!services.humanPool) {
            return reply.send({ tickets: [] });
        }

        const [rows] = await services.humanPool.query(
            `SELECT id, subject, status, created_at
             FROM support_tickets
             WHERE human_did = ?
             ORDER BY created_at DESC
             LIMIT 20`,
            [humanDid],
        ) as [Array<{ id: string; subject: string; status: string; created_at: string }>, unknown];

        return reply.send({ tickets: rows });
    });
}
