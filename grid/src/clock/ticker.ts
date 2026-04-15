/**
 * World Clock — emits ticks at a configurable rate.
 *
 * Each tick represents one unit of Grid time.
 * Epochs group ticks into larger cycles (default: 100 ticks per epoch).
 */

import type { ClockState, TickEvent, TickListener } from './types.js';

export interface TickerConfig {
    tickRateMs?: number;   // Milliseconds between ticks (default: 30000)
    ticksPerEpoch?: number; // Ticks per epoch (default: 100)
}

export class WorldClock {
    private tick = 0;
    private epoch = 0;
    private readonly tickRateMs: number;
    private readonly ticksPerEpoch: number;
    private readonly listeners: Set<TickListener> = new Set();
    private timer: ReturnType<typeof setInterval> | null = null;
    private startedAt = 0;

    constructor(config: TickerConfig = {}) {
        this.tickRateMs = config.tickRateMs ?? 30000;
        this.ticksPerEpoch = config.ticksPerEpoch ?? 100;
    }

    start(): void {
        if (this.timer) return; // Already running
        this.startedAt = Date.now();
        this.timer = setInterval(() => this.advance(), this.tickRateMs);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** Manually advance one tick (useful for testing). */
    advance(): TickEvent {
        this.tick++;
        if (this.tick > 0 && this.tick % this.ticksPerEpoch === 0) {
            this.epoch++;
        }

        const event: TickEvent = {
            tick: this.tick,
            epoch: this.epoch,
            timestamp: Date.now(),
        };

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (e) {
                // Don't let a listener crash the clock
            }
        }

        return event;
    }

    onTick(listener: TickListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    get state(): ClockState {
        return {
            tick: this.tick,
            epoch: this.epoch,
            tickRateMs: this.tickRateMs,
            startedAt: this.startedAt,
        };
    }

    get running(): boolean {
        return this.timer !== null;
    }

    get currentTick(): number {
        return this.tick;
    }

    get currentEpoch(): number {
        return this.epoch;
    }
}
