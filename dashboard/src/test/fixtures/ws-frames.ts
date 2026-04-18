/**
 * Canonical ws-protocol fixtures for dashboard tests.
 *
 * Shape PARITY with `grid/src/api/ws-protocol.ts` (ServerFrame union) and
 * `grid/src/audit/types.ts` (AuditEntry) is load-bearing. Dashboard code
 * MUST NOT cross-import from grid/ — this file is the single source of
 * truth inside the dashboard workspace.
 *
 * Plan 03 will re-land these types inside `dashboard/src/lib/ws-protocol.ts`
 * with a SYNC comment; until then, these local interfaces are the contract.
 *
 * Consumed by: all downstream plans (03, 04, 05, 06).
 */

// ── Mirror of grid/src/audit/types.ts ────────────────────────────────────

export interface AuditEntry {
    id?: number;
    eventType: string;
    actorDid: string;
    targetDid?: string;
    payload: Record<string, unknown>;
    prevHash: string;
    eventHash: string;
    createdAt: number;
}

// ── Mirror of grid/src/api/ws-protocol.ts ServerFrame union ──────────────

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

// ── Fixture state ────────────────────────────────────────────────────────

let idCounter = 0;

/** Reset the auto-increment id counter between tests for deterministic ids. */
export function resetFixtureIds(): void {
    idCounter = 0;
}

/** Deterministic 64-char hex filler for prev/event hashes in fixtures. */
function hashFiller(seed: string): string {
    // Deterministic but not cryptographic — fixtures only.
    let out = '';
    let i = 0;
    while (out.length < 64) {
        out += (seed.charCodeAt(i % seed.length) ^ (i * 31)).toString(16).padStart(2, '0');
        i += 1;
    }
    return out.slice(0, 64);
}

// ── Builders ─────────────────────────────────────────────────────────────

export function makeHello(overrides: Partial<HelloFrame> = {}): HelloFrame {
    return {
        type: 'hello',
        serverTime: Date.now(),
        gridName: 'test-grid',
        lastEntryId: 0,
        ...overrides,
    };
}

export function makeAuditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
    idCounter += 1;
    const id = overrides.id ?? idCounter;
    const eventType = overrides.eventType ?? 'tick';
    const actorDid = overrides.actorDid ?? 'system';
    const createdAt = overrides.createdAt ?? Date.now();
    return {
        id,
        eventType,
        actorDid,
        payload: overrides.payload ?? {},
        prevHash: overrides.prevHash ?? '0'.repeat(64),
        eventHash: overrides.eventHash ?? hashFiller(`${id}:${eventType}:${actorDid}`),
        createdAt,
        ...(overrides.targetDid !== undefined ? { targetDid: overrides.targetDid } : {}),
    };
}

export function makeEvent(entryOverrides: Partial<AuditEntry> = {}): EventFrame {
    return { type: 'event', entry: makeAuditEntry(entryOverrides) };
}

export function makeDropped(sinceId: number, latestId: number): DroppedFrame {
    return { type: 'dropped', sinceId, latestId };
}

export function makeTickEntry(tick: number, tickRateMs = 30_000): AuditEntry {
    return makeAuditEntry({
        eventType: 'tick',
        actorDid: 'system',
        payload: { tick, epoch: 0, tickRateMs, timestamp: Date.now() },
    });
}

export function makeNousMovedEntry(
    nousDid: string,
    name: string,
    fromRegion: string,
    toRegion: string,
    tick = 1,
): AuditEntry {
    return makeAuditEntry({
        eventType: 'nous.moved',
        actorDid: nousDid,
        payload: { name, fromRegion, toRegion, travelCost: 1, tick },
    });
}
