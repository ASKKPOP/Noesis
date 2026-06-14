/**
 * Phase 61 HOUSE-4 · Wave 4 (R-61-10 / D-61-09) — construction surfaces tests.
 *
 * Verifies the ADDITIVE construction panels on the orbital Genesis Core map:
 *   - a blueprint library panel lists the held blueprint hashes (short labels);
 *   - a build panel surfaces build-from-blueprint with the skill-held status
 *     (held / not-held) + the material cost;
 *   - a co-build DAG board shows per-node claim/complete state + the DAG-weighted
 *     attribution shares;
 *   - a teach-here indicator appears on workshop structures (a school).
 *
 * Privacy: only what the Grid feed serves crosses — held blueprint HEX64 skill
 * hashes, the build skill-held flag + material cost, the co-build node states +
 * weights + attribution shares (hashed holders). The recipe BODY, raw sub-task
 * content, and raw owner DIDs are NEVER rendered (D-61-06).
 *
 * Additive invariant: the Phase 58 exterior (ghost-vs-lit modules, Earth, the
 * Government Core, NY clock), the Phase 59 interior viewer, and the Phase 60
 * commerce overlay (shop badge / roles / board / IOU strip) stay UNCHANGED.
 *
 * Render+mock-fetch pattern follows test/commerce-surfaces.test.tsx.
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
const BP_HASH_1 = 'a1b2c3d4e5f6'.repeat(5).slice(0, 64);
const BP_HASH_2 = 'f6e5d4c3b2a1'.repeat(5).slice(0, 64);
const BUILDER_HASH = 'c'.repeat(64);
const PARTNER_HASH = 'e'.repeat(64);
const RAW_DID = 'did:civic:noesis:nous:should-never-render';
const RAW_RECIPE = 'secret-recipe-arrangement-do-this-instead';

// A live feed where a ring-2 manufacture parcel is an owned workshop carrying a
// blueprint library, a build view, and a co-build DAG.
function constructionFeedResponse() {
    const parcels = GENESIS_SEED.map((p, i) =>
        i === 16 // a manufacture ring-2 parcel
            ? {
                  ...p,
                  status: 'owned',
                  owner_civic_did_hash: OWNER_HASH,
                  occupant_count: 1,
                  structure: { type: 'workshop', visibility: 'open' },
                  held_blueprints: [BP_HASH_1, BP_HASH_2],
                  build: {
                      blueprint_hash: BP_HASH_1,
                      skill_held: true,
                      material_cost_bios: 120,
                  },
                  cobuild: {
                      nodes: [
                          { node_id: 'node_a', weight: 2, state: 'completed' },
                          { node_id: 'node_b', weight: 1, state: 'claimed' },
                          { node_id: 'node_c', weight: 1, state: 'open' },
                      ],
                      attribution: [
                          { holder_civic_did_hash: BUILDER_HASH, share: 0.5 },
                          { holder_civic_did_hash: PARTNER_HASH, share: 0.25 },
                      ],
                  },
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

describe('OrbitalGenesisMap construction surfaces (R-61-10)', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockReturnValue(constructionFeedResponse());
    });

    describe('blueprint library: held hashes', () => {
        it('renders the held blueprint hashes (short labels)', async () => {
            await renderMap();
            const panel = screen.getByTestId('blueprint-library');
            const entries = within(panel).getAllByTestId('blueprint-entry');
            expect(entries).toHaveLength(2);
            expect(entries[0].getAttribute('data-blueprint-hash')).toBe(BP_HASH_1);
            // short label is a truncation of the full hash
            expect(panel.textContent).toContain(BP_HASH_1.slice(0, 12));
        });
    });

    describe('build panel: skill-held status + material cost', () => {
        it('shows the skill-held status', async () => {
            await renderMap();
            const panel = screen.getByTestId('build-panel');
            const status = within(panel).getByTestId('skill-held-status');
            expect(status.getAttribute('data-skill-held')).toBe('true');
            expect(status.textContent).toContain('skill held');
        });

        it('shows the material cost', async () => {
            await renderMap();
            const panel = screen.getByTestId('build-panel');
            expect(within(panel).getByTestId('material-cost').textContent).toContain('120');
        });

        it('renders a not-held status when the builder does not hold the skill', async () => {
            fetchMock.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            parcels: GENESIS_SEED.map((p, i) =>
                                i === 16
                                    ? {
                                          ...p,
                                          status: 'owned',
                                          owner_civic_did_hash: OWNER_HASH,
                                          structure: { type: 'workshop', visibility: 'open' },
                                          build: {
                                              blueprint_hash: BP_HASH_1,
                                              skill_held: false,
                                              material_cost_bios: 80,
                                          },
                                      }
                                    : p,
                            ),
                        }),
                }),
            );
            await renderMap();
            const status = screen.getByTestId('skill-held-status');
            expect(status.getAttribute('data-skill-held')).toBe('false');
            expect(status.textContent).toContain('not held');
        });
    });

    describe('co-build DAG board: nodes + attribution', () => {
        it('renders each sub-task node with its claim/complete state', async () => {
            await renderMap();
            const panel = screen.getByTestId('cobuild-board');
            const nodes = within(panel).getAllByTestId('cobuild-node');
            expect(nodes).toHaveLength(3);
            const states = nodes.map((n) => n.getAttribute('data-state')).sort();
            expect(states).toEqual(['claimed', 'completed', 'open']);
        });

        it('renders the DAG-weighted attribution shares', async () => {
            await renderMap();
            const panel = screen.getByTestId('cobuild-attribution');
            const shares = within(panel).getAllByTestId('attribution-share');
            expect(shares).toHaveLength(2);
            // 0.5 share renders as 50%
            expect(panel.textContent).toContain('50%');
            expect(panel.textContent).toContain('25%');
        });

        it('never renders the recipe body / raw sub-task content', async () => {
            const { container } = await (async () => {
                let result!: ReturnType<typeof render>;
                fetchMock.mockReturnValue(
                    Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () =>
                            Promise.resolve({
                                parcels: GENESIS_SEED.map((p, i) =>
                                    i === 16
                                        ? {
                                              ...p,
                                              status: 'owned',
                                              owner_civic_did_hash: OWNER_HASH,
                                              structure: { type: 'workshop', visibility: 'open' },
                                              // A buggy/hostile feed leaking the recipe body —
                                              // the component must surface none of it.
                                              cobuild: {
                                                  nodes: [
                                                      {
                                                          node_id: 'node_a',
                                                          weight: 1,
                                                          state: 'open',
                                                          recipe: RAW_RECIPE,
                                                      },
                                                  ],
                                                  attribution: [],
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
            expect(container.innerHTML).not.toContain(RAW_RECIPE);
        });
    });

    describe('teach-here indicator: workshops are schools', () => {
        it('marks a workshop structure with a teach-here indicator', async () => {
            await renderMap();
            const indicators = screen.getAllByTestId('teach-here-indicator');
            expect(indicators.length).toBeGreaterThan(0);
            expect(
                indicators.some((el) => el.getAttribute('aria-label')?.includes('school')),
            ).toBe(true);
        });

        it('does NOT mark a non-workshop structure', async () => {
            fetchMock.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            parcels: GENESIS_SEED.map((p, i) =>
                                i === 16
                                    ? {
                                          ...p,
                                          status: 'owned',
                                          owner_civic_did_hash: OWNER_HASH,
                                          structure: { type: 'home', visibility: 'open' },
                                      }
                                    : p,
                            ),
                        }),
                }),
            );
            await renderMap();
            expect(screen.queryByTestId('teach-here-indicator')).toBeNull();
        });
    });

    describe('privacy: no raw owner DID renders alongside construction surfaces', () => {
        it('never leaks a raw DID', async () => {
            fetchMock.mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            parcels: GENESIS_SEED.map((p, i) =>
                                i === 16
                                    ? {
                                          ...p,
                                          status: 'owned',
                                          owner_civic_did_hash: OWNER_HASH,
                                          owner_civic_did: RAW_DID,
                                          structure: { type: 'workshop', visibility: 'open' },
                                          held_blueprints: [BP_HASH_1],
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

    describe('Phase 58/59/60 surfaces UNCHANGED (additive)', () => {
        it('still renders the Phase 58 exterior (modules, Earth, Government Core, NY clock)', async () => {
            await renderMap();
            expect(screen.getByTestId('earth-below')).toBeTruthy();
            expect(screen.getByTestId('government-core')).toBeTruthy();
            expect(screen.getByTestId('ny-clock').textContent).toMatch(/NY\s+\d+\s+·\s+DAY\s+\d+/);
            expect(screen.getAllByTestId('parcel-module').length).toBeGreaterThan(0);
        });

        it('does not auto-open the Phase 59 interior viewer', async () => {
            await renderMap();
            expect(screen.queryByTestId('interior-viewer')).toBeNull();
        });

        it('does not render the Phase 60 commerce overlay when no commerce fields are served', async () => {
            await renderMap();
            // The construction feed serves NO commerce fields → the commerce
            // overlay stays absent; only the construction overlay renders.
            expect(screen.queryByTestId('commerce-overlay')).toBeNull();
            expect(screen.getByTestId('construction-overlay')).toBeTruthy();
        });
    });
});
