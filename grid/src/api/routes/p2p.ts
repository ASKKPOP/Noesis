/**
 * Phase 42 P2P-01..03 — P2P signaling routes.
 *
 * POST /api/v1/p2p/announce           — civic_did_required (Brain JWT heartbeat, 5-min cadence)
 * GET  /api/v1/p2p/peers/:civicDid    — public (peer presence lookup)
 * POST /api/v1/p2p/signal/:peerDid    — civic_did_required (encrypted SDP relay OR close event)
 * GET  /api/v1/p2p/signal/inbox       — civic_did_required (drain encrypted SDP for caller)
 * GET  /api/v1/p2p/turn-credentials   — civic_did_required (HMAC-SHA1 short-lived TURN creds, FREE in v3.0)
 *
 * Audit emissions:
 *   - p2p.peer_announced     (every announce)
 *   - p2p.connection_opened  (first signal of a new connection_id)
 *   - p2p.connection_closed  (close event)
 *
 * Private WSS push (NOT audit, NOT allowlist):
 *   - p2p.signal_received (delivered to recipient Brain only via hub.pushSignalToDid)
 *
 * Security decisions:
 *   - D-42-02: offline peers return HTTP 404 {error:'peer_offline'} — NOT 200 {status:'offline'}
 *   - D-42-03: TURN is FREE in v3.0 — no Bios deduction
 *   - D-42-06: p2p.signal_received bypasses audit chain entirely
 *   - T-42-04-01: inbox drain scoped to bearer's DID — no cross-DID query param
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { createHash, randomUUID } from 'node:crypto';
import { appendP2pPeerAnnounced } from '../../audit/append-p2p-peer-announced.js';
import { appendP2pConnectionOpened } from '../../audit/append-p2p-connection-opened.js';
import { appendP2pConnectionClosed, type P2pCloseReason } from '../../audit/append-p2p-connection-closed.js';
import { SdpInboxStore } from '../../p2p/sdp-inbox-store.js';
import { generateTurnCredentials } from '../../p2p/turn-credentials.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9-]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSE_REASONS = new Set<string>(['completed', 'timeout', 'error', 'initiated']);

// Phase 42 — connection_id → tick at which p2p.connection_opened fired.
// Used at close time to compute duration_ticks = currentTick - openedAtTick.
// Process-scoped; Grid restart drops in-flight tracking (acceptable — Brain
// reconnect path issues a fresh offer/answer pair with a new connection_id).
const _openedAtTick = new Map<string, number>();

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

export async function registerP2pRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {

    // ── POST /api/v1/p2p/announce ────────────────────────────────────────────
    app.post('/api/v1/p2p/announce', async (req, reply) => {
        const p2p = services.p2pService;
        if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });

        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }

        const tick = tickFn();
        p2p.peerStore.announce(civicDid, tick);
        appendP2pPeerAnnounced(services.audit, {
            civic_did_hash: sha256Hex(civicDid),
            endpoint_hash: sha256Hex('online'),  // D-42-02 static sentinel
            tick,
        });
        return reply.code(200).send({ status: 'announced', next_announce_in: 300 });
    });

    // ── GET /api/v1/p2p/peers/:civicDid (public) ─────────────────────────────
    app.get<{ Params: { civicDid: string } }>('/api/v1/p2p/peers/:civicDid', async (req, reply) => {
        const p2p = services.p2pService;
        if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });

        const { civicDid } = req.params;
        if (!CIVIC_DID_RE.test(civicDid)) {
            return reply.code(400).send({ error: 'invalid_civic_did' });
        }
        const status = p2p.peerStore.getStatus(civicDid);
        // D-42-02: offline peers return 404 peer_offline — NOT 200 {status:'offline'}
        if (status.status === 'offline') {
            return reply.code(404).send({ error: 'peer_offline' });
        }
        return reply.code(200).send(status);
    });

    // ── POST /api/v1/p2p/signal/:peerDid ─────────────────────────────────────
    app.post<{
        Params: { peerDid: string };
        Body: {
            encrypted_blob?: string;
            event?: 'close';
            connection_id?: string;
            close_reason?: string;
        };
    }>('/api/v1/p2p/signal/:peerDid', async (req, reply) => {
        const p2p = services.p2pService;
        if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });
        const tickFn = services.currentTick;
        if (!tickFn) return reply.code(503).send({ error: 'clock_unavailable' });

        const fromDid = req.didContext?.did;
        if (!fromDid || !CIVIC_DID_RE.test(fromDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const { peerDid } = req.params;
        if (!CIVIC_DID_RE.test(peerDid)) {
            return reply.code(400).send({ error: 'invalid_peer_did' });
        }
        const tick = tickFn();
        const body = req.body ?? {};

        // Close event path
        if (body.event === 'close') {
            if (!body.connection_id || !UUID_RE.test(body.connection_id)) {
                return reply.code(400).send({ error: 'invalid_connection_id' });
            }
            if (!body.close_reason || !CLOSE_REASONS.has(body.close_reason)) {
                return reply.code(400).send({ error: 'invalid_close_reason' });
            }
            // Phase 42 — compute real duration from the open tick recorded when
            // p2p.connection_opened fired. Missing entry (e.g. Grid restart between
            // open and close) → duration_ticks = 0; audit event still fires with valid tuple.
            const openedAt = _openedAtTick.get(body.connection_id);
            _openedAtTick.delete(body.connection_id);
            const duration_ticks = openedAt !== undefined ? Math.max(0, tick - openedAt) : 0;
            appendP2pConnectionClosed(services.audit, {
                close_reason: body.close_reason as P2pCloseReason,
                connection_id: body.connection_id,
                duration_ticks,
                tick,
            });
            return reply.code(200).send({ status: 'closed' });
        }

        // Offer/answer relay path
        // T-42-04-02: validate base64 encoding
        if (!body.encrypted_blob || !BASE64_RE.test(body.encrypted_blob)) {
            return reply.code(400).send({ error: 'invalid_encrypted_blob' });
        }
        const connectionId = randomUUID();
        // Record open tick for duration_ticks computation at close time
        _openedAtTick.set(connectionId, tick);
        p2p.sdpInboxStore.push(peerDid, {
            connectionId,
            fromDid,
            encryptedBlob: body.encrypted_blob,
            expiresAt: SdpInboxStore.computeExpiresAt(),
        });
        // D-42-06: private per-DID push — bypasses audit chain entirely
        services.firehoseHub?.pushSignalToDid(peerDid, {
            type: 'p2p.signal_received',
            connection_id: connectionId,
            from_did: fromDid,
        });
        appendP2pConnectionOpened(services.audit, {
            connection_id: connectionId,
            from_did_hash: sha256Hex(fromDid),
            tick,
            to_did_hash: sha256Hex(peerDid),
        });
        return reply.code(200).send({ connection_id: connectionId });
    });

    // ── GET /api/v1/p2p/signal/inbox ─────────────────────────────────────────
    app.get('/api/v1/p2p/signal/inbox', async (req, reply) => {
        const p2p = services.p2pService;
        if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        // T-42-04-01: SECURITY — drain is scoped to caller's DID only (no peerDid param)
        const entries = p2p.sdpInboxStore.drain(civicDid);
        return reply.code(200).send({ signals: entries });
    });

    // ── GET /api/v1/p2p/turn-credentials ─────────────────────────────────────
    app.get('/api/v1/p2p/turn-credentials', async (req, reply) => {
        const p2p = services.p2pService;
        if (!p2p) return reply.code(503).send({ error: 'p2p_service_unavailable' });
        const civicDid = req.didContext?.did;
        if (!civicDid || !CIVIC_DID_RE.test(civicDid) || req.didContext?.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        // T-42-04-05: Civic-DID auth is the abuse gate
        // D-42-03: TURN is FREE in v3.0 — NO Bios deduction
        const creds = generateTurnCredentials(civicDid, p2p.turnSharedSecret);
        const turnHost = process.env.TURN_HOST ?? 'coturn';
        const turnPort = process.env.TURN_PORT ?? '3478';
        return reply.code(200).send({
            ...creds,
            uris: [
                `turn:${turnHost}:${turnPort}?transport=udp`,
                `turn:${turnHost}:${turnPort}?transport=tcp`,
                `stun:${turnHost}:${turnPort}`,
            ],
        });
    });
}
