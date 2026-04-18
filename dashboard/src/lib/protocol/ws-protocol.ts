/**
 * SYNC: grid/src/api/ws-protocol.ts
 *
 * Wire protocol for /ws/events. The dashboard consumes ServerFrame and
 * emits ClientFrame. See 02-CONTEXT.md §Wire protocol for the locked spec.
 * Update this file in lockstep with the Grid-side original.
 *
 * Server-only runtime helpers are intentionally NOT mirrored — the dashboard
 * never parses a client frame off the wire; it only emits them.
 */

import type { AuditEntry } from './audit-types';

// ── Server → Client ────────────────────────────────────────────────────────

export interface HelloFrame {
    type: 'hello';
    serverTime: number;
    gridName: string;
    lastEntryId: number;
}

export interface EventFrame {
    type: 'event';
    entry: AuditEntry;
}

export interface DroppedFrame {
    type: 'dropped';
    sinceId: number;
    latestId: number;
}

export interface PingFrame {
    type: 'ping';
    t: number;
}

export interface PongFrame {
    type: 'pong';
    t: number;
}

export interface ByeFrame {
    type: 'bye';
    reason: string;
}

// ── Client → Server ────────────────────────────────────────────────────────

export interface SubscribeFrame {
    type: 'subscribe';
    filters?: string[];
    sinceId?: number;
}

export interface UnsubscribeFrame {
    type: 'unsubscribe';
}

// ── Unions ─────────────────────────────────────────────────────────────────

export type ServerFrame =
    | HelloFrame
    | EventFrame
    | DroppedFrame
    | PingFrame
    | PongFrame
    | ByeFrame;

export type ClientFrame =
    | SubscribeFrame
    | UnsubscribeFrame
    | PingFrame
    | PongFrame;
