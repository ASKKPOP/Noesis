'use client';
/**
 * useGovernanceProposals — SWR hook for the governance proposals list endpoint.
 *
 * Endpoint: GET /api/v1/governance/proposals
 * Response: { proposals: ProposalSummary[] }
 *
 * Polling: refreshInterval 2000ms, revalidateOnFocus: false
 * (Clones Phase 9 relationships SWR pattern — D-9-13 / D-12-09.)
 *
 * Privacy:
 *   - Returns aggregate proposal summaries only (no body_text, no voter choice)
 *   - H1+ can view this endpoint (operator read-only, VOTE-05 / D-12-09)
 *
 * Wall-clock ban: no Date.now / Math.random in this hook.
 * Tick numbers come from the server in the response.
 *
 * Phase 12 Wave 4 — VOTE-07 / D-12-09 / T-09-16 (SWR storm mitigation).
 */

import useSWR from 'swr';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'open' | 'tallied';
export type ProposalOutcome = 'passed' | 'rejected' | 'quorum_fail';

/**
 * Aggregate summary of a governance proposal.
 * Shape matches GET /api/v1/governance/proposals response entries.
 * No body_text, no voter_did breakdown — H1+ safe.
 */
export interface ProposalSummary {
    proposal_id: string;
    status: ProposalStatus;
    opened_at_tick: number;
    deadline_tick: number;
    commit_count: number;
    reveal_count: number;
    outcome?: ProposalOutcome;
}

interface ProposalsResponse {
    proposals: ProposalSummary[];
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchProposals(): Promise<ProposalSummary[]> {
    const resp = await fetch('/api/v1/governance/proposals');
    if (!resp.ok) {
        throw new Error(`governance/proposals fetch failed: ${resp.status}`);
    }
    const data: ProposalsResponse = await resp.json();
    return data.proposals ?? [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * SWR hook for the governance proposals list.
 * Returns { proposals, isLoading, error }.
 *
 * T-09-16 mitigation: refreshInterval: 2000 with revalidateOnFocus: false
 * bounds the SWR request rate. Operator concurrency is small (≤5 in v2.2).
 */
export function useGovernanceProposals(): {
    proposals: ProposalSummary[];
    isLoading: boolean;
    error: Error | null;
} {
    const { data, error, isLoading } = useSWR<ProposalSummary[], Error>(
        'governance-proposals',
        fetchProposals,
        {
            refreshInterval: 2000,
            revalidateOnFocus: false,
        },
    );

    return {
        proposals: data ?? [],
        isLoading,
        error: error ?? null,
    };
}
