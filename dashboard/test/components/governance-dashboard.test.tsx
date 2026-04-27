/**
 * Phase 12 Wave 4 — Dashboard governance page component tests (VOTE-07 / D-12-09).
 *
 * Verifies the tier-aware governance dashboard:
 *   - Proposal list rendered for all tiers (H1+)
 *   - "View votes" button NOT in DOM for tiers H1–H4 (VOTE-05 UI lock)
 *   - "View votes" button visible for H5
 *   - "View body" button disabled with tooltip for H1; enabled for H2+
 *   - Loading state renders skeleton
 *   - Error state shows error + retry
 *   - Empty state shows "No open proposals."
 *
 * Uses vi.mock of the useGovernanceProposals hook (project pattern — no MSW installed).
 * Tests are DOM-render tests using @testing-library/react.
 *
 * VOTE-05 hand-audit: No propose/commit/reveal button exists in any render path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProposalSummary } from '../../src/app/grid/governance/use-governance-proposals';

// ── Mock useGovernanceProposals hook ──────────────────────────────────────────
const hoisted = vi.hoisted(() => {
    let _proposals: ProposalSummary[] = [];
    let _isLoading = false;
    let _error: Error | null = null;

    return {
        get proposals() { return _proposals; },
        set proposals(v: ProposalSummary[]) { _proposals = v; },
        get isLoading() { return _isLoading; },
        set isLoading(v: boolean) { _isLoading = v; },
        get error() { return _error; },
        set error(v: Error | null) { _error = v; },
    };
});

vi.mock('../../src/app/grid/governance/use-governance-proposals', () => ({
    useGovernanceProposals: () => ({
        proposals: hoisted.proposals,
        isLoading: hoisted.isLoading,
        error: hoisted.error,
    }),
}));

// ── Import after mock setup ───────────────────────────────────────────────────
import { GovernanceDashboard } from '../../src/app/grid/governance/governance-dashboard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProposal(overrides: Partial<ProposalSummary> = {}): ProposalSummary {
    return {
        proposal_id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
        status: 'open',
        opened_at_tick: 1,
        deadline_tick: 100,
        commit_count: 3,
        reveal_count: 2,
        outcome: undefined,
        ...overrides,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — tier-aware proposal list (VOTE-07 / D-12-09)', () => {

    beforeEach(() => {
        hoisted.proposals = [];
        hoisted.isLoading = false;
        hoisted.error = null;
    });

    // ── Loading state ────────────────────────────────────────────────────────

    it('loading state shows skeleton (role="status")', () => {
        hoisted.isLoading = true;

        render(<GovernanceDashboard tier={1} />);

        expect(screen.getByRole('status')).toBeTruthy();
    });

    // ── Error state ──────────────────────────────────────────────────────────

    it('error state shows error message and retry button', () => {
        hoisted.error = new Error('network failure');

        render(<GovernanceDashboard tier={1} />);

        expect(screen.getByRole('alert')).toBeTruthy();
        expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    });

    // ── Empty state ──────────────────────────────────────────────────────────

    it('empty state shows "No open proposals."', () => {
        hoisted.proposals = [];

        render(<GovernanceDashboard tier={1} />);

        expect(screen.getByText('No open proposals.')).toBeTruthy();
    });

    // ── Tier 1: list visible, "View votes" NOT in DOM (VOTE-05) ─────────────

    it('tier=1: proposals list renders; "View votes" button is NOT in DOM', () => {
        hoisted.proposals = [makeProposal(), makeProposal({ proposal_id: 'bbbbcccc-dddd-eeee-ffff-000000000000' })];

        const { container } = render(<GovernanceDashboard tier={1} />);

        // List is rendered (H1+ can see aggregate list)
        expect(container.querySelector('[data-testid="proposals-list"]')).toBeTruthy();

        // VOTE-05: "View votes" MUST NOT be in the DOM for H1 (not just disabled)
        const voteButtons = container.querySelectorAll('[data-testid="view-votes-btn"]');
        expect(voteButtons).toHaveLength(0);
    });

    // ── Tier 2: "View body" buttons enabled ──────────────────────────────────

    it('tier=2: "View body" button is not disabled', () => {
        hoisted.proposals = [makeProposal()];

        const { container } = render(<GovernanceDashboard tier={2} />);

        const bodyBtn = container.querySelector('[data-testid="view-body-btn"]') as HTMLButtonElement | null;
        expect(bodyBtn).toBeTruthy();
        expect(bodyBtn?.disabled).toBeFalsy();
    });

    // ── Tier 1: "View body" button disabled with tooltip ─────────────────────

    it('tier=1: "View body" button is disabled with title indicating H2 required', () => {
        hoisted.proposals = [makeProposal()];

        const { container } = render(<GovernanceDashboard tier={1} />);

        const bodyBtn = container.querySelector('[data-testid="view-body-btn"]') as HTMLButtonElement | null;
        expect(bodyBtn).toBeTruthy();
        expect(bodyBtn?.disabled).toBeTruthy();
        // Must have a tooltip indicating H2+ requirement
        expect(bodyBtn?.title).toMatch(/H2/);
    });

    // ── Tier 5: "View votes" button visible and clickable ───────────────────

    it('tier=5: "View votes" button is in DOM and clickable', () => {
        hoisted.proposals = [makeProposal()];

        const { container } = render(<GovernanceDashboard tier={5} />);

        const voteBtn = container.querySelector('[data-testid="view-votes-btn"]') as HTMLButtonElement | null;
        expect(voteBtn).toBeTruthy();
        expect(voteBtn?.disabled).toBeFalsy();
    });

    // ── VOTE-05 hand-audit: no propose/commit/reveal affordance ──────────────

    it('VOTE-05: no propose/commit/reveal button at any tier (including H5)', () => {
        hoisted.proposals = [makeProposal()];

        // Test all tiers
        for (const tier of [1, 2, 3, 4, 5] as const) {
            const { container, unmount } = render(<GovernanceDashboard tier={tier as 1|2|3|4|5} />);
            const buttons = Array.from(container.querySelectorAll('button'));
            const btnTexts = buttons.map(b => b.textContent?.toLowerCase() ?? '');
            const btnTestIds = buttons.map(b => b.getAttribute('data-testid') ?? '');

            for (const text of btnTexts) {
                expect(text).not.toMatch(/propose|commit|reveal|vote\s+now|submit/);
            }
            for (const id of btnTestIds) {
                expect(id).not.toMatch(/propose|commit|reveal/);
            }
            unmount();
        }
    });

    // ── Proposal ID truncation ───────────────────────────────────────────────

    it('proposal_id displayed truncated to 8 chars', () => {
        hoisted.proposals = [makeProposal({ proposal_id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff' })];

        const { container } = render(<GovernanceDashboard tier={1} />);

        expect(container.textContent).toContain('aaaabbbb');
        // Full UUID should NOT appear in rendered output
        expect(container.textContent).not.toContain('aaaabbbb-cccc-dddd-eeee-ffffffffffff');
    });

    // ── Tallied proposal shows outcome ───────────────────────────────────────

    it('tallied proposal shows outcome in the row', () => {
        hoisted.proposals = [makeProposal({ status: 'tallied', outcome: 'passed' })];

        const { container } = render(<GovernanceDashboard tier={1} />);

        expect(container.textContent).toContain('passed');
    });
});
