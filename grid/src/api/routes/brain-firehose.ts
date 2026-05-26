/**
 * GET /api/v1/brain/firehose — WebSocket upgrade route for the Brain firehose.
 *
 * Phase 38 WIRE-01 (WSS half) + WIRE-05 (per-DID filter).
 *
 * Must be registered INSIDE the fastify-websocket plugin scope (see server.ts).
 * Shares the same WsFirehoseHub instance as /api/v1/audit/firehose — per-DID
 * relevance filtering is applied in ClientConnection.trySend via isRelevantFor
 * (firehose-filter.ts). No filtering is done here.
 *
 * Auth is MANDATORY — no GRID_WS_SECRET shared-secret fallback. The Brain
 * presents a valid EdDSA bearer JWT (verified by tryDid) and MUST resolve to
 * civic_member tier. Non-civic requests are rejected with close code 4401.
 */

import type { FastifyInstance } from 'fastify';
import type { WsFirehoseHub } from '../../audit/firehose-hub.js';
import { tryDid } from '../preHandlers/tryDid.js';
import type { BrainTokenStore } from '../../db/stores/brain-token-store.js';

type ServicesForBrainFirehose = {
    didStore?: { isRevoked(did: string): boolean | Promise<boolean> };
    brainTokenStore?: BrainTokenStore;
};

export function registerBrainFirehoseRoute(
    instance: FastifyInstance,
    firehoseHub: WsFirehoseHub,
    services?: ServicesForBrainFirehose,
): void {
    instance.get('/api/v1/brain/firehose', { websocket: true }, async (socket, req) => {
        // Resolve DIDContext from Authorization bearer.
        // tryDid (Plan 38-02) handles EdDSA Brain JWTs via brain_tokens lookup.
        const didContext = await tryDid(req, {
            didStore: services?.didStore,
            brainTokenStore: services?.brainTokenStore,
        });

        // Brain firehose requires civic_member tier — no visitor / anonymous access.
        if (!didContext || didContext.tier !== 'civic_member') {
            try {
                socket.close(4401, 'civic_did_required');
            } catch {
                /* swallow */
            }
            return;
        }

        // ServerSocket adapter — same shape as audit-firehose.ts.
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

        // Shared hub instance — same audit listener, same firehose.
        // Per-DID filter is applied automatically in ClientConnection.trySend.
        firehoseHub.onConnect(adapter, didContext);
    });
}
