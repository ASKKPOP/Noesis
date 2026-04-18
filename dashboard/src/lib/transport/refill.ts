/**
 * refillFromDropped — REST backfill triggered by a DroppedFrame.
 *
 * When the server emits `{type:'dropped', sinceId, latestId}`, it means the
 * client's resume point fell outside the ring-buffer replay window and the
 * server cannot replay over the socket. This module closes the gap by
 * paginating /api/v1/audit/trail between (sinceId, latestId].
 *
 * Concurrency contract: a second call with the same (origin, sinceId,
 * latestId) key while the first is pending SHARES the same Promise —
 * preventing stampede when multiple components react to the same frame.
 */

import type { AuditEntry } from '../protocol/audit-types';
import type { DroppedFrame } from '../protocol/ws-protocol';

export class RefillError extends Error {
    override readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'RefillError';
        this.cause = cause;
    }
}

// Max page size matches grid/src/api/server.ts audit trail behavior
// (default limit=50, but the service accepts up to arbitrary — we cap at 1000
// to keep any single response bounded and aligned with common server paging).
const PAGE_LIMIT = 1000;

/**
 * Module-level coalesce map. A second call with the same key while the first
 * is pending returns the SAME Promise — both callers receive the identical
 * resolved value. Prevents stampede when multiple components react to the
 * same DroppedFrame.
 */
const inFlight = new Map<string, Promise<AuditEntry[]>>();

export function refillFromDropped(
    frame: Pick<DroppedFrame, 'sinceId' | 'latestId'>,
    gridOrigin: string,
    onEntries: (entries: AuditEntry[]) => void,
    signal?: AbortSignal,
): Promise<AuditEntry[]> {
    if (frame.latestId === frame.sinceId) {
        onEntries([]);
        return Promise.resolve([]);
    }
    if (frame.latestId < frame.sinceId) {
        return Promise.reject(
            new RefillError(
                `latestId < sinceId (${frame.latestId} < ${frame.sinceId})`,
            ),
        );
    }

    const key = `${gridOrigin}|${frame.sinceId}|${frame.latestId}`;
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = runRefill(frame, gridOrigin, onEntries, signal);
    inFlight.set(key, promise);
    // Clear the map entry once the promise settles so a later refill with
    // the same key is allowed to re-fetch (e.g. transient failure retry).
    promise
        .finally(() => {
            inFlight.delete(key);
        })
        .catch(() => {
            // Swallow — the real rejection is still propagated to callers via
            // the original `promise` returned below.
        });
    return promise;
}

async function runRefill(
    frame: Pick<DroppedFrame, 'sinceId' | 'latestId'>,
    gridOrigin: string,
    onEntries: (entries: AuditEntry[]) => void,
    signal?: AbortSignal,
): Promise<AuditEntry[]> {
    const collected: AuditEntry[] = [];
    let cursor = frame.sinceId;

    while (cursor < frame.latestId) {
        const remaining = frame.latestId - cursor;
        const limit = Math.min(PAGE_LIMIT, remaining);
        const url = `${gridOrigin}/api/v1/audit/trail?offset=${cursor}&limit=${limit}`;

        let response: Response;
        try {
            response = await fetch(url, signal ? { signal } : {});
        } catch (err) {
            throw new RefillError(`Refill fetch failed at offset=${cursor}`, err);
        }
        if (!response.ok) {
            throw new RefillError(
                `Refill HTTP ${response.status} at offset=${cursor}`,
            );
        }

        let body: { entries: AuditEntry[]; total: number };
        try {
            body = (await response.json()) as { entries: AuditEntry[]; total: number };
        } catch (err) {
            throw new RefillError(`Refill JSON parse failed at offset=${cursor}`, err);
        }
        if (!Array.isArray(body.entries)) {
            throw new RefillError(`Refill response malformed at offset=${cursor}`);
        }

        collected.push(...body.entries);
        if (body.entries.length === 0) {
            // Server has no more entries in this range — stop to avoid an
            // infinite loop if the ring buffer trimmed below our target.
            break;
        }
        cursor += body.entries.length;
    }

    onEntries(collected);
    return collected;
}

/** Test-only helper: reset the coalesce map between tests. */
export function __resetRefillState(): void {
    inFlight.clear();
}
