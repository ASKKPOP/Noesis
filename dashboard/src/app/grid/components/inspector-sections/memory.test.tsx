/**
 * MemorySection tests — up to 5 episodic memories, reverse-chronological.
 *
 * Contract (Plan 04-05 Task 2):
 *   - W2 TIMESTAMP CONTRACT (locked by Plan 04-03): `timestamp` is Unix
 *     **seconds** (integer). MemorySection MUST `* 1000` before `new Date()`.
 *     Regression test: `timestamp: 1700000000` seconds must render a 2023 date.
 *   - Defensive cap at 5 rows even if the server returns 7+ entries.
 *   - Empty → EmptyState with UI-SPEC copy.
 *   - Section test-id is `section-memory`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemorySection } from './memory';

describe('MemorySection', () => {
    it('renders the section container with test-id section-memory', () => {
        render(<MemorySection memories={[]} />);
        expect(screen.getByTestId('section-memory')).not.toBeNull();
    });

    it('renders EmptyState copy when memory_highlights is empty', () => {
        render(<MemorySection memories={[]} />);
        // UI-SPEC §203: "No episodic memories recorded. ..."
        expect(screen.getByText(/No episodic memories recorded/i)).not.toBeNull();
    });

    it('renders each memory row as a <li> with its summary and kind', () => {
        render(
            <MemorySection
                memories={[
                    { timestamp: 1700000000, kind: 'trade',  summary: 'Bought bread for 4 ousia' },
                    { timestamp: 1700000100, kind: 'goal',   summary: 'Adopted Explore alpha' },
                ]}
            />,
        );
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(screen.getByText('Bought bread for 4 ousia').textContent).toBe('Bought bread for 4 ousia');
        expect(screen.getByText('Adopted Explore alpha').textContent).toBe('Adopted Explore alpha');
        expect(screen.getAllByText('trade').length).toBeGreaterThan(0);
        expect(screen.getAllByText('goal').length).toBeGreaterThan(0);
    });

    it('caps the rendered list at 5 rows even if the payload is longer', () => {
        const seven = Array.from({ length: 7 }, (_, i) => ({
            timestamp: 1700000000 + i,
            kind: 'trade',
            summary: `Memory #${i}`,
        }));
        render(<MemorySection memories={seven} />);
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(5);
    });

    it('honors the W2 seconds→ms timestamp contract (Plan 04-03 lock)', () => {
        // 1700000000 seconds = 2023-11-14T22:13:20Z
        render(
            <MemorySection
                memories={[{ timestamp: 1700000000, kind: 'goal', summary: 'probe' }]}
            />,
        );
        // Exactly one memory row — its rendered timestamp MUST include 2023.
        // If the section mistakenly passed 1700000000 milliseconds into Date,
        // we'd see a 1970 date instead.
        const item = screen.getByRole('listitem');
        expect(item.textContent).toMatch(/2023/);
    });
});
