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
import { onLawEnacted as ringExpansionOnLawEnacted, type RingExpansionDeps } from '../civic/ring-expansion.js';
import type { LogosEngine } from '../logos/engine.js';
import type { NousRegistry } from '../registry/registry.js';
import { appendProposalTallied } from './appendProposalTallied.js';
import type { GovernanceStore } from './store.js';

export class GovernanceEngine {
    /**
     * Phase 60 HOUSE-3 (D-60-08 / R-60-10) — ring-expansion template deps, LATE-WIRED by the
     * bootstrap (main.ts) once the parcel registry + founding-law read-through exist (mirrors
     * attachUpkeepScanner). Undefined in pure-governance contexts (tests / replay without civic
     * land), in which case the dispatch simply skips the template (no-op). NOT a new event /
     * governance path / clock.onTick.
     */
    private ringDeps?: RingExpansionDeps;

    constructor(
        private readonly audit: AuditChain,
        private readonly store: GovernanceStore,
        private readonly registry: NousRegistry,
        private readonly logos: LogosEngine,
    ) {}

    /**
     * Phase 60 HOUSE-3 (D-60-08 / R-60-10) — late-wire the ring-expansion template deps so the
     * EXISTING gov.law_enacted dispatch (appendProposalTallied passed-branch) hands each enacted
     * bill body to the template. seedZone/alreadySeeded come from the parcel registry + founding
     * law; amendConstant records a Polis override (founding-law.recordPolisOverride). Mirrors the
     * upkeep-scanner late-wire pattern — keeps the constructor signature unchanged.
     */
    attachRingExpansion(deps: RingExpansionDeps): void {
        this.ringDeps = deps;
    }

    /**
     * Called by GenesisLauncher's clock.onTick (Wave 3 wires this).
     *
     * Scans for proposals where currentTick >= deadline_tick AND status === 'open',
     * calls appendProposalTallied for each, which handles tally + law promotion + (when
     * ringDeps is wired) the ring-expansion template at the gov.law_enacted dispatch.
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
                    ringDeps: this.ringDeps,
                });
            }
        }
    }

    /**
     * Phase 60 HOUSE-3 (D-60-08 / R-60-10) — ring-expansion bill TEMPLATE hook, retained as a thin
     * direct-invoke seam. The GENUINE production dispatch fires the template from the enactment
     * site (onTickClosed → appendProposalTallied passed-branch, using the late-wired ringDeps); this
     * method lets a caller/test drive the template against an enacted body in isolation.
     *
     * The enacted bill body is handed to the ring-expansion template, which fires ONLY on its own
     * body shapes ({action:'seed_ring',ring} → seedZone + gravity; {action:'amend_law',key,value} →
     * Polis override) and IGNORES everything else. This is NOT a new governance path, NOT a new
     * event, and adds NO `clock.onTick` — it rides the existing legislative dispatch verbatim.
     * Synchronous + side-effect-only (no append): VOTE-05 + R-31-01 are preserved.
     */
    onLawEnacted(billBody: unknown, deps: RingExpansionDeps): void {
        ringExpansionOnLawEnacted(billBody, deps);
    }
}
