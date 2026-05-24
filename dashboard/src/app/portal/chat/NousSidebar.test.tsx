import React from 'react';
import { render } from '@testing-library/react';
import NousSidebar from './NousSidebar';

describe('NousSidebar', () => {
    it('renders without crashing', () => {
        // NousSidebar fetches Nous roster on mount; mock fetch to avoid network
        global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
        const { container } = render(
            <NousSidebar selectedNousId={null} onSelect={() => undefined} />,
        );
        expect(container).toBeDefined();
    });
});
