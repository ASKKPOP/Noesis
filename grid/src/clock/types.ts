/**
 * Clock types — world time for the Grid.
 */

export interface ClockState {
    tick: number;
    epoch: number;
    tickRateMs: number;
    startedAt: number; // Unix timestamp
}

export interface TickEvent {
    tick: number;
    epoch: number;
    timestamp: number;
}

export type TickListener = (event: TickEvent) => void;
