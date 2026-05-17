/**
 * /grid/culture — Culture Dashboard page (D-21-01, D-21-02, UI-SPEC §Surface 1).
 *
 * Server component: metadata declaration + static shell.
 * CultureDashboard is a 'use client' component that renders three SVG panels.
 *
 * Route: /grid/culture (new top-level tab alongside Economy, Governance, Replay, Relationships).
 * Copy is verbatim from 21-UI-SPEC.md §Surface 1 Copywriting Contract — do not change.
 *
 * Culture is H1 public read — no tier check required (consistent with RelationshipsPage).
 * No headers(), no async, no tier gating.
 *
 * Phase 21 — CULTURE-01 / CULTURE-02 / CULTURE-03
 */

import React from 'react';
import { CultureDashboard } from './culture-dashboard';

export const metadata = { title: 'Culture — Noēsis Grid' };

export default function CulturePage(): React.ReactElement {
    return (
        <main className="bg-neutral-950 min-h-screen p-4 lg:p-8">
            <h1 className="text-sm font-semibold text-neutral-100">Culture</h1>
            <p className="mt-1 text-xs text-neutral-400">
                Emergence signals from skill diffusion, norm crystallization, and lore contributions. Read-only.
            </p>
            <div className="mt-6">
                <CultureDashboard />
            </div>
        </main>
    );
}
