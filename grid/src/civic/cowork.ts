/**
 * Phase 60 HOUSE-3 (A5 / D-60-06 / R-60-08) — the Cowork Agreement + task board.
 *
 * A CoworkAgreement is the SIGNED DUAL-DID source of truth for a paid co-work session:
 * who hosts, who works, the scope, the settlement amount, and the term — all anchored to
 * Civic-DIDs. The IOU ledger (credit-ledger.ts) enforces the obligation it records.
 *
 * The Phase 59 `task_board` affordance becomes executable here:
 *   postTask (owner/staff)  → a `posted` agreement (worker empty until claimed)
 *   claimTask (board access) → `claimed`, parties[1] = the worker
 *   completeTask (host)      → `settled`
 *
 * D-NH-06 — co-work is ALWAYS PAID. completeTask settles EVERY time:
 *   funded   → registry.transferWei(host → worker, settlement_amount_wei)
 *   not now  → recordIou(worker=creditor, host=debtor, amount, agreement_id, tick)
 * A completion that would pay NOTHING (amount 0 AND no IOU) THROWS `cowork_must_pay` —
 * never free. Honored work bumps the worker's trust_score (reputation, not vibes).
 *
 * A completed session is the producer of `zoning.cowork_session` (participants HASHED, a
 * count, the parcel, the tick span) — but that append is WIRED IN WAVE 4. Here we only
 * CONSTRUCT the participants set + hash; nothing is emitted on chain yet (the IOU/Ousia
 * settlement is the only effect this wave). Board/task/scope CONTENT stays Grid-side.
 *
 * Board ops are REQUEST-DRIVEN — there is no clock.onTick scan (single-onTick R-H-03).
 */

import { createHash } from 'node:crypto';
import { recordIou } from './credit-ledger.js';

/** The closed status ladder of a co-work agreement. */
export type CoworkStatus = 'posted' | 'claimed' | 'completed' | 'settled';

/** The signed dual-DID source of truth: parties = [host_did, worker_did]. */
export interface CoworkAgreement {
    agreement_id: string;
    parcel_id: string;
    /** [host, worker]; worker is empty until claimTask sets parties[1]. */
    parties: [string, string];
    scope_ref: string;
    settlement_amount_wei: number;
    term_ticks: number;
    status: CoworkStatus;
    /** Pointer to the Phase 47 Police dispute pipeline (set only on a breach). */
    dispute_route?: string;
}

/** Input to createAgreement / postTask (the signed dual-DID schema, pre-status). */
export interface CoworkAgreementInput {
    parcel_id: string;
    parties: [string, string];
    scope_ref: string;
    settlement_amount_wei: number;
    term_ticks: number;
}

/**
 * Dependencies for completeTask. Tests inject pure spies; production wires
 * registry.transferWei + credit-ledger.recordIou + the (Wave-4) audit append.
 */
export interface CompleteDeps {
    /** True when the host can settle in Ousia NOW; false → record an IOU instead. */
    funded: boolean;
    start_tick: number;
    end_tick: number;
    /** Move Ousia host → worker (registry.transferWei). Defaults to a no-op spy seam. */
    transferWei?: (from: string, to: string, amount: number) => void;
    /** Record the IOU when unfunded (credit-ledger.recordIou). Defaults to the real ledger. */
    recordIou?: (creditor: string, debtor: string, amount: number, reasonRef: string, tick: number) => void;
    /** Bump the worker's trust_score on honored settlement (registry.bumpTrust seam). */
    bumpTrust?: (parcelId: string, workerDid: string, delta: number) => void;
    /** Wave-4 audit seam — present only so the Wave-4 producer test can assert later. */
    audit?: unknown;
}

/** Module-level board (Grid-side). DB-first persistence rides ParcelStore.persistCowork. */
const agreements = new Map<string, CoworkAgreement>();
let seq = 0;

/** Reset the board (test isolation helper — production never calls this). */
export function _resetCowork(): void {
    agreements.clear();
    seq = 0;
}

/** All agreements (deep copies) — used by ParcelStore.hydrate mirroring + dashboard reads. */
export function allAgreements(): CoworkAgreement[] {
    return [...agreements.values()].map(a => ({ ...a, parties: [...a.parties] as [string, string] }));
}

/** Mirror a hydrated agreement row into memory (ParcelStore.hydrate calls this on boot). */
export function upsertAgreement(a: CoworkAgreement): void {
    if (!a.agreement_id) return; // defensive: ignore malformed rows (no id → nothing to anchor)
    agreements.set(a.agreement_id, { ...a, parties: [...a.parties] as [string, string] });
    const n = Number(a.agreement_id.replace(/^cowork:/, ''));
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
}

/** sha256 hex — the HEX64 participants-hash discipline the zoning.* producers expect. */
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/**
 * Create + post a co-work agreement (status `posted`). The worker slot stays empty
 * (parties[1] = '') until a claim. scope_ref body is Grid-side and never broadcast.
 * `postTask` is the named board affordance; createAgreement is its alias for the schema test.
 */
export function createAgreement(input: CoworkAgreementInput): CoworkAgreement {
    const agreement: CoworkAgreement = {
        agreement_id: `cowork:${seq++}`,
        parcel_id: input.parcel_id,
        parties: [input.parties[0], input.parties[1] ?? ''] as [string, string],
        scope_ref: input.scope_ref,
        settlement_amount_wei: input.settlement_amount_wei,
        term_ticks: input.term_ticks,
        status: 'posted',
    };
    agreements.set(agreement.agreement_id, agreement);
    return { ...agreement, parties: [...agreement.parties] as [string, string] };
}

/** Owner/staff posts a task: alias of createAgreement (the board-op name). */
export const postTask = createAgreement;

/**
 * Claim a posted task: any role with board access. Sets parties[1] = worker and the
 * status to `claimed`. Throws on an unknown id or a non-postable status (closed ladder).
 */
export function claimTask(agreementId: string, workerDid: string): CoworkAgreement {
    const a = agreements.get(agreementId);
    if (!a) throw new Error(`cowork_not_found: ${agreementId}`);
    if (a.status !== 'posted') throw new Error(`cowork_not_claimable: ${a.status}`);
    a.parties = [a.parties[0], workerDid];
    a.status = 'claimed';
    return { ...a, parties: [...a.parties] as [string, string] };
}

/**
 * Host confirms completion. **ALWAYS settles (D-NH-06):** Ousia via transferWei when
 * funded, otherwise an IOU (worker = creditor, host = debtor). A completion that would
 * pay NOTHING (amount ≤ 0 AND not falling back to an IOU) THROWS `cowork_must_pay` —
 * co-work is never free. On settlement the worker's trust_score is bumped (honored work).
 *
 * The participants set + participants_hash for the Wave-4 `zoning.cowork_session` producer
 * is CONSTRUCTED here, but NOTHING is appended on chain this wave (Wave 4 wires the append).
 */
export function completeTask(agreementId: string, hostDid: string, deps: CompleteDeps): CoworkAgreement {
    const a = agreements.get(agreementId);
    if (!a) throw new Error(`cowork_not_found: ${agreementId}`);
    if (a.parties[0] !== hostDid) throw new Error(`cowork_not_host: ${hostDid} is not the host`);
    const worker = a.parties[1];
    if (!worker) throw new Error(`cowork_unclaimed: ${agreementId} has no worker`);

    const amount = a.settlement_amount_wei;
    a.status = 'completed';

    // D-NH-06: ALWAYS settle — a pay-nothing completion is forbidden (never free).
    if (amount <= 0) {
        throw new Error('cowork_must_pay: a completed co-work session is never free (D-NH-06)');
    }
    if (deps.funded) {
        // Ousia-moving settlement rides the existing transfer path.
        (deps.transferWei ?? (() => {}))(hostDid, worker, amount);
    } else {
        // Unfunded → record an IOU: worker is the creditor (owed), host the debtor.
        (deps.recordIou ?? recordIou)(worker, hostDid, amount, a.agreement_id, deps.end_tick);
    }

    // Honored work raises the worker's trust_score (reputation, not vibes).
    deps.bumpTrust?.(a.parcel_id, worker, 1);

    // Construct the Wave-4 zoning.cowork_session payload set — NOT emitted this wave.
    // Participants are a SORTED, HASHED set (no raw DIDs, no board/scope text on chain).
    const participants = [hostDid, worker].sort();
    void {
        parcel_id: a.parcel_id,
        participant_count: participants.length,
        participants_hash: sha256Hex(participants.join('|')),
        start_tick: deps.start_tick,
        end_tick: deps.end_tick,
    };

    a.status = 'settled';
    return { ...a, parties: [...a.parties] as [string, string] };
}
