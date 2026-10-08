/**
 * Reviewer panel — lists the queue from the Grid and sends the pre-screen decision.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NousRegistrationReviewPage from './page';

function jsonResp(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
const ROW = {
    request_id: 'r1', nous_did: 'did:noesis:hermes', type: 'A', status: 'requested', reason_code: null,
    filed_tick: 1200, registrant_did_hash: 'ab'.repeat(32), registrant_is_operator: true, founding_nous: true,
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('NousRegistrationReviewPage', () => {
    it('shows a filing with what the reviewer needs to judge it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ registrations: [ROW] })));
        render(<NousRegistrationReviewPage />);
        const row = await screen.findByTestId('review-r1');
        expect(row.textContent).toContain('did:noesis:hermes');
        expect(row.textContent).toContain('Waiting for pre-screen');
        expect(row.textContent).toContain('owner is a Grid operator');
        expect(row.textContent).toContain('founding Nous');
    });

    it('a pass sends { pass: true } and reports the Polis outcome', async () => {
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            if (init?.method === 'POST') return jsonResp({ status: 'approved' }, 201);
            return jsonResp({ registrations: [fetchMock.mock.calls.length > 1 ? { ...ROW, status: 'approved' } : ROW] });
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<NousRegistrationReviewPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Pass pre-screen' }));

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('charter rules approved it'));
        const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!;
        expect(post[0]).toMatch(/nous-registrations\/r1\/prescreen$/);
        expect(JSON.parse(post[1]!.body as string)).toEqual({ pass: true });
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Pass pre-screen' })).toBeNull());
    });

    it('a rejection sends the chosen reason', async () => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
            init?.method === 'POST' ? jsonResp({ status: 'rejected', reason_code: 'prescreen_sybil' }, 201) : jsonResp({ registrations: [ROW] }));
        vi.stubGlobal('fetch', fetchMock);
        render(<NousRegistrationReviewPage />);
        fireEvent.change(await screen.findByLabelText('Rejection reason'), { target: { value: 'prescreen_sybil' } });
        fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('rejected at the pre-screen'));
        const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')!;
        expect(JSON.parse(post[1]!.body as string)).toEqual({ pass: false, reason: 'prescreen_sybil' });
    });

    it('says why when the Grid refuses the queue', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResp({ error: 'not_operator' }, 403)));
        render(<NousRegistrationReviewPage />);
        expect((await screen.findByRole('alert')).textContent).toContain('Only a Grid operator');
    });
});
