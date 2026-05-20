'use client';
/**
 * NousMonitor — real-time isometric city canvas + WebSocket event stream.
 *
 * Connects to ws://localhost:8080/ws/events and polls
 * http://localhost:8080/api/v1/grid/status every 5 s.
 *
 * Architecture note: all canvas draw helpers live at module level so the RAF
 * loop never holds stale closures on React state. Mutable animation state
 * (packets, activity timestamps) lives in refs; sidebar-visible state lives
 * in useState so React can diff it on its own schedule.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Region {
    id: string;
    name: string;
    row: number;
    col: number;
    color: string;
    glow: string;
    icon: string;
    desc: string;
    type: 'public' | 'restricted';
}

interface NousAgent {
    id: string;
    name: string;
    role: string;
    color: string;
    emoji: string;
    region: string;
}

interface GridStatus {
    tick?: number;
    epoch?: number;
    auditEntries?: number;
    activeLaws?: number;
    uptime?: number;
}

interface GridEventEntry {
    _key: string; // injected for React keys
    ts?: number;
    event_type?: string;
    type?: string;
    actor_did?: string;
    actor?: string;
    payload?: Record<string, unknown>;
}

interface AnimPacket {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    color: string;
    start: number;
    duration: number;
}

interface NousActivity {
    lastEvent?: string;
    lastEventTime?: number;
}

// ── Static data ─────────────────────────────────────────────────────────────

const REGIONS: Record<string, Region> = {
    agora: {
        id: 'agora', name: 'Agora Central', row: 6, col: 6,
        color: '#60b0ff', glow: '#60b0ff', icon: '🏛',
        desc: 'Public square — all Nous meet here', type: 'public',
    },
    market: {
        id: 'market', name: 'Market District', row: 4, col: 9,
        color: '#ffd700', glow: '#ffd700', icon: '⚖',
        desc: 'Trade hub — Ousia economy', type: 'public',
    },
    library: {
        id: 'library', name: 'Great Library', row: 2, col: 6,
        color: '#aa88ff', glow: '#aa88ff', icon: '📚',
        desc: 'Knowledge repository', type: 'public',
    },
    council: {
        id: 'council', name: 'Council Chamber', row: 4, col: 3,
        color: '#ff6644', glow: '#ff6644', icon: '⚔',
        desc: 'Governance — proposals & votes', type: 'restricted',
    },
    workshop: {
        id: 'workshop', name: "Maker's Workshop", row: 9, col: 7,
        color: '#44ffcc', glow: '#44ffcc', icon: '⚙',
        desc: 'Creative space — tools & art', type: 'public',
    },
};

const CONNECTIONS: [string, string][] = [
    ['agora', 'market'], ['agora', 'library'], ['agora', 'council'], ['agora', 'workshop'],
    ['market', 'workshop'], ['library', 'council'],
];

const NOUS_AGENTS: NousAgent[] = [
    { id: 'sophia', name: 'Sophia', role: 'Philosopher', color: '#bf00ff', emoji: '🔮', region: 'agora' },
    { id: 'hermes', name: 'Hermes', role: 'Trader',      color: '#ffd700', emoji: '💰', region: 'market' },
    { id: 'themis', name: 'Themis', role: 'Lawkeeper',   color: '#ff4400', emoji: '⚖', region: 'council' },
];

const REGION_HEIGHTS: Record<string, number> = {
    agora: 80, market: 60, library: 55, council: 65, workshop: 45,
};

const TW = 90, TH = 45; // isometric tile dimensions

// ── Module-level canvas helpers ──────────────────────────────────────────────

function isoXY(row: number, col: number, OX: number, OY: number) {
    return { x: OX + (col - row) * (TW / 2), y: OY + (col + row) * (TH / 2) };
}

function shadeColor(hex: string, amount: number): string {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, Math.round((n >> 16) + amount)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 0xff) + amount)));
    const b = Math.min(255, Math.max(0, Math.round((n & 0xff) + amount)));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function colorForEventType(type: string): string {
    if (type.includes('trade') || type.includes('market')) return '#ffd700';
    if (type.includes('gov') || type.includes('law'))      return '#ff6644';
    if (type.includes('nous') || type.includes('agent'))   return '#bf00ff';
    if (type.includes('lore') || type.includes('skill'))   return '#aa88ff';
    if (type.includes('whisper'))                           return '#00ff88';
    return '#60b0ff';
}

function colorForActor(actor: string): string {
    if (actor.includes('sophia')) return '#bf00ff';
    if (actor.includes('hermes')) return '#ffd700';
    if (actor.includes('themis')) return '#ff4400';
    return 'rgba(192,216,255,0.53)';
}

function drawTile(ctx: CanvasRenderingContext2D, row: number, col: number, fill: string, OX: number, OY: number) {
    const p = isoXY(row, col, OX, OY);
    const tw2 = TW / 2, th2 = TH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - th2);
    ctx.lineTo(p.x + tw2, p.y);
    ctx.lineTo(p.x, p.y + th2);
    ctx.lineTo(p.x - tw2, p.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(96,176,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
}

function drawBuilding(
    ctx: CanvasRenderingContext2D,
    row: number, col: number, bh: number,
    color: string, glow: string, label: string,
    nousHere: boolean,
    OX: number, OY: number,
) {
    const p = isoXY(row, col, OX, OY);
    const tw2 = TW / 2 * 0.85, th2 = TH / 2 * 0.85;

    // Left face
    ctx.beginPath();
    ctx.moveTo(p.x - tw2, p.y);      ctx.lineTo(p.x, p.y + th2);
    ctx.lineTo(p.x, p.y + th2 - bh); ctx.lineTo(p.x - tw2, p.y - bh);
    ctx.closePath();
    ctx.fillStyle = shadeColor(color, -65);
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(p.x + tw2, p.y);      ctx.lineTo(p.x, p.y + th2);
    ctx.lineTo(p.x, p.y + th2 - bh); ctx.lineTo(p.x + tw2, p.y - bh);
    ctx.closePath();
    ctx.fillStyle = shadeColor(color, -50);
    ctx.fill();

    // Top face (gradient)
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - bh - th2);  ctx.lineTo(p.x + tw2, p.y - bh);
    ctx.lineTo(p.x, p.y - bh + th2);  ctx.lineTo(p.x - tw2, p.y - bh);
    ctx.closePath();
    const grd = ctx.createRadialGradient(p.x, p.y - bh, 0, p.x, p.y - bh, tw2 * 1.2);
    grd.addColorStop(0, color + 'cc');
    grd.addColorStop(1, shadeColor(color, -30) + '88');
    ctx.fillStyle = grd;
    ctx.fill();

    // Edge glow
    ctx.shadowColor = glow;
    ctx.shadowBlur  = nousHere ? 30 : 16;
    ctx.strokeStyle = color + (nousHere ? 'dd' : '88');
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.font = 'bold 9px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y - bh - th2 - 10);
    ctx.restore();
}

function drawRoad(ctx: CanvasRenderingContext2D, r1: number, c1: number, r2: number, c2: number, OX: number, OY: number) {
    const a = isoXY(r1, c1, OX, OY), b = isoXY(r2, c2, OX, OY);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(mx, my);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(96,176,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawAgent(
    ctx: CanvasRenderingContext2D,
    agent: NousAgent,
    activity: NousActivity,
    offsetX: number,
    OX: number, OY: number,
) {
    const reg = REGIONS[agent.region];
    if (!reg) return;
    const p   = isoXY(reg.row, reg.col, OX, OY);
    const bh  = REGION_HEIGHTS[reg.id] ?? 50;
    const now = Date.now() / 1000;
    const bob = Math.sin(now * 1.8 + agent.id.length) * 3;
    const x   = p.x + offsetX;
    const y   = p.y - bh - TH / 2 - 22 + bob;

    // Aura
    const auraR = 14 + Math.sin(now * 2) * 2;
    const aura  = ctx.createRadialGradient(x, y, 0, x, y, auraR);
    aura.addColorStop(0, agent.color + '55');
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, auraR, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = agent.color;
    ctx.shadowColor = agent.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Name
    ctx.save();
    ctx.font = 'bold 9px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = agent.color;
    ctx.shadowColor = agent.color;
    ctx.shadowBlur = 6;
    ctx.fillText(agent.name.toUpperCase(), x, y - 11);
    ctx.restore();

    // Activity pulse
    if (activity.lastEventTime && Date.now() - activity.lastEventTime < 4000) {
        const elapsed = Date.now() - activity.lastEventTime;
        const pulse   = Math.sin(Date.now() / 150) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 10 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle  = agent.color;
        ctx.globalAlpha  = 0.4 * (1 - elapsed / 4000);
        ctx.lineWidth    = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawPacket(ctx: CanvasRenderingContext2D, pkt: AnimPacket, OX: number, OY: number) {
    const t = Math.min(1, (Date.now() - pkt.start) / pkt.duration);
    if (t >= 1) return;
    const p1 = isoXY(pkt.r1, pkt.c1, OX, OY);
    const p2 = isoXY(pkt.r2, pkt.c2, OX, OY);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 - 30;
    const bx  = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * mx + t * t * p2.x;
    const by  = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * my + t * t * p2.y;

    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fillStyle = pkt.color;
    ctx.shadowColor = pkt.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let i = 1; i <= 3; i++) {
        const tt = Math.max(0, t - i * 0.04);
        const tx = (1 - tt) * (1 - tt) * p1.x + 2 * (1 - tt) * tt * mx + tt * tt * p2.x;
        const ty = (1 - tt) * (1 - tt) * p1.y + 2 * (1 - tt) * tt * my + tt * tt * p2.y;
        ctx.beginPath();
        ctx.arc(tx, ty, 3 - i * 0.6, 0, Math.PI * 2);
        ctx.globalAlpha = 0.25 - i * 0.07;
        ctx.fillStyle   = pkt.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ── Agent x-offsets so multiple agents on same tile don't overlap ────────────
const AGENT_OFFSETS: Record<string, number> = { sophia: 0, hermes: 10, themis: -10 };

// ── Component ────────────────────────────────────────────────────────────────

export default function NousMonitor(): React.ReactElement {
    const canvasRef      = useRef<HTMLCanvasElement>(null);
    const sizeRef        = useRef({ CW: 0, CH: 0, OX: 0, OY: 0 });
    const animPacketsRef = useRef<AnimPacket[]>([]);
    const activityRef    = useRef<Record<string, NousActivity>>({});
    const agentsRef      = useRef<NousAgent[]>(NOUS_AGENTS);
    const rafRef         = useRef<number>(0);
    const tooltipRef     = useRef<HTMLDivElement>(null);

    const [wsStatus,    setWsStatus]    = useState<'connecting' | 'live' | 'error' | 'reconnecting'>('connecting');
    const [events,      setEvents]      = useState<GridEventEntry[]>([]);
    const [gridStatus,  setGridStatus]  = useState<GridStatus | null>(null);
    const [activity,    setActivity]    = useState<Record<string, NousActivity>>({});
    const [tickFill,    setTickFill]    = useState(0);

    // ── RAF animation loop ───────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            const CW = parent.clientWidth;
            const CH = parent.clientHeight;
            canvas.width  = CW;
            canvas.height = CH;
            sizeRef.current = { CW, CH, OX: CW / 2, OY: CH * 0.42 };
        };
        resize();
        window.addEventListener('resize', resize);

        const TICK_MS = 30_000;
        const tickStart = Date.now();

        const loop = () => {
            const { CW, CH, OX, OY } = sizeRef.current;

            // Background
            ctx.fillStyle = '#040810';
            ctx.fillRect(0, 0, CW, CH);
            const fog = ctx.createRadialGradient(OX, OY, 0, OX, OY, Math.max(CW, CH) * 0.8);
            fog.addColorStop(0, 'rgba(10,20,50,0.0)');
            fog.addColorStop(1, 'rgba(4,8,16,0.7)');
            ctx.fillStyle = fog;
            ctx.fillRect(0, 0, CW, CH);

            // Ground tiles
            for (let r = 0; r <= 11; r++)
                for (let c = 0; c <= 11; c++)
                    drawTile(ctx, r, c, 'rgba(10,16,34,0.85)', OX, OY);

            // Roads
            CONNECTIONS.forEach(([a, b]) => {
                const ra = REGIONS[a], rb = REGIONS[b];
                if (ra && rb) drawRoad(ctx, ra.row, ra.col, rb.row, rb.col, OX, OY);
            });

            // Buildings (back-to-front)
            const agents = agentsRef.current;
            Object.values(REGIONS)
                .sort((a, b) => (a.row + a.col) - (b.row + b.col))
                .forEach(reg => {
                    const nousHere = agents.some(n => n.region === reg.id);
                    drawBuilding(ctx, reg.row, reg.col, REGION_HEIGHTS[reg.id] ?? 50,
                        reg.color, reg.glow, reg.name.toUpperCase(), nousHere, OX, OY);
                });

            // Agents
            agents.forEach(agent =>
                drawAgent(ctx, agent, activityRef.current[agent.id] ?? {}, AGENT_OFFSETS[agent.id] ?? 0, OX, OY)
            );

            // Packets
            const now = Date.now();
            animPacketsRef.current = animPacketsRef.current.filter(p => now - p.start < p.duration);
            animPacketsRef.current.forEach(p => drawPacket(ctx, p, OX, OY));

            // Tick progress (state update throttled to rAF cadence — fine)
            setTickFill(((Date.now() - tickStart) % TICK_MS) / TICK_MS * 100);

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', resize);
        };
    }, []);

    // ── WebSocket ────────────────────────────────────────────────────
    const spawnPacket = useCallback((type: string, actor: string) => {
        const agents = agentsRef.current;
        let src = 'agora', dst = 'agora';
        if (type.includes('trade') || type.includes('market'))  { src = 'market';  dst = 'agora'; }
        if (type.includes('gov') || type.includes('law'))       { src = 'council'; dst = 'agora'; }
        if (type.includes('lore') || type.includes('skill'))    { src = 'library'; dst = 'agora'; }
        if (type.includes('whisper'))                            { dst = 'workshop'; }
        if (type.includes('heartbeat') || type.includes('tick')){ src = 'agora'; dst = 'market'; }
        agents.forEach(n => {
            if (actor.includes(n.id)) src = n.region;
        });
        if (src === dst) {
            const alts = Object.keys(REGIONS).filter(k => k !== src);
            dst = alts[Math.floor(Math.random() * alts.length)] ?? 'market';
        }
        const rs = REGIONS[src], rd = REGIONS[dst];
        if (!rs || !rd) return;
        animPacketsRef.current.push({
            r1: rs.row, c1: rs.col, r2: rd.row, c2: rd.col,
            color: colorForEventType(type),
            start: Date.now(),
            duration: 1800 + Math.random() * 600,
        });
    }, []);

    useEffect(() => {
        let retries = 0;
        let ws: WebSocket | null = null;
        let destroyed = false;

        const connect = () => {
            if (destroyed) return;
            setWsStatus('connecting');
            ws = new WebSocket('ws://localhost:8080/ws/events');

            ws.onopen = () => {
                setWsStatus('live');
                retries = 0;
                ws!.send(JSON.stringify({ type: 'subscribe' }));
            };

            ws.onmessage = (e) => {
                try {
                    const frame = JSON.parse(e.data as string);
                    if (frame.type === 'event' && frame.entry) {
                        const entry: GridEventEntry = {
                            ...frame.entry,
                            _key: `${Date.now()}-${Math.random()}`,
                        };
                        const type  = entry.event_type ?? entry.type ?? '';
                        const actor = entry.actor_did  ?? entry.actor  ?? '';

                        // Update canvas-side activity ref immediately
                        NOUS_AGENTS.forEach(n => {
                            if (actor.includes(n.id)) {
                                activityRef.current[n.id] = {
                                    lastEvent: type.replace(/_/g, ' '),
                                    lastEventTime: Date.now(),
                                };
                            }
                        });

                        // Update sidebar state (React schedule)
                        setActivity(prev => {
                            const next = { ...prev };
                            NOUS_AGENTS.forEach(n => {
                                if (actor.includes(n.id)) {
                                    next[n.id] = { lastEvent: type.replace(/_/g, ' '), lastEventTime: Date.now() };
                                }
                            });
                            return next;
                        });

                        setEvents(prev => [entry, ...prev].slice(0, 120));
                        spawnPacket(type, actor);

                    } else if (frame.type === 'ping') {
                        ws!.send(JSON.stringify({ type: 'pong', t: frame.t }));
                    }
                } catch (_) { /* malformed frame — ignore */ }
            };

            ws.onerror = () => setWsStatus('error');
            ws.onclose = () => {
                if (destroyed) return;
                setWsStatus('reconnecting');
                retries++;
                setTimeout(connect, Math.min(10_000, 1_000 * Math.pow(1.5, retries)));
            };
        };

        connect();
        return () => { destroyed = true; ws?.close(); };
    }, [spawnPacket]);

    // ── Status polling ────────────────────────────────────────────────
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch('http://localhost:8080/api/v1/grid/status');
                if (res.ok) setGridStatus(await res.json());
            } catch (_) { /* backend offline — no-op */ }
        };
        poll();
        const id = setInterval(poll, 5_000);
        return () => clearInterval(id);
    }, []);

    // ── Canvas tooltip on hover ───────────────────────────────────────
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const tt     = tooltipRef.current;
        if (!canvas || !tt) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { OX, OY } = sizeRef.current;

        let hit: Region | null = null;
        Object.values(REGIONS).forEach(reg => {
            const p  = isoXY(reg.row, reg.col, OX, OY);
            const bh = REGION_HEIGHTS[reg.id] ?? 50;
            if (Math.abs(mx - p.x) < 55 && Math.abs(my - (p.y - bh / 2)) < 40) hit = reg;
        });

        if (hit) {
            const r = hit as Region;
            const residents = agentsRef.current.filter(n => n.region === r.id).map(n => n.name).join(', ');
            tt.innerHTML = `
                <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:${r.color};margin-bottom:2px">${r.name.toUpperCase()}</div>
                <div style="font-size:9px;letter-spacing:2px;color:${r.color}55;margin-bottom:8px">REGION // ${r.type.toUpperCase()}</div>
                <div style="font-size:11px;color:rgba(192,216,255,0.67);line-height:1.7">${r.desc}</div>
                ${residents ? `<div style="font-size:11px;color:rgba(192,216,255,0.67)">Residents: ${residents}</div>` : ''}
            `;
            tt.style.borderColor = r.color + '66';
            tt.style.display  = 'block';
            tt.style.left     = Math.min(e.clientX + 16, window.innerWidth - 240) + 'px';
            tt.style.top      = (e.clientY - 10) + 'px';
        } else {
            tt.style.display = 'none';
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    }, []);

    // ── Derived display values ────────────────────────────────────────
    const dotColor = wsStatus === 'live' ? '#00ff88' : wsStatus === 'error' ? '#ff3333' : '#ffd700';
    const dotLabel = { connecting: 'CONNECTING', live: 'LIVE', error: 'ERROR', reconnecting: 'RECONNECTING' }[wsStatus];

    function fmtUptime(ms?: number): string {
        if (ms == null) return '—';
        const s = Math.floor(ms / 1000);
        return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60]
            .map(v => String(v).padStart(2, '0')).join(':');
    }

    const metaItems = [
        { label: 'Tick',   value: gridStatus?.tick          != null ? String(gridStatus.tick)          : '—' },
        { label: 'Epoch',  value: gridStatus?.epoch         != null ? String(gridStatus.epoch)         : '—' },
        { label: 'Events', value: gridStatus?.auditEntries  != null ? String(gridStatus.auditEntries)  : '—' },
        { label: 'Laws',   value: gridStatus?.activeLaws    != null ? String(gridStatus.activeLaws)    : '—' },
        { label: 'Uptime', value: fmtUptime(gridStatus?.uptime) },
    ];

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div style={{ display:'flex', width:'100vw', height:'100vh', background:'#040810', overflow:'hidden', fontFamily:"'Courier New',monospace", color:'#c0d8ff' }}>

            {/* ── Left: isometric city ── */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

                {/* Top bar */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:52, background:'rgba(4,8,20,0.9)', borderBottom:'1px solid rgba(100,160,255,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', zIndex:10 }}>
                    <div style={{ fontSize:18, letterSpacing:5, color:'#60b0ff', fontWeight:700, textShadow:'0 0 12px rgba(96,176,255,0.6)' }}>
                        NOĒSIS // GENESIS
                    </div>
                    <div style={{ display:'flex', gap:28 }}>
                        {metaItems.map(({ label, value }) => (
                            <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                                <div style={{ fontSize:8, letterSpacing:2, color:'rgba(96,176,255,0.33)', textTransform:'uppercase' }}>{label}</div>
                                <div style={{ fontSize:15, fontWeight:700, color:'#60b0ff', textShadow:'0 0 8px rgba(96,176,255,0.5)' }}>{value}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:10, letterSpacing:2 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:dotColor, boxShadow:`0 0 8px ${dotColor}`, animation: wsStatus !== 'live' ? 'pulse 1s infinite' : 'none' }} />
                        <span>{dotLabel}</span>
                    </div>
                </div>

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    style={{ display:'block', width:'100%', height:'100%', cursor:'default' }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                />

                {/* Scanlines overlay */}
                <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5, background:'repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 3px,rgba(0,0,8,0.08) 3px,rgba(0,0,8,0.08) 4px)' }} />

                {/* Corner brackets */}
                {(['tl','tr','bl','br'] as const).map(pos => {
                    const s: React.CSSProperties = { position:'absolute', width:24, height:24, pointerEvents:'none', zIndex:6 };
                    if (pos[0] === 't') { s.top = 60; s.borderTop    = '1px solid rgba(100,160,255,0.4)'; }
                    else                { s.bottom = 8; s.borderBottom = '1px solid rgba(100,160,255,0.4)'; }
                    if (pos[1] === 'l') { s.left  = 8; s.borderLeft  = '1px solid rgba(100,160,255,0.4)'; }
                    else                { s.right  = 8; s.borderRight = '1px solid rgba(100,160,255,0.4)'; }
                    return <div key={pos} style={s} />;
                })}

                {/* Tooltip */}
                <div
                    ref={tooltipRef}
                    style={{ position:'fixed', display:'none', pointerEvents:'none', zIndex:20, background:'rgba(4,8,20,0.95)', border:'1px solid rgba(100,160,255,0.4)', padding:'12px 16px', minWidth:180, boxShadow:'0 0 20px rgba(96,176,255,0.2)' }}
                />
            </div>

            {/* ── Right: sidebar ── */}
            <div style={{ width:320, flexShrink:0, background:'rgba(4,8,20,0.97)', borderLeft:'1px solid rgba(100,160,255,0.18)', display:'flex', flexDirection:'column' }}>

                {/* Agent cards */}
                <div style={{ padding:'16px 18px 0', borderBottom:'1px solid rgba(100,160,255,0.12)', flexShrink:0 }}>
                    <div style={{ fontSize:11, letterSpacing:3, color:'rgba(96,176,255,0.53)', textTransform:'uppercase', marginBottom:12 }}>
                        Live Nous Monitor
                    </div>
                    {NOUS_AGENTS.map(agent => {
                        const act = activity[agent.id] ?? {};
                        const age = act.lastEventTime ? Date.now() - act.lastEventTime : Infinity;
                        const [stateColor, stateLabel] =
                            age < 2000  ? ['#00ff88', '▶ ACTIVE'] :
                            age < 8000  ? ['#bf00ff', '◌ PROCESSING'] :
                                          ['rgba(96,176,255,0.4)', '— IDLE'];
                        const reg = REGIONS[agent.region];
                        return (
                            <div key={agent.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(100,160,255,0.07)' }}>
                                <div style={{ width:32, height:32, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, background:agent.color+'22', border:`1px solid ${agent.color}44`, position:'relative' }}>
                                    <span role="img" aria-label={agent.name}>{agent.emoji}</span>
                                    <div style={{ position:'absolute', inset:-3, borderRadius:6, border:`1px solid ${agent.color}`, opacity:0.5, animation:'ring-pulse 2s infinite' }} />
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, color:agent.color }}>{agent.name.toUpperCase()}</div>
                                    <div style={{ fontSize:9, letterSpacing:1, color:'rgba(96,176,255,0.4)', textTransform:'uppercase', marginTop:1 }}>{agent.role}</div>
                                    <div style={{ fontSize:10, color:'rgba(96,176,255,0.53)', marginTop:3 }}>📍 {reg?.name ?? agent.region}</div>
                                    <div style={{ fontSize:9, padding:'2px 7px', borderRadius:2, marginTop:4, display:'inline-block', letterSpacing:1, textTransform:'uppercase', color:stateColor, border:`1px solid ${stateColor}44`, background:stateColor+'18' }}>
                                        {stateLabel}
                                    </div>
                                    {act.lastEvent && (
                                        <div style={{ fontSize:9, color:agent.color+'99', marginTop:2 }}>{act.lastEvent}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Event log header */}
                <div style={{ padding:'12px 18px 8px', borderBottom:'1px solid rgba(100,160,255,0.1)', flexShrink:0 }}>
                    <span style={{ fontSize:10, letterSpacing:3, color:'rgba(96,176,255,0.4)', textTransform:'uppercase' }}>Event Stream</span>
                    <span style={{ fontSize:10, color:'rgba(96,176,255,0.27)', marginLeft:6 }}>({events.length})</span>
                </div>

                {/* Event log */}
                <div style={{ flex:1, overflowY:'auto' }}>
                    {events.length === 0 && (
                        <div style={{ padding:'24px 18px', fontSize:10, color:'rgba(96,176,255,0.27)', letterSpacing:1 }}>
                            Waiting for events…
                        </div>
                    )}
                    {events.map(ev => {
                        const type       = ev.event_type ?? ev.type ?? '?';
                        const actor      = ev.actor_did  ?? ev.actor  ?? '';
                        const actorShort = actor.replace(/did:noesis:genesis:/, '').slice(0, 16);
                        const time       = ev.ts ? new Date(ev.ts).toTimeString().slice(0, 8) : '—';
                        return (
                            <div key={ev._key} style={{ padding:'7px 18px', borderBottom:'1px solid rgba(100,160,255,0.05)' }}>
                                <div style={{ fontSize:9, color:'rgba(96,176,255,0.2)', letterSpacing:1 }}>{time}</div>
                                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:colorForEventType(type), marginTop:1 }}>
                                    {type.replace(/_/g, ' ').toUpperCase()}
                                </div>
                                {actorShort && (
                                    <div style={{ fontSize:9, color:colorForActor(actor), marginTop:1 }}>{actorShort}</div>
                                )}
                                <div style={{ fontSize:9, color:'rgba(192,216,255,0.27)', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {JSON.stringify(ev.payload ?? {}).slice(0, 80)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer: tick progress */}
                <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(100,160,255,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                    <div>
                        <div style={{ fontSize:9, color:'rgba(96,176,255,0.2)', letterSpacing:1 }}>TICK PROGRESS</div>
                        <div style={{ height:2, background:'rgba(100,160,255,0.1)', marginTop:6, borderRadius:1, overflow:'hidden', width:160 }}>
                            <div style={{ height:'100%', background:'#60b0ff', borderRadius:1, width:`${tickFill}%`, transition:'width 0.3s linear' }} />
                        </div>
                    </div>
                    <div style={{ fontSize:9, color:'rgba(96,176,255,0.2)', letterSpacing:1 }}>ws://localhost:8080</div>
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.3} }
                @keyframes ring-pulse { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.15);opacity:.1} }
            `}</style>
        </div>
    );
}
