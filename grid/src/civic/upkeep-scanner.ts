/**
 * Phase 59 HOUSE-2 (D-NH-03 / D-59-05/06/07/09 / R-59-06/07) — tick-driven upkeep scanner.
 *
 * Makes ownership COST something. `onUpkeepTick(tick, deps)` rides the EXISTING
 * tick callback in `grid/src/genesis/launcher.ts` fire-and-forget, exactly mirroring
 * `governance.onTickClosed(event.tick)` — this module adds NO tick subscription of its
 * own (R-H-03 single-onTick invariant) and uses NO wallclock (all timing is tick-based;
 * the wallclock CI gate stays green).
 *
 * Lazy period-boundary assessment: for each OWNED, NON-commons parcel whose
 * `last_upkeep_tick` is a full UPKEEP_PERIOD_TICKS (or more) behind `tick` (or
 * undefined), a period is DUE:
 *   - FUNDED  → chargeToTreasury(owner nous_accounts → civic_treasury, upkeepDue)
 *               atomically (Phase 62.6-02, Ledger A) + emit treasury.upkeep_collected
 *               + resetCondition + persistUpkeep.
 *   - INSUFFICIENT → advanceCondition (ladder maintained→worn→derelict) + emit
 *               zoning.condition_changed; at the reclaim threshold the registry
 *               reclaims to treasury and the scanner emits zoning.parcel_reclaimed +
 *               persistReclaim.
 * `last_upkeep_tick` advances to `tick` either way so the next assessment is the
 * next boundary. Polis Commons (owner_civic_did NULL, rings 0–1) are SKIPPED
 * entirely — never debited, never decayed.
 */
import { createHash } from 'node:crypto';
import type { Parcel, ParcelCondition } from './types.js';
import { UPKEEP_PERIOD_TICKS, upkeepDue } from './founding-law.js';
import { appendTreasuryUpkeepCollected } from '../audit/append-treasury-upkeep-collected.js';
import { appendZoningConditionChanged } from '../audit/append-zoning-condition-changed.js';
import { appendZoningParcelReclaimed } from '../audit/append-zoning-parcel-reclaimed.js';

/** sha256 hex — the HEX64 owner-hash discipline the zoning.* / treasury.* producers expect. */
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * The registry facade the scanner needs. In production this is composed in the
 * launcher from the parcel registry (list/ladder) and the parcel store (persist).
 * The owner→treasury money move is now an atomic Ledger-A charge via `accountStore`
 * (below), not this facade. The tests pass a single mock object.
 */
export interface UpkeepRegistry {
    /** All parcels (deep copies) for this grid. */
    list(filter?: { ownerDid?: string | null }): Parcel[];
    /** Ladder transitions (delegate to ParcelRegistry). */
    advanceCondition(address: string): 'worn' | 'derelict' | 'reclaimed';
    resetCondition?(address: string): void;
    /** Read back current ladder state after a transition (for the emitted condition). */
    getParcel?(address: string): Parcel | undefined;
    /** DB-first persisters (delegate to ParcelStore). Optional so mocks may omit them. */
    persistUpkeep?(parcel: Parcel): Promise<void> | void;
    persistReclaim?(parcel: Parcel): Promise<void> | void;
}

/** Minimal audit surface — the sole-producer append-* functions call `append` on this. */
export interface UpkeepAudit {
    append(eventType: string, actorDid: string, payload: Record<string, unknown>): unknown;
}

/**
 * The atomic owner→civic_treasury charge seam (Phase 62.6-02). Backed in production by
 * `NousAccountStore.chargeToTreasury` (debit owner nous_accounts → credit civic_treasury
 * on one connection/transaction; throws 'insufficient_balance' when the owner cannot cover).
 */
export interface UpkeepAccountStore {
    chargeToTreasury(p: {
        gridName: string;
        civicDid: string;
        amountWei: bigint;
        currentTick: number;
    }): Promise<{ newBalance: bigint }>;
}

export interface UpkeepScannerDeps {
    registry: UpkeepRegistry;
    audit: UpkeepAudit;
    /** Retained for the reclaim path (ownerDid = treasuryDid on a reclaimed parcel). */
    treasuryDid: string;
    /** Grid name for the Ledger-A charge keying. */
    gridName: string;
    /** Atomic owner nous_accounts → civic_treasury upkeep charge (Ledger A). */
    accountStore: UpkeepAccountStore;
}

/** True if a parcel is Polis Commons (treasury-owned: owner_civic_did NULL) — upkeep-exempt. */
function isCommons(parcel: Parcel): boolean {
    return parcel.ownerDid === null || parcel.ownerDid === undefined;
}

/** True if a full UPKEEP_PERIOD_TICKS (or more) has elapsed since the last upkeep. */
function periodDue(parcel: Parcel, tick: number): boolean {
    if (parcel.lastUpkeepTick === undefined || parcel.lastUpkeepTick === null) return true;
    return tick - parcel.lastUpkeepTick >= UPKEEP_PERIOD_TICKS;
}

/**
 * Assess upkeep for every owned non-commons parcel at a period boundary. Fire-and-forget
 * from the existing tick callback — never blocks the clock, never throws out (each parcel
 * is assessed in isolation; a failure on one does not stop the sweep).
 */
export async function onUpkeepTick(tick: number, deps: UpkeepScannerDeps): Promise<void> {
    const { registry, audit, treasuryDid, gridName, accountStore } = deps;
    for (const parcel of registry.list()) {
        // Polis Commons are EXEMPT — never debited, never decayed.
        if (isCommons(parcel)) continue;
        if (!periodDue(parcel, tick)) continue;

        const ownerDid = parcel.ownerDid as string;
        const due = upkeepDue(parcel);
        const ownerHash = sha256Hex(ownerDid);

        if (due > 0) {
            try {
                // FUNDED — atomic owner nous_accounts → civic_treasury (Ledger A). The
                // affordability read collapses into the charge: chargeToTreasury does
                // SELECT … FOR UPDATE → debit → treasury credit in one transaction and
                // throws 'insufficient_balance' when the owner cannot cover.
                await accountStore.chargeToTreasury({
                    gridName,
                    civicDid: ownerDid,
                    amountWei: BigInt(due),
                    currentTick: tick,
                });
                appendTreasuryUpkeepCollected(audit as never, {
                    amount_wei: due,
                    owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    tick,
                });
                registry.resetCondition?.(parcel.id);
                const settled: Parcel = {
                    ...parcel,
                    lastUpkeepTick: tick,
                    missedPeriods: 0,
                    condition: 'maintained',
                };
                await registry.persistUpkeep?.(settled);
                continue;
            } catch (e) {
                if (!(e instanceof Error && e.message === 'insufficient_balance')) {
                    // Non-affordability error — preserve per-parcel isolation: skip this
                    // parcel, do NOT abort the sweep, do NOT decay on a transient DB fault.
                    continue;
                }
                // insufficient_balance → fall through to the decay ladder below.
            }
        }

        {
            // INSUFFICIENT (or nothing owed but a real period missed) — advance the ladder.
            const state = registry.advanceCondition(parcel.id);
            if (state === 'reclaimed') {
                appendZoningParcelReclaimed(audit as never, {
                    former_owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    reason: 'upkeep_default',
                    tick,
                });
                const reclaimed: Parcel = {
                    ...parcel,
                    ownerDid: treasuryDid,
                    structure: null,
                    condition: 'maintained',
                    missedPeriods: 0,
                    lastUpkeepTick: tick,
                };
                await registry.persistReclaim?.(reclaimed);
            } else {
                // worn | derelict — emit the new condition + persist the advanced ladder.
                appendZoningConditionChanged(audit as never, {
                    condition: state as ParcelCondition,
                    owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    tick,
                });
                const advanced: Parcel = {
                    ...parcel,
                    condition: state as ParcelCondition,
                    missedPeriods: parcel.missedPeriods + 1,
                    lastUpkeepTick: tick,
                };
                await registry.persistUpkeep?.(advanced);
            }
        }
    }
}
