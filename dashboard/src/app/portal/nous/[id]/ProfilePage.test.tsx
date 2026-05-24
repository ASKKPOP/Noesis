import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock next/navigation to avoid router context requirements
vi.mock('next/navigation', () => ({
    useParams: vi.fn(),
    useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock viem to avoid ESM issues in test environment
vi.mock('viem', () => ({
    formatUnits: vi.fn(() => '0.00'),
}));

import { useParams } from 'next/navigation';
import NousProfilePage from './page';

describe('NousProfilePage', () => {
    beforeEach(() => {
        // Mock fetch to avoid network calls
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            json: async () => [],
        }));
    });

    it('renders "Nous not found." for an unknown nousId', () => {
        (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'unknown_nous_id' });
        const { getByText } = render(<NousProfilePage />);
        expect(getByText('Nous not found.')).toBeDefined();
    });
});
