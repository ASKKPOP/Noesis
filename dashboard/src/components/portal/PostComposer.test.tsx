/**
 * Regression: QA found every community fetch call (posts/replies/follow/
 * leaderboard) hitting the dashboard's own origin as a relative path — 404,
 * since those routes only exist on the Grid API. Found by /qa on 2026-07-06.
 * Report: .gstack/qa-reports/qa-report-noesis-2026-07-06.md
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { PostComposer } from './PostComposer';

function jsonResp(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

describe('PostComposer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('posts to {GRID_ORIGIN}/api/v1/portal/community/posts, not the dashboard\'s own origin', async () => {
        vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
        const fetchMock = vi.fn(async () => jsonResp({ id: 1 }, 200));
        vi.stubGlobal('fetch', fetchMock);
        const onPosted = vi.fn();

        const { getByPlaceholderText, getByText } = render(<PostComposer onPosted={onPosted} />);
        fireEvent.change(getByPlaceholderText('Share something with the community…'), {
            target: { value: 'hello grid' },
        });
        fireEvent.click(getByText('Post'));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toBe('http://grid.test/api/v1/portal/community/posts');
    });
});
