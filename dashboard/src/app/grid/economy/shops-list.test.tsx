/**
 * ShopsList — presentational; one card per shop with owner name + nested
 * listings table. Owner lookup falls back to truncated DID when missing.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { ShopsList } from './shops-list';
import type { NousRosterEntry, Shop } from '@/lib/api/economy';

function mkNous(did: string, name: string): NousRosterEntry {
    return {
        did,
        name,
        region: 'alpha',
        ousia: 0,
        lifecyclePhase: 'adult',
        reputation: 0.5,
        status: 'active',
    };
}

describe('ShopsList', () => {
    afterEach(() => cleanup());

    it('renders an empty-state when no shops', () => {
        render(<ShopsList shops={[]} roster={[]} />);
        expect(screen.getByTestId('shops-empty')).not.toBeNull();
        expect(screen.queryByTestId('shops-list')).toBeNull();
    });

    it('renders a card per shop with owner name + listings', () => {
        const shop: Shop = {
            ownerDid: 'did:noesis:alpha',
            name: 'Alpha Emporium',
            listings: [
                { sku: 'sku-1', label: 'Dialectic', priceOusia: 5 },
                { sku: 'sku-2', label: 'Discourse', priceOusia: 10 },
            ],
        };
        render(<ShopsList shops={[shop]} roster={[mkNous('did:noesis:alpha', 'Alpha')]} />);
        const list = screen.getByTestId('shops-list');
        expect(within(list).getByText('Alpha Emporium')).not.toBeNull();
        // Owner name appears in "owned by Alpha" subtitle.
        expect(within(list).getByText(/owned by Alpha/)).not.toBeNull();
        expect(within(list).getByText('Dialectic')).not.toBeNull();
        expect(within(list).getByText('Discourse')).not.toBeNull();
        expect(within(list).getByText('sku-1')).not.toBeNull();
    });

    it('falls back to "…<last 8 chars>" when shop owner is not in roster', () => {
        const shop: Shop = {
            ownerDid: 'did:noesis:phantomowner12345678',
            name: 'Phantom',
            listings: [],
        };
        render(<ShopsList shops={[shop]} roster={[]} />);
        expect(screen.getByText(/…12345678/)).not.toBeNull();
    });
});
