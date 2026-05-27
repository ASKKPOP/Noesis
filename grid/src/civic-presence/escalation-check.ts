/**
 * Phase 41 / SLEEP-04 + SLEEP-05 — 24h escalation walker.
 */

import type { AuditChain } from '../audit/chain.js';
import type { CivicDidStore } from '../civic-registry/civic-did-store.js';
import type { BusinessDidStore } from '../civic-registry/business-did-store.js';
import { appendIrsDisbursementExecuted } from '../audit/append-irs-disbursement-executed.js';
import type { PresenceStore } from './presence-store.js';
import type { MessageQueueStore } from './message-queue-store.js';
import { ABSENT_THRESHOLD_MS, PRESUMED_DEPARTED_THRESHOLD_MS } from './types.js';

const SYSTEM_SENDER_CIVIC_DID = 'did:civic:noesis:system';

export interface EscalationDeps {
    readonly gridName: string;
    readonly presenceStore: PresenceStore;
    readonly messageQueueStore: MessageQueueStore;
    readonly civicDidStore: CivicDidStore;
    readonly businessDidStore?: BusinessDidStore;
    readonly audit: AuditChain;
    readonly now: Date;
    readonly tick: number;
}

export async function runEscalationCheck(deps: EscalationDeps): Promise<{
    absentCount: number;
    presumedDepartedCount: number;
}> {
    const absentBoundary = new Date(deps.now.getTime() - ABSENT_THRESHOLD_MS);
    const presumedBoundary = new Date(deps.now.getTime() - PRESUMED_DEPARTED_THRESHOLD_MS);

    // SLEEP-05: 1y boundary first — away or absent → presumed_departed
    const presumed = await deps.presenceStore.listStaleSince(
        deps.gridName,
        presumedBoundary,
        ['away', 'absent'],
    );
    for (const row of presumed) {
        await deps.presenceStore.updatePresence(
            deps.gridName, row.civicDid, 'presumed_departed', deps.tick,
        );
        await deps.civicDidStore.markFrozen(deps.gridName, row.civicDid, deps.tick);

        // BusinessDid dissolution — listByCivicDid + markDissolved per active business DID.
        // BusinessDidStore.markDissolved(gridName, businessDid, dissolvedAtTick) is the real API.
        if (deps.businessDidStore) {
            try {
                const bizRecords = await deps.businessDidStore.listByCivicDid(
                    deps.gridName, row.civicDid,
                );
                for (const biz of bizRecords) {
                    if (biz.status === 'active') {
                        await deps.businessDidStore.markDissolved(
                            deps.gridName, biz.businessDid, deps.tick,
                        );
                    }
                }
            } catch { /* best-effort */ }
        }

        appendIrsDisbursementExecuted(deps.audit, {
            amount_bios: 0,
            cause: 'presumed_departed',
            civic_did: row.civicDid,
            grid_name: deps.gridName,
            tick: deps.tick,
        });
    }

    // SLEEP-04: 30d boundary — away → absent
    const absent = await deps.presenceStore.listStaleSince(
        deps.gridName,
        absentBoundary,
        ['away'],
    );
    for (const row of absent) {
        await deps.presenceStore.updatePresence(
            deps.gridName, row.civicDid, 'absent', deps.tick,
        );
        await deps.messageQueueStore.enqueue(
            deps.gridName,
            row.civicDid,
            SYSTEM_SENDER_CIVIC_DID,
            {
                kind: 'absent_escalation_notice',
                message: 'You were marked absent due to 30+ days offline. ' +
                         'Community charter revocation processing is pending (Phase 49 stub).',
                escalated_at_tick: deps.tick,
            },
            deps.tick,
        );
    }

    return {
        absentCount: absent.length,
        presumedDepartedCount: presumed.length,
    };
}
