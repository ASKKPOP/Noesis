/* Noēsis Grid-Viz — PORTAL layer: synthetic off-Earth Noēsis-space.
 * A constellation of Grids (NOT a real-Earth map). Click Genesis to enter its city. */

const Portal = (function () {
  let canvas, ctx, onEnter, stars = [], t = 0, raf = null;
  const nodes = [];

  function layout() {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    nodes.length = 0;
    nodes.push({ grid: GENESIS_GRID, x: cx, y: cy, r: 46, live: true });
    const seeds = [[-0.42, -0.22, 26], [0.40, -0.30, 24], [0.46, 0.26, 22]];
    FUTURE_GRIDS.forEach((g, i) => {
      const s = seeds[i % seeds.length];
      nodes.push({ grid: g, x: cx + s[0] * rect.width * 0.9, y: cy + s[1] * rect.height * 0.9, r: s[2], live: false });
    });
    stars = [];
    for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * rect.width, y: Math.random() * rect.height, r: Math.random() * 1.4 + 0.3 });
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2a2a38';
    stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });

    // links from Genesis to future grids
    const gen = nodes[0];
    ctx.strokeStyle = 'rgba(80,40,60,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    for (let i = 1; i < nodes.length; i++) { ctx.beginPath(); ctx.moveTo(gen.x, gen.y); ctx.lineTo(nodes[i].x, nodes[i].y); ctx.stroke(); }
    ctx.setLineDash([]);

    for (const n of nodes) {
      if (n.live) {
        const pulse = 46 + Math.sin(t / 28) * 8 + 14;
        ctx.beginPath(); ctx.arc(n.x, n.y, pulse, 0, 7);
        ctx.strokeStyle = 'rgba(255,184,108,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7);
        ctx.fillStyle = '#1c1622'; ctx.fill();
        ctx.strokeStyle = '#ffb86c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffb86c'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('GENESIS', n.x, n.y - 2);
        ctx.fillStyle = '#9a9aa6'; ctx.font = '400 11px system-ui';
        ctx.fillText('Grid · live · click to enter', n.x, n.y + 14);
      } else {
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7);
        ctx.fillStyle = '#15151a'; ctx.fill();
        ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#6a6a76'; ctx.font = '400 10px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(n.grid.name, n.x, n.y + 3);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#f472b6'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('PORTAL · NOĒSIS-SPACE', 20, 30);
  }

  function loop() { t++; draw(); raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }

  return {
    init(canvasEl, enterCb) {
      canvas = canvasEl; ctx = canvas.getContext('2d'); onEnter = enterCb;
      resize();
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const g = nodes[0];
        if ((mx - g.x) ** 2 + (my - g.y) ** 2 <= (g.r + 8) ** 2) onEnter(GENESIS_GRID);
      });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const g = nodes[0];
        canvas.style.cursor = ((mx - g.x) ** 2 + (my - g.y) ** 2 <= (g.r + 8) ** 2) ? 'pointer' : 'default';
      });
      window.addEventListener('resize', () => { if (raf) resize(); });
    },
    show() { resize(); loop(); },
    hide() { stop(); },
  };
})();
