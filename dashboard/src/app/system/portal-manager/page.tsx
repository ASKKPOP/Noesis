'use client';

/**
 * /system/portal-manager — Tier-3 Portal Manager v1 (Henry-side meta-ops).
 *
 * Operator-gated, READ-ONLY monitoring console served on noesiis.com. Fetches the
 * civic registration reviewer queue from the Grid
 * (GET /api/v1/portal-manager/registrations) using the operator's H-tier +
 * session-scoped op-id as the x-operator-tier / x-operator-id headers — the same
 * header-trust mechanism the Grid operator routes use.
 *
 * Reachable only by an operator who can satisfy the tier-5 gate; otherwise the
 * view shows the unauthorized state. No portal Civic-DID grants access (Tier-3 is
 * Henry-side meta-ops, not a citizen surface). OBSERVE-ONLY — no write actions.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { agencyStore, getOperatorId } from '@/lib/stores/agency-store';
import {
    fetchRegistrations,
    fetchDidIssuance,
    fetchAuditChain,
    type RegistrationsResponse,
    type DidIssuanceResponse,
    type AuditChainResponse,
    type PortalManagerErrorKind,
} from '@/lib/api/portal-manager';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';
import PortalManagerView from './PortalManagerView';

/** H-tier → numeric operator tier for the Grid header-trust gate (H5 = 5). */
const TIER_TO_NUM: Record<HumanAgencyTier, number> = {
    H1: 1, H2: 2, H3: 3, H4: 4, H5: 5,
};

export default function PortalManagerPage() {
    const tier = useSyncExternalStore(
        agencyStore.subscribe,
        agencyStore.getSnapshot,
        () => 'H1' as HumanAgencyTier,
    );

    const [data, setData] = useState<RegistrationsResponse | null>(null);
    const [error, setError] = useState<PortalManagerErrorKind | undefined>(undefined);
    const [didData, setDidData] = useState<DidIssuanceResponse | null>(null);
    const [didError, setDidError] = useState<PortalManagerErrorKind | undefined>(undefined);
    const [auditData, setAuditData] = useState<AuditChainResponse | null>(null);
    const [auditError, setAuditError] = useState<PortalManagerErrorKind | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        agencyStore.hydrateFromStorage();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const op = { tier: TIER_TO_NUM[tier], operatorId: getOperatorId() };
        setLoading(true);
        setError(undefined);
        setDidError(undefined);
        setAuditError(undefined);

        // Fire all three read-only slices in parallel with the SAME signal; the
        // single top-level loading flag clears once ALL settle.
        Promise.all([
            fetchRegistrations(op, undefined, controller.signal).then((res) => {
                if (res.ok) { setData(res.data); setError(undefined); }
                else { setData(null); setError(res.error.kind); }
            }),
            fetchDidIssuance(op, controller.signal).then((res) => {
                if (res.ok) { setDidData(res.data); setDidError(undefined); }
                else { setDidData(null); setDidError(res.error.kind); }
            }),
            fetchAuditChain(op, controller.signal).then((res) => {
                if (res.ok) { setAuditData(res.data); setAuditError(undefined); }
                else { setAuditData(null); setAuditError(res.error.kind); }
            }),
        ])
            .then(() => setLoading(false))
            .catch((err) => {
                if ((err as { name?: string })?.name === 'AbortError') return;
                setError('network');
                setDidError('network');
                setAuditError('network');
                setLoading(false);
            });
        return () => controller.abort();
    }, [tier]);

    return (
        <PortalManagerView
            data={data}
            error={error}
            loading={loading}
            didIssuance={didData}
            didError={didError}
            audit={auditData}
            auditError={auditError}
        />
    );
}
