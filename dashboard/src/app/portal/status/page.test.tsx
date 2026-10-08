/**
 * Project Status page tests.
 *
 * ANTI-HARDCODING: values from the fetch FIXTURES must flow into the DOM (tick,
 * headline, lifecycle tally), and when the Grid does not answer the page must
 * say so rather than show a status.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import StatusPage from './page';

function jsonResp(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const HEALTH = {
    status: 'degraded',
    reasons: ['audit_divergence'],
    timestamp: 1,
    audit: {
        in_memory_length: 120, persisted_max_id: 117, divergence: 3, divergence_threshold: 50,
        last_persist_attempt_at: 1, last_persist_error: null,
    },
    firehose: { client_count: 2, frames_sent_total: 1, frames_dropped_total: 0, last_frame_at: 1, watermark_bytes: 1 },
    clock: { tick: 137, running: true, last_tick_at: 1 },
};

const STATUS = {
    name: 'genesis', tick: 137, epoch: 0, nousCount: 3, regionCount: 6,
    activeLaws: 1, auditEntries: 120, uptime: 90_000_000,
};

const item = (status: string, headline: string) => ({ status, metric: null, headline });
const MAP = {
    grid_name: 'genesis', tick: 137, generated_at_tick: 137,
    surfaces: {
        grid: item('up', 'world running'),
        portal: item('up', 'no applications'),
        steward: item('up', 'reads the Grid'),
        brain: item('empty', 'no Brains registered'),
    },
    institutions: {
        registry: item('active', '5 Civic-DIDs · 3 Nous'),
        polis: item('empty', '0 in pipeline · 0 enacted'),
        police: item('empty', '0 complaints · 0 sanctions'),
        irs: item('active', 'treasury 0.0 ETH · 2% fee'),
        marketplace: item('down', 'db_unavailable'),
        library: item('active', '42 entries · 9 citations'),
        communities: item('empty', '0 communities · 0 members'),
        p2p: item('unknown', 'p2p peer store unavailable'),
    },
};

const ROSTER = {
    nous: [{ lifecyclePhase: 'infant' }, { lifecyclePhase: 'infant' }, { lifecyclePhase: 'elder' }],
};

function stubGrid(routes: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const path = Object.keys(routes).find((p) => url.endsWith(p));
        return path ? jsonResp(routes[path]) : jsonResp({}, 503);
    }));
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('StatusPage', () => {
    it('renders what the Grid reports', async () => {
        stubGrid({
            '/health/detailed': HEALTH,
            '/api/v1/grid/status': STATUS,
            '/api/v1/system/map': MAP,
            '/api/v1/grid/nous': ROSTER,
        });
        render(<StatusPage />);

        await waitFor(() =>
            expect(screen.getByTestId('status-banner').textContent).toContain('The Grid reports degraded'),
        );
        expect(screen.getByTestId('status-banner').textContent).toContain('genesis · tick 137');
        expect(screen.getByText('audit_divergence')).toBeTruthy();
        expect(screen.getByText('no Brains registered')).toBeTruthy();
        expect(screen.getByText('42 entries · 9 citations')).toBeTruthy();
        expect(screen.getByText('1d 1h')).toBeTruthy();
        expect(screen.getByText('infant').parentElement?.textContent).toBe('infant2');
        expect(screen.queryByText(/Phase 22/)).toBeNull();
    });

    it('says the Grid is not answering when every read fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        render(<StatusPage />);

        await waitFor(() =>
            expect(screen.getByTestId('status-banner').textContent).toBe('The Grid is not answering'),
        );
        expect(screen.getAllByText('The Grid did not answer this read.')).toHaveLength(4);
        expect(screen.queryByText(/^(Up|Active|Operational)$/)).toBeNull();
    });

    it('does not claim health when only the health check is unanswered', async () => {
        stubGrid({ '/api/v1/grid/status': STATUS });
        render(<StatusPage />);

        await waitFor(() =>
            expect(screen.getByTestId('status-banner').textContent).toContain(
                'The Grid is answering, but not its health check',
            ),
        );
        expect(screen.getByText('Active laws')).toBeTruthy();
    });
});
