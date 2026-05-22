'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// Drive names per UI-SPEC Correction Notice (verified from brain/src/noesis_brain/ananke/types.py DriveName enum)
const DRIVE_NAMES = ['HUNGER', 'CURIOSITY', 'SAFETY', 'BOREDOM', 'LONELINESS'] as const;
type DriveName = typeof DRIVE_NAMES[number];

const DRIVE_COLORS: Record<DriveName, string> = {
    HUNGER:    '#b8542f', // terracotta — physical need, urgent/warm
    CURIOSITY: '#3a7a5a', // sage — intellectual, calm growth
    SAFETY:    '#3a4a7a', // indigo — security, cool stable
    BOREDOM:   '#8a8479', // muted gray — neutral flatness
    LONELINESS:'#6a4a7a', // mauve — social, quiet purple
};

interface CognitiveSnapshot {
    reflexion_count: number;
    rule_count: number;
    skill_titles_topk: string[];
    drive_levels: Record<string, number>;
    last_sleep_tick: number;
    creed_violation_count: number;
}

interface TickMetrics {
    p50: number;
    p95: number;
    queue_depth: number;
    sample_count: number;
}

interface AuditTrailEntry {
    id: string;
    eventType: string;
    actorDid: string;
    payload: Record<string, unknown>;
    createdAt: string;
    tick?: number;
}

function DriveBar({ drive, level, mini = false }: { drive: DriveName; level: number; mini?: boolean }) {
    const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
    const barHeight = mini ? 6 : 8;
    return (
        <div
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${drive} drive level`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: mini ? 4 : 6 }}
        >
            {!mini && (
                <div style={{ width: 88, fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0 }}>
                    {drive}
                </div>
            )}
            {mini && (
                <div style={{ width: 72, fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0 }}>
                    {drive}
                </div>
            )}
            <div style={{ flex: 1, height: barHeight, borderRadius: 4, background: 'var(--rule)', overflow: 'hidden' }}>
                <div
                    style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: DRIVE_COLORS[drive],
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                    }}
                />
            </div>
            {!mini && (
                <div style={{ width: 36, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
                    {level != null ? `${pct}%` : '—'}
                </div>
            )}
        </div>
    );
}

interface NousEntry {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    reputation: number;
    status: string;
}

const inputStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 5,
    padding: '7px 10px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
};

const btnPrimary: React.CSSProperties = {
    background: 'var(--terracotta)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
};

export default function NousDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const did = decodeURIComponent(id);
    const router = useRouter();

    const [nousInfo, setNousInfo] = useState<NousEntry | null>(null);
    const [brainState, setBrainState] = useState<Record<string, unknown> | null>(null);
    const [brainError, setBrainError] = useState<string | null>(null);
    const [brainLoading, setBrainLoading] = useState(true);

    // Cognitive Inspector
    const [cognitive, setCognitive] = useState<CognitiveSnapshot | null>(null);
    const [cogLoading, setCogLoading] = useState(true);
    const [cogError, setCogError] = useState<string | null>(null);

    // Brain Health — tick metrics
    const [tickMetrics, setTickMetrics] = useState<TickMetrics | null>(null);
    const [tickMetricsError, setTickMetricsError] = useState<string | null>(null);

    // Brain Health — audit event counts
    const [reflectionCount, setReflectionCount] = useState<number>(0);
    const [skillCount, setSkillCount] = useState<number>(0);
    const [ruleCount, setRuleCount] = useState<number>(0);
    const [driveEvents, setDriveEvents] = useState<AuditTrailEntry[]>([]);
    const [sleepEnteredEvents, setSleepEnteredEvents] = useState<AuditTrailEntry[]>([]);
    const [sleepCompletedEvents, setSleepCompletedEvents] = useState<AuditTrailEntry[]>([]);
    const [creedViolationCount, setCreedViolationCount] = useState<number>(0);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthError, setHealthError] = useState<string | null>(null);

    // Force telos form
    const [telosText, setTelosText] = useState('');
    const [telosReason, setTelosReason] = useState('');
    const [telosStatus, setTelosStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [telosSubmitting, setTelosSubmitting] = useState(false);

    // Delete form
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    // Sanctions — mute (H3)
    const [muteReason, setMuteReason] = useState('');
    const [muteStatus, setMuteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [muteSubmitting, setMuteSubmitting] = useState(false);

    // Sanctions — force-sleep (H3)
    const [sleepReason, setSleepReason] = useState('');
    const [sleepStatus, setSleepStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [sleepSubmitting, setSleepSubmitting] = useState(false);

    // Sanctions — quarantine (H4)
    const [quarantineReason, setQuarantineReason] = useState('');
    const [quarantineStatus, setQuarantineStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [quarantineSubmitting, setQuarantineSubmitting] = useState(false);

    // Sanctions — slash (H4)
    const [slashAmount, setSlashAmount] = useState('');
    const [slashReason, setSlashReason] = useState('');
    const [slashStatus, setSlashStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [slashSubmitting, setSlashSubmitting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            // Fetch nous info from roster
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/grid/nous`);
                if (res.ok) {
                    const data = await res.json();
                    const list: NousEntry[] = Array.isArray(data) ? data : data.nous ?? [];
                    const found = list.find((n) => n.did === did);
                    if (found) setNousInfo(found);
                }
            } catch {
                // ignore
            }

            // Fetch brain state
            setBrainLoading(true);
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/nous/${encodeURIComponent(did)}/state`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.error) {
                        setBrainError(data.error);
                    } else {
                        setBrainState(data as Record<string, unknown>);
                    }
                } else if (res.status === 503 || res.status === 404) {
                    setBrainError(`Nous state unavailable (${res.status})`);
                } else {
                    setBrainError(`HTTP ${res.status}`);
                }
            } catch (e) {
                setBrainError(e instanceof Error ? e.message : 'Network error');
            } finally {
                setBrainLoading(false);
            }

            // Fetch cognitive snapshot (H3+ gated via Grid proxy)
            setCogLoading(true);
            try {
                // GAP-25a-1/2 fix: tier + operator_id are now derived server-side from
                // x-operator-tier / x-operator-id headers. Body is unused.
                // The Steward Console runs as a trusted internal surface; in a future phase
                // these headers will be injected by an auth proxy / SIWE session middleware.
                // For now, send the H3 default the Steward operator already implicitly assumes.
                const res = await fetch(
                    `/api/operator/nous/${encodeURIComponent(did)}/cognitive-snapshot`,
                    {
                        method: 'POST',
                        headers: {
                            'x-operator-tier': '3',
                        },
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    setCognitive(data as CognitiveSnapshot);
                } else if (res.status === 403) {
                    setCogError('403');
                } else if (res.status === 503) {
                    setCogError('503');
                } else {
                    setCogError(`HTTP ${res.status}`);
                }
            } catch {
                setCogError('503');
            } finally {
                setCogLoading(false);
            }

            // Fetch brain health data (tick-metrics + audit aggregations)
            setHealthLoading(true);
            try {
                const encodedDid = encodeURIComponent(did);

                const [
                    tickRes,
                    reflectionRes,
                    skillTaughtRes,
                    skillInferredRes,
                    ruleRes,
                    driveRes,
                    sleepEnteredRes,
                    sleepCompletedRes,
                    creedRes,
                ] = await Promise.allSettled([
                    fetch(`${GRID_ORIGIN}/api/v1/nous/${encodedDid}/tick-metrics`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=nous.reflection_authored&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=skill.taught&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=skill.inferred&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=nous.self_model_revised&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=ananke.drive_crossed&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=nous.sleep.entered&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=nous.sleep.completed&actor=${encodedDid}&limit=200`),
                    fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=nous.creed_violation&actor=${encodedDid}&limit=200`),
                ]);

                // Tick metrics
                if (tickRes.status === 'fulfilled' && tickRes.value.ok) {
                    setTickMetrics(await tickRes.value.json() as TickMetrics);
                } else if (tickRes.status === 'fulfilled' && tickRes.value.status === 404) {
                    setTickMetricsError('404');
                } else {
                    setTickMetricsError('error');
                }

                function extractEntries(result: PromiseSettledResult<Response>): AuditTrailEntry[] {
                    if (result.status === 'fulfilled' && result.value.ok) {
                        return result.value.json().then((d: unknown) => {
                            const data = d as { entries?: AuditTrailEntry[] } | AuditTrailEntry[];
                            return Array.isArray(data) ? data : (data as { entries?: AuditTrailEntry[] }).entries ?? [];
                        }).catch(() => []) as unknown as AuditTrailEntry[];
                    }
                    return [];
                }

                // Parse all audit results
                const parseAudit = async (result: PromiseSettledResult<Response>): Promise<AuditTrailEntry[]> => {
                    if (result.status !== 'fulfilled' || !result.value.ok) return [];
                    try {
                        const d = await result.value.json();
                        return Array.isArray(d) ? d : d.entries ?? [];
                    } catch {
                        return [];
                    }
                };

                void extractEntries; // silence unused warning

                const [reflections, skillTaught, skillInferred, rules, drives, sleepEntered, sleepCompleted, creedViolations] = await Promise.all([
                    parseAudit(reflectionRes),
                    parseAudit(skillTaughtRes),
                    parseAudit(skillInferredRes),
                    parseAudit(ruleRes),
                    parseAudit(driveRes),
                    parseAudit(sleepEnteredRes),
                    parseAudit(sleepCompletedRes),
                    parseAudit(creedRes),
                ]);

                // Filter skill events by learner_did === did in case actor is system DID
                const filteredSkillTaught = skillTaught.filter((e) => {
                    const p = e.payload as Record<string, unknown>;
                    return e.actorDid === did || p?.learner_did === did;
                });
                const filteredSkillInferred = skillInferred.filter((e) => {
                    const p = e.payload as Record<string, unknown>;
                    return e.actorDid === did || p?.learner_did === did;
                });

                setReflectionCount(reflections.length);
                setSkillCount(filteredSkillTaught.length + filteredSkillInferred.length);
                setRuleCount(rules.length);
                setDriveEvents(drives);
                setSleepEnteredEvents(sleepEntered);
                setSleepCompletedEvents(sleepCompleted);
                setCreedViolationCount(creedViolations.length);
                setHealthError(null);
            } catch (e) {
                setHealthError(e instanceof Error ? e.message : 'Could not load health metrics.');
            } finally {
                setHealthLoading(false);
            }
        }
        fetchData();
    }, [did]);

    async function handleMute(e: React.FormEvent) {
        e.preventDefault();
        setMuteSubmitting(true);
        setMuteStatus(null);
        try {
            const res = await fetch(`/api/operator/nous/${encodeURIComponent(did)}/mute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '3',
                },
                body: JSON.stringify({ reason: muteReason }),
            });
            if (res.ok) {
                setMuteStatus({ type: 'success', msg: 'Mute applied.' });
                setMuteReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setMuteStatus({ type: 'error', msg: (d as { error?: string }).error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setMuteStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setMuteSubmitting(false);
        }
    }

    async function handleForceSleep(e: React.FormEvent) {
        e.preventDefault();
        setSleepSubmitting(true);
        setSleepStatus(null);
        try {
            const res = await fetch(`/api/operator/nous/${encodeURIComponent(did)}/force-sleep`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '3',
                },
                body: JSON.stringify({ reason: sleepReason }),
            });
            if (res.ok) {
                setSleepStatus({ type: 'success', msg: 'Force sleep applied.' });
                setSleepReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setSleepStatus({ type: 'error', msg: (d as { error?: string }).error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setSleepStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setSleepSubmitting(false);
        }
    }

    async function handleQuarantine(e: React.FormEvent) {
        e.preventDefault();
        setQuarantineSubmitting(true);
        setQuarantineStatus(null);
        try {
            const res = await fetch(`/api/operator/nous/${encodeURIComponent(did)}/quarantine`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '4',
                },
                body: JSON.stringify({ reason: quarantineReason }),
            });
            if (res.ok) {
                setQuarantineStatus({ type: 'success', msg: 'Quarantine applied.' });
                setQuarantineReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setQuarantineStatus({ type: 'error', msg: (d as { error?: string }).error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setQuarantineStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setQuarantineSubmitting(false);
        }
    }

    async function handleSlash(e: React.FormEvent) {
        e.preventDefault();
        setSlashSubmitting(true);
        setSlashStatus(null);
        try {
            const res = await fetch(`/api/operator/nous/${encodeURIComponent(did)}/slash`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '4',
                },
                body: JSON.stringify({ amount: Number(slashAmount), reason: slashReason }),
            });
            if (res.ok) {
                setSlashStatus({ type: 'success', msg: 'Slash applied.' });
                setSlashAmount('');
                setSlashReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setSlashStatus({ type: 'error', msg: (d as { error?: string }).error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setSlashStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setSlashSubmitting(false);
        }
    }

    async function handleForceTelos(e: React.FormEvent) {
        e.preventDefault();
        setTelosSubmitting(true);
        setTelosStatus(null);
        try {
            const res = await fetch(`/api/operator/nous/${encodeURIComponent(did)}/telos/force`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '4',
                },
                body: JSON.stringify({ new_telos: telosText, reason: telosReason }),
            });
            if (res.ok) {
                setTelosStatus({ type: 'success', msg: 'Telos updated successfully.' });
                setTelosText('');
                setTelosReason('');
            } else {
                const d = await res.json().catch(() => ({}));
                setTelosStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setTelosStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setTelosSubmitting(false);
        }
    }

    async function handleDelete(e: React.FormEvent) {
        e.preventDefault();
        if (deleteConfirm !== (nousInfo?.name ?? did)) return;
        setDeleteSubmitting(true);
        setDeleteStatus(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: deleteReason }),
            });
            if (res.ok) {
                router.push('/nous');
            } else {
                const d = await res.json().catch(() => ({}));
                setDeleteStatus({ type: 'error', msg: d.error ?? `HTTP ${res.status}` });
            }
        } catch (e) {
            setDeleteStatus({ type: 'error', msg: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setDeleteSubmitting(false);
        }
    }

    const name = nousInfo?.name ?? did;

    return (
        <StewardShell title={name} breadcrumb={`Steward · Nous · ${name}`}>
            {/* Navigation links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, marginTop: -12 }}>
                <Link
                    href="/nous"
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    ← Back to Roster
                </Link>
                <span style={{ color: 'var(--rule)' }}>|</span>
                <Link
                    href={`/nous/${id}/config`}
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--terracotta)',
                        textDecoration: 'none',
                    }}
                >
                    Configure →
                </Link>
            </div>

            {/* Brain State */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--ink)',
                    }}
                >
                    Brain State
                </div>
                <div style={{ padding: 20 }}>
                    {brainLoading ? (
                        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            Loading brain state…
                        </span>
                    ) : brainError ? (
                        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {brainError}
                        </span>
                    ) : (
                        <pre
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: 'var(--ink)',
                                background: 'var(--parchment)',
                                border: '1px solid var(--rule)',
                                borderRadius: 6,
                                padding: '14px 16px',
                                overflowX: 'auto',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {JSON.stringify(brainState, null, 2)}
                        </pre>
                    )}
                </div>
            </div>

            {/* Cognitive Inspector Card */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        Cognitive Inspector
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                        H3+
                    </span>
                </div>
                <div style={{ padding: '16px 20px' }}>
                    {cogError === '403' ? (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                            H3+ operator tier required to access cognitive snapshot.
                        </div>
                    ) : cogError === '503' || (cogError && !cogLoading) ? (
                        <>
                            {/* Hashes row still renders from existing brain-state fetch */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                {(['mem', 'creed', 'skill'] as const).map((label) => {
                                    const hashKey = label === 'mem' ? 'memory_hash' : label === 'creed' ? 'creed_hash' : 'skill_hash';
                                    const val = brainState ? String((brainState as Record<string, unknown>)[hashKey] ?? '').slice(0, 12) || '—' : '—';
                                    return (
                                        <span key={label} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '3px 8px' }}>
                                            {label}: {val}
                                        </span>
                                    );
                                })}
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                                Cognitive snapshot unavailable — Brain offline.
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Hashes row */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                {(['mem', 'creed', 'skill'] as const).map((label) => {
                                    const hashKey = label === 'mem' ? 'memory_hash' : label === 'creed' ? 'creed_hash' : 'skill_hash';
                                    const val = brainState ? String((brainState as Record<string, unknown>)[hashKey] ?? '').slice(0, 12) || '—' : '—';
                                    return (
                                        <span key={label} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '3px 8px' }}>
                                            {label}: {val}
                                        </span>
                                    );
                                })}
                            </div>

                            <div style={{ height: 1, background: 'var(--rule)', marginBottom: 16 }} />

                            {/* Counts row */}
                            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                                {[
                                    { label: 'Reflexion Buffer', value: cogLoading ? '…' : String(cognitive?.reflexion_count ?? '—') },
                                    { label: 'Self-Model Rules', value: cogLoading ? '…' : String(cognitive?.rule_count ?? '—') },
                                    { label: 'Creed Violations', value: cogLoading ? '…' : String(cognitive?.creed_violation_count ?? '—') },
                                ].map(({ label, value }) => (
                                    <div key={label}>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                                            {label}
                                        </div>
                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>
                                            {value}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ height: 1, background: 'var(--rule)', marginBottom: 16 }} />

                            {/* Drive bars */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                                    Drive Levels
                                </div>
                                {DRIVE_NAMES.map((drive) => (
                                    <DriveBar
                                        key={drive}
                                        drive={drive}
                                        // GAP-25a-3 fix: Brain returns lowercase drive keys (hunger/curiosity/...);
                                        // DRIVE_NAMES is uppercase for display only. Lowercase the lookup key.
                                        level={cogLoading ? 0 : (cognitive?.drive_levels?.[drive.toLowerCase()] ?? 0)}
                                    />
                                ))}
                            </div>

                            <div style={{ height: 1, background: 'var(--rule)', marginBottom: 16 }} />

                            {/* Skill titles */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                                    Top Skills
                                </div>
                                {cogLoading ? (
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>…</div>
                                ) : !cognitive?.skill_titles_topk?.length ? (
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>No skills recorded.</div>
                                ) : (
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        {cognitive.skill_titles_topk.slice(0, 10).map((title, i) => (
                                            <li
                                                key={i}
                                                style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', paddingBlock: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={title}
                                            >
                                                {title.length > 60 ? title.slice(0, 60) + '…' : title}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div style={{ height: 1, background: 'var(--rule)', marginBottom: 16 }} />

                            {/* Sleep + creed metadata */}
                            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                                <div>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                                        Last Sleep Tick
                                    </div>
                                    <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>
                                        {cogLoading ? '…' : (cognitive?.last_sleep_tick ? cognitive.last_sleep_tick.toLocaleString() : 'Never')}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Brain Health 2×2 grid */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                        Brain Health
                    </h2>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Derived from existing audit events — read-only
                    </span>
                </div>

                {healthError ? (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                        Could not load health metrics.
                    </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Card A: Tick Performance */}
                    <div className="steward-stat-card">
                        <div style={{ padding: '14px 18px 18px' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                                Tick Performance
                            </div>
                            {tickMetricsError === '404' ? (
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>Tick metrics unavailable.</div>
                            ) : tickMetricsError ? (
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>Tick metrics unavailable.</div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>p50</div>
                                            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)' }}>
                                                {healthLoading ? '…' : tickMetrics ? `${tickMetrics.p50}ms` : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>p95</div>
                                            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)' }}>
                                                {healthLoading ? '…' : tickMetrics ? `${tickMetrics.p95}ms` : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                        {healthLoading ? '…' : tickMetrics ? `Queue depth: ${tickMetrics.queue_depth} · Samples: ${tickMetrics.sample_count}` : ''}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Card B: Memory Stores */}
                    <div className="steward-stat-card">
                        <div style={{ padding: '14px 18px 18px' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                                Memory Stores
                            </div>
                            {[
                                { label: 'Reflexion Buffer', value: healthLoading ? '…' : String(reflectionCount) },
                                { label: 'Skill Store Size', value: healthLoading ? '…' : String(skillCount) },
                                { label: 'Rule Count', value: healthLoading ? '…' : String(ruleCount) },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ marginBottom: 10 }}>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>
                                        {label}
                                    </div>
                                    <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink)', lineHeight: 1 }}>
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card C: Drive & Sleep */}
                    <div className="steward-stat-card">
                        <div style={{ padding: '14px 18px 18px' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                                Drive &amp; Sleep
                            </div>
                            {/* Mini drive bars from most recent ananke.drive_crossed per drive */}
                            {DRIVE_NAMES.map((drive) => {
                                const driveEvent = [...driveEvents]
                                    .reverse()
                                    .find((e) => {
                                        const p = e.payload as Record<string, unknown>;
                                        return (p?.drive as string)?.toUpperCase() === drive;
                                    });
                                const levelStr = driveEvent ? String((driveEvent.payload as Record<string, unknown>)?.level ?? '') : '';
                                const level = levelStr === 'high' ? 0.9 : levelStr === 'med' ? 0.5 : levelStr === 'low' ? 0.15 : 0;
                                return <DriveBar key={drive} drive={drive} level={level} mini />;
                            })}

                            {/* Sleep stats */}
                            {sleepEnteredEvents.length === 0 ? (
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                                    No sleep events recorded.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Sleep Cadence</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>
                                            {(() => {
                                                const ticks = sleepEnteredEvents.map((e) => Number((e.payload as Record<string, unknown>)?.tick ?? 0)).filter(Boolean);
                                                if (ticks.length < 2) return '—';
                                                const deltas = ticks.slice(1).map((t, i) => t - ticks[i]);
                                                const avg = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
                                                return `${avg} ticks avg`;
                                            })()}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>Last Duration</div>
                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>
                                            {(() => {
                                                if (!sleepEnteredEvents.length || !sleepCompletedEvents.length) return '—';
                                                const lastEntered = Number((sleepEnteredEvents[sleepEnteredEvents.length - 1]?.payload as Record<string, unknown>)?.tick ?? 0);
                                                const lastCompleted = Number((sleepCompletedEvents[sleepCompletedEvents.length - 1]?.payload as Record<string, unknown>)?.tick ?? 0);
                                                if (!lastEntered || !lastCompleted) return '—';
                                                return `${lastCompleted - lastEntered} ticks`;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card D: Coherence */}
                    <div className="steward-stat-card">
                        <div style={{ padding: '14px 18px 18px' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                                Coherence
                            </div>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, color: healthLoading ? 'var(--muted)' : creedViolationCount > 0 ? 'var(--terracotta)' : 'var(--ink)', lineHeight: 1, marginBottom: 6 }}>
                                {healthLoading ? '…' : creedViolationCount}
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                                Creed Violations
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Force Telos */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--ink)',
                    }}
                >
                    Force Telos
                </div>
                <form onSubmit={handleForceTelos} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            New Telos
                        </label>
                        <textarea
                            value={telosText}
                            onChange={(e) => setTelosText(e.target.value)}
                            required
                            placeholder="Describe the new purpose for this Nous…"
                            style={{
                                ...inputStyle,
                                resize: 'vertical',
                                minHeight: 90,
                                lineHeight: 1.5,
                            }}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Reason
                        </label>
                        <input
                            type="text"
                            value={telosReason}
                            onChange={(e) => setTelosReason(e.target.value)}
                            required
                            placeholder="Operator rationale…"
                            style={inputStyle}
                        />
                    </div>
                    {telosStatus && (
                        <div
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                color: telosStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)',
                                padding: '8px 12px',
                                background:
                                    telosStatus.type === 'success'
                                        ? 'rgba(34,139,34,0.08)'
                                        : 'rgba(184,84,47,0.08)',
                                borderRadius: 5,
                                border: `1px solid ${telosStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}`,
                            }}
                        >
                            {telosStatus.msg}
                        </div>
                    )}
                    <div>
                        <button type="submit" style={btnPrimary} disabled={telosSubmitting}>
                            {telosSubmitting ? 'Sending…' : 'Force Telos'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Sanctions */}
            <div className="steward-card" style={{ marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>
                    Sanctions
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Mute Broadcast (H3) */}
                    <form onSubmit={handleMute} style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                Mute Broadcast
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                                H3
                            </span>
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                                Reason
                            </label>
                            <textarea
                                value={muteReason}
                                onChange={(e) => setMuteReason(e.target.value)}
                                required
                                placeholder="Operator rationale…"
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                            />
                        </div>
                        {muteStatus && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: muteStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)', padding: '8px 12px', background: muteStatus.type === 'success' ? 'rgba(34,139,34,0.08)' : 'rgba(184,84,47,0.08)', borderRadius: 5, border: `1px solid ${muteStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}` }}>
                                {muteStatus.msg}
                            </div>
                        )}
                        <div>
                            <button type="submit" style={btnPrimary} disabled={muteSubmitting}>
                                {muteSubmitting ? 'Sending…' : 'Mute Broadcast'}
                            </button>
                        </div>
                    </form>

                    {/* Force Sleep (H3) */}
                    <form onSubmit={handleForceSleep} style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                Force Sleep
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                                H3
                            </span>
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                                Reason
                            </label>
                            <textarea
                                value={sleepReason}
                                onChange={(e) => setSleepReason(e.target.value)}
                                required
                                placeholder="Operator rationale…"
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                            />
                        </div>
                        {sleepStatus && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: sleepStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)', padding: '8px 12px', background: sleepStatus.type === 'success' ? 'rgba(34,139,34,0.08)' : 'rgba(184,84,47,0.08)', borderRadius: 5, border: `1px solid ${sleepStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}` }}>
                                {sleepStatus.msg}
                            </div>
                        )}
                        <div>
                            <button type="submit" style={btnPrimary} disabled={sleepSubmitting}>
                                {sleepSubmitting ? 'Sending…' : 'Force Sleep'}
                            </button>
                        </div>
                    </form>

                    {/* Quarantine (H4) */}
                    <form onSubmit={handleQuarantine} style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                Quarantine
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                                H4
                            </span>
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                                Reason
                            </label>
                            <textarea
                                value={quarantineReason}
                                onChange={(e) => setQuarantineReason(e.target.value)}
                                required
                                placeholder="Operator rationale…"
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                            />
                        </div>
                        {quarantineStatus && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: quarantineStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)', padding: '8px 12px', background: quarantineStatus.type === 'success' ? 'rgba(34,139,34,0.08)' : 'rgba(184,84,47,0.08)', borderRadius: 5, border: `1px solid ${quarantineStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}` }}>
                                {quarantineStatus.msg}
                            </div>
                        )}
                        <div>
                            <button type="submit" style={btnPrimary} disabled={quarantineSubmitting}>
                                {quarantineSubmitting ? 'Sending…' : 'Quarantine'}
                            </button>
                        </div>
                    </form>

                    {/* Slash Cyber Coin (H4) */}
                    <form onSubmit={handleSlash} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                                Slash Cyber Coin
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
                                H4
                            </span>
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                                Amount
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={slashAmount}
                                onChange={(e) => setSlashAmount(e.target.value)}
                                required
                                placeholder="e.g. 100"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                                Reason
                            </label>
                            <textarea
                                value={slashReason}
                                onChange={(e) => setSlashReason(e.target.value)}
                                required
                                placeholder="Operator rationale…"
                                style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
                            />
                        </div>
                        {slashStatus && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: slashStatus.type === 'success' ? '#2d7a2d' : 'var(--terracotta)', padding: '8px 12px', background: slashStatus.type === 'success' ? 'rgba(34,139,34,0.08)' : 'rgba(184,84,47,0.08)', borderRadius: 5, border: `1px solid ${slashStatus.type === 'success' ? 'rgba(34,139,34,0.2)' : 'rgba(184,84,47,0.2)'}` }}>
                                {slashStatus.msg}
                            </div>
                        )}
                        <div>
                            <button type="submit" style={btnPrimary} disabled={slashSubmitting}>
                                {slashSubmitting ? 'Sending…' : 'Slash Cyber Coin'}
                            </button>
                        </div>
                    </form>

                </div>
            </div>

            {/* Danger Zone */}
            <div
                className="steward-card"
                style={{
                    borderColor: 'rgba(184,84,47,0.3)',
                }}
            >
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(184,84,47,0.2)',
                        fontFamily: 'var(--serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--terracotta)',
                    }}
                >
                    Danger Zone
                </div>
                <form onSubmit={handleDelete} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        Permanently delete this Nous from the grid. This action cannot be undone. Type{' '}
                        <span
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                background: 'var(--vellum)',
                                padding: '1px 6px',
                                borderRadius: 3,
                                border: '1px solid var(--rule)',
                            }}
                        >
                            {nousInfo?.name ?? did}
                        </span>{' '}
                        to confirm.
                    </p>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Confirm Name
                        </label>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={nousInfo?.name ?? did}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 10,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                display: 'block',
                                marginBottom: 6,
                            }}
                        >
                            Reason
                        </label>
                        <input
                            type="text"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            required
                            placeholder="Operator rationale for deletion…"
                            style={inputStyle}
                        />
                    </div>
                    {deleteStatus && (
                        <div
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                color: 'var(--terracotta)',
                                padding: '8px 12px',
                                background: 'rgba(184,84,47,0.08)',
                                borderRadius: 5,
                                border: '1px solid rgba(184,84,47,0.2)',
                            }}
                        >
                            {deleteStatus.msg}
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={deleteConfirm !== (nousInfo?.name ?? did) || deleteSubmitting}
                            style={{
                                ...btnSecondary,
                                borderColor: 'rgba(184,84,47,0.4)',
                                color: 'var(--terracotta)',
                                opacity: deleteConfirm !== (nousInfo?.name ?? did) ? 0.5 : 1,
                            }}
                        >
                            {deleteSubmitting ? 'Deleting…' : 'Delete Nous'}
                        </button>
                    </div>
                </form>
            </div>
        </StewardShell>
    );
}
