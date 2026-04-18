/**
 * WsHub — owns all connected /ws/events clients. Subscribes ONCE to
 * AuditChain.onAppend, enforces the Phase 1 broadcast allowlist, and
 * fan-outs allowlisted entries to each ClientConnection for per-client
 * ring-buffered backpressure.
 *
 * Invariants (enforced by tests in grid/test/ws-hub.test.ts):
 *  1. The AuditChain listener NEVER calls ws.send — it only enqueues.
 *  2. A listener exception can never corrupt chain state (Phase 1
 *     already try/catches; we belt-and-suspenders here too).
 *  3. A slow client (high bufferedAmount) can NEVER delay a fast client.
 *  4. An entry whose eventType is not isAllowlisted() is dropped at the hub.
 *  5. close() is idempotent and leaves clients.size === 0.
 *  6. Resume: a {type:'subscribe', sinceId: N} frame replays missed allow-
 *     listed entries when gap ≤ REPLAY_WINDOW, else emits a single
 *     DroppedFrame telling the client to refill via REST. See PITFALLS §C6
 *     and ROADMAP Phase 2 Success Criterion #5.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { Unsubscribe } from '../audit/types.js';
import { isAllowlisted } from '../audit/broadcast-allowlist.js';
import { RingBuffer } from '../util/ring-buffer.js';
import {
    type HelloFrame,
    type EventFrame,
    type DroppedFrame,
    type ByeFrame,
    type ServerFrame,
    parseClientFrame,
} from './ws-protocol.js';

// ── Public types ─────────────────────────────────────────────────────────

export interface ServerSocket {
    readonly bufferedAmount: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', cb: (data: unknown) => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err: Error) => void): void;
}

export interface WsHubOptions {
    audit: AuditChain;
    gridName: string;
    bufferCapacity?: number;
    watermarkBytes?: number;
}

const DEFAULT_BUFFER_CAPACITY = 256;
const DEFAULT_WATERMARK_BYTES = 1_048_576;

/**
 * Maximum number of in-memory audit entries we will replay in response to
 * a {type:'subscribe', sinceId: N} frame. If the client is further behind
 * than this, we emit a single DroppedFrame and let them refill via the
 * REST /api/v1/audit/trail endpoint. Locked by 02-CONTEXT.md §Resume protocol.
 */
export const REPLAY_WINDOW = 512;

// ── Glob matching (exposed for tests) ────────────────────────────────────

/**
 * Minimal glob matcher supporting `*` wildcard within a single segment and
 * `**` as a cross-segment wildcard. Patterns are matched against
 * `entry.eventType`. Empty pattern matches everything.
 */
export function globMatch(pattern: string, eventType: string): boolean {
    if (pattern === '' || pattern === '*' || pattern === '**') return true;
    // Convert pattern to regex: escape regex chars, then * → [^.]*, ** → .*
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§§DOUBLESTAR§§')
        .replace(/\*/g, '[^.]*')
        .replace(/§§DOUBLESTAR§§/g, '.*');
    const re = new RegExp('^' + escaped + '$');
    return re.test(eventType);
}

// ── Internal: one connected client ───────────────────────────────────────

class ClientConnection {
    readonly socket: ServerSocket;
    readonly watermarkBytes: number;
    private readonly buffer: RingBuffer<AuditEntry>;
    private filters: string[] = []; // empty = accept all
    private droppedMin: number | null = null;
    private droppedMax: number | null = null;
    closed = false;

    constructor(socket: ServerSocket, watermarkBytes: number, bufferCapacity: number) {
        this.socket = socket;
        this.watermarkBytes = watermarkBytes;
        this.buffer = new RingBuffer<AuditEntry>(bufferCapacity);
    }

    setFilters(filters: string[] | undefined): void {
        // undefined or empty → accept everything. Normalize empty filter array
        // to the sentinel `undefined` semantics by leaving it as [] means
        // "match nothing" only after explicit unsubscribe.
        if (filters === undefined || filters.length === 0) {
            this.filters = [];
        } else {
            this.filters = [...filters];
        }
    }

    /** Mark filters as reject-all (unsubscribe). */
    setFiltersRejectAll(): void {
        this.filters = ['__no_match_reserved_sentinel__'];
    }

    matches(eventType: string): boolean {
        if (this.filters.length === 0) return true; // accept-all
        for (const p of this.filters) {
            if (globMatch(p, eventType)) return true;
        }
        return false;
    }

    /**
     * Best-effort send of a ServerFrame. Never throws — catches transport
     * errors (closed socket, serialization faults). Used for Hello, Bye,
     * Ping/Pong replies, and direct EventFrame sends on a non-backpressured
     * socket.
     */
    trySend(frame: ServerFrame): void {
        if (this.closed) return;
        try {
            this.socket.send(JSON.stringify(frame));
        } catch {
            // Swallow — a broken socket should not propagate into the hub's
            // audit listener. The 'close'/'error' handler will clean up.
        }
    }

    /**
     * Enqueue an entry for delivery. If the socket is drained and the buffer
     * empty, send synchronously; otherwise push into the ring buffer. On
     * overflow, track the dropped id range for a subsequent DroppedFrame.
     */
    enqueue(entry: AuditEntry): void {
        if (this.closed) return;

        const canDirectSend =
            this.buffer.size === 0 &&
            this.droppedMin === null &&
            this.socket.bufferedAmount < this.watermarkBytes;

        if (canDirectSend) {
            this.trySend({ type: 'event', entry });
            return;
        }

        const evicted = this.buffer.push(entry);
        if (evicted !== null) {
            const evictedId = evicted.id ?? 0;
            if (this.droppedMin === null || evictedId < this.droppedMin) {
                this.droppedMin = evictedId;
            }
            if (this.droppedMax === null || evictedId > this.droppedMax) {
                this.droppedMax = evictedId;
            }
        }

        this.scheduleDrain();
    }

    /**
     * Schedule an async drain attempt. In production this would hook the
     * socket's drain event; for now a microtask is fine and tests invoke
     * `tryDrain()` directly where needed.
     */
    private scheduleDrain(): void {
        queueMicrotask(() => this.tryDrain());
    }

    tryDrain(): void {
        if (this.closed) return;
        if (this.socket.bufferedAmount >= this.watermarkBytes) return;

        if (this.droppedMin !== null && this.droppedMax !== null) {
            const sinceId = this.droppedMin;
            const latestId = this.droppedMax;
            this.droppedMin = null;
            this.droppedMax = null;
            this.trySend({ type: 'dropped', sinceId, latestId });
            if (this.socket.bufferedAmount >= this.watermarkBytes) return;
        }

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

    /** Emit a single DroppedFrame directly (used by hub for stale-sinceId replay). */
    sendDropped(sinceId: number, latestId: number): void {
        this.trySend({ type: 'dropped', sinceId, latestId });
    }

    sendBye(reason: string): void {
        const bye: ByeFrame = { type: 'bye', reason };
        this.trySend(bye);
    }

    markClosed(): void {
        this.closed = true;
    }

    /**
     * Handle an inbound client frame. Silent on malformed input. Triggers the
     * hub's replay callback on subscribe frames carrying a sinceId.
     */
    handleClientMessage(raw: unknown, onReplayRequest: (sinceId: number) => void): void {
        const frame = parseClientFrame(raw);
        if (!frame) return;
        switch (frame.type) {
            case 'subscribe':
                this.setFilters(frame.filters);
                if (frame.sinceId !== undefined) {
                    onReplayRequest(frame.sinceId);
                }
                break;
            case 'unsubscribe':
                this.setFiltersRejectAll();
                break;
            case 'ping':
                this.trySend({ type: 'pong', t: frame.t });
                break;
            case 'pong':
                break;
        }
    }
}

// ── WsHub ────────────────────────────────────────────────────────────────

export class WsHub {
    private readonly audit: AuditChain;
    private readonly gridName: string;
    private readonly bufferCapacity: number;
    private readonly watermarkBytes: number;
    private readonly _clients: Set<ClientConnection> = new Set();
    private readonly unsubscribeAudit: Unsubscribe;
    private closing = false;

    constructor(opts: WsHubOptions) {
        this.audit = opts.audit;
        this.gridName = opts.gridName;
        this.bufferCapacity = opts.bufferCapacity ?? DEFAULT_BUFFER_CAPACITY;
        this.watermarkBytes = opts.watermarkBytes ?? DEFAULT_WATERMARK_BYTES;

        // Single subscription — enforced by acceptance criterion.
        this.unsubscribeAudit = this.audit.onAppend((entry) => this.onAuditEvent(entry));
    }

    get clientCount(): number {
        return this._clients.size;
    }

    get clients(): ReadonlySet<unknown> {
        return this._clients;
    }

    /** Attach a freshly-upgraded socket. Sends HelloFrame, wires handlers. */
    onConnect(socket: ServerSocket, _req?: { headers?: Record<string, unknown> }): void {
        if (this.closing) {
            try {
                socket.close(1001, 'shutting down');
            } catch {
                /* swallow */
            }
            return;
        }
        const client = new ClientConnection(socket, this.watermarkBytes, this.bufferCapacity);
        this._clients.add(client);

        const hello: HelloFrame = {
            type: 'hello',
            serverTime: Date.now(),
            gridName: this.gridName,
            lastEntryId: this.audit.length,
        };
        try {
            socket.send(JSON.stringify(hello));
        } catch {
            /* swallow */
        }

        socket.on('message', (raw) =>
            client.handleClientMessage(raw, (sinceId) => this.replayForClient(client, sinceId)),
        );
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
     * Bounded replay path for the resume protocol. Honors:
     *  - REPLAY_WINDOW (512): beyond this, emit a DroppedFrame instead.
     *  - The same isAllowlisted() gate used for live events.
     *  - The client's current topic filter (matches()).
     *  - Per-client backpressure (we enqueue through the normal path).
     */
    private replayForClient(client: ClientConnection, sinceId: number): void {
        if (client.closed) return;
        const head = this.audit.length;
        const gap = head - sinceId;
        if (gap <= 0) return;
        if (gap > REPLAY_WINDOW) {
            client.sendDropped(sinceId, head);
            return;
        }
        const entries = this.audit.all();
        for (const entry of entries) {
            const entryId = entry.id ?? 0;
            if (entryId <= sinceId) continue;
            if (!isAllowlisted(entry.eventType)) continue;
            if (!client.matches(entry.eventType)) continue;
            try {
                client.enqueue(entry);
            } catch {
                /* swallow */
            }
        }
    }

    /**
     * Called from the audit listener. Never awaits. Never throws.
     * Enforces the broadcast allowlist at the single fan-out point.
     */
    private onAuditEvent(entry: AuditEntry): void {
        if (!isAllowlisted(entry.eventType)) return;
        for (const client of this._clients) {
            if (!client.matches(entry.eventType)) continue;
            try {
                client.enqueue(entry);
            } catch {
                /* swallow */
            }
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

        for (const client of this._clients) {
            client.sendBye('shutting down');
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
