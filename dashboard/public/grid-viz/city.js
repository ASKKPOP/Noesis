/* Noēsis Grid-Viz — CITY layer: isometric 6-zone renderer (vanilla canvas). */

const City = (function () {
  let canvas, ctx, grid, rows, cols;
  const cam = { x: 0, y: 0, zoom: 1 };
  const TILE_W0 = 64, TILE_H0 = 32;
  let hover = null;               // {c, r}
  let drag = null;                // {x, y, camx, camy}
  let onHoverInfo = null;

  function tileW() { return TILE_W0 * cam.zoom; }
  function tileH() { return TILE_H0 * cam.zoom; }

  function worldToScreen(c, r) {
    const tw = tileW(), th = tileH();
    return { x: (c - r) * tw / 2 + cam.x, y: (c + r) * th / 2 + cam.y };
  }
  function screenToTile(sx, sy) {
    const tw = tileW(), th = tileH();
    const ix = sx - cam.x, iy = sy - cam.y;
    const c = (ix / (tw / 2) + iy / (th / 2)) / 2;
    const r = (iy / (th / 2) - ix / (tw / 2)) / 2;
    return { c: Math.floor(c), r: Math.floor(r) };
  }

  function zoneAt(c, r) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    const ch = grid.layout[r][c];
    return grid.zones[ch] || null;
  }
  function parcelKey(c, r) { return `${grid.id}:${c}-${r}`; }

  function drawDiamond(cx, cy, hw, hh, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawBuilding(scx, baseCy, desc) {
    const hw = tileW() / 2 * desc.inset;
    const hh = tileH() / 2 * desc.inset;
    const H = desc.height * 46 * cam.zoom;
    drawBox(scx, baseCy, hw, hh, H, desc);
    if (desc.setback) {
      const hw2 = hw * desc.setback, hh2 = hh * desc.setback;
      drawBox(scx, baseCy - H, hw2, hh2, desc.setbackH * 46 * cam.zoom, desc, true);
    }
    if (desc.antenna) {
      const topY = baseCy - H - (desc.setback ? desc.setbackH * 46 * cam.zoom : 0);
      ctx.strokeStyle = '#cfcfd6'; ctx.lineWidth = 1.2 * cam.zoom;
      ctx.beginPath(); ctx.moveTo(scx, topY); ctx.lineTo(scx, topY - 12 * cam.zoom); ctx.stroke();
    }
  }

  function drawBox(cx, cy, hw, hh, H, desc, isSetback) {
    const roof = isSetback ? desc.roof : desc.roof;
    // right face
    ctx.fillStyle = desc.body;
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh - H); ctx.lineTo(cx + hw, cy - H); ctx.closePath(); ctx.fill();
    // left face (darker)
    ctx.fillStyle = desc.bodyDark;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh - H); ctx.lineTo(cx - hw, cy - H); ctx.closePath(); ctx.fill();
    // roof
    drawDiamond(cx, cy - H, hw, hh, roof, 'rgba(0,0,0,0.25)');
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // back-to-front: increasing (c + r)
    const order = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push([c, r]);
    order.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));

    for (const [c, r] of order) {
      const zone = zoneAt(c, r);
      if (!zone) continue;
      const s = worldToScreen(c, r);
      const cx = s.x, cy = s.y + tileH() / 2;
      const isHover = hover && hover.c === c && hover.r === r;
      // ground
      drawDiamond(cx, cy, tileW() / 2, tileH() / 2,
        isHover ? shade(zone.color, 30) : shade(zone.color, -60),
        'rgba(10,10,12,0.6)');
      // building (skip streets)
      if (zone.id !== 'road') {
        const desc = Buildings.getSync(zone, parcelKey(c, r));
        drawBuilding(cx, cy, desc);
      }
    }
    if (onHoverInfo) onHoverInfo(hover ? infoFor(hover.c, hover.r) : null);
  }

  function infoFor(c, r) {
    const zone = zoneAt(c, r);
    if (!zone || zone.id === 'road') return null;
    const rnd = mulberry32(hashStr(parcelKey(c, r)));
    return {
      zone: zone.name, zoneKr: zone.kr, color: zone.color,
      did: `did:noesis:genesis:parcel-${c}-${r}`,
      audits: Math.floor(rnd() * 40),
      coord: `(${c}, ${r})`,
    };
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function centerCamera() {
    const rect = canvas.getBoundingClientRect();
    cam.x = rect.width / 2;
    cam.y = rect.height / 2 - (rows + cols) * tileH() / 4;
  }

  function bind() {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (drag) { cam.x = drag.camx + (mx - drag.x); cam.y = drag.camy + (my - drag.y); render(); return; }
      hover = screenToTile(mx, my); render();
    });
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      drag = { x: e.clientX - rect.left, y: e.clientY - rect.top, camx: cam.x, camy: cam.y };
    });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('mouseleave', () => { hover = null; render(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      cam.zoom = Math.max(0.4, Math.min(3, cam.zoom * f));
      render();
    }, { passive: false });
  }

  return {
    init(canvasEl, gridData, hoverCb) {
      canvas = canvasEl; ctx = canvas.getContext('2d');
      grid = gridData; rows = grid.layout.length; cols = grid.layout[0].length;
      onHoverInfo = hoverCb;
      bind(); resize(); centerCamera(); render();
      window.addEventListener('resize', () => { resize(); });
    },
    show() { resize(); centerCamera(); render(); },
    catalogSize() { return Buildings.catalogSize(); },
  };
})();
