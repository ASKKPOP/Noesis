/**
 * FirehoseRow tests — the 28px mono line item rendered inside the Firehose
 * panel. Each test wraps the row in <StoresProvider> so usePresence() can
 * resolve names from the shared PresenceStore.
 *
 * Coverage:
 *   FR-1: timestamp (HH:MM:SS) + event-type badge + actor + payload preview
 *   FR-2: actor resolution falls back to did when presence has no name
 *   FR-3: non-tick actor uses presence name when available
 *   FR-4: badge uses the correct category (data-category attr stable for E2E)
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from '../use-stores';
import { FirehoseRow } from './firehose-row';
import {
    makeAuditEntry,
    makeTickEntry,
    resetFixtureIds,
} from '@/test/fixtures/ws-frames';

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

/**
 * Harness that renders an effect-free child that pre-populates presence
 * before the row renders, so usePresence() in <FirehoseRow> reads the
 * already-populated snapshot on first render.
 */
function PrePopulated({
    spawn,
    children,
}: {
    spawn?: Array<{ actorDid: string; name: string; region: string }>;
    children: ReactNode;
}) {
    const stores = useStores();
    if (spawn) {
        for (const s of spawn) {
            stores.presence.applyEvent(
                makeAuditEntry({
                    id: Math.floor(Math.random() * 1_000_000) + 100_000,
                    eventType: 'nous.spawned',
                    actorDid: s.actorDid,
                    payload: { name: s.name, region: s.region },
                }),
            );
        }
    }
    return <>{children}</>;
}

describe('FirehoseRow', () => {
    beforeEach(() => resetFixtureIds());

    it('FR-1: renders timestamp, event-type badge, actor, and payload preview', () => {
        // Pin a deterministic timestamp so formatTimestamp is testable.
        // Date-neutral: use a local Date built from components so the HH:MM:SS
        // rendered matches what we expect regardless of CI timezone.
        const d = new Date();
        d.setHours(12, 34, 56, 0);
        const entry = {
            ...makeTickEntry(42, 30_000),
            createdAt: d.getTime(),
        };
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });

        // Row carries the E2E selector
        const row = screen.getByTestId('firehose-row');
        expect(row).not.toBeNull();

        // Timestamp text present in HH:MM:SS form
        expect(row.textContent).toContain('12:34:56');

        // Event-type badge — tick → category 'lifecycle'
        const badge = screen.getByTestId('event-type-badge');
        expect(badge.textContent).toBe('tick');
        expect(badge.getAttribute('data-category')).toBe('lifecycle');

        // Actor column — tick.actorDid === 'system'
        expect(row.textContent).toContain('system');

        // Payload preview contains 'tick=42' token
        expect(row.textContent).toContain('tick=42');
    });

    it('FR-2: falls back to a truncated did when presence has no name', () => {
        const entry = makeAuditEntry({
            id: 7,
            eventType: 'nous.spoke',
            actorDid: 'did:nous:verylongnameindeed',
            payload: { message: 'hi there world' },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        const row = screen.getByTestId('firehose-row');
        // Not the full did, but the stripped prefix — verify "did:nous:" is gone
        expect(row.textContent).not.toContain('did:nous:');
        expect(row.textContent).toContain('verylongnameinde'); // truncated at 15 chars + ellipsis
    });

    it('FR-3: uses presence-resolved name when PresenceStore knows the actor', () => {
        const aliceDid = 'did:nous:alice';
        const entry = makeAuditEntry({
            id: 20,
            eventType: 'nous.spoke',
            actorDid: aliceDid,
            payload: { message: 'hello' },
        });
        render(
            <PrePopulated
                spawn={[{ actorDid: aliceDid, name: 'Alice', region: 'agora' }]}
            >
                <FirehoseRow entry={entry} />
            </PrePopulated>,
            { wrapper: Wrapper },
        );
        const row = screen.getByTestId('firehose-row');
        expect(row.textContent).toContain('Alice');
        // The resolved name replaces the did — we should not see any did prefix.
        expect(row.textContent).not.toContain('did:nous:');
    });

    it('FR-5: operator.nous_deleted row has text-red-400 line-through on actor column', () => {
        const entry = makeAuditEntry({
            id: 50,
            eventType: 'operator.nous_deleted',
            actorDid: 'did:nous:operator',
            payload: {
                tier: 'H5',
                action: 'delete',
                operator_id: 'op:00000000-0000-4000-8000-000000000000',
                target_did: 'did:noesis:alpha',
                pre_deletion_state_hash: 'a'.repeat(64),
            },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        // Actor column should have red + line-through
        const actorCol = screen.getByTestId('firehose-actor');
        expect(actorCol.className).toContain('text-red-400');
        expect(actorCol.className).toContain('line-through');
    });

    it('FR-6: operator.nous_deleted badge has bg-rose-900/20 text-rose-300', () => {
        const entry = makeAuditEntry({
            id: 51,
            eventType: 'operator.nous_deleted',
            actorDid: 'did:nous:operator',
            payload: { tier: 'H5', action: 'delete', target_did: 'did:noesis:alpha', operator_id: 'op:x', pre_deletion_state_hash: 'b'.repeat(64) },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        const badge = screen.getByTestId('event-type-badge');
        expect(badge.className).toContain('bg-rose-900/20');
        expect(badge.className).toContain('text-rose-300');
    });

    it('FR-7: operator.nous_deleted row has border-l-2 border-rose-900 left accent', () => {
        const entry = makeAuditEntry({
            id: 52,
            eventType: 'operator.nous_deleted',
            actorDid: 'did:nous:operator',
            payload: { tier: 'H5', action: 'delete', target_did: 'did:noesis:alpha', operator_id: 'op:x', pre_deletion_state_hash: 'c'.repeat(64) },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        const row = screen.getByTestId('firehose-row');
        expect(row.className).toContain('border-l-2');
        expect(row.className).toContain('border-rose-900');
    });

    it('FR-8: non-deleted event types do NOT receive destructive classes (regression guard)', () => {
        const entry = makeAuditEntry({
            id: 53,
            eventType: 'nous.spoke',
            actorDid: 'did:nous:alice',
            payload: { message: 'hi' },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        const row = screen.getByTestId('firehose-row');
        expect(row.className).not.toContain('border-rose-900');
        const badge = screen.getByTestId('event-type-badge');
        expect(badge.className).not.toContain('bg-rose-900/20');
    });

    it('FR-4: movement category gets data-category="movement" on the badge', () => {
        const entry = makeAuditEntry({
            id: 5,
            eventType: 'nous.moved',
            actorDid: 'did:nous:bob',
            payload: { name: 'Bob', fromRegion: 'agora', toRegion: 'forum', travelCost: 1 },
        });
        render(<FirehoseRow entry={entry} />, { wrapper: Wrapper });
        const badge = screen.getByTestId('event-type-badge');
        expect(badge.getAttribute('data-category')).toBe('movement');
        expect(badge.textContent).toBe('nous.moved');
    });
});
