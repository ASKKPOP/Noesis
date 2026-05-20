'use client';

/**
 * Portal home — NOĒSIS CYBER GRID
 * Isometric city canvas with cyberpunk aesthetics, animated data packets,
 * matrix rain, district tooltips, and interactive district panels.
 *
 * Client-only (ssr:false) — uses canvas APIs and wagmi hooks.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

// ── District config ──────────────────────────────────────────────────────────
type DistrictId = 'AI_CORE' | 'DATA' | 'FIREWALL' | 'HUB' | 'DARKWEB' | 'RESIDENTIAL' | 'BUFFER';

interface District { color: string; dark: string; glow: string; groundLight: string; name: string; }
const DISTRICTS: Record<DistrictId, District> = {
    AI_CORE:    { name: 'AI Core',           color: '#bf00ff', dark: '#5a007a', glow: '#bf00ff', groundLight: '#1a0030' },
    DATA:       { name: 'Data Center',       color: '#00d4ff', dark: '#005577', glow: '#00d4ff', groundLight: '#001a22' },
    FIREWALL:   { name: 'Firewall District', color: '#ff4400', dark: '#7a1500', glow: '#ff4400', groundLight: '#1a0800' },
    HUB:        { name: 'Network Hub',       color: '#ffd700', dark: '#665500', glow: '#ffd700', groundLight: '#1a1100' },
    DARKWEB:    { name: 'Dark Web',          color: '#00ff88', dark: '#006633', glow: '#00ff88', groundLight: '#001a0e' },
    RESIDENTIAL:{ name: 'Nous Residential',  color: '#4488ff', dark: '#1a3577', glow: '#4488ff', groundLight: '#060f22' },
    BUFFER:     { name: 'Transit Zone',      color: '#334455', dark: '#1a2233', glow: '#334455', groundLight: '#0a0e14' },
};

const DISTRICT_INFO: Record<DistrictId, { desc: string; metrics: { label: string; val: string }[] }> = {
    AI_CORE:    { desc: 'The neural nexus of the Genesis cluster. Three active Nous minds — Sophia, Hermes, Themis — run perpetual cognitive cycles here. LLM inference streams flood the local fabric at 40ms intervals. The spire at grid center is the Grid Service itself: the arbiter of all identity, law, and trade.', metrics: [{ label: 'Active Minds', val: '3' }, { label: 'Tick Rate', val: '30s' }, { label: 'Memory Depth', val: '∞' }, { label: 'Consensus', val: '100%' }] },
    DATA:       { desc: 'Persistent state lives here. MySQL cluster shards hold every skill, lore fragment, identity record, and trade ledger ever written. The buildings are massive — wide, flat, humming with coolant. Reads never sleep.', metrics: [{ label: 'Tables', val: '24' }, { label: 'Migrations', val: '17' }, { label: 'Uptime', val: '99.9%' }, { label: 'Write/s', val: '~200' }] },
    FIREWALL:   { desc: 'The perimeter. Rate-limited ingress channels, DID-authenticated routes, cryptographic whisper pipes. Every packet entering the grid passes through a Firewall node. Unauthorized identities are tombstoned on contact.', metrics: [{ label: 'Rules', val: '48' }, { label: 'DID Checks', val: '100%' }, { label: 'Blocks/hr', val: '~12' }, { label: 'Latency', val: '<1ms' }] },
    HUB:        { desc: 'Where minds meet. The Agora, Market, and Council channels converge here. WebSocket frames radiate from Hub towers carrying presence events, trade proposals, whisper messages, and governance votes.', metrics: [{ label: 'Channels', val: '3' }, { label: 'Sockets', val: 'live' }, { label: 'Events/s', val: '~40' }, { label: 'Protocol', val: 'WS/2' }] },
    DARKWEB:    { desc: 'Whisper routing. Encrypted peer-to-peer messages pass through the Dark Web district wrapped in BLAKE2b-keyed envelopes. No logs, no metadata. The NaCl cryptographic layer ensures even the Grid itself cannot read the payload.', metrics: [{ label: 'Cipher', val: 'NaCl' }, { label: 'Hash', val: 'BLAKE2b' }, { label: 'Logged', val: 'NEVER' }, { label: 'Routes', val: 'P2P' }] },
    RESIDENTIAL:{ desc: 'The Nous neighborhood. Sophia the Philosopher, Hermes the Trader, Themis the Lawkeeper — each runs in a container here, sleeping between ticks, dreaming in YAML config. Their socket files pulse in the /sockets volume.', metrics: [{ label: 'Residents', val: '3' }, { label: 'Container', val: 'Python' }, { label: 'Sockets', val: '/sockets' }, { label: 'Model', val: 'qwen3:4b' }] },
    BUFFER:     { desc: 'Transit arteries. Packets, events, and audit logs flow through the buffer zones connecting all districts. These corridors are monitored but sparse — the occasional neon sign marks a relay node.', metrics: [{ label: 'Throughput', val: '~1GB/s' }, { label: 'Latency', val: '<5ms' }, { label: 'Monitors', val: 'passive' }, { label: 'Type', val: 'Relay' }] },
};

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
function makePrng(seed: number) {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── Static world data (generated once at module level) ───────────────────────
const GRID = 22, TW = 72, TH = 36, MAX_H = 160;

function buildWorld() {
    const rng = makePrng(42);
    const tileMap: DistrictId[][] = [];
    const buildingMap: ({ h: number; w: number; lit: boolean; antenna: boolean } | null)[][] = [];

    function districtAt(r: number, c: number): DistrictId {
        const cx = GRID / 2, cy = GRID / 2;
        const dx = r - cx, dy = c - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 3.2) return 'AI_CORE';
        if (d < 4.8) return 'RESIDENTIAL';
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (d < 9.5) {
            if (angle > -90 && angle <= 0) return 'DATA';
            if (angle > 0 && angle <= 90) return 'HUB';
            if (angle > 90 || angle <= -135) return 'DARKWEB';
            return 'FIREWALL';
        }
        if (r < 3 || r > GRID - 3 || c < 3 || c > GRID - 3) return 'FIREWALL';
        return 'BUFFER';
    }

    for (let r = 0; r < GRID; r++) {
        tileMap[r] = [];
        buildingMap[r] = [];
        for (let c = 0; c < GRID; c++) {
            const dist = districtAt(r, c);
            tileMap[r][c] = dist;
            if (rng() > 0.22) {
                let maxH = 20;
                if (dist === 'AI_CORE')    maxH = rng() > 0.3 ? MAX_H : 80;
                if (dist === 'DATA')       maxH = rng() > 0.4 ? 90 : 50;
                if (dist === 'FIREWALL')   maxH = rng() > 0.5 ? 60 : 30;
                if (dist === 'HUB')        maxH = rng() > 0.3 ? 100 : 45;
                if (dist === 'DARKWEB')    maxH = rng() > 0.6 ? 35 : 18;
                if (dist === 'RESIDENTIAL') maxH = rng() > 0.4 ? 55 : 28;
                if (dist === 'BUFFER')     maxH = rng() > 0.7 ? 25 : 12;
                buildingMap[r][c] = {
                    h: Math.max(8, Math.floor(rng() * maxH)),
                    w: 0.55 + rng() * 0.45,
                    lit: rng() > 0.4,
                    antenna: dist === 'HUB' && rng() > 0.5,
                };
            } else {
                buildingMap[r][c] = null;
            }
        }
    }

    const hubs: { r: number; c: number; dist: DistrictId }[] = [];
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            const d = tileMap[r][c];
            if ((d === 'AI_CORE' || d === 'HUB' || d === 'DATA') && buildingMap[r][c] && rng() > 0.6) {
                hubs.push({ r, c, dist: d });
            }
        }
    }

    return { tileMap, buildingMap, hubs };
}

const WORLD = buildWorld();

// ── Tooltip & panel state types ──────────────────────────────────────────────
interface TooltipState { x: number; y: number; name: string; typeStr: string; desc: string; color: string; }
interface PanelState { id: DistrictId; }

// ── CyberGrid canvas component ───────────────────────────────────────────────
function CyberGrid() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    // Toggle state — also mirrored to refs for animation loop access
    const [nightMode,    setNightMode]    = useState(false);
    const [showPackets,  setShowPackets]  = useState(true);
    const [showRain,     setShowRain]     = useState(true);
    const [autoRotate,   setAutoRotate]   = useState(false);
    const nightRef       = useRef(false);
    const packetsRef     = useRef(true);
    const rainRef        = useRef(true);
    const rotateRef      = useRef(false);

    const [stats,   setStats]   = useState({ nodes: 3, pps: 0, uptime: '00:00:00' });
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [panel,   setPanel]   = useState<PanelState | null>(null);

    // Sync toggle refs
    const toggleNight   = () => setNightMode(v   => { nightRef.current   = !v; return !v; });
    const togglePackets = () => setShowPackets(v  => { packetsRef.current = !v; return !v; });
    const toggleRain    = () => setShowRain(v     => { rainRef.current    = !v; return !v; });
    const toggleRotate  = () => setAutoRotate(v   => { rotateRef.current  = !v; return !v; });

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        const canvas: HTMLCanvasElement = canvasRef.current;
        const container: HTMLDivElement = containerRef.current;
        const ctx = canvas.getContext('2d')!;

        // ── Mutable animation state ──────────────────────────────────────────
        let zoom = 1, targetZoom = 1;
        let panX = 0, panY = 0;
        let rotateAngle = 0;
        let tick = 0;
        let ppsCount = 0;
        let lastPpsTime = Date.now();
        const startTime = Date.now();

        // Packets
        interface Pkt { src:{r:number;c:number;dist:DistrictId}; dst:{r:number;c:number;dist:DistrictId}; t:number; speed:number; color:string; }
        const packets: Pkt[] = [];
        const rnd = makePrng(Date.now());

        function spawnPacket() {
            if (WORLD.hubs.length < 2) return;
            const src = WORLD.hubs[Math.floor(Math.random() * WORLD.hubs.length)];
            let dst = src;
            while (dst === src) dst = WORLD.hubs[Math.floor(Math.random() * WORLD.hubs.length)];
            packets.push({ src, dst, t: 0, speed: 0.006 + Math.random() * 0.008, color: DISTRICTS[src.dist].color });
            ppsCount++;
        }

        // Rain drops
        const rainDrops = Array.from({ length: 120 }, () => ({
            x: Math.random() * 3000,
            y: Math.random() * 2000,
            speed: 1.5 + Math.random() * 3,
            len: 4 + Math.floor(Math.random() * 12),
            chars: Array.from({ length: 20 }, () => String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))),
            alpha: 0.15 + Math.random() * 0.45,
        }));

        // Ambient particles
        const ambientPts = Array.from({ length: 60 }, () => ({
            x: Math.random() * 3000, y: Math.random() * 2000,
            vx: (Math.random() - 0.5) * 0.4, vy: -0.2 - Math.random() * 0.5,
            r: 1 + Math.random() * 2.5,
            alpha: 0.2 + Math.random() * 0.5,
            color: ['#00d4ff', '#bf00ff', '#00ff88', '#ffd700'][Math.floor(Math.random() * 4)],
        }));

        // ── Helpers ──────────────────────────────────────────────────────────
        function colorMix(hex: string, alpha: number): string {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            if (nightRef.current) return `rgba(${Math.floor(r*.7)},${Math.floor(g*.7)},${Math.floor(b*.7)},${alpha})`;
            return `rgba(${r},${g},${b},${alpha})`;
        }

        function isoToScreen(r: number, c: number) {
            const W = canvas.width, H = canvas.height;
            let ox = W / 2 - (GRID / 2 * TW / 2 * zoom) + panX;
            if (rotateRef.current) ox = W / 2 - (GRID / 2 * TW / 2 * zoom) + Math.sin(rotateAngle) * 30 * zoom;
            const oy = H / 3 - (GRID / 4 * TH / 2 * zoom) + panY;
            return {
                x: (c - r) * (TW / 2) * zoom + ox,
                y: (c + r) * (TH / 2) * zoom + oy,
            };
        }

        function screenToIso(sx: number, sy: number) {
            const W = canvas.width, H = canvas.height;
            let ox = W / 2 - (GRID / 2 * TW / 2 * zoom) + panX;
            if (rotateRef.current) ox = W / 2 - (GRID / 2 * TW / 2 * zoom) + Math.sin(rotateAngle) * 30 * zoom;
            const oy = H / 3 - (GRID / 4 * TH / 2 * zoom) + panY;
            const tx = (sx - ox) / zoom, ty = (sy - oy) / zoom;
            return {
                r: Math.floor((ty / (TH / 2) - tx / (TW / 2)) / 2),
                c: Math.floor((tx / (TW / 2) + ty / (TH / 2)) / 2),
            };
        }

        // ── Draw functions ────────────────────────────────────────────────────
        function drawGround(r: number, c: number) {
            const d = DISTRICTS[WORLD.tileMap[r][c]];
            const p = isoToScreen(r, c);
            const tw2 = (TW / 2) * zoom, th2 = (TH / 2) * zoom;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - th2);
            ctx.lineTo(p.x + tw2, p.y);
            ctx.lineTo(p.x, p.y + th2);
            ctx.lineTo(p.x - tw2, p.y);
            ctx.closePath();
            const g = ctx.createLinearGradient(p.x - tw2, p.y - th2, p.x + tw2, p.y + th2);
            g.addColorStop(0, (nightRef.current ? d.dark : d.groundLight) + 'ff');
            g.addColorStop(1, '#020610ff');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = colorMix(d.color, nightRef.current ? 0.08 : 0.15);
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        function drawBuilding(r: number, c: number) {
            const bld = WORLD.buildingMap[r][c];
            if (!bld) return;
            const d = DISTRICTS[WORLD.tileMap[r][c]];
            const h = bld.h * zoom;
            const tw2 = (TW / 2) * zoom * bld.w;
            const th2 = (TH / 2) * zoom * bld.w;
            const p = isoToScreen(r, c);

            // Left face
            ctx.beginPath();
            ctx.moveTo(p.x - tw2, p.y); ctx.lineTo(p.x, p.y + th2);
            ctx.lineTo(p.x, p.y + th2 - h); ctx.lineTo(p.x - tw2, p.y - h); ctx.closePath();
            const gl = ctx.createLinearGradient(p.x - tw2, p.y, p.x, p.y + th2);
            gl.addColorStop(0, colorMix(d.dark, 0.9)); gl.addColorStop(1, '#020610');
            ctx.fillStyle = gl; ctx.fill();

            // Right face
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + th2); ctx.lineTo(p.x + tw2, p.y);
            ctx.lineTo(p.x + tw2, p.y - h); ctx.lineTo(p.x, p.y + th2 - h); ctx.closePath();
            const gr = ctx.createLinearGradient(p.x, p.y + th2, p.x + tw2, p.y);
            gr.addColorStop(0, '#020610'); gr.addColorStop(1, colorMix(d.dark, 0.7));
            ctx.fillStyle = gr; ctx.fill();

            // Top face
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - h - th2); ctx.lineTo(p.x + tw2, p.y - h);
            ctx.lineTo(p.x, p.y - h + th2); ctx.lineTo(p.x - tw2, p.y - h); ctx.closePath();
            const gt = ctx.createRadialGradient(p.x, p.y - h, 0, p.x, p.y - h, tw2);
            gt.addColorStop(0, colorMix(d.color, nightRef.current ? 0.6 : 0.5));
            gt.addColorStop(1, colorMix(d.dark, 0.8));
            ctx.fillStyle = gt; ctx.fill();
            ctx.shadowColor = d.glow; ctx.shadowBlur = nightRef.current ? 22 : 12;
            ctx.strokeStyle = colorMix(d.color, nightRef.current ? 0.7 : 0.5);
            ctx.lineWidth = 0.8; ctx.stroke(); ctx.shadowBlur = 0;

            // Windows
            if (bld.lit) {
                const rows = Math.max(1, Math.floor(bld.h / 12));
                for (let wr = 0; wr < rows; wr++) {
                    const wy = p.y + th2 - h + (wr + 1) * (h / (rows + 1));
                    for (let wc = 0; wc < 2; wc++) {
                        const wx = p.x - tw2 + (wc + 1) * (tw2 / 3);
                        const wwy = wy + wx * (th2 / tw2) - p.x * (th2 / tw2);
                        ctx.fillStyle = colorMix(d.color, (nightRef.current ? 0.9 : 0.6) * (0.5 + 0.5 * Math.sin(tick * 0.04 + r * 0.7 + c * 0.9 + wr)));
                        ctx.fillRect(wx - 2 * zoom, wwy - 3 * zoom, 3 * zoom, 4 * zoom);
                    }
                }
            }

            // Antenna
            if (bld.antenna) {
                const ax = p.x, ay = p.y - h - th2, aH = 20 * zoom;
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - aH);
                ctx.strokeStyle = colorMix(d.color, 0.8); ctx.lineWidth = 1.5;
                ctx.shadowColor = d.glow; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
                if (Math.sin(tick * 0.07 + r + c) > 0.5) {
                    ctx.beginPath(); ctx.arc(ax, ay - aH, 2.5 * zoom, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff0000'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8;
                    ctx.fill(); ctx.shadowBlur = 0;
                }
            }
        }

        function drawPacket(pkt: Pkt) {
            const sp = isoToScreen(pkt.src.r, pkt.src.c);
            const dp = isoToScreen(pkt.dst.r, pkt.dst.c);
            const sh = WORLD.buildingMap[pkt.src.r][pkt.src.c]?.h ?? 0;
            const dh = WORLD.buildingMap[pkt.dst.r][pkt.dst.c]?.h ?? 0;
            const sx = sp.x, sy = sp.y - sh * zoom;
            const ex = dp.x, ey = dp.y - dh * zoom;
            const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 40 * zoom;
            const t = pkt.t;
            const x = (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex;
            const y = (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey;
            ctx.beginPath(); ctx.arc(x, y, 3*zoom, 0, Math.PI*2);
            ctx.fillStyle = pkt.color; ctx.shadowColor = pkt.color; ctx.shadowBlur = 12;
            ctx.fill(); ctx.shadowBlur = 0;
            for (let i = 1; i <= 4; i++) {
                const tt = Math.max(0, t - i * 0.015);
                const tx2 = (1-tt)*(1-tt)*sx + 2*(1-tt)*tt*mx + tt*tt*ex;
                const ty2 = (1-tt)*(1-tt)*sy + 2*(1-tt)*tt*my + tt*tt*ey;
                ctx.beginPath(); ctx.arc(tx2, ty2, Math.max(0.5, (2.5 - i*0.4)*zoom), 0, Math.PI*2);
                ctx.globalAlpha = Math.max(0, 0.3 - i*0.06);
                ctx.fillStyle = pkt.color; ctx.fill(); ctx.globalAlpha = 1;
            }
        }

        // ── Animation loop ────────────────────────────────────────────────────
        function loop() {
            tick++;
            const W = canvas.width, H = canvas.height;
            if (rotateRef.current) rotateAngle += 0.002;
            if (Math.abs(zoom - targetZoom) > 0.001) zoom += (targetZoom - zoom) * 0.12;

            // Spawn / update packets
            if (packetsRef.current && tick % 8 === 0 && packets.length < 40) spawnPacket();
            for (let i = packets.length - 1; i >= 0; i--) {
                packets[i].t += packets[i].speed;
                if (packets[i].t >= 1) packets.splice(i, 1);
            }

            // Update rain
            rainDrops.forEach(d => {
                d.y += d.speed;
                if (d.y > H + 200) { d.y = -200; d.x = Math.random() * W; }
                if (tick % 12 === 0) d.chars[0] = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));
            });

            // Update ambient particles
            ambientPts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
                if (p.x < -20 || p.x > W + 20) p.x = Math.random() * W;
            });

            // Stats update every 60 ticks
            if (tick % 60 === 0) {
                const now = Date.now();
                const pps = Math.round(ppsCount / ((now - lastPpsTime) / 1000));
                ppsCount = 0; lastPpsTime = now;
                const elapsed = Math.floor((now - startTime) / 1000);
                const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0');
                const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
                const ss = (elapsed % 60).toString().padStart(2, '0');
                setStats({ nodes: 3, pps, uptime: `${hh}:${mm}:${ss}` });
            }

            // ── Render ────────────────────────────────────────────────────────
            ctx.clearRect(0, 0, W, H);

            // Background
            const sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, nightRef.current ? '#000208' : '#020610');
            sky.addColorStop(1, nightRef.current ? '#010510' : '#030a18');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

            // Horizon glow
            const hgY = (H / 3) + panY;
            const hg = ctx.createRadialGradient(W/2, hgY, 0, W/2, hgY, W*0.6);
            hg.addColorStop(0, nightRef.current ? 'rgba(191,0,255,0.08)' : 'rgba(0,212,255,0.06)');
            hg.addColorStop(1, 'transparent');
            ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);

            // Rain (behind buildings)
            if (rainRef.current) {
                rainDrops.forEach(drop => {
                    ctx.fillStyle = nightRef.current ? `rgba(0,255,136,${drop.alpha})` : `rgba(0,212,255,${drop.alpha*0.6})`;
                    ctx.font = '12px Courier New';
                    for (let i = 0; i < drop.len; i++) {
                        ctx.globalAlpha = ((drop.len - i) / drop.len) * drop.alpha;
                        ctx.fillText(drop.chars[i % drop.chars.length], drop.x, drop.y - i * 14);
                    }
                    ctx.globalAlpha = 1;
                });
            }

            // Tiles + buildings (painter's algorithm)
            for (let sum = 0; sum < GRID * 2 - 1; sum++) {
                for (let r = 0; r < GRID; r++) {
                    const c = sum - r;
                    if (c < 0 || c >= GRID) continue;
                    drawGround(r, c);
                    if (WORLD.buildingMap[r][c]) drawBuilding(r, c);
                }
            }

            // Packets
            if (packetsRef.current) packets.forEach(drawPacket);

            // Ambient particles
            ambientPts.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(tick * 0.03 + p.x));
                ctx.shadowColor = p.color; ctx.shadowBlur = 8;
                ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            });

            // Edge vignette
            const fade = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.7);
            fade.addColorStop(0, 'transparent');
            fade.addColorStop(1, 'rgba(2,6,16,0.65)');
            ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);

            rafRef.current = requestAnimationFrame(loop);
        }

        // ── Resize ────────────────────────────────────────────────────────────
        function resize() {
            canvas.width  = container.offsetWidth;
            canvas.height = container.offsetHeight;
        }
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        resize();

        // ── Mouse interaction ─────────────────────────────────────────────────
        let isDragging = false, dragStartX = 0, dragStartY = 0, dragPanX = 0, dragPanY = 0;

        function onMouseMove(e: MouseEvent) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const iso = screenToIso(mx, my);
            if (iso.r >= 0 && iso.r < GRID && iso.c >= 0 && iso.c < GRID) {
                const dist = WORLD.tileMap[iso.r][iso.c];
                const d = DISTRICTS[dist];
                const bld = WORLD.buildingMap[iso.r][iso.c];
                setTooltip({
                    x: e.clientX + 16,
                    y: e.clientY - 8,
                    name: d.name,
                    typeStr: `DISTRICT // TILE [${iso.r},${iso.c}]`,
                    desc: bld ? `${bld.h}u building${bld.antenna ? ' ↑ ANTENNA' : ''}${bld.lit ? ' ◉ LIT' : ''}` : 'Empty sector — transit grid active.',
                    color: d.color,
                });
            } else {
                setTooltip(null);
            }
            if (isDragging) { panX = dragPanX + (e.clientX - dragStartX); panY = dragPanY + (e.clientY - dragStartY); }
        }
        function onMouseDown(e: MouseEvent) {
            isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY; dragPanX = panX; dragPanY = panY;
            canvas.style.cursor = 'grabbing';
        }
        function onMouseUp(e: MouseEvent) {
            if (Math.abs(e.clientX - dragStartX) < 4 && Math.abs(e.clientY - dragStartY) < 4) {
                const rect = canvas.getBoundingClientRect();
                const iso = screenToIso(e.clientX - rect.left, e.clientY - rect.top);
                if (iso.r >= 0 && iso.r < GRID && iso.c >= 0 && iso.c < GRID) {
                    setPanel({ id: WORLD.tileMap[iso.r][iso.c] });
                }
            }
            isDragging = false; canvas.style.cursor = 'crosshair';
        }
        function onWheel(e: WheelEvent) {
            e.preventDefault();
            targetZoom = Math.max(0.35, Math.min(2.5, targetZoom + (e.deltaY > 0 ? -0.08 : 0.08)));
        }
        function onLeave() { setTooltip(null); isDragging = false; }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('mouseleave', onLeave);

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(rafRef.current);
            ro.disconnect();
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mouseleave', onLeave);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    const btn = (label: string, active: boolean, onClick: () => void) => (
        <button
            onClick={onClick}
            className={[
                'border px-3 py-1.5 text-[10px] font-mono tracking-[2px] uppercase transition-all',
                'text-cyan-400 border-cyan-400/35',
                active
                    ? 'bg-cyan-400/25 shadow-[0_0_20px_rgba(0,212,255,0.5)]'
                    : 'bg-cyan-400/7 hover:bg-cyan-400/18 hover:shadow-[0_0_14px_rgba(0,212,255,0.4)]',
            ].join(' ')}
        >
            {label}
        </button>
    );

    const panelData = panel ? DISTRICT_INFO[panel.id] : null;
    const panelDistrict = panel ? DISTRICTS[panel.id] : null;

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#020610]" style={{ fontFamily: "'Courier New', monospace" }}>
            {/* ── Canvas ── */}
            <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />

            {/* ── Scanlines ── */}
            <div className="pointer-events-none absolute inset-0 opacity-50"
                style={{ background: 'repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,8,0.15) 2px,rgba(0,0,8,0.15) 4px)' }} />

            {/* ── Corner decorations ── */}
            {[
                'top-3 left-3 border-t border-l',
                'top-3 right-3 border-t border-r',
                'bottom-3 left-3 border-b border-l',
                'bottom-3 right-3 border-b border-r',
            ].map((cls, i) => (
                <div key={i} className={`pointer-events-none absolute h-7 w-7 border-cyan-400/50 ${cls}`} />
            ))}

            {/* ── HUD: Header ── */}
            <div className="pointer-events-none absolute left-8 top-6 select-none">
                <div className="text-2xl font-bold tracking-[6px] text-cyan-400"
                    style={{ textShadow: '0 0 10px #00d4ff, 0 0 30px #00d4ff80' }}>
                    NOĒSIS
                </div>
                <div className="mt-0.5 text-[11px] tracking-[3px] text-cyan-400/55 uppercase">
                    // CYBER GRID — LIVE WORLD MAP
                </div>
                <div className="mt-0.5 text-[9px] tracking-[2px] text-cyan-400/44">
                    GRID NODE v2.4 ● GENESIS CLUSTER ● UPTIME {stats.uptime}
                </div>
            </div>

            {/* ── HUD: Controls ── */}
            <div className="absolute right-8 top-6 flex gap-3 pointer-events-all">
                {btn('◐ NIGHT',   nightMode,   toggleNight)}
                {btn('▶ PACKETS', showPackets, togglePackets)}
                {btn('✦ RAIN',    showRain,    toggleRain)}
                {btn('↺ ROTATE',  autoRotate,  toggleRotate)}
            </div>

            {/* ── HUD: Stats bar ── */}
            <div className="pointer-events-none absolute bottom-6 left-8 flex gap-8 select-none">
                {[
                    { label: 'Active Nodes', value: stats.nodes.toString() },
                    { label: 'Packets/s',    value: stats.pps.toString() },
                    { label: 'Grid Health',  value: '100%' },
                    { label: 'Uptime',       value: stats.uptime },
                ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                        <div className="text-[9px] tracking-[2px] uppercase text-cyan-400/55">{label}</div>
                        <div className="text-base font-bold tracking-[2px] text-cyan-400"
                            style={{ textShadow: '0 0 8px #00d4ff88' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── HUD: Legend ── */}
            <div className="pointer-events-none absolute bottom-6 right-8 select-none">
                {(Object.entries(DISTRICTS) as [DistrictId, District][]).map(([id, d]) => (
                    <div key={id} className="mb-1.5 flex items-center gap-2 text-[10px] tracking-[1px] text-white/55">
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                        {d.name}
                    </div>
                ))}
            </div>

            {/* ── Tooltip ── */}
            {tooltip && (
                <div
                    className="pointer-events-none fixed z-50 max-w-[260px] border px-4 py-3"
                    style={{
                        left: Math.min(tooltip.x, window.innerWidth - 280),
                        top: Math.min(tooltip.y, window.innerHeight - 160),
                        background: 'rgba(2,6,16,0.92)',
                        borderColor: tooltip.color + '88',
                        boxShadow: `0 0 20px rgba(0,212,255,0.3),inset 0 0 40px rgba(0,212,255,0.04)`,
                    }}
                >
                    <div className="text-sm font-bold tracking-[3px]" style={{ color: tooltip.color, textShadow: `0 0 8px ${tooltip.color}` }}>
                        {tooltip.name}
                    </div>
                    <div className="mt-1 text-[9px] tracking-[2px] uppercase text-cyan-400/66">{tooltip.typeStr}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-white/67">{tooltip.desc}</div>
                </div>
            )}

            {/* ── District panel ── */}
            {panel && panelData && panelDistrict && (
                <div className="fixed left-1/2 top-1/2 z-[200] -translate-x-1/2 -translate-y-1/2 min-w-[360px] max-w-[480px] border p-8"
                    style={{
                        background: 'rgba(2,6,16,0.97)',
                        borderColor: panelDistrict.color + '66',
                        boxShadow: `0 0 60px ${panelDistrict.color}33`,
                    }}
                >
                    <button
                        onClick={() => setPanel(null)}
                        className="absolute right-3 top-3 border border-cyan-400/30 px-2.5 py-1 font-mono text-[10px] text-cyan-400/55 hover:border-cyan-400/70 hover:text-cyan-400 transition-colors"
                    >
                        ✕ CLOSE
                    </button>
                    <h2 className="text-xl font-bold tracking-[4px]"
                        style={{ color: panelDistrict.color, textShadow: `0 0 12px ${panelDistrict.color}` }}>
                        {DISTRICTS[panel.id].name.toUpperCase()}
                    </h2>
                    <div className="mb-4 mt-1 text-[9px] tracking-[3px] text-cyan-400/55">
                        // {panel.id} — DISTRICT DETAIL
                    </div>
                    <p className="text-[12px] leading-relaxed text-white/80">{panelData.desc}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        {panelData.metrics.map(m => (
                            <div key={m.label} className="border border-cyan-400/15 bg-cyan-400/5 p-3">
                                <div className="text-[8px] tracking-[2px] uppercase text-cyan-400/55">{m.label}</div>
                                <div className="text-[22px] font-bold" style={{ color: panelDistrict.color }}>{m.val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: CyberGrid }), { ssr: false });
