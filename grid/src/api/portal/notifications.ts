// Phase 36 / D-36-19 — Portal notification queue (private, per-operator).
// Server-pushed-via-poll (NOT WS). Uses portal.notification_dispatched audit event
// (NOT on broadcast allowlist).
//
// Phase 36 STUB — in-process Map; Phase 56 wires MySQL persistence.
//
// Endpoints:
//   GET  /portal/api/v1/notifications         — list notifications (portal_session_required)
//   POST /portal/api/v1/notifications/:id/read — mark as read (portal_session_required)

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { appendPortalNotificationDispatched } from '../../audit/append-portal-notification-dispatched.js';

/** Notification shape for the Portal queue. */
export interface Notification {
    id: string;
    type: string;
    body_hash: string;
    dispatched_at_tick: number;
    read_at_tick?: number;
}

/**
 * In-process per-operator notification queue.
 * Module-scoped Map: operatorDid → Notification[].
 * Phase 56 replaces with MySQL persistence.
 *
 * TODO Phase 56: real per-DID persistent queue with expiry + pagination.
 */
const notificationStore = new Map<string, Notification[]>();

/**
 * Internal helper — enqueue a notification for an operator.
 * Calls appendPortalNotificationDispatched audit event (NOT on broadcast allowlist per D-36-19).
 *
 * Exported for use by future phases (Phase 56 soft-interaction handlers).
 */
export function enqueueNotification(
    services: GridServices,
    operatorDid: string,
    type: string,
    bodyHash: string,
): void {
    const tick = services.clock.state.tick;
    const id = randomUUID();

    const notification: Notification = {
        id,
        type,
        body_hash: bodyHash,
        dispatched_at_tick: tick,
    };

    // Add to in-process queue.
    const queue = notificationStore.get(operatorDid) ?? [];
    queue.push(notification);
    notificationStore.set(operatorDid, queue);

    // Emit private audit event (NOT on broadcast allowlist per D-36-19).
    appendPortalNotificationDispatched(services.audit, {
        dispatched_at_tick: tick,
        notification_type: type,
        operator_did: operatorDid,
    });
}

export function registerPortalNotificationsRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // GET /portal/api/v1/notifications — policy: portal_session_required (D-36-19)
    app.get('/portal/api/v1/notifications', async (req, reply) => {
        // Policy already enforced by global onRequest hook (portal_session_required).
        const operatorDid = req.didContext?.operatorDid ?? req.didContext?.did;
        if (!operatorDid) {
            return reply.code(401).send({ error: 'portal_session_required' });
        }
        const notifications = notificationStore.get(operatorDid) ?? [];
        return { notifications };
    });

    // POST /portal/api/v1/notifications/:id/read — mark notification as read
    app.post<{ Params: { id: string } }>(
        '/portal/api/v1/notifications/:id/read',
        async (req, reply) => {
            // Policy already enforced by global onRequest hook (portal_session_required).
            const operatorDid = req.didContext?.operatorDid ?? req.didContext?.did;
            if (!operatorDid) {
                return reply.code(401).send({ error: 'portal_session_required' });
            }

            const queue = notificationStore.get(operatorDid);
            if (!queue) {
                return reply.code(404).send({ error: 'notification_not_found' });
            }

            const notification = queue.find((n) => n.id === req.params.id);
            if (!notification) {
                return reply.code(404).send({ error: 'notification_not_found' });
            }

            // Mark as read by setting read_at_tick.
            notification.read_at_tick = services.clock.state.tick;

            // Emit the dispatch audit event on the read action.
            appendPortalNotificationDispatched(services.audit, {
                dispatched_at_tick: services.clock.state.tick,
                notification_type: notification.type,
                operator_did: operatorDid,
            });

            return { ok: true };
        },
    );
}
