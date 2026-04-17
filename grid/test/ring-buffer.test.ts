import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/util/ring-buffer.js';

describe('RingBuffer', () => {
    it('starts empty with reported capacity', () => {
        const rb = new RingBuffer<number>(3);
        expect(rb.size).toBe(0);
        expect(rb.capacity).toBe(3);
        expect(rb.isFull).toBe(false);
    });

    it('push into non-full buffer returns null', () => {
        const rb = new RingBuffer<number>(3);
        expect(rb.push(1)).toBeNull();
        expect(rb.size).toBe(1);
        expect(rb.isFull).toBe(false);
    });

    it('fills to capacity without dropping', () => {
        const rb = new RingBuffer<number>(3);
        expect(rb.push(1)).toBeNull();
        expect(rb.push(2)).toBeNull();
        expect(rb.push(3)).toBeNull();
        expect(rb.isFull).toBe(true);
        expect(rb.size).toBe(3);
    });

    it('push into full buffer drops oldest (FIFO) and returns it', () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1); rb.push(2); rb.push(3);
        expect(rb.push(4)).toBe(1);
        expect(rb.size).toBe(3);
        expect(rb.isFull).toBe(true);
    });

    it('drain returns items in FIFO order and empties', () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1); rb.push(2); rb.push(3);
        rb.push(4); // evicts 1; buffer now [2,3,4]
        expect(rb.drain()).toEqual([2, 3, 4]);
        expect(rb.size).toBe(0);
        expect(rb.isFull).toBe(false);
    });

    it('drain on empty buffer returns []', () => {
        const rb = new RingBuffer<number>(3);
        expect(rb.drain()).toEqual([]);
        expect(rb.size).toBe(0);
    });

    it('capacity boundary of 1 evicts on every push after the first', () => {
        const rb = new RingBuffer<number>(1);
        expect(rb.push(1)).toBeNull();
        expect(rb.isFull).toBe(true);
        expect(rb.push(2)).toBe(1);
        expect(rb.drain()).toEqual([2]);
    });

    it('can accept fresh inserts after drain', () => {
        const rb = new RingBuffer<number>(2);
        rb.push(1); rb.push(2);
        rb.drain();
        expect(rb.push(3)).toBeNull();
        expect(rb.push(4)).toBeNull();
        expect(rb.drain()).toEqual([3, 4]);
    });

    it('preserves object references across drain', () => {
        type Item = { id: number };
        const a: Item = { id: 1 };
        const b: Item = { id: 2 };
        const rb = new RingBuffer<Item>(2);
        rb.push(a); rb.push(b);
        const out = rb.drain();
        expect(out[0]).toBe(a);
        expect(out[1]).toBe(b);
    });

    it('rejects non-positive or non-integer capacity', () => {
        expect(() => new RingBuffer<number>(0)).toThrow();
        expect(() => new RingBuffer<number>(-1)).toThrow();
        expect(() => new RingBuffer<number>(1.5)).toThrow();
    });
});
