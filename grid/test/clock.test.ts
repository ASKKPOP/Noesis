import { describe, it, expect, afterEach } from 'vitest';
import { WorldClock } from '../src/clock/ticker.js';

describe('WorldClock', () => {
    let clock: WorldClock;

    afterEach(() => {
        clock?.stop();
    });

    it('starts at tick 0, epoch 0', () => {
        clock = new WorldClock();
        expect(clock.currentTick).toBe(0);
        expect(clock.currentEpoch).toBe(0);
        expect(clock.running).toBe(false);
    });

    it('advance() increments tick', () => {
        clock = new WorldClock();
        const event = clock.advance();
        expect(event.tick).toBe(1);
        expect(event.epoch).toBe(0);
        expect(clock.currentTick).toBe(1);
    });

    it('advance() increments epoch at ticksPerEpoch boundary', () => {
        clock = new WorldClock({ ticksPerEpoch: 3 });
        clock.advance(); // tick 1
        clock.advance(); // tick 2
        expect(clock.currentEpoch).toBe(0);
        clock.advance(); // tick 3 → epoch 1
        expect(clock.currentTick).toBe(3);
        expect(clock.currentEpoch).toBe(1);
    });

    it('notifies listeners on advance', () => {
        clock = new WorldClock();
        const events: number[] = [];
        clock.onTick(e => events.push(e.tick));
        clock.advance();
        clock.advance();
        expect(events).toEqual([1, 2]);
    });

    it('unsubscribe removes listener', () => {
        clock = new WorldClock();
        const events: number[] = [];
        const unsub = clock.onTick(e => events.push(e.tick));
        clock.advance();
        unsub();
        clock.advance();
        expect(events).toEqual([1]);
    });

    it('listener exceptions do not crash the clock', () => {
        clock = new WorldClock();
        clock.onTick(() => { throw new Error('boom'); });
        const events: number[] = [];
        clock.onTick(e => events.push(e.tick));
        clock.advance();
        expect(events).toEqual([1]);
    });

    it('start() / stop() toggle running state', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        expect(clock.running).toBe(false);
        clock.start();
        expect(clock.running).toBe(true);
        clock.stop();
        expect(clock.running).toBe(false);
    });

    it('start() is idempotent', () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        clock.start();
        clock.start(); // should not create second timer
        expect(clock.running).toBe(true);
        clock.stop();
        expect(clock.running).toBe(false);
    });

    it('state returns full clock state', () => {
        clock = new WorldClock({ tickRateMs: 5000, ticksPerEpoch: 50 });
        clock.advance();
        const s = clock.state;
        expect(s.tick).toBe(1);
        expect(s.epoch).toBe(0);
        expect(s.tickRateMs).toBe(5000);
    });

    it('tick event includes timestamp', () => {
        clock = new WorldClock();
        const before = Date.now();
        const event = clock.advance();
        expect(event.timestamp).toBeGreaterThanOrEqual(before);
        expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });
});
