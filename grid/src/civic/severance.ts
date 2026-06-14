/**
 * Phase 60 HOUSE-3 (A6 / D-60-02 / R-60-03) — the severance state machine.
 *
 * Role / agreement / shop-binding termination follows a single closed FSM:
 *
 *   ACTIVE → NOTICE → SETTLEMENT → WIND_DOWN → REVOKE → ARCHIVED
 *
 * NEVER a hard kill: capabilities are removed ONLY at REVOKE, and at ARCHIVED the
 * RoleEdge is downgraded to retained history (a revoked_tick stamp) — the edge is
 * NEVER deleted, so a later re-grant resumes the holder's existing trust_score.
 *
 * SETTLEMENT drains outstanding IOUs for the pair BEFORE the FSM reaches REVOKE
 * (D-NH-06 — co-work is always paid). The drain is an injected callback so the FSM
 * stays pure; `makeIouDrain` below builds the REAL ledger-backed drain (Wave 2),
 * settling every open IOU between the pair via credit-ledger.settleIou before REVOKE.
 *
 * A FOR-CAUSE breach SHORT-CIRCUITS from ACTIVE/NOTICE straight to SETTLEMENT with a
 * dispute flag carrying a dispute_route pointer to Phase 47 Police — no adjudication
 * happens here (Phase 60 only flags + short-circuits).
 *
 * The FSM is REQUEST-DRIVEN: it is stepped by revokeRole / unbind-shop callers, NOT
 * by a clock.onTick scan (single-onTick invariant R-H-03 / D-60-11 preserved).
 */

import { outstandingBetween, settleIou, type LedgerDeps } from './credit-ledger.js';

export type SeveranceState =
    | 'ACTIVE'
    | 'NOTICE'
    | 'SETTLEMENT'
    | 'WIND_DOWN'
    | 'REVOKE'
    | 'ARCHIVED';

/** Pointer to the Phase 47 Police dispute pipeline (for-cause breaches only). */
export const DISPUTE_ROUTE_POLICE = 'phase47:police:dispute';

export interface SeveranceContext {
    state: SeveranceState;
    parcel_id: string;
    host: string;
    holder: string;
    /** For-cause breach: short-circuit to SETTLEMENT with a dispute flag (Phase 47). */
    forCause?: boolean;
    /** SETTLEMENT hook: drain outstanding IOUs for the pair before REVOKE (Wave 2 wires it). */
    drainIous?: () => void;
    /** REVOKE hook: strip capabilities (removed ONLY here — not earlier). */
    removeCapabilities?: () => void;
    /**
     * Edge-delete hook that MUST NOT be called: severance downgrades to history, never
     * a hard kill. Present in the context only so a test can prove it is never invoked.
     */
    deleteEdge?: () => void;
    /** Carried out when a for-cause breach flags a dispute (Wave 4 emits / routes it). */
    flagDispute?: (route: string) => void;
}

/**
 * Step the severance FSM exactly one transition and return the next state.
 *
 * Normal path: each state advances to the next in order. For-cause short-circuits
 * ACTIVE/NOTICE → SETTLEMENT. Side effects fire on the transition OUT of the state
 * they belong to: drain at SETTLEMENT, capability removal at REVOKE. ARCHIVED is the
 * terminal state and returns itself.
 */
export function advanceSeverance(ctx: SeveranceContext): SeveranceState {
    switch (ctx.state) {
        case 'ACTIVE':
            // For-cause breach short-circuits NOTICE → straight to SETTLEMENT, flagging
            // the dispute with a pointer to Phase 47 Police (no adjudication here).
            if (ctx.forCause) {
                ctx.flagDispute?.(DISPUTE_ROUTE_POLICE);
                return 'SETTLEMENT';
            }
            return 'NOTICE';

        case 'NOTICE':
            // A breach discovered during NOTICE also short-circuits to SETTLEMENT.
            if (ctx.forCause) {
                ctx.flagDispute?.(DISPUTE_ROUTE_POLICE);
                return 'SETTLEMENT';
            }
            return 'SETTLEMENT';

        case 'SETTLEMENT':
            // Drain outstanding IOUs for the pair BEFORE we proceed toward REVOKE.
            ctx.drainIous?.();
            return 'WIND_DOWN';

        case 'WIND_DOWN':
            return 'REVOKE';

        case 'REVOKE':
            // Capabilities are removed ONLY here. The edge is downgraded to history at
            // ARCHIVED (revoked_tick stamp) — deleteEdge is intentionally NEVER called.
            ctx.removeCapabilities?.();
            return 'ARCHIVED';

        case 'ARCHIVED':
        default:
            return 'ARCHIVED';
    }
}

/**
 * Build the REAL ledger-backed SETTLEMENT drain (Wave 2): a `drainIous` hook that
 * settles EVERY outstanding IOU between the pair (in either direction) BEFORE the FSM
 * reaches REVOKE — D-NH-06 (co-work is always paid; nothing is left owed on revoke).
 *
 * Uses outstandingBetween + settleIou; the settle flips bookkeeping only (any Ousia move
 * is the cowork/severance caller's job). Persistence rides the optional LedgerDeps so the
 * settle is DB-first when a store is wired (tests pass none → pure memory).
 */
export function makeIouDrain(host: string, holder: string, tick: number, deps: LedgerDeps = {}): () => void {
    return () => {
        for (const iou of outstandingBetween(host, holder)) {
            settleIou(iou.iou_id, tick, deps);
        }
    };
}
