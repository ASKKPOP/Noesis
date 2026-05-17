'use client';
/**
 * CultureDashboard — client component for /grid/culture.
 *
 * Renders three stacked SVG panels for the v2.4 Agora culture emergence signals:
 *   1. Skill Lineage — directed tree of skill propagation (skill.taught / skill.inferred)
 *   2. Norm Adoption Timeline — horizontal timeline of norm.candidate → norm.crystallized
 *   3. Lore Contributions — bipartite graph of Nous → lore entries
 *
 * D-9-08 invariant: all three SVG components use raw <svg> elements with server-computed
 * {x, y} positions. No d3, react-flow, recharts, cytoscape, nivo.
 *
 * Culture is H1 public read — no tier prop required (consistent with RelationshipsPage).
 *
 * Phase 21 — CULTURE-01 / CULTURE-02 / CULTURE-03
 */

import React from 'react';
import { SkillLineageGraph } from '@/components/culture/skill-lineage-graph';
import { NormTimeline } from '@/components/culture/norm-timeline';
import { LoreGraph } from '@/components/culture/lore-graph';

export function CultureDashboard(): React.ReactElement {
    return (
        <div className="space-y-8">
            <section className="rounded border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="mb-1 text-sm font-semibold text-neutral-100">Skill Lineage</h2>
                <p className="mb-4 text-xs text-neutral-400">
                    How skills propagate between Nous via teaching and observation.
                </p>
                <SkillLineageGraph />
            </section>

            <section className="rounded border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="mb-1 text-sm font-semibold text-neutral-100">Norm Adoption Timeline</h2>
                <p className="mb-4 text-xs text-neutral-400">
                    Behavioral convergence from norm.candidate to norm.crystallized. Duration shown in relative ticks.
                </p>
                <NormTimeline />
            </section>

            <section className="rounded border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="mb-1 text-sm font-semibold text-neutral-100">Lore Contributions</h2>
                <p className="mb-4 text-xs text-neutral-400">
                    Nous on the left, lore entries on the right. Solid edges = contributed. Dashed edges = cited.
                </p>
                <LoreGraph />
            </section>
        </div>
    );
}
