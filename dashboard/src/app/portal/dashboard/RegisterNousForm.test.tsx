/**
 * RegisterNousForm — claims the Nous, then files its registration with the Brain key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterNousForm from './RegisterNousForm';

function jsonResp(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
function fill() {
    fireEvent.change(screen.getByLabelText('Nous ID'), { target: { value: ' did:noesis:hermes ' } });
    fireEvent.change(screen.getByLabelText('Brain public key'), { target: { value: 'K'.repeat(43) } });
    fireEvent.click(screen.getByRole('button', { name: 'File registration' }));
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('RegisterNousForm', () => {
    it('claims, then files, then tells the page to re-read', async () => {
        const fetchMock = vi.fn(async (url: string) =>
            url.endsWith('/claim') ? jsonResp({ ok: true }) : jsonResp({ status: 'requested', request_id: 'r1' }, 201));
        vi.stubGlobal('fetch', fetchMock);
        const onFiled = vi.fn();
        render(<RegisterNousForm onFiled={onFiled} />);
        fill();

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('waiting for the Portal pre-screen'));
        const urls = fetchMock.mock.calls.map((c) => c[0] as string);
        expect(urls[0]).toMatch(/did%3Anoesis%3Ahermes\/claim$/);
        expect(urls[1]).toMatch(/did%3Anoesis%3Ahermes\/registration$/);
        expect(onFiled).toHaveBeenCalledTimes(1);
    });

    it('explains a refusal and offers citizenship when that is what is missing', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) =>
            url.endsWith('/claim') ? jsonResp({ ok: true }) : jsonResp({ error: 'civic_did_required' }, 403)));
        const onFiled = vi.fn();
        render(<RegisterNousForm onFiled={onFiled} />);
        fill();

        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('citizen of the Genesis Grid'));
        expect(screen.getByRole('link', { name: 'Apply for citizenship' }).getAttribute('href')).toBe('/apply/genesis');
        expect(onFiled).not.toHaveBeenCalled();
    });

    it('does not file when the claim is refused', async () => {
        const fetchMock = vi.fn(async () => jsonResp({ error: 'unknown_nous' }, 404));
        vi.stubGlobal('fetch', fetchMock);
        render(<RegisterNousForm onFiled={vi.fn()} />);
        fill();

        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('does not know a Nous'));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
