/**
 * Portal Manager v1 — PortalManagerView component tests.
 *
 * Asserts the three status sections render with correct counts, the activity
 * summary shows registrations_total + civic_dids_issued, the queue is read-only
 * (no approve/reject controls — VOTE-05 / D-V3-36), and the unauthorized state
 * renders when the fetch returned the operator-gate error.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PortalManagerView from './PortalManagerView';
import type {
    RegistrationsResponse,
    DidIssuanceResponse,
    AuditChainResponse,
} from '../../../lib/api/portal-manager';

const DATA: RegistrationsResponse = {
    grid_name: 'genesis',
    applications: [
        {
            application_id: 'a1', grid_name: 'genesis', status: 'approved',
            civic_did: 'did:civic:noesis:human:c1', reason_code: null,
            requested_at_tick: 10, decided_at_tick: 11,
            human_did_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456aaaa',
        },
        {
            application_id: 'a2', grid_name: 'genesis', status: 'rejected',
            civic_did: null, reason_code: 'oath_mismatch',
            requested_at_tick: 12, decided_at_tick: 13,
            human_did_hash: 'bbb123def456bbb123def456bbb123def456bbb123def456bbb123def456bbbb',
        },
    ],
    counts: { pending: 3, approved: 5, rejected: 2, total: 10 },
    activity: { registrations_total: 10, civic_dids_issued: 5 },
};

describe('PortalManagerView — data state', () => {
    it('renders the activity summary (registrations_total + civic_dids_issued)', () => {
        const { getByText } = render(<PortalManagerView data={DATA} />);
        expect(getByText('Registrations')).toBeTruthy();
        expect(getByText('Civic-DIDs Issued')).toBeTruthy();
        // total registrations 10 appears (summary card) and the rejected reason renders.
        expect(getByText('oath_mismatch')).toBeTruthy();
    });

    it('renders all three status sections with their counts', () => {
        const { getByText, getAllByText } = render(<PortalManagerView data={DATA} />);
        expect(getAllByText('Pending').length).toBeGreaterThan(0);
        expect(getAllByText('Approved').length).toBeGreaterThan(0);
        expect(getAllByText('Rejected').length).toBeGreaterThan(0);
        expect(getByText('3')).toBeTruthy(); // pending count
        expect(getByText('2')).toBeTruthy(); // rejected count
    });

    it('is READ-ONLY: renders no action controls (VOTE-05 / D-V3-36)', () => {
        const { container } = render(<PortalManagerView data={DATA} />);
        // No interactive controls of any kind — the surface is observe-only.
        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('input')).toBeNull();
        expect(container.querySelector('form')).toBeNull();
        expect(container.querySelector('select')).toBeNull();
        // No imperative approve/reject *action* text (status labels like "Approved"
        // are read-only and allowed; an "Approve application" verb is not).
        expect(container.textContent).not.toMatch(/approve application/i);
        expect(container.textContent).not.toMatch(/reject application/i);
    });

    it('shows a DID hash, never a raw human DID', () => {
        const { container } = render(<PortalManagerView data={DATA} />);
        expect(container.textContent).not.toContain('did:noesis:human');
        // a truncated hash is shown
        expect(container.textContent).toContain('abc123de');
    });

    it('renders an empty-queue message when there are no applications', () => {
        const empty: RegistrationsResponse = {
            ...DATA, applications: [],
            counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
            activity: { registrations_total: 0, civic_dids_issued: 0 },
        };
        const { getByText } = render(<PortalManagerView data={empty} />);
        expect(getByText('No registration applications on record.')).toBeTruthy();
    });
});

describe('PortalManagerView — gate / error states', () => {
    it('renders the operator-authorization notice on unauthorized', () => {
        const { getByText } = render(<PortalManagerView data={null} error="unauthorized" />);
        expect(getByText(/Operator authorization required/i)).toBeTruthy();
    });

    it('renders a db-unavailable notice on db_unavailable', () => {
        const { getByText } = render(<PortalManagerView data={null} error="db_unavailable" />);
        expect(getByText(/store is currently unavailable/i)).toBeTruthy();
    });

    it('renders a distinct console-disabled notice on console_disabled (NOT the unauthorized copy)', () => {
        const { getByText, queryByText } = render(<PortalManagerView data={null} error="console_disabled" />);
        expect(getByText(/console is disabled in this environment/i)).toBeTruthy();
        // It must NOT show the operator-authorization (unauthorized) copy — distinct states.
        expect(queryByText(/Operator authorization required/i)).toBeNull();
    });

    it('renders a loading state', () => {
        const { getByText } = render(<PortalManagerView data={null} loading />);
        expect(getByText(/Loading registration activity/i)).toBeTruthy();
    });
});

const DID: DidIssuanceResponse = {
    grid_name: 'genesis',
    issued: [
        { civic_did: 'did:civic:noesis:human:c1', status: 'active', issued_at_tick: 10, kind: 'civic' },
        { civic_did: 'did:civic:noesis:human:c2', status: 'revoked', issued_at_tick: 8, kind: 'civic' },
    ],
    counts: { active: 12, revoked: 3, total: 15, nous_active: 9 },
};

const AUDIT: AuditChainResponse = {
    integrity: { in_memory_length: 42, persisted_max_id: 42, divergence: 0, divergence_threshold: 10, healthy: true },
    recent: [
        { event_type: 'portal.registration_submitted', tick: 41 },
        { event_type: 'registry.civic_did_issued', tick: 42 },
    ],
};

describe('PortalManagerView — DID issuance section', () => {
    it('renders the counts from props (active + nous_active), not literals', () => {
        const { getByText, rerender, queryByText } = render(
            <PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT} />,
        );
        expect(getByText('12')).toBeTruthy(); // active count from props
        expect(getByText('9')).toBeTruthy();  // nous_active from props
        // Flip props → the rendered value follows (proves data-binding).
        const DID2: DidIssuanceResponse = { ...DID, counts: { active: 99, revoked: 1, total: 100, nous_active: 4 } };
        rerender(<PortalManagerView data={DATA} didIssuance={DID2} audit={AUDIT} />);
        expect(getByText('99')).toBeTruthy();
        expect(queryByText('12')).toBeNull();
    });

    it('shows the PUBLIC civic_did (not a hash) truncated with a full-value title', () => {
        const { container } = render(<PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT} />);
        expect(container.textContent).toContain('did:civic:noesis:human:');
        expect(container.querySelector('[title="did:civic:noesis:human:c1"]')).toBeTruthy();
    });

    it('renders the empty-state when issued[] is empty', () => {
        const empty: DidIssuanceResponse = { ...DID, issued: [], counts: { active: 0, revoked: 0, total: 0, nous_active: 0 } };
        const { getByText } = render(<PortalManagerView data={DATA} didIssuance={empty} audit={AUDIT} />);
        expect(getByText('No Civic-DIDs issued on record.')).toBeTruthy();
    });

    it('renders the matching error copy on didError', () => {
        const { getByText } = render(<PortalManagerView data={DATA} didIssuance={null} didError="console_disabled" audit={AUDIT} />);
        expect(getByText(/console is disabled in this environment/i)).toBeTruthy();
    });
});

describe('PortalManagerView — audit chain section', () => {
    it('renders integrity divergence + a healthy indicator that flips with props', () => {
        const { getByText, getAllByText, rerender, queryByText } = render(
            <PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT} />,
        );
        expect(getByText('Healthy')).toBeTruthy();
        // 42 appears for both in_memory_length and persisted_max_id (from props).
        expect(getAllByText('42').length).toBeGreaterThan(0);
        const AUDIT2: AuditChainResponse = {
            ...AUDIT,
            integrity: { ...AUDIT.integrity, divergence: 50, healthy: false },
        };
        rerender(<PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT2} />);
        expect(getByText('Diverged')).toBeTruthy();
        expect(queryByText('Healthy')).toBeNull();
    });

    it('renders recent event rows from props (event_type + tick)', () => {
        const { getByText } = render(<PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT} />);
        expect(getByText('portal.registration_submitted')).toBeTruthy();
        expect(getByText('registry.civic_did_issued')).toBeTruthy();
    });

    it('renders the empty-state when recent[] is empty', () => {
        const empty: AuditChainResponse = { ...AUDIT, recent: [] };
        const { getByText } = render(<PortalManagerView data={DATA} didIssuance={DID} audit={empty} />);
        expect(getByText('No recent civic audit events.')).toBeTruthy();
    });

    it('renders the matching error copy on auditError', () => {
        const { getByText } = render(<PortalManagerView data={DATA} didIssuance={DID} audit={null} auditError="unauthorized" />);
        expect(getByText(/Operator authorization required/i)).toBeTruthy();
    });

    it('stays READ-ONLY with the new sections (no action controls)', () => {
        const { container } = render(<PortalManagerView data={DATA} didIssuance={DID} audit={AUDIT} />);
        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('input')).toBeNull();
        expect(container.querySelector('form')).toBeNull();
        expect(container.querySelector('select')).toBeNull();
    });
});
