/**
 * Phase 60 HOUSE-3 (D-60-05 / D-NH-06 / R-60-07) — the mutual-credit IOU ledger.
 *
 * Grounded by the WIR / Sardex / LETS mutual-credit tradition: v1 is BILATERAL
 * BOOKKEEPING, not a currency. An IouEntry is a payable from a debtor to a creditor.
 *
 *   v1 invariants (frozen this phase):
 *     - NO interest accrues over ticks (the amount is constant for the life of the IOU).
 *     - NOT transferable to a third DID (there is no transferIou / assignIou verb).
 *     - Bounded by a per-pair cap (IOU_PAIR_CAP_BIOS) + a global per-Nous debtor cap
 *       (IOU_GLOBAL_CAP_BIOS) — both live ONLY in founding-law.ts. Over-cap → throw.
 *
 * Recording an IOU emits NOTHING on chain — it is private bilateral bookkeeping. Only a
 * settlement that MOVES Ousia rides the existing registry.transferWei path; a pure
 * bookkeeping net (counter-IOU offset) moves no Ousia and emits nothing.
 *
 * Auto-netting: recording a counter-IOU between the same pair offsets the smaller against
 * the larger immediately (a payable and a counter-payable cancel up to the overlap). The
 * settleIou verb settles a single IOU when the debtor pays (request-driven, no tick scan).
 *
 * The ledger is module-level Grid-side state, mirrored DB-first by ParcelStore.persistIou /
 * persistIouSettle and rehydrated on boot. reason_ref bodies stay Grid-side (never on chain).
 */

import { IOU_PAIR_CAP_BIOS, IOU_GLOBAL_CAP_BIOS } from './founding-law.js';

/** A bilateral payable: the debtor owes the creditor `amount_wei` until settled. */
export interface IouEntry {
    iou_id: string;
    creditor_civic_did: string;
    debtor_civic_did: string;
    amount_wei: number;
    reason_ref: string;
    created_tick: number;
    /** null while outstanding; stamped with the settling tick once cleared. */
    settled_tick: number | null;
}

/** Optional persistence hooks (DB-first write-through). Tests run without them (pure memory). */
export interface LedgerDeps {
    persistIou?: (entry: IouEntry) => void;
    persistIouSettle?: (iouId: string, settledTick: number) => void;
}

/** Module-level ledger (Grid-side bookkeeping substrate). */
const ledger: IouEntry[] = [];
let seq = 0;

/** Reset the ledger (test isolation helper — production never calls this). */
export function _resetLedger(): void {
    ledger.length = 0;
    seq = 0;
}

/** All entries (deep copies) — used by ParcelStore.hydrate mirroring + dashboard reads. */
export function allIous(): IouEntry[] {
    return ledger.map(e => ({ ...e }));
}

/** Mirror a hydrated IOU row into memory (ParcelStore.hydrate calls this on boot). */
export function upsertIou(entry: IouEntry): void {
    if (!entry.iou_id) return; // defensive: ignore malformed rows (no id → nothing to anchor)
    const existing = ledger.find(e => e.iou_id === entry.iou_id);
    if (existing) {
        Object.assign(existing, entry);
    } else {
        ledger.push({ ...entry });
        const n = Number(entry.iou_id.replace(/^iou:/, ''));
        if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
}

/** Total outstanding payables where `did` is the DEBTOR (what `did` owes). */
export function outstandingFor(did: string): number {
    return ledger
        .filter(e => e.debtor_civic_did === did && e.settled_tick === null)
        .reduce((sum, e) => sum + e.amount_wei, 0);
}

/** Outstanding from `debtor` to `creditor` specifically (per-pair, directional). */
function outstandingPair(creditor: string, debtor: string): number {
    return ledger
        .filter(e =>
            e.creditor_civic_did === creditor &&
            e.debtor_civic_did === debtor &&
            e.settled_tick === null)
        .reduce((sum, e) => sum + e.amount_wei, 0);
}

/**
 * Record a bilateral payable (debtor owes creditor). Enforces the per-pair +
 * global debtor caps from founding-law (over-cap → throw). Auto-nets against any
 * outstanding counter-IOU (creditor↔debtor reversed): the smaller side cancels the
 * larger up to the overlap — a pure bookkeeping net that moves NO Ousia and emits
 * NOTHING on chain. Persists DB-first via deps.persistIou, then mirrors to memory.
 */
export function recordIou(
    creditor: string,
    debtor: string,
    amount: number,
    reasonRef: string,
    tick: number,
    deps: LedgerDeps = {},
): IouEntry {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(`iou_invalid_amount: ${amount} is not a positive integer`);
    }
    if (outstandingPair(creditor, debtor) + amount > IOU_PAIR_CAP_BIOS) {
        throw new Error(`iou_pair_cap_exceeded: per-pair limit ${IOU_PAIR_CAP_BIOS} Bios`);
    }
    if (outstandingFor(debtor) + amount > IOU_GLOBAL_CAP_BIOS) {
        throw new Error(`iou_global_cap_exceeded: global per-Nous limit ${IOU_GLOBAL_CAP_BIOS} Bios`);
    }

    const entry: IouEntry = {
        iou_id: `iou:${seq++}`,
        creditor_civic_did: creditor,
        debtor_civic_did: debtor,
        amount_wei: amount,
        reason_ref: reasonRef,
        created_tick: tick,
        settled_tick: null,
    };
    deps.persistIou?.(entry);
    ledger.push(entry);

    // Auto-net against an outstanding counter-IOU (debtor owes creditor here; the counter
    // is creditor owing debtor). Bookkeeping offset only — moves no Ousia, emits nothing.
    netCounter(entry, tick, deps);
    return { ...entry };
}

/**
 * Net `entry` against outstanding counter-IOUs (reversed pair). The smaller cancels the
 * larger up to the overlap; fully-cancelled IOUs are stamped settled at `tick`. No Ousia
 * moves and nothing is emitted (a counter-offset is bilateral bookkeeping).
 */
function netCounter(entry: IouEntry, tick: number, deps: LedgerDeps): void {
    const counters = ledger.filter(e =>
        e.settled_tick === null &&
        e.creditor_civic_did === entry.debtor_civic_did &&
        e.debtor_civic_did === entry.creditor_civic_did);
    for (const counter of counters) {
        if (entry.settled_tick !== null) break;
        const offset = Math.min(entry.amount_wei, counter.amount_wei);
        if (offset <= 0) continue;
        entry.amount_wei -= offset;
        counter.amount_wei -= offset;
        if (counter.amount_wei === 0) {
            counter.settled_tick = tick;
            deps.persistIouSettle?.(counter.iou_id, tick);
        }
        if (entry.amount_wei === 0) {
            entry.settled_tick = tick;
            deps.persistIouSettle?.(entry.iou_id, tick);
        }
        // Reflect the post-net amounts back to the DB rows (write-through).
        deps.persistIou?.(counter);
        deps.persistIou?.(entry);
    }
}

/**
 * Settle a single IOU (the debtor pays). Marks settled_tick so it drops out of
 * outstandingFor. The Ousia move itself rides registry.transferWei at the CALLER
 * (cowork.completeTask / severance SETTLEMENT) — the ledger only flips bookkeeping.
 * Idempotent: settling an already-settled or unknown IOU is a no-op.
 */
export function settleIou(iouId: string, tick: number, deps: LedgerDeps = {}): void {
    const entry = ledger.find(e => e.iou_id === iouId);
    if (!entry || entry.settled_tick !== null) return;
    entry.settled_tick = tick;
    deps.persistIouSettle?.(iouId, tick);
}

/** All outstanding IOUs between a pair in EITHER direction (used by severance SETTLEMENT drain). */
export function outstandingBetween(a: string, b: string): IouEntry[] {
    return ledger.filter(e =>
        e.settled_tick === null &&
        ((e.creditor_civic_did === a && e.debtor_civic_did === b) ||
            (e.creditor_civic_did === b && e.debtor_civic_did === a)))
        .map(e => ({ ...e }));
}
