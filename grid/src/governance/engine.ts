/**
 * GovernanceEngine — wires onTickClosed deadline scan + tally trigger + law promotion.
 *
 * SSR-safe: no module-level singleton. Caller (GenesisLauncher, replay harness,
 * test suite) constructs an instance and passes it explicitly.
 *
 * Wall-clock ban: no Date.now / Math.random — tick comes from caller (D-12-03 / D-12-11).
 *
 * Phase 12 Wave 2 — VOTE-04 / D-12-03 / CONTEXT-12.
 */

import type { AuditChain } from '../audit/chain.js';
import type { LogosEngine } from '../logos/engine.js';
import type { NousRegistry } from '../registry/registry.js';
import { appendProposalTallied } from './appendProposalTallied.js';
import type { GovernanceStore } from './store.js';

export class GovernanceEngine {
    constructor(
        private readonly audit: AuditChain,
        private readonly store: GovernanceStore,
        private readonly registry: NousRegistry,
        private readonly logos: LogosEngine,
    ) {}

    /**
     * Called by GenesisLauncher's clock.onTick (Wave 3 wires this).
     *
     * Scans for proposals where currentTick >= deadline_tick AND status === 'open',
     * calls appendProposalTallied for each, which handles tally + law promotion.
     */
    async onTickClosed(currentTick: number): Promise<void> {
        const openProposals = await this.store.getOpenProposals();
        for (const p of openProposals) {
            if (currentTick >= p.deadline_tick) {
                await appendProposalTallied(this.audit, {
                    proposal_id: p.proposal_id,
                    currentTick,
                    store: this.store,
                    registry: this.registry,
                    logos: this.logos,
                });
            }
        }
    }
}
