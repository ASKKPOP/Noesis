/**
 * MockWebSocket — a browser-API-shaped WebSocket double for dashboard tests.
 *
 * Mirrors `grid/test/ws-hub.test.ts` FakeSocket in spirit (test-only emit/on
 * hooks, no real network) but implements the BROWSER WebSocket surface
 * (readyState, send(data), addEventListener('open'|'message'|'close'|'error')
 * and on* assignments) so dashboard code that targets `window.WebSocket`
 * can be tested against the same contract as the server.
 *
 * SYNC note: do NOT import from `grid/src/...` — this module stays
 * self-contained in the dashboard workspace. Shape parity with
 * `grid/src/api/ws-protocol.ts` frames is enforced by manual review and
 * by a later Plan 03 SYNC header over `ws-frames.ts`.
 */

type WsEvent = 'open' | 'message' | 'close' | 'error';
type Listener = (event: Event | MessageEvent | CloseEvent) => void;

interface MockMessageEvent {
    readonly type: 'message';
    readonly data: string;
}

interface MockCloseEvent {
    readonly type: 'close';
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
}

export class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly CONNECTING = MockWebSocket.CONNECTING;
    readonly OPEN = MockWebSocket.OPEN;
    readonly CLOSING = MockWebSocket.CLOSING;
    readonly CLOSED = MockWebSocket.CLOSED;

    readonly url: string;
    readonly protocols: string | string[] | undefined;

    /** Every successful send is recorded so tests can assert wire traffic. */
    sent: string[] = [];

    /** Starts in CONNECTING per browser WS semantics; advance via emitOpen(). */
    readyState: number = MockWebSocket.CONNECTING;

    /** Assignable handler slots (browser API parity). */
    onopen: Listener | null = null;
    onmessage: Listener | null = null;
    onclose: Listener | null = null;
    onerror: Listener | null = null;

    private listeners: Record<WsEvent, Listener[]> = {
        open: [],
        message: [],
        close: [],
        error: [],
    };

    constructor(url: string, protocols?: string | string[]) {
        this.url = url;
        this.protocols = protocols;
    }

    // ── Browser WebSocket API ────────────────────────────────────────────

    addEventListener(type: WsEvent, listener: Listener): void {
        this.listeners[type].push(listener);
    }

    removeEventListener(type: WsEvent, listener: Listener): void {
        this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }

    send(data: string): void {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error(
                `MockWebSocket.send called while readyState=${this.readyState} (not OPEN)`,
            );
        }
        this.sent.push(data);
    }

    close(code = 1000, reason = ''): void {
        if (this.readyState === MockWebSocket.CLOSED) return;
        this.readyState = MockWebSocket.CLOSING;
        // Synchronous close in tests — real WS would flip to CLOSED async.
        this.emitClose(code, reason);
    }

    // ── Test-only drivers ────────────────────────────────────────────────

    /** Flip the socket to OPEN and fire the open event. */
    emitOpen(): void {
        this.readyState = MockWebSocket.OPEN;
        const event: Event = { type: 'open' } as Event;
        this.dispatch('open', event);
    }

    /**
     * Deliver a message. Object payloads are JSON-stringified to match the
     * wire format dashboard code will see (ws-protocol frames are text JSON).
     */
    emitMessage(data: unknown): void {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        const event: MockMessageEvent = { type: 'message', data: payload };
        this.dispatch('message', event as unknown as MessageEvent);
    }

    emitClose(code = 1000, reason = ''): void {
        this.readyState = MockWebSocket.CLOSED;
        const event: MockCloseEvent = {
            type: 'close',
            code,
            reason,
            wasClean: code === 1000,
        };
        this.dispatch('close', event as unknown as CloseEvent);
    }

    emitError(): void {
        const event: Event = { type: 'error' } as Event;
        this.dispatch('error', event);
    }

    // ── Private dispatch ─────────────────────────────────────────────────

    private dispatch(type: WsEvent, event: Event | MessageEvent | CloseEvent): void {
        const slotMap: Record<WsEvent, Listener | null> = {
            open: this.onopen,
            message: this.onmessage,
            close: this.onclose,
            error: this.onerror,
        };
        const slot = slotMap[type];
        if (slot) slot(event);
        for (const listener of [...this.listeners[type]]) {
            listener(event);
        }
    }
}
