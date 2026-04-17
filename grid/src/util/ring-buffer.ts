/**
 * Bounded FIFO with drop-oldest-on-overflow semantics.
 *
 * Used by Phase 2 WsHub to provide per-client backpressure: each client
 * gets its own RingBuffer, and on overflow the oldest undelivered event
 * is discarded (the client is expected to refill via REST /api/v1/audit/trail).
 *
 * Not thread-safe; intended for single-threaded Node.js event loop use.
 */
export class RingBuffer<T> {
    private readonly items: T[] = [];
    private readonly _capacity: number;

    constructor(capacity: number) {
        if (!Number.isInteger(capacity) || capacity <= 0) {
            throw new Error(`RingBuffer capacity must be a positive integer, got ${capacity}`);
        }
        this._capacity = capacity;
    }

    /**
     * Append item. If buffer is full, evicts and returns the oldest item;
     * otherwise returns null.
     */
    push(item: T): T | null {
        let evicted: T | null = null;
        if (this.items.length >= this._capacity) {
            evicted = this.items.shift() ?? null;
        }
        this.items.push(item);
        return evicted;
    }

    /** Returns all buffered items in FIFO order and empties the buffer. */
    drain(): T[] {
        const out = this.items.slice();
        this.items.length = 0;
        return out;
    }

    get size(): number { return this.items.length; }
    get capacity(): number { return this._capacity; }
    get isFull(): boolean { return this.items.length >= this._capacity; }
}
