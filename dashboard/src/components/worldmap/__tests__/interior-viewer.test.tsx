/**
 * Phase 59 HOUSE-2 · Wave 5 (R-59-11 / D-59-11) — OrbitalGenesisMap interior viewer.
 *
 * The interior viewer is an ADDITIVE click-to-enter overlay on top of the Phase 58
 * orbital exterior. Asserts:
 *   - clicking an owned, OPEN, non-derelict module fetches GET :id/interior and
 *     renders the interior tree, distinguishing mirror (STATIC mesh) from
 *     functional (HIGHLIGHTED, affordance-carrying) furniture;
 *   - condition styling reflects maintained (normal) / worn (faded) / derelict;
 *   - a derelict module shows a "closed" state and does NOT open the interior;
 *   - no raw owner DID is ever rendered (only owner_civic_did_hash).
 *
 * The interior is sovereign Grid-side space served only via the entry-policy-gated
 * GET route — humans browse only open, non-derelict structures.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OrbitalGenesisMap, type ParcelFeedEntry } from '../OrbitalGenesisMap';

// The exterior keeps the Phase 58 data-testid="parcel-module"; modules are
// distinguished by data-parcel-id. This helper waits for + returns one.
async function findModule(id: string): Promise<Element> {
    return waitFor(() => {
        const el = document.querySelector(`[data-testid="parcel-module"][data-parcel-id="${id}"]`);
        if (!el) throw new Error(`module ${id} not found`);
        return el;
    });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_HASH = 'a'.repeat(64); // HEX64 owner_civic_did_hash (never a raw DID)
const RAW_OWNER_DID = 'did:civic:noesis:genesis:alice'; // must NEVER appear in DOM

function parcel(over: Partial<ParcelFeedEntry>): ParcelFeedEntry {
    return {
        id: 'genesis:residential:0007',
        zone: 'residential',
        ring: 3,
        sector: 7.5,
        level: 0,
        status: 'owned',
        price_bios: 400,
        owner_civic_did_hash: OWNER_HASH,
        structure: { type: 'home', visibility: 'open' },
        occupant_count: 0,
        condition: 'maintained',
        ...over,
    };
}

const OPEN_HOME = parcel({ id: 'genesis:residential:0007', condition: 'maintained' });
const WORN_HOME = parcel({ id: 'genesis:residential:0008', sector: 22.5, condition: 'worn' });
const DERELICT_HOME = parcel({
    id: 'genesis:residential:0009',
    sector: 37.5,
    condition: 'derelict',
});

const INTERIOR_RESPONSE = {
    parcel_id: 'genesis:residential:0007',
    condition: 'maintained',
    interior: {
        areas: [
            {
                name: 'living',
                objects: [
                    { kind: 'bed', class: 'mirror' },
                    { kind: 'work_desk', class: 'functional' },
                ],
            },
        ],
    },
};

function mockParcelsFeed(parcels: ParcelFeedEntry[]) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            if (url.includes('/interior')) {
                // GET :id/interior — return the tree (mirror + functional).
                return {
                    ok: true,
                    status: 200,
                    json: async () => INTERIOR_RESPONSE,
                } as Response;
            }
            // GET /api/v1/civic/parcels — the public feed.
            return {
                ok: true,
                status: 200,
                json: async () => ({ parcels }),
            } as Response;
        }),
    );
}

describe('OrbitalGenesisMap interior viewer (R-59-11 / D-59-11)', () => {
    beforeEach(() => {
        mockParcelsFeed([OPEN_HOME, WORN_HOME, DERELICT_HOME]);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('clicking an owned open module opens the interior tree (mirror static vs functional highlighted)', async () => {
        render(<OrbitalGenesisMap />);
        const mod = await findModule('genesis:residential:0007');
        fireEvent.click(mod);

        const viewer = await screen.findByTestId('interior-viewer');
        expect(viewer).toBeTruthy();

        // The tree renders both classes, distinguished by data-furniture-class.
        const mirror = await screen.findByTestId('interior-object-bed');
        const functional = await screen.findByTestId('interior-object-work_desk');
        expect(mirror.getAttribute('data-furniture-class')).toBe('mirror');
        expect(functional.getAttribute('data-furniture-class')).toBe('functional');

        // Functional furniture is HIGHLIGHTED (affordance-carrying); mirror is static.
        expect(functional.getAttribute('data-highlighted')).toBe('true');
        expect(mirror.getAttribute('data-highlighted')).toBe('false');
    });

    it('reflects condition styling: maintained interior viewer carries the condition', async () => {
        render(<OrbitalGenesisMap />);
        const mod = await findModule('genesis:residential:0007');
        fireEvent.click(mod);
        const viewer = await screen.findByTestId('interior-viewer');
        expect(viewer.getAttribute('data-condition')).toBe('maintained');
    });

    it('worn module renders a worn (faded) exterior styling state', async () => {
        render(<OrbitalGenesisMap />);
        const worn = await findModule('genesis:residential:0008');
        expect(worn.getAttribute('data-condition')).toBe('worn');
    });

    it('a derelict module shows closed and does NOT open the interior', async () => {
        render(<OrbitalGenesisMap />);
        const derelict = await findModule('genesis:residential:0009');
        expect(derelict.getAttribute('data-condition')).toBe('derelict');

        fireEvent.click(derelict);

        // Derelict shows a "closed" affordance instead of opening the interior.
        await waitFor(() => {
            expect(screen.getByTestId('interior-closed')).toBeTruthy();
        });
        expect(screen.queryByTestId('interior-viewer')).toBeNull();
    });

    it('never renders a raw owner DID (only owner_civic_did_hash)', async () => {
        const { container } = render(<OrbitalGenesisMap />);
        const mod = await findModule('genesis:residential:0007');
        fireEvent.click(mod);
        await screen.findByTestId('interior-viewer');
        expect(container.innerHTML).not.toContain(RAW_OWNER_DID);
        expect(container.innerHTML).not.toContain('did:civic:');
    });
});
