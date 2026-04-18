/**
 * Wire protocol for /ws/events — the WebSocket endpoint mounted in Plan 03.
 *
 * JSON over text frames. All frames carry a `type` discriminator. Keep this
 * file free of runtime imports beyond `type` imports — it is consumed by
 * WsHub, integration tests, and eventually the dashboard WS client.
 *
 * Locked by .planning/phases/02-wshub-ws-events-endpoint/02-CONTEXT.md §Wire protocol.
 */

import type { AuditEntry } from '../audit/types.js';

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

// ── Runtime guard ──────────────────────────────────────────────────────────

/**
 * Best-effort parse of a client-sent frame. Accepts either a string
 * (JSON-encoded) or an already-parsed object. Returns the narrowed
 * ClientFrame or null. NEVER throws — a malformed frame is a soft error
 * that the WsHub logs and ignores.
 */
export function parseClientFrame(raw: unknown): ClientFrame | null {
    let obj: unknown = raw;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (obj === null || typeof obj !== 'object') return null;
    const candidate = obj as { type?: unknown } & Record<string, unknown>;
    switch (candidate.type) {
        case 'subscribe': {
            const filters = candidate.filters;
            if (filters !== undefined) {
                if (!Array.isArray(filters)) return null;
                if (!filters.every((f) => typeof f === 'string')) return null;
            }
            const sinceId = candidate.sinceId;
            if (sinceId !== undefined && typeof sinceId !== 'number') return null;
            return {
                type: 'subscribe',
                filters: filters as string[] | undefined,
                sinceId: sinceId as number | undefined,
            };
        }
        case 'unsubscribe':
            return { type: 'unsubscribe' };
        case 'ping':
        case 'pong': {
            const t = candidate.t;
            if (typeof t !== 'number') return null;
            return { type: candidate.type, t };
        }
        default:
            return null;
    }
}
