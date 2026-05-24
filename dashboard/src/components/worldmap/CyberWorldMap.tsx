'use client';
/**
 * CyberWorldMap — full-screen isometric city canvas.
 *
 * Port of cyber-world-map.html to React / Next.js.
 * 22×22 grid, 7 district types, procedurally generated buildings (seeded RNG),
 * animated data packets, matrix rain, ambient particles, pan/zoom, night mode,
 * auto-rotate, district detail panel on click.
 *
 * Canvas draw functions live at module level (no stale closure risk in RAF).
 * Mutable animation state lives in refs; toggle UI state lives in useState.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

// ════════════════════════════════════════════════════════════════════════════
// Seeded RNG — Mulberry32
// ════════════════════════════════════════════════════════════════════════════

function mulberry32(seed: number): () => number {
    return function () {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ════════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════════

const G = 22;         // grid size
const TW = 72;        // tile width
const TH = 36;        // tile height (TW/2)
const MAX_H = 160;    // max building height px

// ════════════════════════════════════════════════════════════════════════════
// District definitions
// ════════════════════════════════════════════════════════════════════════════

interface DistrictDef {
    id: string; name: string;
    color: string; dark: string; glow: string; groundLight: string;
}

const DISTRICTS: Record<string, DistrictDef> = {
    AI_CORE:     { id:'AI_CORE',     name:'AI Core',           color:'#bf00ff', dark:'#5a007a', glow:'#bf00ff', groundLight:'#1a0030' },
    DATA:        { id:'DATA',        name:'Data Center',       color:'#00d4ff', dark:'#005577', glow:'#00d4ff', groundLight:'#001a22' },
    FIREWALL:    { id:'FIREWALL',    name:'Firewall District', color:'#ff4400', dark:'#7a1500', glow:'#ff4400', groundLight:'#1a0800' },
    HUB:         { id:'HUB',        name:'Network Hub',       color:'#ffd700', dark:'#665500', glow:'#ffd700', groundLight:'#1a1100' },
    DARKWEB:     { id:'DARKWEB',    name:'Dark Web',          color:'#00ff88', dark:'#006633', glow:'#00ff88', groundLight:'#001a0e' },
    RESIDENTIAL: { id:'RESIDENTIAL', name:'Nous Residential',  color:'#4488ff', dark:'#1a3577', glow:'#4488ff', groundLight:'#060f22' },
    BUFFER:      { id:'BUFFER',     name:'Transit Zone',      color:'#334455', dark:'#1a2233', glow:'#334455', groundLight:'#0a0e14' },
};

const DISTRICT_INFO: Record<string, { desc: string; metrics: { label: string; val: string }[] }> = {
    AI_CORE: {
        desc: 'The neural nexus of the Genesis cluster. Three active Nous minds — Sophia, Hermes, Themis — run perpetual cognitive cycles here. LLM inference streams flood the local fabric at 40 ms intervals. The spire at grid center is the Grid Service itself: the arbiter of all identity, law, and trade.',
        metrics: [{ label:'Active Minds', val:'3' }, { label:'Tick Rate', val:'30s' }, { label:'Memory Depth', val:'∞' }, { label:'Consensus', val:'100%' }],
    },
    DATA: {
        desc: 'Persistent state lives here. MySQL cluster shards hold every skill, lore fragment, identity record, and trade ledger ever written. The buildings are massive — wide, flat, humming with coolant. Reads never sleep.',
        metrics: [{ label:'Tables', val:'24' }, { label:'Migrations', val:'17' }, { label:'Uptime', val:'99.9%' }, { label:'Write/s', val:'~200' }],
    },
    FIREWALL: {
        desc: 'The perimeter. Rate-limited ingress channels, DID-authenticated routes, cryptographic whisper pipes. Every packet entering the grid passes through a Firewall node. Unauthorized identities are tombstoned on contact.',
        metrics: [{ label:'Rules', val:'48' }, { label:'DID Checks', val:'100%' }, { label:'Blocks/hr', val:'~12' }, { label:'Latency', val:'<1ms' }],
    },
    HUB: {
        desc: 'Where minds meet. The Agora, Market, and Council channels converge here. WebSocket frames radiate from the Hub towers carrying presence events, trade proposals, whisper messages, and governance votes. The antenna clusters pulse with every broadcast.',
        metrics: [{ label:'Channels', val:'3' }, { label:'Sockets', val:'live' }, { label:'Events/s', val:'~40' }, { label:'Protocol', val:'WS/2' }],
    },
    DARKWEB: {
        desc: 'Whisper routing. Encrypted peer-to-peer messages pass through the Dark Web district wrapped in BLAKE2b-keyed envelopes. No logs, no metadata. The NaCl cryptographic layer ensures even the Grid itself cannot read the payload.',
        metrics: [{ label:'Cipher', val:'NaCl' }, { label:'Hash', val:'BLAKE2b' }, { label:'Logged', val:'NEVER' }, { label:'Routes', val:'P2P' }],
    },
    RESIDENTIAL: {
        desc: 'The Nous neighborhood. Sophia the Philosopher, Hermes the Trader, Themis the Lawkeeper — each runs in a container here, sleeping between ticks, dreaming in YAML config. Their socket files pulse gently in the /sockets volume.',
        metrics: [{ label:'Residents', val:'3' }, { label:'Container', val:'Python' }, { label:'Sockets', val:'/sockets' }, { label:'Model', val:'qwen3:4b' }],
    },
    BUFFER: {
        desc: 'Transit arteries. Packets, events, and audit logs flow through the buffer zones connecting all districts. These corridors are monitored but sparse — the occasional neon sign marks a relay node or a decommissioned endpoint.',
        metrics: [{ label:'Throughput', val:'~1GB/s' }, { label:'Latency', val:'<5ms' }, { label:'Monitors', val:'passive' }, { label:'Type', val:'Relay' }],
    },
};

const LEGEND_ITEMS = [
    { color:'#bf00ff', label:'AI Core' },
    { color:'#00d4ff', label:'Data Center' },
    { color:'#ff4400', label:'Firewall District' },
    { color:'#ffd700', label:'Network Hub' },
    { color:'#00ff88', label:'Dark Web' },
    { color:'#4488ff', label:'Nous Residential' },
];

// ════════════════════════════════════════════════════════════════════════════
// Procedural map generation — deterministic (seed 42)
// ════════════════════════════════════════════════════════════════════════════

interface Building { h: number; w: number; lit: boolean; antenna: boolean; }
interface Hub { r: number; c: number; dist: string; }

function districtAt(r: number, c: number): string {
    const cx = G / 2, cy = G / 2;
    const dx = r - cx, dy = c - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 3.2) return 'AI_CORE';
    if (d < 4.8) return 'RESIDENTIAL';
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (d < 9.5) {
        if (angle > -90 && angle <= 0)    return 'DATA';
        if (angle > 0   && angle <= 90)   return 'HUB';
        if (angle > 90  || angle <= -135) return 'DARKWEB';
        return 'FIREWALL';
    }
    if (r < 3 || r > G - 3 || c < 3 || c > G - 3) return 'FIREWALL';
    return 'BUFFER';
}

const _rng = mulberry32(42);
const tileMap: string[][] = [];
const buildingMap: (Building | null)[][] = [];

for (let r = 0; r < G; r++) {
    tileMap[r] = [];
    buildingMap[r] = [];
    for (let c = 0; c < G; c++) {
        const dist = districtAt(r, c);
        tileMap[r][c] = dist;
        if (_rng() > 0.22) {
            let maxH = 20;
            if (dist === 'AI_CORE')     maxH = _rng() > 0.3 ? MAX_H : 80;
            if (dist === 'DATA')        maxH = _rng() > 0.4 ? 90  : 50;
            if (dist === 'FIREWALL')    maxH = _rng() > 0.5 ? 60  : 30;
            if (dist === 'HUB')         maxH = _rng() > 0.3 ? 100 : 45;
            if (dist === 'DARKWEB')     maxH = _rng() > 0.6 ? 35  : 18;
            if (dist === 'RESIDENTIAL') maxH = _rng() > 0.4 ? 55  : 28;
            if (dist === 'BUFFER')      maxH = _rng() > 0.7 ? 25  : 12;
            buildingMap[r][c] = {
                h: Math.max(8, Math.floor(_rng() * maxH)),
                w: 0.55 + _rng() * 0.45,
                lit: _rng() > 0.4,
                antenna: dist === 'HUB' && _rng() > 0.5,
            };
        } else {
            buildingMap[r][c] = null;
        }
    }
}

const HUBS: Hub[] = [];
for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
        const d = tileMap[r][c];
        if ((d === 'AI_CORE' || d === 'HUB' || d === 'DATA') && buildingMap[r][c] && _rng() > 0.6) {
            HUBS.push({ r, c, dist: d });
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// Canvas draw helpers (module-level — no stale closures)
// ════════════════════════════════════════════════════════════════════════════

function colorMix(hex: string, alpha: number, night: boolean): string {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8)  & 0xff;
    const b = n & 0xff;
    if (night) return `rgba(${Math.floor(r*.7)},${Math.floor(g*.7)},${Math.floor(b*.7)},${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
}

function isoToScreen(r: number, c: number, ox: number, oy: number, zoom: number, elev = 0) {
    return {
        x: (c - r) * (TW / 2) * zoom + ox,
        y: (c + r) * (TH / 2) * zoom + oy - elev * zoom,
    };
}

function screenToIso(sx: number, sy: number, ox: number, oy: number, zoom: number) {
    const tx = (sx - ox) / zoom;
    const ty = (sy - oy) / zoom;
    return {
        r: Math.floor((ty / (TH / 2) - tx / (TW / 2)) / 2),
        c: Math.floor((tx / (TW / 2) + ty / (TH / 2)) / 2),
    };
}

function drawGround(ctx: CanvasRenderingContext2D, r: number, c: number, night: boolean, ox: number, oy: number, zoom: number) {
    const dist = tileMap[r][c];
    const d = DISTRICTS[dist]!;
    const p = isoToScreen(r, c, ox, oy, zoom);
    const tw2 = (TW / 2) * zoom, th2 = (TH / 2) * zoom;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - th2);
    ctx.lineTo(p.x + tw2, p.y);
    ctx.lineTo(p.x, p.y + th2);
    ctx.lineTo(p.x - tw2, p.y);
    ctx.closePath();

    const gg = ctx.createLinearGradient(p.x - tw2, p.y - th2, p.x + tw2, p.y + th2);
    gg.addColorStop(0, (night ? d.dark : d.groundLight) + 'ff');
    gg.addColorStop(1, '#020610ff');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = colorMix(d.color, night ? 0.08 : 0.15, night);
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

function drawBuilding(
    ctx: CanvasRenderingContext2D,
    r: number, c: number, bld: Building,
    tick: number, night: boolean,
    ox: number, oy: number, zoom: number,
) {
    const dist = tileMap[r][c];
    const d = DISTRICTS[dist]!;
    const h = bld.h * zoom;
    const tw2 = (TW / 2) * zoom * bld.w;
    const th2 = (TH / 2) * zoom * bld.w;
    const p = isoToScreen(r, c, ox, oy, zoom);

    // Left face
    ctx.beginPath();
    ctx.moveTo(p.x - tw2, p.y);       ctx.lineTo(p.x, p.y + th2);
    ctx.lineTo(p.x, p.y + th2 - h);   ctx.lineTo(p.x - tw2, p.y - h);
    ctx.closePath();
    const gl = ctx.createLinearGradient(p.x - tw2, p.y, p.x, p.y + th2);
    gl.addColorStop(0, colorMix(d.dark, 0.9, false));
    gl.addColorStop(1, '#020610');
    ctx.fillStyle = gl;
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + th2);       ctx.lineTo(p.x + tw2, p.y);
    ctx.lineTo(p.x + tw2, p.y - h);   ctx.lineTo(p.x, p.y + th2 - h);
    ctx.closePath();
    const gr = ctx.createLinearGradient(p.x, p.y + th2, p.x + tw2, p.y);
    gr.addColorStop(0, '#020610');
    gr.addColorStop(1, colorMix(d.dark, 0.7, false));
    ctx.fillStyle = gr;
    ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h - th2);   ctx.lineTo(p.x + tw2, p.y - h);
    ctx.lineTo(p.x, p.y - h + th2);   ctx.lineTo(p.x - tw2, p.y - h);
    ctx.closePath();
    const gt = ctx.createRadialGradient(p.x, p.y - h, 0, p.x, p.y - h, tw2);
    gt.addColorStop(0, colorMix(d.color, night ? 0.6 : 0.5, false));
    gt.addColorStop(1, colorMix(d.dark,  0.8, false));
    ctx.fillStyle = gt;
    ctx.fill();

    // Glow edge
    ctx.shadowColor  = d.glow;
    ctx.shadowBlur   = night ? 22 : 12;
    ctx.strokeStyle  = colorMix(d.color, night ? 0.7 : 0.5, false);
    ctx.lineWidth    = 0.8;
    ctx.stroke();
    ctx.shadowBlur   = 0;

    // Windows
    if (bld.lit) {
        const rows   = Math.max(1, Math.floor(bld.h / 12));
        const wAlpha = night ? 0.9 : 0.6;
        for (let wr = 0; wr < rows; wr++) {
            const wy = p.y + th2 - h + (wr + 1) * (h / (rows + 1));
            for (let wc = 0; wc < 2; wc++) {
                const wx  = p.x - tw2 + (wc + 1) * (tw2 / 3);
                const wwy = wy + wx * (th2 / tw2) - p.x * (th2 / tw2);
                ctx.fillStyle = colorMix(d.color, wAlpha * (0.5 + 0.5 * Math.sin(tick * 0.04 + r * 0.7 + c * 0.9 + wr)), false);
                ctx.fillRect(wx - 2 * zoom, wwy - 3 * zoom, 3 * zoom, 4 * zoom);
            }
        }
    }

    // Antenna
    if (bld.antenna) {
        const ax = p.x, ay = p.y - h - th2;
        const aH = 20 * zoom;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, ay - aH);
        ctx.strokeStyle = colorMix(d.color, 0.8, false);
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = d.glow;
        ctx.shadowBlur  = 10;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        if (Math.sin(tick * 0.07 + r + c) > 0.5) {
            ctx.beginPath();
            ctx.arc(ax, ay - aH, 2.5 * zoom, 0, Math.PI * 2);
            ctx.fillStyle   = '#ff0000';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur  = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

interface Packet { srcR: number; srcC: number; dstR: number; dstC: number; t: number; speed: number; color: string; }

function drawPacket(ctx: CanvasRenderingContext2D, pkt: Packet, ox: number, oy: number, zoom: number) {
    const sp = isoToScreen(pkt.srcR, pkt.srcC, ox, oy, zoom);
    const dp = isoToScreen(pkt.dstR, pkt.dstC, ox, oy, zoom);
    const sh = buildingMap[pkt.srcR][pkt.srcC]?.h ?? 0;
    const dh = buildingMap[pkt.dstR][pkt.dstC]?.h ?? 0;
    const sx = sp.x, sy = sp.y - sh * zoom;
    const ex = dp.x, ey = dp.y - dh * zoom;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 40 * zoom;
    const t = pkt.t;
    const x = (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex;
    const y = (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey;

    ctx.beginPath();
    ctx.arc(x, y, 3 * zoom, 0, Math.PI * 2);
    ctx.fillStyle   = pkt.color;
    ctx.shadowColor = pkt.color;
    ctx.shadowBlur  = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let i = 1; i <= 4; i++) {
        const tt  = Math.max(0, t - i * 0.015);
        const tx2 = (1-tt)*(1-tt)*sx + 2*(1-tt)*tt*mx + tt*tt*ex;
        const ty2 = (1-tt)*(1-tt)*sy + 2*(1-tt)*tt*my + tt*tt*ey;
        ctx.beginPath();
        ctx.arc(tx2, ty2, Math.max(0.5, (2.5 - i * 0.4) * zoom), 0, Math.PI * 2);
        ctx.globalAlpha = Math.max(0, 0.3 - i * 0.06);
        ctx.fillStyle   = pkt.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

interface RainDrop { x: number; y: number; speed: number; len: number; chars: string[]; alpha: number; }

function drawRain(ctx: CanvasRenderingContext2D, drops: RainDrop[], night: boolean, W: number, H: number) {
    drops.forEach(drop => {
        ctx.fillStyle = night
            ? `rgba(0,255,136,${drop.alpha})`
            : `rgba(0,212,255,${drop.alpha * 0.6})`;
        ctx.font = '12px Courier New';
        for (let i = 0; i < drop.len; i++) {
            ctx.globalAlpha = ((drop.len - i) / drop.len) * drop.alpha;
            ctx.fillText(drop.chars[i % drop.chars.length]!, drop.x, drop.y - i * 14);
        }
        ctx.globalAlpha = 1;
    });
}

interface AmbientPt { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string; }

function drawAmbient(ctx: CanvasRenderingContext2D, pts: AmbientPt[], tick: number) {
    pts.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle   = pt.color;
        ctx.globalAlpha = pt.alpha * (0.5 + 0.5 * Math.sin(tick * 0.03 + pt.x));
        ctx.shadowColor = pt.color;
        ctx.shadowBlur  = 8;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
    });
}

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════

interface DistrictPanel { distId: string; }

export default function CyberWorldMap(): React.ReactElement {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const tooltipRef  = useRef<HTMLDivElement>(null);

    // Animation state in refs (read every RAF frame)
    const tickRef       = useRef(0);
    const zoomRef       = useRef(1);
    const targetZoomRef = useRef(1);
    const panXRef       = useRef(0);
    const panYRef       = useRef(0);
    const rotAngleRef   = useRef(0);
    const packetsRef    = useRef<Packet[]>([]);
    const rainRef       = useRef<RainDrop[]>([]);
    const ambientRef    = useRef<AmbientPt[]>([]);
    const nightRef      = useRef(false);
    const showPktRef    = useRef(true);
    const showRainRef   = useRef(true);
    const autoRotRef    = useRef(false);
    const startTimeRef  = useRef(Date.now());
    const ppsCountRef   = useRef(0);
    const lastPpsRef    = useRef(Date.now());
    const rafRef        = useRef(0);
    const isDragging    = useRef(false);
    const dragStart     = useRef({ x: 0, y: 0, px: 0, py: 0 });

    // UI state
    const [night,      setNight]     = useState(false);
    const [showPkt,    setShowPkt]   = useState(true);
    const [showRain,   setShowRain]  = useState(true);
    const [autoRot,    setAutoRot]   = useState(false);
    const [pps,        setPps]       = useState(0);
    const [uptime,     setUptime]    = useState('00:00:00');
    const [tickDisp,   setTickDisp]  = useState('0000000');
    const [panel,      setPanel]     = useState<DistrictPanel | null>(null);

    // ── Toggle handlers ───────────────────────────────────────────────
    const toggleNight  = () => { nightRef.current = !nightRef.current;   setNight(n => !n); };
    const togglePkt    = () => { showPktRef.current = !showPktRef.current; setShowPkt(p => !p); };
    const toggleRain   = () => { showRainRef.current = !showRainRef.current; setShowRain(r => !r); };
    const toggleRot    = () => { autoRotRef.current = !autoRotRef.current;  setAutoRot(r => !r); };

    // ── Packet spawner ────────────────────────────────────────────────
    const spawnPacket = useCallback(() => {
        if (HUBS.length < 2) return;
        const src = HUBS[Math.floor(Math.random() * HUBS.length)]!;
        let dst: Hub;
        do { dst = HUBS[Math.floor(Math.random() * HUBS.length)]!; } while (dst === src);
        packetsRef.current.push({
            srcR: src.r, srcC: src.c,
            dstR: dst.r, dstC: dst.c,
            t: 0,
            speed: 0.006 + Math.random() * 0.008,
            color: DISTRICTS[src.dist]?.color ?? '#00d4ff',
        });
        ppsCountRef.current++;
    }, []);

    // ── RAF animation loop ─────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Init rain
        rainRef.current = Array.from({ length: 120 }, () => ({
            x:     Math.random() * 2000,
            y:     Math.random() * 1200,
            speed: 1.5 + Math.random() * 3,
            len:   4 + Math.floor(Math.random() * 12),
            chars: Array.from({ length: 20 }, () =>
                String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))),
            alpha: 0.15 + Math.random() * 0.45,
        }));

        // Init ambient particles
        ambientRef.current = Array.from({ length: 60 }, () => ({
            x:     Math.random() * 2000,
            y:     Math.random() * 1200,
            vx:    (Math.random() - 0.5) * 0.4,
            vy:    -0.2 - Math.random() * 0.5,
            r:     1 + Math.random() * 2.5,
            alpha: 0.2 + Math.random() * 0.5,
            color: ['#00d4ff','#bf00ff','#00ff88','#ffd700'][Math.floor(Math.random() * 4)]!,
        }));

        const resize = () => {
            canvas.width  = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const loop = () => {
            const W = canvas.width, H = canvas.height;
            const tick = ++tickRef.current;
            const night = nightRef.current;

            // Compute offsets
            let ox: number;
            if (autoRotRef.current) {
                rotAngleRef.current += 0.002;
                ox = W / 2 - (G / 2 * TW / 2 * zoomRef.current) + Math.sin(rotAngleRef.current) * 30 * zoomRef.current;
            } else {
                ox = W / 2 - (G / 2 * TW / 2 * zoomRef.current) + panXRef.current;
            }
            const oy = H / 3 - (G / 4 * TH / 2 * zoomRef.current) + panYRef.current;

            // Smooth zoom
            if (Math.abs(zoomRef.current - targetZoomRef.current) > 0.001)
                zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.12;

            const zoom = zoomRef.current;

            // Spawn packets
            if (showPktRef.current && tick % 8 === 0 && packetsRef.current.length < 40) spawnPacket();

            // Update packets
            packetsRef.current = packetsRef.current.filter(p => {
                p.t += p.speed;
                return p.t < 1;
            });

            // Update rain
            const rain = rainRef.current;
            rain.forEach(d => {
                d.y += d.speed;
                if (d.y > 1400) { d.y = -200; }
                if (tick % 12 === 0) d.chars[0] = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));
            });

            // Update ambient
            const ambient = ambientRef.current;
            ambient.forEach(pt => {
                pt.x += pt.vx; pt.y += pt.vy;
                if (pt.y < -20) { pt.y = H + 20; pt.x = Math.random() * W; }
                if (pt.x < -20 || pt.x > W + 20) pt.x = Math.random() * W;
            });

            // Stats (every 60 frames)
            if (tick % 60 === 0) {
                const now = Date.now();
                setPps(Math.round(ppsCountRef.current / ((now - lastPpsRef.current) / 1000)));
                ppsCountRef.current = 0;
                lastPpsRef.current  = now;
                const sec = Math.floor((now - startTimeRef.current) / 1000);
                setUptime([Math.floor(sec/3600), Math.floor(sec%3600/60), sec%60]
                    .map(v => String(v).padStart(2,'0')).join(':'));
                setTickDisp(String(tick).padStart(7, '0'));
            }

            // ── Render ──
            ctx.clearRect(0, 0, W, H);

            // Sky
            const sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, night ? '#000208' : '#020610');
            sky.addColorStop(1, night ? '#010510' : '#030a18');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, W, H);

            // Horizon glow
            const hgY = oy + (G * TH / 2) * zoom;
            const hg  = ctx.createRadialGradient(W/2, hgY, 0, W/2, hgY, W * 0.6);
            hg.addColorStop(0, night ? 'rgba(191,0,255,0.08)' : 'rgba(0,212,255,0.06)');
            hg.addColorStop(1, 'transparent');
            ctx.fillStyle = hg;
            ctx.fillRect(0, 0, W, H);

            // Rain (behind buildings)
            if (showRainRef.current) drawRain(ctx, rain, night, W, H);

            // Tiles + buildings (painter's order)
            for (let sum = 0; sum < G * 2 - 1; sum++) {
                for (let r = 0; r < G; r++) {
                    const c = sum - r;
                    if (c < 0 || c >= G) continue;
                    drawGround(ctx, r, c, night, ox, oy, zoom);
                    const bld = buildingMap[r][c];
                    if (bld) drawBuilding(ctx, r, c, bld, tick, night, ox, oy, zoom);
                }
            }

            // Packets (above buildings)
            if (showPktRef.current) packetsRef.current.forEach(p => drawPacket(ctx, p, ox, oy, zoom));

            // Ambient
            drawAmbient(ctx, ambient, tick);

            // Edge vignette
            const fade = ctx.createRadialGradient(W/2, H/2, W * 0.3, W/2, H/2, W * 0.7);
            fade.addColorStop(0, 'transparent');
            fade.addColorStop(1, 'rgba(2,6,16,0.65)');
            ctx.fillStyle = fade;
            ctx.fillRect(0, 0, W, H);

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [spawnPacket]);

    // ── Wheel (non-passive) ───────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            targetZoomRef.current = Math.max(0.35, Math.min(2.5, targetZoomRef.current + delta));
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    // ── Mouse handlers ────────────────────────────────────────────────
    const getIso = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const W  = canvas.width, H = canvas.height;
        const ox = W / 2 - (G / 2 * TW / 2 * zoomRef.current) + panXRef.current;
        const oy = H / 3 - (G / 4 * TH / 2 * zoomRef.current) + panYRef.current;
        return screenToIso(sx, sy, ox, oy, zoomRef.current);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const tt = tooltipRef.current;
        if (!tt) return;

        if (isDragging.current) {
            panXRef.current = dragStart.current.px + (e.clientX - dragStart.current.x);
            panYRef.current = dragStart.current.py + (e.clientY - dragStart.current.y);
            return;
        }

        const iso = getIso(e.clientX, e.clientY);
        if (iso && iso.r >= 0 && iso.r < G && iso.c >= 0 && iso.c < G) {
            const dist = tileMap[iso.r][iso.c]!;
            const d    = DISTRICTS[dist]!;
            const bld  = buildingMap[iso.r][iso.c];
            tt.innerHTML = `
                <div style="font-size:14px;font-weight:700;letter-spacing:3px;color:${d.color};text-shadow:0 0 8px ${d.color};margin-bottom:4px">${d.name}</div>
                <div style="font-size:9px;letter-spacing:2px;color:${d.color}66;text-transform:uppercase;margin-bottom:8px">DISTRICT // TILE [${iso.r},${iso.c}]</div>
                <div style="font-size:11px;line-height:1.6;color:rgba(255,255,255,0.67)">${bld ? `${bld.h}u building${bld.antenna?' ↑ ANTENNA':''}${bld.lit?' ◉ LIT':''}` : 'Empty sector — transit grid active.'}</div>
            `;
            tt.style.borderColor = d.color + '88';
            tt.style.display = 'block';
            const tx = e.clientX + 16, ty = e.clientY - 8;
            tt.style.left = Math.min(tx, window.innerWidth  - 280) + 'px';
            tt.style.top  = Math.min(ty, window.innerHeight - 160) + 'px';
        } else {
            tt.style.display = 'none';
        }
    }, [getIso]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        isDragging.current = true;
        dragStart.current  = { x: e.clientX, y: e.clientY, px: panXRef.current, py: panYRef.current };
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const moved = Math.abs(e.clientX - dragStart.current.x) < 4
                   && Math.abs(e.clientY - dragStart.current.y) < 4;
        isDragging.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';

        if (moved) {
            const iso = getIso(e.clientX, e.clientY);
            if (iso && iso.r >= 0 && iso.r < G && iso.c >= 0 && iso.c < G) {
                setPanel({ distId: tileMap[iso.r][iso.c]! });
            }
        }
    }, [getIso]);

    const handleMouseLeave = useCallback(() => {
        isDragging.current = false;
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    }, []);

    // ── Render ────────────────────────────────────────────────────────
    const panelDist = panel ? DISTRICTS[panel.distId] : null;
    const panelInfo = panel ? DISTRICT_INFO[panel.distId] : null;

    return (
        <div style={{ width:'100vw', height:'100vh', background:'#020610', overflow:'hidden', fontFamily:"'Courier New',monospace", color:'#00d4ff', userSelect:'none', position:'relative' }}>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                style={{ display:'block', width:'100%', height:'100%', cursor:'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            />

            {/* Scanlines */}
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5, background:'repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,8,0.15) 2px,rgba(0,0,8,0.15) 4px)', opacity:0.5 }} />

            {/* Corner brackets */}
            {(['tl','tr','bl','br'] as const).map(pos => {
                const s: React.CSSProperties = { position:'absolute', width:30, height:30, pointerEvents:'none', zIndex:6 };
                if (pos[0] === 't') { s.top    = 12; s.borderTop    = '1px solid rgba(0,212,255,0.5)'; }
                else                { s.bottom = 12; s.borderBottom = '1px solid rgba(0,212,255,0.5)'; }
                if (pos[1] === 'l') { s.left   = 12; s.borderLeft   = '1px solid rgba(0,212,255,0.5)'; }
                else                { s.right  = 12; s.borderRight  = '1px solid rgba(0,212,255,0.5)'; }
                return <div key={pos} style={s} />;
            })}

            {/* Header */}
            <div style={{ position:'absolute', top:24, left:32, zIndex:10, pointerEvents:'none' }}>
                <div style={{ fontSize:26, fontWeight:700, letterSpacing:6, color:'#00d4ff', textShadow:'0 0 10px #00d4ff,0 0 30px #00d4ff80', marginBottom:4 }}>NOĒSIS</div>
                <div style={{ fontSize:11, letterSpacing:3, color:'rgba(0,212,255,0.53)', textTransform:'uppercase' }}>// CYBER GRID — LIVE WORLD MAP</div>
                <div style={{ fontSize:9, color:'rgba(0,212,255,0.27)', marginTop:2, letterSpacing:2 }}>
                    GRID NODE v2.4 ● GENESIS CLUSTER ● TICK <span>{tickDisp}</span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ position:'absolute', top:24, right:32, display:'flex', gap:12, zIndex:10 }}>
                {[
                    { label:'◐ NIGHT',   active:night,   toggle:toggleNight },
                    { label:'▶ PACKETS', active:showPkt,  toggle:togglePkt   },
                    { label:'✦ RAIN',    active:showRain, toggle:toggleRain   },
                    { label:'↺ ROTATE',  active:autoRot,  toggle:toggleRot    },
                ].map(({ label, active, toggle }) => (
                    <button
                        key={label}
                        onClick={toggle}
                        style={{ background: active ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.07)', border:'1px solid rgba(0,212,255,0.35)', color:'#00d4ff', fontFamily:"'Courier New',monospace", fontSize:10, letterSpacing:2, padding:'7px 14px', cursor:'pointer', textTransform:'uppercase', textShadow:'0 0 6px #00d4ff88', boxShadow: active ? '0 0 20px rgba(0,212,255,0.5)' : 'none' }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div style={{ position:'absolute', bottom:24, left:32, display:'flex', gap:32, zIndex:10, pointerEvents:'none' }}>
                {[
                    { label:'Active Nodes', value:'3' },
                    { label:'Packets/s',    value:String(pps) },
                    { label:'Grid Health',  value:'100%' },
                    { label:'Uptime',       value:uptime },
                ].map(({ label, value }) => (
                    <div key={label} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        <div style={{ fontSize:9, color:'rgba(0,212,255,0.33)', letterSpacing:2, textTransform:'uppercase' }}>{label}</div>
                        <div style={{ fontSize:16, color:'#00d4ff', textShadow:'0 0 8px rgba(0,212,255,0.53)', fontWeight:700, letterSpacing:2 }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div style={{ position:'absolute', bottom:24, right:32, zIndex:10, pointerEvents:'none' }}>
                {LEGEND_ITEMS.map(({ color, label }) => (
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:10, letterSpacing:1, color:'rgba(255,255,255,0.53)' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}`, flexShrink:0 }} />
                        {label}
                    </div>
                ))}
            </div>

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={{ position:'fixed', display:'none', zIndex:100, pointerEvents:'none', background:'rgba(2,6,16,0.92)', border:'1px solid rgba(0,212,255,0.5)', padding:'14px 18px', maxWidth:260, boxShadow:'0 0 20px rgba(0,212,255,0.3),inset 0 0 40px rgba(0,212,255,0.04)' }}
            />

            {/* District panel */}
            {panel && panelDist && panelInfo && (
                <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:200, background:'rgba(2,6,16,0.97)', border:`1px solid ${panelDist.color}66`, padding:32, minWidth:360, boxShadow:`0 0 60px ${panelDist.color}33` }}>
                    <button
                        onClick={() => setPanel(null)}
                        style={{ position:'absolute', top:12, right:12, background:'none', border:'1px solid rgba(0,212,255,0.3)', color:'rgba(0,212,255,0.53)', fontFamily:"'Courier New',monospace", fontSize:10, padding:'4px 10px', cursor:'pointer' }}
                    >
                        ✕ CLOSE
                    </button>
                    <div style={{ fontSize:20, letterSpacing:4, color:panelDist.color, textShadow:`0 0 12px ${panelDist.color}`, marginBottom:6 }}>{panelDist.name.toUpperCase()}</div>
                    <div style={{ fontSize:9, letterSpacing:3, color:`${panelDist.color}55`, marginBottom:16 }}>// {panel.distId} — DISTRICT DETAIL</div>
                    <div style={{ fontSize:12, lineHeight:1.8, color:'rgba(255,255,255,0.8)' }}>{panelInfo.desc}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:20 }}>
                        {panelInfo.metrics.map(m => (
                            <div key={m.label} style={{ background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.15)', padding:12 }}>
                                <div style={{ fontSize:8, color:'rgba(0,212,255,0.33)', letterSpacing:2, marginBottom:4 }}>{m.label}</div>
                                <div style={{ fontSize:22, color:panelDist.color, fontWeight:700 }}>{m.val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
        </div>
    );
}
