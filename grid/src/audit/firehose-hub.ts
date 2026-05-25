/**
 * WsFirehoseHub — unfiltered AuditChain → WebSocket fan-out.
 *
 * Subscribes ONCE to AuditChain.onAppend and fans out every allowlisted
 * AuditEntry to ALL connected clients with NO per-client filter.
 *
 * Design decisions (D-25a-14):
 *  - Density-first: no sinceId replay, no DroppedFrame protocol.
 *  - Only allowlisted event types are forwarded (isAllowlisted() gate).
 *  - Per-client RingBuffer (capacity 256) for backpressure; drop-oldest on overflow.
 *  - Listener body is wrapped in try/catch (defense-in-depth — AuditChain already
 *    swallows listener exceptions, but we belt-and-suspenders here too).
 *
 * Compare to grid/src/api/ws-hub.ts (the /ws/events hub):
 *  - Filter logic stripped (no filters, matches(), setFilters*, globMatch).
 *  - sinceId replay logic stripped.
 *  - DroppedFrame tracking stripped.
 *  - ServerSocket imported from ws-hub.ts (not redeclared).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import type { Unsubscribe } from './types.js';
import { isAllowlisted } from './broadcast-allowlist.js';
import { RingBuffer } from '../util/ring-buffer.js';
import type { ServerSocket } from '../api/ws-hub.js';
import type { ByeFrame, ServerFrame } from '../api/ws-protocol.js';

/**
 * Phase 32 OBS-05 (D-32-A2): callbacks ClientConnection invokes when a send
 * succeeds or a ring-buffer overflow is detected. Hub passes closures bound
 * to its private metrics object — keeps ClientConnection from reaching into
 * hub internals.
 */
export interface HubMetricsSink {
    incrementSent: () => void;
    incrementDropped: () => void;
    touchLastFrame: () => void;
}

/**
 * Phase 32 OBS-05 (D-32-A4): plain-object snapshot of hub-level metrics.
 * Consumed by /health/detailed (Phase 32 Plan 04) and Steward UI (Phase 34).
 * Cross-phase API contract — additive changes only.
 */
export interface FirehoseStats {
    readonly client_count: number;
    readonly frames_sent_total: number;
    readonly frames_dropped_total: number;
    readonly last_frame_at: number | null;
    readonly watermark_bytes: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_BUFFER_CAPACITY = 256;
const DEFAULT_WATERMARK_BYTES = 1_048_576;

// ── Internal: one connected client ───────────────────────────────────────

class ClientConnection {
    readonly socket: ServerSocket;
    readonly watermarkBytes: number;
    private readonly buffer: RingBuffer<AuditEntry>;
    private readonly metrics: HubMetricsSink;
    closed = false;

    constructor(
        socket: ServerSocket,
        watermarkBytes: number,
        bufferCapacity: number,
        metrics: HubMetricsSink,  // D-32-A2
    ) {
        this.socket = socket;
        this.watermarkBytes = watermarkBytes;
        this.buffer = new RingBuffer<AuditEntry>(bufferCapacity);
        this.metrics = metrics;
    }

    /**
     * Best-effort send of a ServerFrame. Never throws.
     */
    trySend(frame: ServerFrame): void {
        if (this.closed) return;
        try {
            this.socket.send(JSON.stringify(frame));
            this.metrics.incrementSent();    // D-32-A3
            this.metrics.touchLastFrame();   // D-32-A3
        } catch {
            // Swallow — a broken socket should not propagate into the hub's
            // audit listener. Counters never incremented if send threw (R-32-03).
        }
    }

    /**
     * Enqueue an entry for delivery. If the socket is drained and the buffer
     * empty, send synchronously; otherwise push into the ring buffer. On
     * overflow, the oldest entry is evicted (drop-oldest semantics).
     */
    enqueue(entry: AuditEntry): void {
        if (this.closed) return;

        const canDirectSend =
            this.buffer.size === 0 &&
            this.socket.bufferedAmount < this.watermarkBytes;

        if (canDirectSend) {
            this.trySend({ type: 'event', entry });
            return;
        }

        // D-32-A1: at-capacity pre-check — drop counter fires ONLY from enqueue,
        // NEVER from tryDrain re-queue path (Pitfall 3). Drop is observable from
        // the public stats() surface.
        if (this.buffer.size === this.buffer.capacity) {
            this.metrics.incrementDropped();
        }
        this.buffer.push(entry);
        this.scheduleDrain();
    }

    private scheduleDrain(): void {
        queueMicrotask(() => this.tryDrain());
    }

    tryDrain(): void {
        if (this.closed) return;
        if (this.socket.bufferedAmount >= this.watermarkBytes) return;

        const items = this.buffer.drain();
        let i = 0;
        while (i < items.length && this.socket.bufferedAmount < this.watermarkBytes) {
            this.trySend({ type: 'event', entry: items[i] });
            i++;
        }
        for (; i < items.length; i++) {
            this.buffer.push(items[i]);
        }
    }

    sendBye(reason: string): void {
        const bye: ByeFrame = { type: 'bye', reason };
        this.trySend(bye);
    }

    markClosed(): void {
        this.closed = true;
    }
}

// ── WsFirehoseHub ─────────────────────────────────────────────────────────

export class WsFirehoseHub {
    private readonly audit: AuditChain;
    private readonly gridName: string;
    private readonly bufferCapacity: number;
    private readonly watermarkBytes: number;
    private readonly _clients: Set<ClientConnection> = new Set();
    private readonly unsubscribeAudit: Unsubscribe;
    private closing = false;

    // Phase 32 OBS-05 (D-32-A2): per-hub frame counters. Mutated only via the
    // HubMetricsSink callbacks passed into ClientConnection at construction time.
    private metrics = {
        frames_sent_total: 0,
        frames_dropped_total: 0,
        last_frame_at: null as number | null,
    };

    constructor(audit: AuditChain, gridName: string, bufferCapacity?: number, watermarkBytes?: number) {
        this.audit = audit;
        this.gridName = gridName;
        this.bufferCapacity = bufferCapacity ?? DEFAULT_BUFFER_CAPACITY;
        this.watermarkBytes = watermarkBytes ?? DEFAULT_WATERMARK_BYTES;

        // Single subscription — subscribed once on construction.
        this.unsubscribeAudit = this.audit.onAppend((entry) => this.onAuditEvent(entry));
    }

    get clientCount(): number {
        return this._clients.size;
    }

    /**
     * Phase 32 OBS-05 (D-32-A4): plain-object snapshot of hub-level metrics.
     * Read on every /health/detailed request (Plan 04). O(1) — never iterates clients.
     */
    stats(): FirehoseStats {
        return {
            client_count: this._clients.size,
            frames_sent_total: this.metrics.frames_sent_total,
            frames_dropped_total: this.metrics.frames_dropped_total,
            last_frame_at: this.metrics.last_frame_at,
            watermark_bytes: this.watermarkBytes,
        };
    }

    /**
     * Attach a freshly-upgraded socket. Sends HelloFrame, wires close/error handlers.
     */
    onConnect(socket: ServerSocket): void {
        if (this.closing) {
            try {
                socket.close(1001, 'shutting down');
            } catch {
                /* swallow */
            }
            return;
        }
        const client = new ClientConnection(
            socket,
            this.watermarkBytes,
            this.bufferCapacity,
            {
                // D-32-A2: closures bind to hub's private metrics object.
                incrementSent: () => { this.metrics.frames_sent_total++; },
                incrementDropped: () => { this.metrics.frames_dropped_total++; },
                touchLastFrame: () => { this.metrics.last_frame_at = Date.now(); },
            },
        );
        this._clients.add(client);

        // Hello frame — no lastEntryId (density-first design, no replay)
        try {
            socket.send(
                JSON.stringify({
                    type: 'hello',
                    serverTime: Date.now(),
                    gridName: this.gridName,
                }),
            );
        } catch {
            /* swallow */
        }

        socket.on('close', () => {
            client.markClosed();
            this._clients.delete(client);
        });
        socket.on('error', () => {
            client.markClosed();
            this._clients.delete(client);
        });
    }

    /**
     * Called from the audit listener. Never awaits. Never throws.
     * Enforces the broadcast allowlist — non-allowlisted entries are dropped.
     */
    private onAuditEvent(entry: AuditEntry): void {
        try {
            if (!isAllowlisted(entry.eventType)) return;
            for (const client of this._clients) {
                try {
                    client.enqueue(entry);
                } catch {
                    /* swallow per-client errors */
                }
            }
        } catch {
            /* swallow entire listener body (defense-in-depth) */
        }
    }

    async close(): Promise<void> {
        if (this.closing) return;
        this.closing = true;

        try {
            this.unsubscribeAudit();
        } catch {
            /* swallow */
        }

        // Two-phase: emit all byes, yield to let transport flush the frames,
        // then close sockets.
        for (const client of this._clients) {
            client.sendBye('shutting down');
        }
        await new Promise((r) => setImmediate(r));
        for (const client of this._clients) {
            try {
                client.socket.close(1001, 'shutting down');
            } catch {
                /* swallow */
            }
            client.markClosed();
        }
        this._clients.clear();
    }
}
