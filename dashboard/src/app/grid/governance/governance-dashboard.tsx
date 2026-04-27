'use client';
import React from 'react';
/**
 * GovernanceDashboard — client component for /grid/governance.
 *
 * Renders a table of governance proposals for H1+ operators (read-only per VOTE-05).
 * Tier-aware affordances:
 *   H1: list visible; "View body" disabled; "View votes" NOT rendered
 *   H2+: "View body" enabled (fetches body via H2+ endpoint)
 *   H5: "View votes" button rendered and clickable (opens VotingHistoryModal)
 *
 * VOTE-05 INVARIANT: No propose, commit, or reveal button exists in this component
 * at any tier including H5. This dashboard is STRICTLY read-only for operators.
 *
 * SWR polling: refreshInterval 2000ms, revalidateOnFocus: false (T-09-16 mitigation).
 *
 * Wall-clock ban: tick numbers come from server; no Date.now used for tick display.
 *
 * Phase 12 Wave 4 — VOTE-07 / D-12-09 / T-09-15 / T-09-16.
 */

import { useState } from 'react';
import { useGovernanceProposals } from './use-governance-proposals';
import type { ProposalSummary } from './use-governance-proposals';
import { VotingHistoryModal } from './voting-history-modal';

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernanceDashboardProps {
    /** Operator tier from x-operator-tier request header (1–5). */
    tier: 1 | 2 | 3 | 4 | 5;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceDashboard({ tier }: GovernanceDashboardProps) {
    const { proposals, isLoading, error } = useGovernanceProposals();
    const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
    const [bodyExpanded, setBodyExpanded] = useState<Record<string, string | null>>({});
    const [bodyLoading, setBodyLoading] = useState<Record<string, boolean>>({});

    // ── Handle body fetch ─────────────────────────────────────────────────────
    const handleViewBody = async (proposalId: string) => {
        if (bodyExpanded[proposalId] !== undefined) {
            // Toggle collapse
            setBodyExpanded((prev) => ({ ...prev, [proposalId]: prev[proposalId] ? null : prev[proposalId] }));
            return;
        }
        setBodyLoading((prev) => ({ ...prev, [proposalId]: true }));
        try {
            const resp = await fetch(`/api/v1/governance/proposals/${proposalId}/body`, {
                headers: { 'x-operator-tier': String(tier) },
            });
            if (resp.ok) {
                const data = await resp.json();
                setBodyExpanded((prev) => ({ ...prev, [proposalId]: data.body_text ?? '(empty)' }));
            } else {
                setBodyExpanded((prev) => ({ ...prev, [proposalId]: `Error ${resp.status}` }));
            }
        } catch {
            setBodyExpanded((prev) => ({ ...prev, [proposalId]: 'Network error' }));
        } finally {
            setBodyLoading((prev) => ({ ...prev, [proposalId]: false }));
        }
    };

    // ── States ────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div role="status" className="text-xs text-neutral-400">
                Loading proposals…
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="text-xs text-rose-400">
                <span>Failed to load proposals: {error.message}</span>
                <button
                    className="ml-2 underline text-neutral-300"
                    onClick={() => window.location.reload()}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (proposals.length === 0) {
        return (
            <p className="text-xs text-neutral-400">No open proposals.</p>
        );
    }

    // ── Proposal list ─────────────────────────────────────────────────────────
    return (
        <div data-testid="proposals-list">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="text-neutral-500 text-left">
                        <th className="pb-2 pr-3">Proposal</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3">Opened</th>
                        <th className="pb-2 pr-3">Deadline</th>
                        <th className="pb-2 pr-3">Commits</th>
                        <th className="pb-2 pr-3">Reveals</th>
                        <th className="pb-2 pr-3">Outcome</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {proposals.map((p: ProposalSummary) => (
                        <React.Fragment key={p.proposal_id}>
                            <tr className="border-t border-neutral-800">
                                <td className="py-1 pr-3 font-mono">
                                    {/* Truncate proposal_id to 8 chars */}
                                    {p.proposal_id.slice(0, 8)}
                                </td>
                                <td className="py-1 pr-3">{p.status}</td>
                                <td className="py-1 pr-3">tick {p.opened_at_tick}</td>
                                <td className="py-1 pr-3">tick {p.deadline_tick}</td>
                                <td className="py-1 pr-3">{p.commit_count}</td>
                                <td className="py-1 pr-3">{p.reveal_count}</td>
                                <td className="py-1 pr-3">{p.outcome ?? '—'}</td>
                                <td className="py-1 flex gap-2">
                                    {/* "View body" — H2+ enabled, H1 disabled with tooltip */}
                                    <button
                                        data-testid="view-body-btn"
                                        disabled={tier < 2}
                                        title={tier < 2 ? 'H2+ required to view proposal body' : undefined}
                                        onClick={() => tier >= 2 && handleViewBody(p.proposal_id)}
                                        className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {bodyLoading[p.proposal_id] ? '…' : 'View body'}
                                    </button>

                                    {/* "View votes" — H5 ONLY. NOT rendered for H1–H4 (VOTE-05). */}
                                    {tier >= 5 && (
                                        <button
                                            data-testid="view-votes-btn"
                                            onClick={() => setSelectedProposal(p.proposal_id)}
                                            className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-neutral-200"
                                        >
                                            View votes
                                        </button>
                                    )}
                                </td>
                            </tr>
                            {/* Inline body expansion row */}
                            {bodyExpanded[p.proposal_id] && (
                                <tr className="bg-neutral-900">
                                    <td colSpan={8} className="px-2 py-1 text-xs text-neutral-300 font-mono whitespace-pre-wrap">
                                        {bodyExpanded[p.proposal_id]}
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {/* H5-only VotingHistoryModal (VOTE-07 / D-12-09) */}
            {tier >= 5 && selectedProposal && (
                <VotingHistoryModal
                    isOpen={selectedProposal !== null}
                    proposalId={selectedProposal}
                    onClose={() => setSelectedProposal(null)}
                />
            )}
        </div>
    );
}
