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
import type { RoleEdge } from './roles.js';
import { UPKEEP_PERIOD_TICKS, RECLAIM_GRACE_PERIODS, upkeepDue } from './founding-law.js';
import { appendTreasuryUpkeepCollected } from '../audit/append-treasury-upkeep-collected.js';
import { appendZoningConditionChanged } from '../audit/append-zoning-condition-changed.js';
import { appendZoningParcelReclaimed } from '../audit/append-zoning-parcel-reclaimed.js';
import { appendZoningRoleRevoked } from '../audit/append-zoning-role-revoked.js';

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
    /** Ladder transitions (delegate to ParcelRegistry). `tick` stamps the roles a reclaim ends. */
    advanceCondition(address: string, tick: number): 'worn' | 'derelict' | 'reclaimed';
    resetCondition?(address: string): void;
    /** Role edges on a parcel — read before a reclaim so each role it ends reaches the chain. */
    rolesFor?(address: string): RoleEdge[];
    /** Read back current ladder state after a transition (for the emitted condition). */
    getParcel?(address: string): Parcel | undefined;
    /** DB-first persisters (delegate to ParcelStore). Optional so mocks may omit them. */
    persistUpkeep?(parcel: Parcel): Promise<void> | void;
    persistReclaim?(parcel: Parcel, tick: number): Promise<void> | void;
}

/** The slice of ParcelRegistry / ParcelStore the production facade is composed from. */
export interface UpkeepFacadeRegistry {
    list(filter?: { ownerDid?: string | null }): Parcel[];
    advanceCondition(address: string, tick: number): 'worn' | 'derelict' | 'reclaimed';
    resetCondition(address: string): void;
    stampUpkeep(address: string, tick: number): void;
    rolesFor(address: string): RoleEdge[];
}
export interface UpkeepFacadeStore {
    persistUpkeep(parcel: Parcel): Promise<void>;
    persistReclaim(parcel: Parcel, tick: number): Promise<void>;
}

/**
 * The production UpkeepRegistry: parcel-registry ladder + parcel-store persistence.
 * main.ts wires exactly this, and the tests exercise exactly this.
 */
export function createUpkeepRegistryFacade(
    registry: UpkeepFacadeRegistry,
    store: UpkeepFacadeStore,
): UpkeepRegistry {
    return {
        list: (filter) => registry.list(filter),
        advanceCondition: (address, tick) => registry.advanceCondition(address, tick),
        resetCondition: (address) => registry.resetCondition(address),
        rolesFor: (address) => registry.rolesFor(address),
        persistUpkeep: async (parcel) => {
            // Memory first: the scanner reads what is due from memory, and by now the
            // owner has already been charged (or has already slipped a rung). If the
            // database write below fails, the worst case is one repeated assessment
            // after a restart — not one on every tick while the database is down.
            if (parcel.lastUpkeepTick !== undefined) registry.stampUpkeep(parcel.id, parcel.lastUpkeepTick);
            await store.persistUpkeep(parcel);
        },
        persistReclaim: (parcel, tick) => store.persistReclaim(parcel, tick),
    };
}

/**
 * How many ticks the Grid has ever run, read from its own chain: every tick of every
 * earlier run is a `tick` entry there. The clock starts again from 0 at each start, so
 * a period measured on the clock alone would be pushed back by every restart, and in a
 * Grid restarted more often than a period upkeep would never fall due again.
 */
export function ticksRecorded(entries: Iterable<{ eventType: string }>): number {
    let n = 0;
    for (const entry of entries) if (entry.eventType === 'tick') n++;
    return n;
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
    /** The Polis treasury DID. No longer read here: a reclaimed parcel has no owner. */
    treasuryDid: string;
    /** Grid name for the Ledger-A charge keying. */
    gridName: string;
    /** Atomic owner nous_accounts → civic_treasury upkeep charge (Ledger A). */
    accountStore: UpkeepAccountStore;
    /**
     * Ticks the Grid ran before this start (`ticksRecorded` of the restored chain; 0 when
     * there is none). Periods and `last_upkeep_tick` are counted in lifetime ticks — this
     * plus the clock's tick — so a restart neither postpones nor brings forward what is
     * due. Events and the ledger still carry the clock's own tick.
     */
    ticksBeforeStart?: number;
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
 * A write that fails must not reject out of the sweep: the tick callback does not await
 * it, and an unhandled rejection ends the Grid process. Memory is already ahead of the
 * database at this point; the warning is what makes that visible.
 */
async function persistOrWarn(what: string, parcelId: string, write: () => Promise<void> | void | undefined): Promise<void> {
    try {
        await write();
    } catch (e) {
        console.warn(`[upkeep] ${what}_failed parcel_id=${parcelId}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/**
 * An event that cannot be written must not undo what already happened, nor reject out of
 * the sweep. By the time an event is written the charge or the ladder step is done and
 * recorded; the warning is what is left to say about it.
 */
function emitOrWarn(what: string, parcelId: string, emit: () => void): void {
    try {
        emit();
    } catch (e) {
        console.warn(`[upkeep] ${what}_event_failed parcel_id=${parcelId}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/**
 * Assess upkeep for every owned non-commons parcel at a period boundary. Fire-and-forget
 * from the existing tick callback — never blocks the clock, never throws out (each parcel
 * is assessed in isolation; a failure on one does not stop the sweep).
 */
export async function onUpkeepTick(tick: number, deps: UpkeepScannerDeps): Promise<void> {
    const { registry, audit, gridName, accountStore } = deps;
    const age = tick + (deps.ticksBeforeStart ?? 0); // lifetime ticks: what periods are counted in
    for (const parcel of registry.list()) {
        // Polis Commons are EXEMPT — never debited, never decayed.
        if (isCommons(parcel)) continue;
        if (parcel.lastUpkeepTick !== undefined && parcel.lastUpkeepTick > age) {
            // The stamp is ahead of the Grid's lifetime count: the chain that count is
            // read from holds fewer ticks than it did when the stamp was written (ticks
            // not yet saved at an unclean stop, a pruned chain, an older copy restored).
            // Start the period again from now, with no charge and no decay, rather than
            // wait in silence for the count to catch up.
            console.warn(`[upkeep] upkeep_stamp_ahead parcel_id=${parcel.id} stamp=${parcel.lastUpkeepTick} lifetime=${age}`);
            await persistOrWarn('upkeep_restamp', parcel.id, () => registry.persistUpkeep?.({ ...parcel, lastUpkeepTick: age }));
            continue;
        }
        if (!periodDue(parcel, age)) continue;

        const ownerDid = parcel.ownerDid as string;
        const due = upkeepDue(parcel);
        const ownerHash = sha256Hex(ownerDid);

        if (due > 0) {
            let charged = false;
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
                charged = true;
            } catch (e) {
                if (!(e instanceof Error && e.message === 'insufficient_balance')) {
                    // Non-affordability error — preserve per-parcel isolation: skip this
                    // parcel, do NOT abort the sweep, do NOT decay on a transient DB fault.
                    // WR-06: a hard failure (e.g. a broken charge rail — the exact defect that
                    // hid CR-01) must be OBSERVABLE, not silently swallowed. Mirror the market
                    // skim's `skim_charge_failed` log so a real SQL fault surfaces per parcel.
                    console.warn(
                        `[upkeep] upkeep_charge_failed parcel_id=${parcel.id}: ${e instanceof Error ? e.message : String(e)}`,
                    );
                    continue;
                }
                // insufficient_balance → fall through to the decay ladder below.
            }
            if (charged) {
                // The owner has paid. Record the period before anything else can fail: a
                // paid period that memory does not know is charged again on the next tick.
                registry.resetCondition?.(parcel.id);
                const settled: Parcel = {
                    ...parcel,
                    lastUpkeepTick: age,
                    missedPeriods: 0,
                    condition: 'maintained',
                };
                await persistOrWarn('upkeep_persist', parcel.id, () => registry.persistUpkeep?.(settled));
                emitOrWarn('upkeep', parcel.id, () => appendTreasuryUpkeepCollected(audit as never, {
                    amount_wei: due,
                    owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    tick,
                }));
                continue;
            }
        }

        {
            // INSUFFICIENT (or nothing owed but a real period missed) — advance the ladder.
            if (parcel.missedPeriods + 1 >= RECLAIM_GRACE_PERIODS.reclaim) {
                // This miss reclaims the parcel. Database first: if the write fails nothing
                // has changed yet, the parcel is still due, and the next sweep tries again.
                // (Reclaiming in memory first would leave a pool parcel whose row still
                // names the former owner, and a later buyer would inherit that row.)
                const reclaimed: Parcel = {
                    ...parcel,
                    ownerDid: null, // back to the pool, as the registry and the database record it
                    structure: null,
                    condition: 'maintained',
                    missedPeriods: 0,
                    lastUpkeepTick: age,
                };
                try {
                    await registry.persistReclaim?.(reclaimed, tick);
                } catch (e) {
                    console.warn(`[upkeep] reclaim_persist_failed parcel_id=${parcel.id}: ${e instanceof Error ? e.message : String(e)}`);
                    continue;
                }
            }
            const rolesBefore = (registry.rolesFor?.(parcel.id) ?? []).filter((e) => e.revoked_tick === undefined);
            const state = registry.advanceCondition(parcel.id, tick);
            if (state === 'reclaimed') {
                // The roles the reclaim ended, each on the chain before the reclaim itself.
                for (const edge of rolesBefore) {
                    emitOrWarn('role_revoked', parcel.id, () => appendZoningRoleRevoked(audit as never, {
                        holder_civic_did_hash: sha256Hex(edge.holder_civic_did),
                        parcel_id: parcel.id,
                        reason: 'severance_complete',
                        tick,
                    }));
                }
                emitOrWarn('reclaim', parcel.id, () => appendZoningParcelReclaimed(audit as never, {
                    former_owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    reason: 'upkeep_default',
                    tick,
                }));
            } else {
                // worn | derelict — record the rung (memory, then the database) before the
                // event: a rung memory has not stamped is taken again on the next tick.
                const advanced: Parcel = {
                    ...parcel,
                    condition: state as ParcelCondition,
                    missedPeriods: parcel.missedPeriods + 1,
                    lastUpkeepTick: age,
                };
                await persistOrWarn('ladder_persist', parcel.id, () => registry.persistUpkeep?.(advanced));
                emitOrWarn('condition', parcel.id, () => appendZoningConditionChanged(audit as never, {
                    condition: state as ParcelCondition,
                    owner_civic_did_hash: ownerHash,
                    parcel_id: parcel.id,
                    tick,
                }));
            }
        }
    }
}
