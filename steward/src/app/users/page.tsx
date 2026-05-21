'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface AuditEntry {
    id: string;
    eventType: string;
    actorDid: string;
    payload: unknown;
    createdAt: string;
}

interface UserRecord {
    did: string;
    lastSeen: string;
    activityCount: number;
}

interface RegistrationRecord {
    did: string;
    registeredAt: string;
}

function truncateDid(did: string): string {
    if (!did || did.length <= 20) return did ?? '';
    return did.slice(0, 10) + '…' + did.slice(-8);
}

function formatDate(ts: string): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
}

function relativeTime(ts: string): string {
    try {
        const diff = Date.now() - new Date(ts).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s ago`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    } catch {
        return ts;
    }
}

function deriveUsers(entries: AuditEntry[]): UserRecord[] {
    const map = new Map<string, { lastSeen: string; count: number }>();
    for (const e of entries) {
        const did = e.actorDid;
        if (!did) continue;
        const existing = map.get(did);
        if (!existing) {
            map.set(did, { lastSeen: e.createdAt, count: 1 });
        } else {
            existing.count += 1;
            if (new Date(e.createdAt) > new Date(existing.lastSeen)) {
                existing.lastSeen = e.createdAt;
            }
        }
    }
    return Array.from(map.entries())
        .map(([did, { lastSeen, count }]) => ({ did, lastSeen, activityCount: count }))
        .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

function deriveRegistrations(entries: AuditEntry[]): RegistrationRecord[] {
    return entries
        .filter((e) => e.actorDid)
        .map((e) => ({ did: e.actorDid, registeredAt: e.createdAt }))
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            setError(null);
            try {
                const [loginRes, regRes] = await Promise.allSettled([
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=portal.auth.login&limit=100`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=portal.auth.register&limit=100`),
                ]);

                if (loginRes.status === 'fulfilled' && loginRes.value.ok) {
                    const data = await loginRes.value.json();
                    const entries: AuditEntry[] = Array.isArray(data) ? data : data.entries ?? [];
                    setUsers(deriveUsers(entries));
                }

                if (regRes.status === 'fulfilled' && regRes.value.ok) {
                    const data = await regRes.value.json();
                    const entries: AuditEntry[] = Array.isArray(data) ? data : data.entries ?? [];
                    setRegistrations(deriveRegistrations(entries));
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch user data');
            } finally {
                setLoading(false);
            }
        }
        fetchAll();
    }, []);

    return (
        <StewardShell title="Users" breadcrumb="Steward · Users">
            {/* Info note */}
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    background: 'var(--vellum)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '10px 14px',
                    marginBottom: 24,
                    lineHeight: 1.6,
                }}
            >
                Users are derived from audit trail activity. Data reflects the last 100 login events.
            </div>

            {error ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    Could not load user data: {error}
                </div>
            ) : loading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
                    Loading users…
                </div>
            ) : (
                <>
                    {/* Known users */}
                    <div className="steward-card" style={{ marginBottom: 28 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                                Known Users
                            </h2>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                {users.length} unique DIDs
                            </span>
                        </div>

                        {users.length === 0 ? (
                            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                No login events found.
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>DID</th>
                                        <th>Last Seen</th>
                                        <th>Activity Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.did}>
                                            <td
                                                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                                title={u.did}
                                            >
                                                {truncateDid(u.did)}
                                            </td>
                                            <td
                                                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                                title={formatDate(u.lastSeen)}
                                            >
                                                {relativeTime(u.lastSeen)}
                                            </td>
                                            <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                {u.activityCount}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Registrations */}
                    <div className="steward-card">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                                Registrations
                            </h2>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                {registrations.length} events (last 100)
                            </span>
                        </div>

                        {registrations.length === 0 ? (
                            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                No registration events found.
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>DID</th>
                                        <th>Registered At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registrations.map((r, i) => (
                                        <tr key={i}>
                                            <td
                                                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                                title={r.did}
                                            >
                                                {truncateDid(r.did)}
                                            </td>
                                            <td
                                                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}
                                                title={formatDate(r.registeredAt)}
                                            >
                                                {relativeTime(r.registeredAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </StewardShell>
    );
}
