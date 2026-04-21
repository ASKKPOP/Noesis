/**
 * useElevatedAction — closure-capture race-safe dispatcher for the H1→H2/H3/H4
 * elevation flow (D-06, D-07).
 *
 * Contract:
 *   1. `fire(payload, dispatch)` elevates the store, opens the dialog, returns
 *      a promise that resolves AFTER the operator confirms or cancels.
 *   2. On Confirm: the body `{ tier: targetTier, operator_id, ...payload }` is
 *      constructed from the LEXICAL `targetTier` argument BEFORE any network
 *      I/O (this line is the SC#4 invariant — if it mutates to read from
 *      `agencyStore.getSnapshot()`, the elevation-race regression fails).
 *   3. After dispatch resolves (success OR failure), the tier auto-downgrades
 *      to H1 in a finally block — AGENCY-04 single-action scope.
 *   4. On Cancel: no HTTP dispatch; promise resolves { ok:false, reason:'cancelled' }.
 *   5. Calling fire() while another fire is pending supersedes the first —
 *      the earlier promise resolves as cancelled.
 *
 * getOperatorId is imported through the module namespace so that tests can
 * vi.spyOn(storeModule, 'getOperatorId') and observe the call order (it
 * fires before dispatch per D-07 body-construction discipline).
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { agencyStore, getOperatorId } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

export type ElevatedTier = Exclude<HumanAgencyTier, 'H1' | 'H5'>;

export interface ElevationResult<T> {
    ok: boolean;
    reason?: 'cancelled' | 'failed';
    data?: T;
}

interface PendingRequest {
    payload: Record<string, unknown>;
    dispatch: (body: Record<string, unknown>) => Promise<unknown>;
    resolve: (r: ElevationResult<unknown>) => void;
}

export function useElevatedAction(targetTier: ElevatedTier): {
    readonly dialogOpen: boolean;
    readonly onConfirm: () => Promise<void>;
    readonly onCancel: () => void;
    readonly fire: <T>(
        payload: Record<string, unknown>,
        dispatch: (body: Record<string, unknown>) => Promise<T>,
    ) => Promise<ElevationResult<T>>;
} {
    const [dialogOpen, setDialogOpen] = useState(false);
    // `pending` is a ref rather than state because the native <dialog> element
    // fires a `close` event whenever the dialog closes (programmatic OR Escape).
    // Our onClose handler routes that to onCancel — so onCancel MUST see the
    // already-consumed pending as null when Confirm was the trigger, otherwise
    // it would resolve the promise as cancelled immediately after onConfirm
    // has already committed to the dispatch path. A ref mutated synchronously
    // inside onConfirm avoids the stale-closure/React-batching window.
    const pendingRef = useRef<PendingRequest | null>(null);

    const fire = useCallback(
        <T,>(
            payload: Record<string, unknown>,
            dispatch: (body: Record<string, unknown>) => Promise<T>,
        ): Promise<ElevationResult<T>> => {
            return new Promise<ElevationResult<T>>((resolve) => {
                // If a prior fire is still pending, supersede it — its promise
                // resolves as cancelled so the caller isn't left hanging.
                const prev = pendingRef.current;
                if (prev) prev.resolve({ ok: false, reason: 'cancelled' });
                pendingRef.current = {
                    payload,
                    dispatch: dispatch as PendingRequest['dispatch'],
                    resolve: resolve as PendingRequest['resolve'],
                };
                agencyStore.setTier(targetTier); // UI reflects elevation immediately
                setDialogOpen(true);
            });
        },
        [targetTier],
    );

    const onConfirm = useCallback(async (): Promise<void> => {
        // Synchronously consume the pending request so the subsequent
        // programmatic dialog-close → onClose → onCancel chain sees null
        // and does not double-resolve the promise.
        const p = pendingRef.current;
        pendingRef.current = null;
        setDialogOpen(false);
        if (!p) return;
        // D-07 RACE-SAFETY: tier + operator_id captured into the body here,
        // BEFORE any I/O. A mid-flight agencyStore.setTier('H1') cannot mutate
        // a string value that is already serialized into this local object.
        const body = { tier: targetTier, operator_id: getOperatorId(), ...p.payload };
        try {
            const data = await p.dispatch(body);
            p.resolve({ ok: true, data });
        } catch {
            p.resolve({ ok: false, reason: 'failed' });
        } finally {
            // AGENCY-04 single-action scope: auto-downgrade regardless of outcome.
            agencyStore.setTier('H1');
        }
    }, [targetTier]);

    const onCancel = useCallback((): void => {
        const p = pendingRef.current;
        pendingRef.current = null;
        setDialogOpen(false);
        if (p) {
            p.resolve({ ok: false, reason: 'cancelled' });
            agencyStore.setTier('H1'); // never persist elevated state on cancel
        }
    }, []);

    return { dialogOpen, onConfirm, onCancel, fire } as const;
}
