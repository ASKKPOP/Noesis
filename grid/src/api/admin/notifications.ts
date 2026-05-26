/**
 * Admin notifications API — recent Pino log events as a ring buffer.
 *
 * Pino logs are written to stdout (captured by Docker). This endpoint
 * exposes a small in-process ring buffer (last 200 events) so the admin
 * panel can show "what just happened" without docker exec.
 *
 * Filter by event_type prefix or level via query params.
 */

import type { FastifyInstance } from 'fastify';
import { OPERATOR_ID_REGEX } from '../types.js';
import type { ApiError } from '../types.js';

interface NotificationEntry {
    ts: number;
    level: number;
    level_name: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    module: string;
    event?: string;
    msg: string;
    [k: string]: unknown;
}

const LEVEL_NAMES: Record<number, NotificationEntry['level_name']> = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
};

const RING_CAPACITY = 200;
const ring: NotificationEntry[] = [];

/** Public hook — call from Pino stream interceptor to populate the ring. */
export function recordNotification(entry: NotificationEntry): void {
    ring.push(entry);
    if (ring.length > RING_CAPACITY) ring.shift();
}

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

export function registerAdminNotificationsRoute(app: FastifyInstance): void {
    const adminEnabled = process.env.GRID_ADMIN_ENABLED === 'true';

    app.get<{ Querystring: { event_prefix?: string; min_level?: string; limit?: string } }>(
        '/api/v1/admin/notifications',
        async (req, reply) => {
            if (!adminEnabled) {
                reply.code(503);
                return { error: 'admin_disabled' };
            }
            const gateErr = tierGate(req, 3);  // H3+ can read notifications
            if (gateErr) {
                reply.code(gateErr.error === 'tier_missing' || gateErr.error === 'invalid_operator_id' ? 401 : 403);
                return gateErr;
            }

            const eventPrefix = req.query.event_prefix;
            const minLevel = req.query.min_level ? parseInt(req.query.min_level, 10) : 30;  // default: info+
            const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), RING_CAPACITY) : 50;

            let filtered = ring.slice();
            if (Number.isFinite(minLevel)) {
                filtered = filtered.filter((e) => e.level >= minLevel);
            }
            if (eventPrefix) {
                filtered = filtered.filter((e) => typeof e.event === 'string' && e.event.startsWith(eventPrefix));
            }

            // Most recent first
            filtered.reverse();
            filtered = filtered.slice(0, limit);

            return {
                count: filtered.length,
                ring_capacity: RING_CAPACITY,
                ring_size: ring.length,
                events: filtered.map((e) => ({
                    ts: e.ts,
                    level: e.level,
                    level_name: e.level_name,
                    module: e.module,
                    event: e.event,
                    msg: e.msg,
                })),
            };
        },
    );
}

// ── Pino stream wiring ─────────────────────────────────────────────────────

/**
 * Pino stream that captures log entries into the ring buffer alongside stdout.
 * Wire this into the Pino instance at logger.ts construction time.
 */
export function makePinoRingStream(): NodeJS.WritableStream {
    const { Writable } = require('node:stream') as typeof import('node:stream');
    return new Writable({
        write(chunk, _enc, cb) {
            try {
                const line = chunk.toString();
                const obj = JSON.parse(line) as Partial<NotificationEntry> & { time?: number; level?: number };
                if (typeof obj.time !== 'number' || typeof obj.level !== 'number') {
                    cb();
                    return;
                }
                recordNotification({
                    ts: obj.time,
                    level: obj.level,
                    level_name: LEVEL_NAMES[obj.level] || 'info',
                    module: (obj.module as string) || 'unknown',
                    event: obj.event,
                    msg: (obj.msg as string) || '',
                });
            } catch {
                // Not JSON or malformed — silently ignore
            }
            cb();
        },
    });
}
