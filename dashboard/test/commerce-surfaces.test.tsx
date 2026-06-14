/**
 * Phase 60 HOUSE-3 · Wave 6 (R-60-14 / D-60-14) — commerce surfaces tests.
 *
 * Verifies the ADDITIVE commerce panels on the orbital Genesis Core map:
 *   - an owned shop module shows its place:// name + a bound-shop badge;
 *   - a roles panel lists granted staff/guest edges with their trust_score;
 *   - a co-work board panel shows posted/claimed/completed tasks (status only —
 *     no raw board/task text beyond what the Grid feed serves);
 *   - an IOU strip shows outstanding bilateral balances.
 *
 * Privacy: only what the Grid feed serves crosses — place name (public), the
 * bound-shop flag, role counts + trust_score, board status counts, and the IOU
 * outstanding totals. NO raw owner DID and NO raw board/task content render.
 *
 * Additive invariant: the Phase 58 exterior (ghost-vs-lit modules, Earth, the
 * Government Core, NY clock) and the Phase 59 interior viewer stay UNCHANGED.
 *
 * Render+mock-fetch pattern follows test/orbital-genesis-map.test.tsx.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
    OrbitalGenesisMap,
    GENESIS_SEED,
} from '../src/components/worldmap/OrbitalGenesisMap';

const OWNER_HASH = 'b'.repeat(64);
const STAFF_HASH = 'c'.repeat(64);
const GUEST_HASH = 'd'.repeat(64);
const PARTNER_HASH = 'e'.repeat(64);
const RAW_DID = 'did:civic:noesis:nous:should-never-render';
const RAW_TASK_TEXT = 'stock-the-shelves-secret-instruction';

// A live feed where the first ring-2 business parcel is an owned, named, bound
// shop carrying role edges, a co-work board, and outstanding IOUs.
function commerceFeedResponse() {
    const parcels = GENESIS_SEED.map((p, i) =>
        i === 5
            ? {
                  ...p,
                  status: 'owned',
                  owner_civic_did_hash: OWNER_HASH,
                  occupant_count: 1,
                  structure: { type: 'shop', visibility: 'open' },
                  place_name: 'bazaar',
                  bound_shop: true,
                  roles: [
                      { role: 'staff', holder_civic_did_hash: STAFF_HASH, trust_score: 0.82 },
                      { role: 'guest', holder_civic_did_hash: GUEST_HASH, trust_score: 0.41 },
                  ],
                  board: { posted: 3, claimed: 2, completed: 5 },
                  ious: [
                      { counterparty_civic_did_hash: PARTNER_HASH, outstanding_bios: 25 },
                  ],
              }
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

describe('OrbitalGenesisMap commerce surfaces (R-60-14)', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockReturnValue(commerceFeedResponse());
    });

    describe('shop module: place name + bound-shop badge', () => {
        it('shows the place:// name for the bound shop', async () => {
            await renderMap();
            const panel = screen.getByTestId('shop-module');
            expect(panel.textContent).toContain('place://bazaar');
        });

        it('shows a bound-shop badge', async () => {
            await renderMap();
            expect(screen.getByTestId('bound-shop-badge')).toBeTruthy();
        });
    });

    describe('roles panel: staff/guest edges + trust', () => {
        it('lists a staff and a guest edge', async () => {
            await renderMap();
            const panel = screen.getByTestId('roles-panel');
            const rows = within(panel).getAllByTestId('role-edge');
            expect(rows).toHaveLength(2);
            const roles = rows.map((r) => r.getAttribute('data-role')).sort();
            expect(roles).toEqual(['guest', 'staff']);
        });

        it('shows the trust_score on each edge', async () => {
            await renderMap();
            const panel = screen.getByTestId('roles-panel');
            expect(panel.textContent).toContain('0.82');
            expect(panel.textContent).toContain('0.41');
        });
    });

    describe('co-work board panel: posted/claimed/completed status', () => {
        it('shows the posted/claimed/completed counts', async () => {
            await renderMap();
            const panel = screen.getByTestId('cowork-board');
            expect(panel.querySelector('[data-testid="board-posted"]')?.textContent).toContain('3');
            expect(panel.querySelector('[data-testid="board-claimed"]')?.textContent).toContain('2');
            expect(panel.querySelector('[data-testid="board-completed"]')?.textContent).toContain('5');
        });

        it('never renders raw board/task text', async () => {
            const { container } = await (async () => {
                let result!: ReturnType<typeof render>;
                fetchMock.mockReturnValue(
                    Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () =>
                            Promise.resolve({
                                parcels: GENESIS_SEED.map((p, i) =>
                                    i === 5
                                        ? {
                                              ...p,
                                              status: 'owned',
                                              owner_civic_did_hash: OWNER_HASH,
                                              structure: { type: 'shop', visibility: 'open' },
                                              // A buggy/hostile feed leaking raw task text + a raw DID —
                                              // the component must surface neither.
                                              board: {
                                                  posted: 1,
                                                  claimed: 0,
                                                  completed: 0,
                                                  tasks: [{ task_ref: RAW_TASK_TEXT }],
                                              },
                                          }
                                        : p,
                                ),
                            }),
                    }),
                );
                await act(async () => {
                    result = render(<OrbitalGenesisMap />);
                    await Promise.resolve();
                });
                return result;
            })();
            expect(container.innerHTML).not.toContain(RAW_TASK_TEXT);
        });
    });

    describe('IOU strip: outstanding bilateral balances', () => {
        it('shows the outstanding balance', async () => {
            await renderMap();
            const strip = screen.getByTestId('iou-strip');
            expect(strip.textContent).toContain('25');
        });
    });

    describe('privacy: no raw owner DID renders alongside commerce surfaces', () => {
        it('never leaks a raw DID', async () => {
            fetchMock.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            parcels: GENESIS_SEED.map((p, i) =>
                                i === 5
                                    ? {
                                          ...p,
                                          status: 'owned',
                                          owner_civic_did_hash: OWNER_HASH,
                                          owner_civic_did: RAW_DID,
                                          structure: { type: 'shop', visibility: 'open' },
                                          place_name: 'bazaar',
                                          bound_shop: true,
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
        });
    });

    describe('Phase 58 exterior + Phase 59 interior viewer UNCHANGED (additive)', () => {
        it('still renders the Phase 58 exterior (modules, Earth, Government Core, NY clock)', async () => {
            await renderMap();
            expect(screen.getByTestId('earth-below')).toBeTruthy();
            expect(screen.getByTestId('government-core')).toBeTruthy();
            expect(screen.getByTestId('ny-clock').textContent).toMatch(/NY\s+\d+\s+·\s+DAY\s+\d+/);
            expect(screen.getAllByTestId('parcel-module').length).toBeGreaterThan(0);
        });

        it('the Phase 59 interior viewer is not open until a browsable module is clicked', async () => {
            await renderMap();
            // Additive panels render WITHOUT auto-opening the interior overlay.
            expect(screen.queryByTestId('interior-viewer')).toBeNull();
        });
    });
});
