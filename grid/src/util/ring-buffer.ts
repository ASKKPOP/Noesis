/**
 * Bounded FIFO with drop-oldest-on-overflow semantics (stub — pending TDD GREEN).
 */

export class RingBuffer<T> {
    constructor(_capacity: number) {
        throw new Error('RingBuffer not yet implemented');
    }

    push(_item: T): T | null {
        throw new Error('RingBuffer.push not yet implemented');
    }

    drain(): T[] {
        throw new Error('RingBuffer.drain not yet implemented');
    }

    get size(): number { throw new Error('not implemented'); }
    get capacity(): number { throw new Error('not implemented'); }
    get isFull(): boolean { throw new Error('not implemented'); }
}
