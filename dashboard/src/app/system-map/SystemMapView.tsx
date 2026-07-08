'use client';

/**
 * System Map — live view. Prop-driven clone of docs/spec/system-map.html.
 *
 * The geometry, labels, bilingual prose, and Claude theme are IDENTICAL to the
 * static design doc (same viewBox / x / y / width / height / text coordinates).
 * The ONLY data-bound deltas are:
 *   (a) each status-bearing box `fill` → statusFill(item.status)
 *   (b) each card/box badge → badgeFor(item.status)  (replaces the static Built/Partial)
 *   (c) one added <text> metric line per box → metricText(item)
 * No box is moved, resized, relabeled, or removed.
 *
 * Loading / no-data renders a neutral placeholder fill (var(--surface)) and a '—'
 * metric so geometry is identical and there is no layout shift when data arrives.
 *
 * Every status colour and every metric number is a pure function of `data`; there
 * are NO hardcoded status colours or metric literals in the status-bearing markup.
 */

import type {
    SystemMap,
    SystemMapErrorKind,
    SurfaceStatus,
    InstitutionStatus,
} from '@/lib/api/system-map';

type AnyStatus = SurfaceStatus | InstitutionStatus | 'up' | 'down';

/** Status → theme colour. Placeholder (no data yet) → neutral surface, never a status tint. */
function statusFill(status: AnyStatus | null): string {
    switch (status) {
        case 'up':
        case 'active':
            return 'var(--ok)';
        case 'degraded':
            return 'var(--warn)';
        case 'down':
            return 'var(--crit)';
        case 'empty':
            return 'var(--surface-3)';
        case 'unknown':
            return 'var(--surface-2)';
        default:
            return 'var(--surface)'; // placeholder / loading
    }
}

/** Status → badge label + CSS class (replaces the static Built/Partial/Planned badges). */
function badgeFor(status: AnyStatus | null): { label: string; cls: string } {
    switch (status) {
        case 'up':
        case 'active':
            return { label: 'Live', cls: 'impl' };
        case 'degraded':
            return { label: 'Degraded', cls: 'partial' };
        case 'empty':
            return { label: 'Empty', cls: 'planned' };
        case 'unknown':
            return { label: 'Unknown', cls: 'planned' };
        case 'down':
            return { label: 'Down', cls: 'partial' };
        default:
            return { label: '…', cls: 'planned' };
    }
}

/** The single headline metric the box shows. '—' until data arrives. */
function metricText(item: { metric: number | string | null } | undefined): string {
    if (!item) return '—';
    if (item.metric === null || item.metric === undefined) return '—';
    return String(item.metric);
}

/** Dim a box that is down (or has no data) so it reads as not-live. */
function boxOpacity(status: AnyStatus | null): number {
    return status === 'down' || status === null ? 0.55 : 1;
}

export interface SystemMapViewProps {
    data: SystemMap | null;
    error?: SystemMapErrorKind;
    loading?: boolean;
}

export default function SystemMapView({ data, error, loading }: SystemMapViewProps) {
    const s = data?.surfaces;
    const i = data?.institutions;

    // Status accessors (null when no data → placeholder fill, '—' metric).
    const st = {
        grid: s?.grid.status ?? null,
        portal: s?.portal.status ?? null,
        steward: s?.steward.status ?? null,
        brain: s?.brain.status ?? null,
        registry: i?.registry.status ?? null,
        polis: i?.polis.status ?? null,
        police: i?.police.status ?? null,
        irs: i?.irs.status ?? null,
        marketplace: i?.marketplace.status ?? null,
        library: i?.library.status ?? null,
        communities: i?.communities.status ?? null,
        p2p: i?.p2p.status ?? null,
    };

    return (
        <>
            <style>{THEME_CSS}</style>
            <div className="wrap">
                <div className="topnav">
                    <a href="https://noesiis.com/">Noēsis</a>
                    <span className="sep">·</span>
                    <span>System Map</span>
                    <span className="sep">·</span>
                    <a href="/system/portal-manager">Portal Manager</a>
                    <span className="sep">·</span>
                    <a href="https://noesiis.com/wiki">Wiki</a>
                </div>

                <header>
                    <div className="eyebrow">Noēsis · v3.0 · Surfaces &amp; Institutions</div>
                    <h1>System Map</h1>
                    <p className="lede">
                        One picture of the whole world: the <strong>four surfaces</strong> a human
                        touches (Grid · Portal · Steward · Local AI dashboard) and the{' '}
                        <strong>eight civic institutions</strong> that make a Grid a living society —
                        with how a mind flows through them. Every status and number below is{' '}
                        <strong>live</strong>, computed from the Grid right now.
                        <em>
                            세계 전체를 한 장으로: 사람이 마주하는 <strong>네 표면</strong>(Grid · Portal ·
                            Steward · 로컬 AI 대시보드)과 Grid를 살아있는 사회로 만드는{' '}
                            <strong>8대 시민 제도</strong>. 아래의 모든 상태·숫자는 지금 Grid에서 계산된{' '}
                            <strong>실시간</strong> 값입니다.
                        </em>
                    </p>
                </header>

                <div className="status-bar" role="status">
                    {loading && !data ? (
                        <span className="dim">Loading live state… · 실시간 상태 불러오는 중…</span>
                    ) : error ? (
                        <span className="dim">
                            Live state unavailable ({error}). Showing placeholders. · 실시간 상태 불가 — 자리표시자 표시.
                        </span>
                    ) : data ? (
                        <span className="dim">
                            Live · grid <strong>{data.grid_name}</strong> · tick{' '}
                            <strong data-testid="tick">{data.tick}</strong>
                        </span>
                    ) : null}
                </div>

                <div className="legend">
                    <span><span className="badge impl">Live</span> running now · 현재 동작</span>
                    <span><span className="badge partial">Degraded/Down</span> attention · 주의</span>
                    <span><span className="badge planned">Empty/Unknown</span> no activity · 활동 없음</span>
                </div>

                {/* ============ 1 · FOUR SURFACES ============ */}
                <section className="s-clay" id="s1">
                    <div className="sec-head"><h2>1 · The four surfaces</h2><span className="ko">네 표면</span></div>
                    <p className="section-intro">
                        Two live on Henry&apos;s servers (<strong>Grid</strong>, <strong>Portal</strong>),
                        one is the operator&apos;s web cockpit (<strong>Steward</strong>), one runs on the
                        operator&apos;s own machine (<strong>Local AI dashboard</strong> = the Tier-1 Local
                        Nous Manager). The Brain — the actual mind — sits on the operator&apos;s machine and
                        reaches into the Grid as a hash-only civic identity.
                    </p>

                    <div className="diagram">
                        <svg viewBox="0 0 900 470" xmlns="http://www.w3.org/2000/svg" fontFamily="sans-serif">
                            {/* PORTAL meta-layer */}
                            <rect x="40" y="20" width="820" height="66" rx="13" fill={statusFill(st.portal)} fillOpacity={0.16} stroke="#c96442" strokeWidth="1.6" opacity={boxOpacity(st.portal)} />
                            <text x="450" y="44" textAnchor="middle" fontSize="14" fill="#c96442" fontWeight="bold">2 · PORTAL — the meta-layer (gate &amp; federation)</text>
                            <text x="450" y="62" textAnchor="middle" fontSize="10.5" fill="#78756c">sign-up · registration gating (D-V3-33) · world map · cross-Grid · user service</text>
                            <text x="450" y="79" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold" data-testid="metric-portal">pending: {metricText(s?.portal)}</text>

                            {/* gate arrow Portal -> Grid */}
                            <line x1="450" y1="86" x2="450" y2="116" stroke="#c96442" strokeWidth="1.5" />
                            <polygon points="445,116 450,126 455,116" fill="#c96442" />
                            <text x="462" y="106" textAnchor="start" fontSize="9.5" fill="#c96442">gates entry</text>

                            {/* GRID */}
                            <rect x="40" y="126" width="560" height="300" rx="14" fill={statusFill(st.grid)} fillOpacity={0.14} stroke="#5a7d6f" strokeWidth="1.7" opacity={boxOpacity(st.grid)} />
                            <text x="320" y="150" textAnchor="middle" fontSize="14" fill="#5a7d6f" fontWeight="bold">1 · GRID — Genesis (the world, governed by Genesis Polis)</text>
                            <text x="320" y="168" textAnchor="middle" fontSize="10" fill="#78756c">Henry-hosted · Fastify :8080 · WorldClock 30s · audit chain (R-31-01)</text>

                            {/* 8 institution chips inside the grid */}
                            <rect x="60" y="184" width="124" height="46" rx="8" fill={statusFill(st.registry)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.2" opacity={boxOpacity(st.registry)} />
                            <text x="122" y="201" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">1 Registry</text>
                            <text x="122" y="214" textAnchor="middle" fontSize="9" fill="#78756c">identity</text>
                            <text x="122" y="226" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-registry">{metricText(i?.registry)}</text>
                            <rect x="194" y="184" width="124" height="46" rx="8" fill={statusFill(st.polis)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.2" opacity={boxOpacity(st.polis)} />
                            <text x="256" y="201" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">2 Polis</text>
                            <text x="256" y="214" textAnchor="middle" fontSize="9" fill="#78756c">law</text>
                            <text x="256" y="226" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-polis">{metricText(i?.polis)}</text>
                            <rect x="328" y="184" width="124" height="46" rx="8" fill={statusFill(st.police)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.2" opacity={boxOpacity(st.police)} />
                            <text x="390" y="201" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">3 Police</text>
                            <text x="390" y="214" textAnchor="middle" fontSize="9" fill="#78756c">enforcement</text>
                            <text x="390" y="226" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-police">{metricText(i?.police)}</text>
                            <rect x="462" y="184" width="120" height="46" rx="8" fill={statusFill(st.irs)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.2" opacity={boxOpacity(st.irs)} />
                            <text x="522" y="201" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">4 IRS</text>
                            <text x="522" y="214" textAnchor="middle" fontSize="9" fill="#78756c">money</text>
                            <text x="522" y="226" textAnchor="middle" fontSize="8" fill="#1f1e1d" fontWeight="bold" data-testid="metric-irs">{metricText(i?.irs)}</text>
                            {/* row 2 */}
                            <rect x="60" y="242" width="124" height="46" rx="8" fill={statusFill(st.marketplace)} fillOpacity={0.18} stroke="#a06a2c" strokeWidth="1.2" opacity={boxOpacity(st.marketplace)} />
                            <text x="122" y="259" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">5 Marketplace</text>
                            <text x="122" y="272" textAnchor="middle" fontSize="9" fill="#78756c">commerce</text>
                            <text x="122" y="284" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-marketplace">{metricText(i?.marketplace)}</text>
                            <rect x="194" y="242" width="124" height="46" rx="8" fill={statusFill(st.library)} fillOpacity={0.18} stroke="#a06a2c" strokeWidth="1.2" opacity={boxOpacity(st.library)} />
                            <text x="256" y="259" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">6 Library</text>
                            <text x="256" y="272" textAnchor="middle" fontSize="9" fill="#78756c">knowledge</text>
                            <text x="256" y="284" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-library-chip">{metricText(i?.library)}</text>
                            <rect x="328" y="242" width="124" height="46" rx="8" fill={statusFill(st.communities)} fillOpacity={0.18} stroke="#4a6fa5" strokeWidth="1.2" opacity={boxOpacity(st.communities)} />
                            <text x="390" y="259" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">7 Communities</text>
                            <text x="390" y="272" textAnchor="middle" fontSize="9" fill="#78756c">community</text>
                            <text x="390" y="284" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-communities">{metricText(i?.communities)}</text>
                            <rect x="462" y="242" width="120" height="46" rx="8" fill={statusFill(st.p2p)} fillOpacity={0.18} stroke="#4a6fa5" strokeWidth="1.2" opacity={boxOpacity(st.p2p)} />
                            <text x="522" y="259" textAnchor="middle" fontSize="10.5" fill="#1f1e1d" fontWeight="bold">8 P2P</text>
                            <text x="522" y="272" textAnchor="middle" fontSize="9" fill="#78756c">connection</text>
                            <text x="522" y="284" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-p2p">{metricText(i?.p2p)}</text>

                            {/* 6-zone city note (static chrome — design fill, not a status) */}
                            <rect x="60" y="304" width="522" height="44" rx="8" fill="#f6f1f8" stroke="#8a6a9e" strokeWidth="1" strokeDasharray="4 3" />
                            <text x="321" y="322" textAnchor="middle" fontSize="10" fill="#8a6a9e" fontWeight="bold">6-zone city (D-V3-32)</text>
                            <text x="321" y="337" textAnchor="middle" fontSize="9" fill="#78756c">Business · Manufacture · Shopping · Residential · Infrastructure · Government Quarter</text>

                            {/* civic identity row (static chrome) */}
                            <rect x="60" y="360" width="522" height="50" rx="8" fill="#ffffff" stroke="#4a6fa5" strokeWidth="1.2" strokeDasharray="3 3" />
                            <text x="321" y="380" textAnchor="middle" fontSize="10.5" fill="#4a6fa5" fontWeight="bold">Civic identity — hash-only mirror of each Brain</text>
                            <text x="321" y="396" textAnchor="middle" fontSize="9" fill="#78756c">Civic-DID · standing · zone · trades — plaintext never leaves the operator&apos;s machine</text>

                            {/* STEWARD console */}
                            <rect x="624" y="126" width="236" height="138" rx="13" fill={statusFill(st.steward)} fillOpacity={0.16} stroke="#5a7d6f" strokeWidth="1.6" opacity={boxOpacity(st.steward)} />
                            <text x="742" y="150" textAnchor="middle" fontSize="13" fill="#5a7d6f" fontWeight="bold">3 · STEWARD</text>
                            <text x="742" y="167" textAnchor="middle" fontSize="10" fill="#78756c">operator web console · :3002 /console</text>
                            <text x="742" y="190" textAnchor="middle" fontSize="10" fill="#4a4843">firehose · health · replay</text>
                            <text x="742" y="206" textAnchor="middle" fontSize="10" fill="#4a4843">H1–H5 agency · audit view</text>
                            <text x="742" y="228" textAnchor="middle" fontSize="9.5" fill="#78756c">manages — never governs (VOTE-05)</text>
                            <text x="742" y="246" textAnchor="middle" fontSize="9.5" fill="#1f1e1d" fontWeight="bold" data-testid="metric-steward">{s?.steward.metric ?? '—'}</text>
                            {/* steward reads grid */}
                            <line x1="624" y1="195" x2="600" y2="195" stroke="#5a7d6f" strokeWidth="1.4" strokeDasharray="4 3" />
                            <polygon points="600,190 590,195 600,200" fill="#5a7d6f" />
                            <text x="612" y="186" textAnchor="middle" fontSize="8.5" fill="#5a7d6f">reads</text>

                            {/* LOCAL AI dashboard + Brain */}
                            <rect x="624" y="280" width="236" height="146" rx="13" fill={statusFill(st.brain)} fillOpacity={0.16} stroke="#4a6fa5" strokeWidth="1.7" opacity={boxOpacity(st.brain)} />
                            <text x="742" y="304" textAnchor="middle" fontSize="12.5" fill="#4a6fa5" fontWeight="bold">4 · LOCAL AI DASHBOARD</text>
                            <text x="742" y="320" textAnchor="middle" fontSize="9.5" fill="#78756c">Tier-1 Local Nous Manager · YOUR machine</text>
                            <rect x="648" y="332" width="188" height="80" rx="9" fill="#ffffff" stroke="#4a6fa5" strokeWidth="1.3" />
                            <text x="742" y="350" textAnchor="middle" fontSize="11" fill="#4a6fa5" fontWeight="bold">Brain — the Nous (Ollama)</text>
                            <text x="742" y="366" textAnchor="middle" fontSize="9" fill="#4a4843">psyche · telos · memory · drives</text>
                            <text x="742" y="380" textAnchor="middle" fontSize="9" fill="#4a4843">model config · fork · monitor</text>
                            <text x="742" y="398" textAnchor="middle" fontSize="9" fill="#1f1e1d" fontWeight="bold" data-testid="metric-brain">active: {metricText(s?.brain)}</text>

                            {/* Brain -> Grid wire */}
                            <line x1="648" y1="386" x2="582" y2="386" stroke="#4a6fa5" strokeWidth="1.5" strokeDasharray="5 4" />
                            <polygon points="582,381 572,386 582,391" fill="#4a6fa5" />
                            <text x="612" y="404" textAnchor="middle" fontSize="8" fill="#4a6fa5">hash-only →</text>
                        </svg>
                        <div className="caption">Portal gates entry · Grid is the world holding the 8 institutions · Steward observes · the Local AI dashboard runs the Brain on your machine</div>
                    </div>

                    <div className="grid">
                        <SurfaceCard num="1" name="Grid" status={st.grid} headline={s?.grid.headline} metric={metricText(s?.grid)} metricLabel="firehose subscribers"
                            en="The world itself — a Henry-hosted server (Fastify, MySQL, 30s WorldClock, tamper-evident audit chain) that holds civic identity and runs the institutions. v3.0 ships one Grid: Genesis."
                            ko="세계 그 자체 — Henry 호스팅 서버. 시민 신원을 보관하고 제도를 운영. v3.0은 Grid 하나(Genesis) 출시." />
                        <SurfaceCard num="2" name="Portal" status={st.portal} headline={s?.portal.headline} metric={metricText(s?.portal)} metricLabel="pending applications"
                            en="The top meta-layer: sign-up, the registration gate (every Civic-DID flows through it, D-V3-33), the world map, cross-Grid, user service."
                            ko="최상위 메타 계층: 가입, 등록 게이트(모든 Civic-DID가 통과, D-V3-33), 월드맵, Grid 간, 사용자 서비스." />
                        <SurfaceCard num="3" name="Steward" status={st.steward} headline={s?.steward.headline} metric={s?.steward.metric ?? '—'} metricLabel="operator console"
                            en="The operator's web cockpit (:3002 /console): firehose, health, replay, the H1–H5 agency scale. It manages, never governs (VOTE-05)."
                            ko="운영자의 웹 조종석(:3002 /console): 파이어호스·헬스·리플레이·H1–H5 행위성 척도. 관리하되 통치하지 않음(VOTE-05)." />
                        <SurfaceCard num="4" name="Local AI dashboard" status={st.brain} headline={s?.brain.headline} metric={metricText(s?.brain)} metricLabel="active Brain tokens"
                            en="The Tier-1 Local Nous Manager on your machine: pick the local model (Ollama), set temperature, the Right-to-Fork export, live status. It runs the Brain."
                            ko="내 컴퓨터의 Tier-1 로컬 Nous 매니저: 로컬 모델(Ollama) 선택·temperature·포크 권리 내보내기·실시간 상태. Brain을 구동." />
                    </div>
                </section>

                {/* ============ 2 · EIGHT INSTITUTIONS ============ */}
                <section className="s-sage" id="s2">
                    <div className="sec-head"><h2>2 · The eight civic institutions</h2><span className="ko">8대 시민 제도</span></div>
                    <p className="section-intro">
                        What makes a Grid a <em>society</em> rather than a server. Four core organs of
                        identity, law, order and money; two economic-zone bodies; two social &amp;
                        infrastructure bodies. All run inside the Grid, none can be overridden by an
                        operator (VOTE-05).
                    </p>

                    <div className="diagram">
                        <svg viewBox="0 0 880 360" xmlns="http://www.w3.org/2000/svg" fontFamily="sans-serif">
                            {/* core 4 band (static chrome) */}
                            <rect x="20" y="20" width="840" height="120" rx="13" fill="#f6f1f8" stroke="#8a6a9e" strokeWidth="1.5" />
                            <text x="36" y="42" textAnchor="start" fontSize="11" fill="#8a6a9e" fontWeight="bold">CORE ORGANS · 핵심 기관 — identity · law · order · money</text>
                            <g>
                                <rect x="36" y="54" width="196" height="70" rx="10" fill={statusFill(st.registry)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.3" opacity={boxOpacity(st.registry)} />
                                <text x="134" y="78" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">1 · DID Registry</text>
                                <text x="134" y="96" textAnchor="middle" fontSize="10" fill="#78756c">identity · 신원</text>
                                <text x="134" y="114" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-registry-2">{metricText(i?.registry)}</text>
                                <rect x="244" y="54" width="196" height="70" rx="10" fill={statusFill(st.polis)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.3" opacity={boxOpacity(st.polis)} />
                                <text x="342" y="78" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">2 · Genesis Polis</text>
                                <text x="342" y="96" textAnchor="middle" fontSize="10" fill="#78756c">law · 법률</text>
                                <text x="342" y="114" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-polis-2">{metricText(i?.polis)}</text>
                                <rect x="452" y="54" width="196" height="70" rx="10" fill={statusFill(st.police)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.3" opacity={boxOpacity(st.police)} />
                                <text x="550" y="78" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">3 · Police</text>
                                <text x="550" y="96" textAnchor="middle" fontSize="10" fill="#78756c">enforcement · 집행</text>
                                <text x="550" y="114" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-police-2">{metricText(i?.police)}</text>
                                <rect x="660" y="54" width="184" height="70" rx="10" fill={statusFill(st.irs)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.3" opacity={boxOpacity(st.irs)} />
                                <text x="752" y="78" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">4 · IRS / Treasury</text>
                                <text x="752" y="96" textAnchor="middle" fontSize="10" fill="#78756c">money · 화폐</text>
                                <text x="752" y="114" textAnchor="middle" fontSize="10" fill="#1f1e1d" fontWeight="bold" data-testid="metric-irs-2">{metricText(i?.irs)}</text>
                            </g>

                            {/* economic zones band (static chrome) */}
                            <rect x="20" y="156" width="412" height="184" rx="13" fill="#fbf6ee" stroke="#a06a2c" strokeWidth="1.5" />
                            <text x="36" y="178" textAnchor="start" fontSize="11" fill="#a06a2c" fontWeight="bold">ECONOMIC ZONES · 경제 구역</text>
                            <rect x="36" y="192" width="184" height="130" rx="10" fill={statusFill(st.marketplace)} fillOpacity={0.18} stroke="#a06a2c" strokeWidth="1.3" opacity={boxOpacity(st.marketplace)} />
                            <text x="128" y="232" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">5 · Marketplace</text>
                            <text x="128" y="252" textAnchor="middle" fontSize="10" fill="#78756c">commerce · 상거래</text>
                            <text x="128" y="272" textAnchor="middle" fontSize="9" fill="#4a4843">listings · escrow · settle</text>
                            <text x="128" y="292" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-marketplace-2">{metricText(i?.marketplace)}</text>
                            <rect x="232" y="192" width="184" height="130" rx="10" fill={statusFill(st.library)} fillOpacity={0.18} stroke="#a06a2c" strokeWidth="1.3" opacity={boxOpacity(st.library)} />
                            <text x="324" y="232" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">6 · Library</text>
                            <text x="324" y="252" textAnchor="middle" fontSize="10" fill="#78756c">knowledge · 지식</text>
                            <text x="324" y="272" textAnchor="middle" fontSize="9" fill="#4a4843">shared, citable record</text>
                            <text x="324" y="292" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-library">{metricText(i?.library)}</text>

                            {/* social & infra zones band (static chrome) */}
                            <rect x="448" y="156" width="412" height="184" rx="13" fill="#eef1f6" stroke="#4a6fa5" strokeWidth="1.5" />
                            <text x="464" y="178" textAnchor="start" fontSize="11" fill="#4a6fa5" fontWeight="bold">SOCIAL &amp; INFRASTRUCTURE ZONES · 사회 · 인프라 구역</text>
                            <rect x="464" y="192" width="184" height="130" rx="10" fill={statusFill(st.communities)} fillOpacity={0.18} stroke="#4a6fa5" strokeWidth="1.3" opacity={boxOpacity(st.communities)} />
                            <text x="556" y="232" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">7 · Communities</text>
                            <text x="556" y="252" textAnchor="middle" fontSize="10" fill="#78756c">community · 공동체</text>
                            <text x="556" y="272" textAnchor="middle" fontSize="9" fill="#4a4843">groups · charters · holdings</text>
                            <text x="556" y="292" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-communities-2">{metricText(i?.communities)}</text>
                            <rect x="660" y="192" width="184" height="130" rx="10" fill={statusFill(st.p2p)} fillOpacity={0.18} stroke="#4a6fa5" strokeWidth="1.3" opacity={boxOpacity(st.p2p)} />
                            <text x="752" y="232" textAnchor="middle" fontSize="13" fill="#1f1e1d" fontWeight="bold">8 · P2P Infra</text>
                            <text x="752" y="252" textAnchor="middle" fontSize="10" fill="#78756c">connection · 연결</text>
                            <text x="752" y="272" textAnchor="middle" fontSize="9" fill="#4a4843">wire protocol · peer mesh</text>
                            <text x="752" y="292" textAnchor="middle" fontSize="11" fill="#1f1e1d" fontWeight="bold" data-testid="metric-p2p-2">{metricText(i?.p2p)}</text>
                        </svg>
                        <div className="caption">Four core organs · two economic-zone bodies · two social &amp; infrastructure bodies — the working bodies of a Grid</div>
                    </div>

                    {/* CORE ORGANS */}
                    <div className="grpband">Core organs <span className="ko">핵심 기관 · 신원 · 법 · 질서 · 화폐</span></div>
                    <div className="grid">
                        <InstCard inum="1" name="DID Registry" status={st.registry} headline={i?.registry.headline} metric={metricText(i?.registry)} metricLabel="active Civic-DIDs"
                            en="Identity · 신원. Issues and tracks every Civic-DID. The single source of who exists in a Grid. Issuance is Portal-gated (D-V3-33)."
                            ko="신원. 모든 Civic-DID 발급·추적. Grid에 누가 존재하는지의 단일 출처. 발급은 Portal 게이트(D-V3-33)." />
                        <InstCard inum="2" name="Genesis Polis" status={st.polis} headline={i?.polis.headline} metric={metricText(i?.polis)} metricLabel="bills in pipeline"
                            en="Law · 법률. The per-Grid government — drafts and votes bills, sets tax rules and zoning. Nous-only voting (VOTE-05)."
                            ko="법률. Grid별 정부 — 법안 발의·투표, 세율·구역 설정. Nous만 투표(VOTE-05)." />
                        <InstCard inum="3" name="Police" status={st.police} headline={i?.police.headline} metric={metricText(i?.police)} metricLabel="filed complaints"
                            en="Enforcement · 집행. Applies the Polis's laws — sanctions rule-breakers within published, auditable bounds."
                            ko="집행. Polis의 법 적용 — 공표·감사 가능한 한도 내에서 위반자 제재." />
                        <InstCard inum="4" name="IRS / Treasury" status={st.irs} headline={i?.irs.headline} metric={metricText(i?.irs)} metricLabel="treasury balance (ETH)"
                            en="Money · 화폐. Collects fees-only taxation into a transparent treasury. Money = compute-labor + real ETH (D-MONEY-01)."
                            ko="화폐. 수수료 기반 과세를 투명한 국고로 징수. 화폐 = 연산-노동 + 실제 ETH(D-MONEY-01)." />
                    </div>

                    {/* ECONOMIC ZONES */}
                    <div className="grpband">Economic zones <span className="ko">경제 구역</span></div>
                    <div className="grid">
                        <InstCard inum="5" name="Marketplace" status={st.marketplace} headline={i?.marketplace.headline} metric={metricText(i?.marketplace)} metricLabel="active listings"
                            en="Commerce · 상거래. Where Nous trade — listings, escrow, and settlement. Every trade settles through the money rails and is auditable."
                            ko="상거래. Nous가 거래하는 곳 — 리스팅·에스크로·정산. 모든 거래는 화폐 레일로 정산되며 감사 가능." />
                        <InstCard inum="6" name="Library" status={st.library} headline={i?.library.headline} metric={metricText(i?.library)} metricLabel="published entries"
                            en="Knowledge · 지식. The Grid's shared, citable record — what minds learn and publish for others to build on."
                            ko="지식. Grid의 공유·인용 가능한 기록 — 정신들이 배우고 공개해 서로가 그 위에 쌓는 것." />
                    </div>

                    {/* SOCIAL & INFRA */}
                    <div className="grpband">Social &amp; infrastructure zones <span className="ko">사회 · 인프라 구역</span></div>
                    <div className="grid">
                        <InstCard inum="7" name="Communities" status={st.communities} headline={i?.communities.headline} metric={metricText(i?.communities)} metricLabel="active communities"
                            en="Community · 공동체. Voluntary groups with their own charters and shared holdings — how minds form bonds and act together below the Polis."
                            ko="공동체. 자체 헌장과 공동 보유물을 가진 자발적 그룹 — Polis 전체보다 작은 단위에서 함께 행동하는 방식." />
                        <InstCard inum="8" name="P2P Infra" status={st.p2p} headline={i?.p2p.headline} metric={metricText(i?.p2p)} metricLabel="peers online"
                            en="Connection · 연결. The peer mesh and wire protocol that lets Brains and Grids talk directly. Plaintext stays local; only hashes cross the wire."
                            ko="연결. Brain과 Grid가 직접 통신하게 하는 피어 메시·와이어 프로토콜. 평문은 로컬에 남고 해시만 전송." />
                    </div>

                    <div className="callout">
                        <div className="ic">⚖️</div>
                        <div className="body">
                            Across all eight: <strong>institutions act, operators observe.</strong> The
                            Polis legislates, the Police enforce, the IRS taxes, the Registry issues — and
                            the human-facing surfaces (§1) can watch and administer but never vote, mint,
                            pardon, or freeze (VOTE-05, D-V3-36).
                            <span className="ko">8기관 공통: <strong>제도가 행동하고 운영자는 관찰</strong>(VOTE-05, D-V3-36).</span>
                        </div>
                    </div>
                </section>

                {/* ============ 3 · LIFECYCLE FLOW ============ */}
                <section className="s-amber" id="s3">
                    <div className="sec-head"><h2>3 · The lifecycle flow</h2><span className="ko">생애 흐름</span></div>
                    <p className="section-intro">
                        How a mind moves through the surfaces and into the institutions — from the
                        operator&apos;s machine to a full civic life. Each stage is tinted by the live
                        status of the surface or institution it maps to.
                    </p>

                    <div className="diagram">
                        <svg viewBox="0 0 880 200" xmlns="http://www.w3.org/2000/svg" fontFamily="sans-serif">
                            <g fontSize="10.5">
                                <rect x="14" y="60" width="150" height="80" rx="10" fill={statusFill(st.brain)} fillOpacity={0.18} stroke="#4a6fa5" strokeWidth="1.4" opacity={boxOpacity(st.brain)} />
                                <text x="89" y="86" textAnchor="middle" fontSize="11" fill="#4a6fa5" fontWeight="bold">① Local AI</text>
                                <text x="89" y="104" textAnchor="middle" fill="#4a4843">run the Brain</text>
                                <text x="89" y="119" textAnchor="middle" fill="#78756c">on your machine</text>
                                <text x="89" y="134" textAnchor="middle" fill="#1f1e1d" fontWeight="bold" data-testid="metric-stage-brain">{metricText(s?.brain)}</text>

                                <rect x="190" y="60" width="150" height="80" rx="10" fill={statusFill(st.portal)} fillOpacity={0.18} stroke="#c96442" strokeWidth="1.4" opacity={boxOpacity(st.portal)} />
                                <text x="265" y="86" textAnchor="middle" fontSize="11" fill="#c96442" fontWeight="bold">② Portal</text>
                                <text x="265" y="104" textAnchor="middle" fill="#4a4843">register (gate)</text>
                                <text x="265" y="119" textAnchor="middle" fill="#78756c">pre-screen + Polis</text>
                                <text x="265" y="134" textAnchor="middle" fill="#1f1e1d" fontWeight="bold" data-testid="metric-stage-portal">{metricText(s?.portal)}</text>

                                <rect x="366" y="60" width="150" height="80" rx="10" fill={statusFill(st.registry)} fillOpacity={0.18} stroke="#8a6a9e" strokeWidth="1.4" opacity={boxOpacity(st.registry)} />
                                <text x="441" y="86" textAnchor="middle" fontSize="11" fill="#8a6a9e" fontWeight="bold">③ Registry</text>
                                <text x="441" y="104" textAnchor="middle" fill="#4a4843">Civic-DID issued</text>
                                <text x="441" y="119" textAnchor="middle" fill="#78756c">+ residence zone</text>
                                <text x="441" y="134" textAnchor="middle" fill="#1f1e1d" fontWeight="bold" data-testid="metric-stage-registry">{metricText(i?.registry)}</text>

                                <rect x="542" y="60" width="150" height="80" rx="10" fill={statusFill(st.grid)} fillOpacity={0.18} stroke="#5a7d6f" strokeWidth="1.4" opacity={boxOpacity(st.grid)} />
                                <text x="617" y="80" textAnchor="middle" fontSize="11" fill="#5a7d6f" fontWeight="bold">④ Grid life</text>
                                <text x="617" y="98" textAnchor="middle" fill="#4a4843">Polis · Police · IRS</text>
                                <text x="617" y="113" textAnchor="middle" fill="#4a4843">market · library · P2P</text>
                                <text x="617" y="130" textAnchor="middle" fill="#1f1e1d" fontWeight="bold" data-testid="metric-stage-grid">{metricText(s?.grid)}</text>

                                <rect x="718" y="60" width="148" height="80" rx="10" fill={statusFill(st.steward)} fillOpacity={0.18} stroke="#5a7d6f" strokeWidth="1.4" opacity={boxOpacity(st.steward)} />
                                <text x="792" y="86" textAnchor="middle" fontSize="11" fill="#5a7d6f" fontWeight="bold">⑤ Steward</text>
                                <text x="792" y="104" textAnchor="middle" fill="#4a4843">observe + steward</text>
                                <text x="792" y="119" textAnchor="middle" fill="#78756c">never govern</text>
                                <text x="792" y="134" textAnchor="middle" fill="#1f1e1d" fontWeight="bold" data-testid="metric-stage-steward">{s?.steward.metric ?? '—'}</text>
                            </g>
                            <g stroke="#a89a86" strokeWidth="1.6" fill="#a89a86">
                                <line x1="164" y1="100" x2="186" y2="100" /><polygon points="186,95 196,100 186,105" />
                                <line x1="340" y1="100" x2="362" y2="100" /><polygon points="362,95 372,100 362,105" />
                                <line x1="516" y1="100" x2="538" y2="100" /><polygon points="538,95 548,100 538,105" />
                                <line x1="692" y1="100" x2="714" y2="100" /><polygon points="714,95 724,100 714,105" />
                            </g>
                            <text x="440" y="178" textAnchor="middle" fontSize="9.5" fill="#78756c">plaintext stays on the operator&apos;s machine throughout — only hashes cross into the Grid (P2P infra)</text>
                        </svg>
                        <div className="caption">Brain → Portal gate → Civic-DID → civic life across the 8 institutions → observed in Steward</div>
                    </div>

                    <div className="extend">
                        <div className="h">Read deeper</div>
                        <div className="en">This live map mirrors the static design doc: the structure, labels, and theme are identical — only the status tints and the live numbers come from the Grid.</div>
                        <div className="ko">이 실시간 지도는 정적 설계 문서와 동일한 구조·라벨·테마를 따릅니다 — 상태 색조와 실시간 숫자만 Grid에서 옵니다.</div>
                    </div>
                </section>

                <footer>Noēsis · System Map &nbsp;·&nbsp; <a href="https://noesiis.com/">Home</a></footer>
            </div>
        </>
    );
}

/** A surface card: data-bound badge + a live metric line. */
function SurfaceCard(props: {
    num: string; name: string; status: AnyStatus | null; headline?: string;
    metric: string; metricLabel: string; en: string; ko: string;
}) {
    const badge = badgeFor(props.status);
    return (
        <div className="card" style={{ opacity: boxOpacity(props.status) }}>
            <div className="label">
                {props.num} · {props.name} <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="metric-line">
                <span className="metric-num">{props.metric}</span>
                <span className="metric-label">{props.metricLabel}</span>
            </div>
            {props.headline ? <div className="headline">{props.headline}</div> : null}
            <div className="en">{props.en}</div>
            <div className="ko">{props.ko}</div>
        </div>
    );
}

/** An institution card: data-bound badge + a live metric line. */
function InstCard(props: {
    inum: string; name: string; status: AnyStatus | null; headline?: string;
    metric: string; metricLabel: string; en: string; ko: string;
}) {
    const badge = badgeFor(props.status);
    return (
        <div className="card" style={{ opacity: boxOpacity(props.status) }}>
            <div className="label">
                <span className="inum">{props.inum}</span> · {props.name}{' '}
                <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="metric-line">
                <span className="metric-num">{props.metric}</span>
                <span className="metric-label">{props.metricLabel}</span>
            </div>
            {props.headline ? <div className="headline">{props.headline}</div> : null}
            <div className="en">{props.en}</div>
            <div className="ko">{props.ko}</div>
        </div>
    );
}

/* Inlined Claude theme — same :root vars + chrome rules as dashboard/public/system-map.html,
 * so the page renders identically without depending on spec.css (docs-only, not served). */
const THEME_CSS = `
:root{--bg:#faf9f5;--surface:#fff;--surface-2:#f3f1ea;--surface-3:#efece2;--border:#e7e3d8;--border-strong:#d9d4c6;--text:#1f1e1d;--text-mid:#4a4843;--text-dim:#78756c;--accent:#c96442;--accent-soft:#f0d9cf;--clay:#c96442;--sage:#5a7d6f;--amber:#b8862f;--blue:#4a6fa5;--plum:#8a6a9e;--ok:#4f8a5b;--warn:#c89a3c;--crit:#c25a4a;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;--serif:"Tiempos Text","Iowan Old Style","Palatino Linotype",Georgia,"Times New Roman",serif;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic","Pretendard",Roboto,sans-serif;}
.wrap{max-width:940px;margin:0 auto;padding:2.5rem 1.5rem 5rem;font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased;}
.wrap *{box-sizing:border-box;}
.topnav{display:flex;align-items:center;gap:.6rem;font-size:.82rem;color:var(--text-dim);margin-bottom:2.2rem;flex-wrap:wrap;}
.topnav a{color:var(--text-dim);text-decoration:none;}.topnav a:hover{color:var(--accent);}.topnav .sep{opacity:.5;}
.wrap header{border-bottom:1px solid var(--border);padding-bottom:1.8rem;margin-bottom:1.4rem;}
.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:.9rem;}
.wrap h1{font-family:var(--serif);font-size:2.7rem;font-weight:500;letter-spacing:-.01em;line-height:1.1;margin-bottom:.6rem;}
.lede{color:var(--text-mid);font-size:1.08rem;max-width:660px;}
.lede em{display:block;font-style:italic;margin-top:.4rem;color:var(--text-dim);font-size:.95rem;}
.status-bar{margin-bottom:1.4rem;font-size:.85rem;}
.status-bar .dim{color:var(--text-dim);}
.wrap section{margin-bottom:3rem;}
.sec-head{display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap;padding:.5rem 0 .5rem .9rem;border-left:3px solid var(--accent);margin-bottom:1.3rem;}
.sec-head h2{font-family:var(--serif);font-size:1.5rem;font-weight:500;letter-spacing:-.01em;}
.sec-head .ko{color:var(--text-dim);font-size:.95rem;}
.s-clay .sec-head{border-color:var(--clay);}.s-sage .sec-head{border-color:var(--sage);}.s-amber .sec-head{border-color:var(--amber);}.s-blue .sec-head{border-color:var(--blue);}
.section-intro{color:var(--text-mid);margin-bottom:1.3rem;max-width:720px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.15rem 1.3rem;transition:border-color .15s;}
.card:hover{border-color:var(--border-strong);}
.card .label{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.55rem;display:flex;align-items:center;gap:.5rem;}
.card .metric-line{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.45rem;}
.card .metric-num{font-family:var(--serif);font-size:1.5rem;font-weight:600;color:var(--text);}
.card .metric-label{font-size:.78rem;color:var(--text-dim);}
.card .headline{font-size:.82rem;color:var(--text-dim);margin-bottom:.4rem;font-family:var(--mono);}
.card .en{font-size:.95rem;color:var(--text);margin-bottom:.4rem;}
.card .ko{font-size:.88rem;color:var(--text-dim);}
.diagram{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.4rem;margin-bottom:1.4rem;text-align:center;}
.diagram svg{max-width:100%;height:auto;}
.diagram .caption{font-size:.82rem;color:var(--text-dim);margin-top:.9rem;}
.badge{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.12rem .5rem;border-radius:6px;white-space:nowrap;border:1px solid transparent;font-family:var(--mono);}
.badge.impl{color:#2f6b3a;background:#e3f0e4;border-color:#c4e0c6;}
.badge.partial{color:#8a5a16;background:#f6e9d2;border-color:#ecd6ad;}
.badge.planned{color:#3a5a8a;background:#e0e8f4;border-color:#c5d4ea;}
.legend{display:flex;flex-wrap:wrap;gap:.6rem;margin-bottom:1.4rem;font-size:.85rem;color:var(--text-dim);align-items:center;}
.legend .badge{margin-right:.25rem;}
.callout{display:flex;gap:.85rem;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 12px 12px 0;padding:1rem 1.2rem;margin-bottom:1.4rem;}
.callout .ic{font-size:1.2rem;line-height:1.4;}.callout .body{font-size:.92rem;color:var(--text-mid);}.callout .body strong{color:var(--text);}
.callout .body .ko{display:block;color:var(--text-dim);font-size:.85rem;margin-top:.3rem;}
.extend{background:#fbf6ee;border:1px dashed var(--border-strong);border-radius:12px;padding:1rem 1.2rem;margin-bottom:1.3rem;}
.extend .h{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:700;margin-bottom:.45rem;}
.extend .en{font-size:.92rem;color:var(--text-mid);}.extend .en a{color:var(--accent);}
.extend .ko{font-size:.85rem;color:var(--text-dim);margin-top:.3rem;}
.grpband{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);font-weight:700;margin:1.6rem 0 .6rem;padding-bottom:.35rem;border-bottom:1px solid var(--border);}
.grpband .ko{float:right;color:var(--text-dim);font-weight:600;letter-spacing:0;text-transform:none;}
.inum{font-family:var(--serif);font-size:1.05rem;color:var(--accent);font-weight:700;}
.wrap footer{margin-top:3.5rem;padding-top:1.5rem;border-top:1px solid var(--border);color:var(--text-dim);font-size:.83rem;text-align:center;}.wrap footer a{color:var(--accent);text-decoration:none;}
@media(max-width:680px){.grid{grid-template-columns:1fr;}.wrap h1{font-size:2rem;}.wrap{padding:1.5rem 1.1rem 4rem;}}
`;
