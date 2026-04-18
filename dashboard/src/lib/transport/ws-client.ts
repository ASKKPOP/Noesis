/**
 * WsClient — owns the browser-side WebSocket lifecycle for /ws/events.
 *
 * Responsibilities:
 *   1. Connect and send a `subscribe` frame on every (re)connect, carrying
 *      `lastSeenId` so the server can replay missed events from the ring
 *      buffer (or emit `dropped` when we're outside the replay window).
 *   2. Dispatch incoming frames to typed handlers (hello/event/dropped/bye
 *      plus a stateChange notifier for UI reactivity).
 *   3. Reconnect with full-jitter exponential backoff on unexpected close,
 *      incrementing `reconnectAttempt` until a successful open resets it.
 *   4. Honor `bye` frames as a server-initiated halt — do NOT reconnect
 *      (bye is "I'm shutting down cleanly", not "network blip").
 *   5. Respond to server `ping` with a matching `pong` (echo `t`).
 *   6. Expose `bumpLastSeenId` so the refill module can advance the
 *      resume pointer after a successful REST backfill.
 *
 * Consumed by: dashboard/src/app/** (Plans 04–06) via a React hook wrapper.
 */

import type {
    AuditEntry,
} from '../protocol/audit-types';
import type {
    ByeFrame,
    DroppedFrame,
    EventFrame,
    HelloFrame,
    PingFrame,
    ServerFrame,
} from '../protocol/ws-protocol';
import { nextDelayMs } from './backoff';

// ── Public types ───────────────────────────────────────────────────────────

export interface WsClientOptions {
    /** WebSocket URL, e.g. ws://localhost:8080/ws/events */
    url: string;
    /** Optional allowlist-glob filters; undefined/empty means all allowlisted */
    filters?: string[];
    /**
     * Test seam — defaults to globalThis.WebSocket. Tests pass MockWebSocket.
     * The factory MUST return an object shaped like the browser WebSocket
     * (readyState, send, close, onopen/onmessage/onclose/onerror).
     */
    wsFactory?: (url: string) => WebSocket;
    /**
     * Optional bearer token for dev-mode auth. When set, appended as
     * `?token=<token>` query param to `url` (matches grid/src/api/server.ts:147).
     */
    authToken?: string;
    /** Called on malformed frames, parse errors, or send failures. */
    onError?: (err: Error) => void;
}

export type WsPhase = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'halted' | 'closed';

export interface WsClientState {
    phase: WsPhase;
    gridName: string | null;
    lastSeenId: number;
    reconnectAttempt: number;
}

export type WsEventMap = {
    hello: HelloFrame;
    event: AuditEntry;
    dropped: DroppedFrame;
    bye: ByeFrame;
    stateChange: WsClientState;
};

type Handler<K extends keyof WsEventMap> = (payload: WsEventMap[K]) => void;

// ── Implementation ─────────────────────────────────────────────────────────

export class WsClient {
    private readonly opts: WsClientOptions;
    private readonly wsFactory: (url: string) => WebSocket;
    private socket: WebSocket | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private halted = false;
    private readonly state_: WsClientState = {
        phase: 'idle',
        gridName: null,
        lastSeenId: 0,
        reconnectAttempt: 0,
    };
    private readonly handlers: { [K in keyof WsEventMap]: Set<Handler<K>> } = {
        hello: new Set(),
        event: new Set(),
        dropped: new Set(),
        bye: new Set(),
        stateChange: new Set(),
    };

    constructor(opts: WsClientOptions) {
        this.opts = opts;
        this.wsFactory =
            opts.wsFactory ??
            ((url: string) => new (globalThis as { WebSocket: new (url: string) => WebSocket }).WebSocket(url));
    }

    /** Current state snapshot — readonly. */
    get state(): Readonly<WsClientState> {
        return this.state_;
    }

    connect(): void {
        if (this.state_.phase === 'closed' || this.state_.phase === 'halted') {
            // Reviving a halted/closed client is a programming error — drop it.
            this.emitError(
                new Error(`WsClient.connect() called on terminal phase "${this.state_.phase}"`),
            );
            return;
        }
        this.openSocket();
    }

    /** Intentional shutdown — halt reconnects, close socket with 1000. */
    close(): void {
        this.clearReconnectTimer();
        this.halted = true;
        this.setPhase('closed');
        if (this.socket) {
            const s = this.socket;
            // Detach listeners before closing so our onclose handler doesn't
            // try to schedule a reconnect (halted flag would block it anyway,
            // but this is belt-and-braces).
            s.onopen = null;
            s.onmessage = null;
            s.onclose = null;
            s.onerror = null;
            try {
                s.close(1000, 'client close');
            } catch {
                // Socket already CLOSED — ignore.
            }
            this.socket = null;
        }
    }

    on<K extends keyof WsEventMap>(type: K, handler: Handler<K>): () => void {
        this.handlers[type].add(handler as never);
        return () => {
            this.handlers[type].delete(handler as never);
        };
    }

    /**
     * Called by the refill module after a successful REST backfill to advance
     * the resume pointer. Monotonic: lower values are ignored.
     */
    bumpLastSeenId(id: number): void {
        if (id > this.state_.lastSeenId) {
            this.state_.lastSeenId = id;
            this.emit('stateChange', { ...this.state_ });
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────

    private openSocket(): void {
        this.setPhase('connecting');
        const url = this.opts.authToken
            ? `${this.opts.url}${this.opts.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.opts.authToken)}`
            : this.opts.url;

        let socket: WebSocket;
        try {
            socket = this.wsFactory(url);
        } catch (err) {
            this.emitError(err instanceof Error ? err : new Error(String(err)));
            this.scheduleReconnect();
            return;
        }
        this.socket = socket;

        socket.onopen = () => this.handleOpen();
        socket.onmessage = (ev: MessageEvent) => this.handleMessage(ev);
        socket.onclose = () => this.handleClose();
        socket.onerror = () => {
            // Browser WS does not surface useful error info; log + rely on
            // the subsequent onclose for reconnect scheduling.
            this.emitError(new Error('WebSocket error event'));
        };
    }

    private handleOpen(): void {
        this.setPhase('open');
        this.state_.reconnectAttempt = 0;
        // Subscribe frame — always carries lastSeenId for resume.
        const frame: { type: 'subscribe'; filters?: string[]; sinceId: number } = {
            type: 'subscribe',
            sinceId: this.state_.lastSeenId,
        };
        if (this.opts.filters && this.opts.filters.length > 0) {
            frame.filters = this.opts.filters;
        }
        this.sendSafe(JSON.stringify(frame));
    }

    private handleMessage(ev: MessageEvent): void {
        let frame: ServerFrame;
        try {
            const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
            if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
                throw new Error('frame missing type');
            }
            frame = parsed as ServerFrame;
        } catch (err) {
            this.emitError(
                new Error(
                    `Malformed server frame: ${err instanceof Error ? err.message : String(err)}`,
                ),
            );
            return;
        }
        switch (frame.type) {
            case 'hello':
                this.state_.gridName = frame.gridName;
                this.emit('hello', frame);
                this.emit('stateChange', { ...this.state_ });
                break;
            case 'event': {
                const entry = (frame as EventFrame).entry;
                if (typeof entry.id === 'number' && entry.id > this.state_.lastSeenId) {
                    this.state_.lastSeenId = entry.id;
                }
                this.emit('event', entry);
                this.emit('stateChange', { ...this.state_ });
                break;
            }
            case 'dropped':
                // Do NOT bump lastSeenId here — refill will do that via
                // bumpLastSeenId after the REST backfill succeeds.
                this.emit('dropped', frame as DroppedFrame);
                break;
            case 'ping':
                this.sendSafe(JSON.stringify({ type: 'pong', t: (frame as PingFrame).t }));
                break;
            case 'pong':
                // Server-initiated heartbeat echo — no action needed.
                break;
            case 'bye':
                this.halted = true;
                this.setPhase('halted');
                this.emit('bye', frame as ByeFrame);
                break;
            default: {
                // Exhaustiveness: any future frame type will land here.
                const _exhaustive: never = frame;
                this.emitError(new Error(`Unknown frame type: ${JSON.stringify(_exhaustive)}`));
            }
        }
    }

    private handleClose(): void {
        this.socket = null;
        if (this.halted || this.state_.phase === 'closed') {
            // bye received or user called close() — do not reconnect.
            return;
        }
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        this.setPhase('reconnecting');
        const delay = nextDelayMs(this.state_.reconnectAttempt);
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.state_.reconnectAttempt += 1;
            if (this.halted || this.state_.phase === 'closed') return;
            this.openSocket();
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private sendSafe(payload: string): void {
        const s = this.socket;
        if (!s) return;
        try {
            s.send(payload);
        } catch (err) {
            this.emitError(err instanceof Error ? err : new Error(String(err)));
        }
    }

    private setPhase(phase: WsPhase): void {
        if (this.state_.phase === phase) return;
        this.state_.phase = phase;
        this.emit('stateChange', { ...this.state_ });
    }

    private emit<K extends keyof WsEventMap>(type: K, payload: WsEventMap[K]): void {
        for (const handler of this.handlers[type]) {
            try {
                (handler as Handler<K>)(payload);
            } catch (err) {
                this.emitError(err instanceof Error ? err : new Error(String(err)));
            }
        }
    }

    private emitError(err: Error): void {
        if (this.opts.onError) {
            try {
                this.opts.onError(err);
            } catch {
                // Swallow — onError itself throwing is a user bug; don't crash.
            }
        }
    }
}
