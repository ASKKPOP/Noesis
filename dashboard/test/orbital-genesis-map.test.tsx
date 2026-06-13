/**
 * Phase 58 HOUSE-1 · Wave 5 (R-58-11 / D-58-09, D-NH-01/11/12) — OrbitalGenesisMap tests.
 *
 * Verifies the dashboard orbital Genesis Core map:
 *   - On fetch FAILURE, the embedded 53-parcel seed renders (graceful fallback).
 *   - Lit vs ghost is driven by owner_civic_did_hash: owned parcels render a
 *     SOLID lit module ([data-owned="true"]); unowned stay ghost frames.
 *   - Occupancy lights are driven by occupant_count from the feed.
 *   - NO raw owner DID is ever rendered — only owner_civic_did_hash (HEX64).
 *   - Earth below (D-NH-12) and the Government Core monument (ring 0) render.
 *   - The NY clock (D-NH-11) renders at the display boundary.
 *
 * Render+mock-fetch pattern follows test/components/governance-voting-history.test.tsx.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';

// ── Mock global fetch ─────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Import after mock ─────────────────────────────────────────────────────────
import { OrbitalGenesisMap, GENESIS_SEED } from '../src/components/worldmap/OrbitalGenesisMap';

// A live feed payload: one owned business parcel (with a hashed owner + 2 occupants),
// everything else available. Shaped exactly like GET /api/v1/civic/parcels.
const OWNER_HASH = 'a'.repeat(64); // HEX64 sha256 hash form
const RAW_DID = 'did:civic:noesis:nous:should-never-render';

function liveFeedResponse() {
    const parcels = GENESIS_SEED.map((p, i) =>
        i === 5 // first ring-2 business parcel
            ? { ...p, status: 'owned', owner_civic_did_hash: OWNER_HASH, occupant_count: 2 }
            : { ...p, status: 'available', owner_civic_did_hash: null, occupant_count: 0 },
    );
    return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ parcels }),
    });
}

async function renderMap() {
    await act(async () => {
        render(<OrbitalGenesisMap />);
        await Promise.resolve();
    });
}

describe('OrbitalGenesisMap — live orbital Genesis Core (R-58-11)', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    describe('embedded-seed fallback on fetch failure', () => {
        beforeEach(() => {
            fetchMock.mockRejectedValue(new Error('network down'));
        });

        it('renders exactly 53 parcels from the embedded seed', async () => {
            await renderMap();
            // 52 orbital modules + the Government Core monument (ring 0) = 53 seed parcels.
            const modules = screen.getAllByTestId('parcel-module');
            const core = screen.getAllByTestId('government-core');
            expect(modules.length + core.length).toBe(53);
            expect(modules).toHaveLength(52);
            expect(core).toHaveLength(1);
        });

        it('renders the Government Core monument at ring 0', async () => {
            await renderMap();
            expect(screen.getByTestId('government-core')).toBeTruthy();
        });

        it('renders Earth below (D-NH-12)', async () => {
            await renderMap();
            expect(screen.getByTestId('earth-below')).toBeTruthy();
        });

        it('renders the NY clock at the display boundary (D-NH-11)', async () => {
            await renderMap();
            const clock = screen.getByTestId('ny-clock');
            expect(clock.textContent).toMatch(/NY\s+\d+\s+·\s+DAY\s+\d+/);
        });

        it('all seed parcels are ghost (unowned) — none lit', async () => {
            await renderMap();
            const lit = screen
                .getAllByTestId('parcel-module')
                .filter((el) => el.getAttribute('data-owned') === 'true');
            expect(lit).toHaveLength(0);
        });
    });

    describe('live feed: lit vs ghost from owner_civic_did_hash', () => {
        beforeEach(() => {
            fetchMock.mockReturnValue(liveFeedResponse());
        });

        it('flips the owned parcel to a lit SOLID module', async () => {
            await renderMap();
            const lit = screen
                .getAllByTestId('parcel-module')
                .filter((el) => el.getAttribute('data-owned') === 'true');
            expect(lit).toHaveLength(1);
        });

        it('leaves unowned parcels as ghost frames', async () => {
            await renderMap();
            // 52 orbital modules, 51 of them unowned (one ring-2 business parcel is owned).
            const ghost = screen
                .getAllByTestId('parcel-module')
                .filter((el) => el.getAttribute('data-owned') === 'false');
            expect(ghost).toHaveLength(51);
        });

        it('drives occupancy lights from occupant_count', async () => {
            await renderMap();
            const occupied = screen
                .getAllByTestId('parcel-module')
                .filter((el) => Number(el.getAttribute('data-occupants')) > 0);
            expect(occupied).toHaveLength(1);
            expect(occupied[0].getAttribute('data-occupants')).toBe('2');
            // occupancy lights actually rendered for the occupied parcel
            expect(within(occupied[0]).getAllByTestId('occupancy-light')).toHaveLength(2);
        });
    });

    describe('privacy: no raw owner DID is ever rendered (D-58-08)', () => {
        it('renders the owner hash but never the raw DID', async () => {
            fetchMock.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            // A malicious/buggy feed that ALSO carries a raw DID — the
                            // component must only ever surface the hash, never the DID.
                            parcels: GENESIS_SEED.map((p, i) =>
                                i === 5
                                    ? {
                                          ...p,
                                          status: 'owned',
                                          owner_civic_did_hash: OWNER_HASH,
                                          owner_civic_did: RAW_DID,
                                          occupant_count: 0,
                                      }
                                    : p,
                            ),
                        }),
                }),
            );
            const { container } = await (async () => {
                let result!: ReturnType<typeof render>;
                await act(async () => {
                    result = render(<OrbitalGenesisMap />);
                    await Promise.resolve();
                });
                return result;
            })();
            expect(container.innerHTML).not.toContain(RAW_DID);
            expect(container.innerHTML).not.toContain('did:civic:noesis:nous:');
            // the hash IS present (proves the owned parcel actually rendered)
            expect(container.innerHTML).toContain(OWNER_HASH.slice(0, 12));
        });
    });
});
