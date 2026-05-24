/**
 * GET /api/v1/audit/firehose — WebSocket upgrade route for the live firehose.
 *
 * Must be registered INSIDE the fastify-websocket plugin scope (see server.ts).
 * Mirrors the GRID_WS_SECRET gate and ServerSocket adapter used by /ws/events.
 *
 * Pitfall 5 (25a-RESEARCH.md): Do NOT register fastifyWebsocket a second time.
 * Register this route inside the same `app.register(async instance => ...)` scope
 * that registers /ws/events.
 */

import type { FastifyInstance } from 'fastify';
import type { WsFirehoseHub } from '../../audit/firehose-hub.js';

export function registerAuditFirehoseRoute(
    instance: FastifyInstance,
    firehoseHub: WsFirehoseHub,
): void {
    instance.get('/api/v1/audit/firehose', { websocket: true }, (socket, req) => {
        // GRID_WS_SECRET gate — cloned verbatim from server.ts /ws/events block.
        const secret = process.env.GRID_WS_SECRET;
        if (secret) {
            const headerAuth = (req.headers['authorization'] as string | undefined) ?? '';
            const bearer = headerAuth.startsWith('Bearer ')
                ? headerAuth.substring('Bearer '.length)
                : null;
            const q = req.query as { token?: unknown } | undefined;
            const queryToken = typeof q?.token === 'string' ? q.token : null;
            const presented = bearer ?? queryToken;
            if (presented !== secret) {
                try {
                    socket.close(1008, 'unauthorized');
                } catch {
                    /* swallow */
                }
                return;
            }
        }

        // ServerSocket adapter — cloned verbatim from server.ts /ws/events block.
        const adapter = {
            get bufferedAmount() {
                return socket.bufferedAmount;
            },
            send: (data: string) => socket.send(data),
            close: (code?: number, reason?: string) => socket.close(code, reason),
            on: (event: 'message' | 'close' | 'error', cb: (arg: never) => void) => {
                if (event === 'message') {
                    socket.on('message', (data: Buffer) =>
                        (cb as (d: unknown) => void)(data.toString('utf8')),
                    );
                } else if (event === 'close') {
                    socket.on('close', () => (cb as () => void)());
                } else {
                    socket.on('error', (err: Error) =>
                        (cb as (e: Error) => void)(err),
                    );
                }
            },
        };

        firehoseHub.onConnect(adapter);
    });
}
