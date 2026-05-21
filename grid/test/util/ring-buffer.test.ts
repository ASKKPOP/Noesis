import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../src/util/ring-buffer.js';

describe('RingBuffer', () => {
    describe('existing behaviour', () => {
        it('push returns null when not full', () => {
            const buf = new RingBuffer<number>(3);
            expect(buf.push(1)).toBeNull();
        });

        it('push returns evicted item when full', () => {
            const buf = new RingBuffer<number>(2);
            buf.push(1);
            buf.push(2);
            expect(buf.push(3)).toBe(1);
        });

        it('drain returns items in FIFO order and empties buffer', () => {
            const buf = new RingBuffer<number>(3);
            buf.push(1);
            buf.push(2);
            buf.push(3);
            expect(buf.drain()).toEqual([1, 2, 3]);
            expect(buf.size).toBe(0);
        });
    });

    describe('peek', () => {
        it('returns items in FIFO order without draining', () => {
            const buf = new RingBuffer<number>(3);
            buf.push(1);
            buf.push(2);
            buf.push(3);
            const snapshot = buf.peek();
            expect(snapshot).toEqual([1, 2, 3]);
            expect(buf.size).toBe(3);
        });

        it('does not empty the buffer — subsequent drain sees identical items', () => {
            const buf = new RingBuffer<string>(4);
            buf.push('a');
            buf.push('b');
            buf.peek(); // should not drain
            const drained = buf.drain();
            expect(drained).toEqual(['a', 'b']);
        });

        it('consecutive peek() calls return identical results', () => {
            const buf = new RingBuffer<number>(3);
            buf.push(10);
            buf.push(20);
            expect(buf.peek()).toEqual(buf.peek());
        });

        it('returns empty array on empty buffer', () => {
            const buf = new RingBuffer<number>(5);
            expect(buf.peek()).toEqual([]);
        });

        it('returns a defensive copy — mutating the result does not affect buffer', () => {
            const buf = new RingBuffer<number>(3);
            buf.push(1);
            buf.push(2);
            const snap = buf.peek();
            snap.push(99); // mutate the snapshot
            expect(buf.size).toBe(2);
            expect(buf.peek()).toEqual([1, 2]);
        });
    });
});
