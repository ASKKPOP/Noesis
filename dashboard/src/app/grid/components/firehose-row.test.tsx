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
