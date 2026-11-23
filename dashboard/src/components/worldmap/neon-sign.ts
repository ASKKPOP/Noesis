/**
 * neon-sign — the station's neon signage (512×128) and the district's name labels, drawn
 * on a canvas. Shared by both renderers: the three.js scenes make sprites of them, the Bevy
 * scenes (viz-rs) ask for their pixels through `renderSign` / `renderLabel`.
 */
export function drawNeonSign(text: string, hex: number): HTMLCanvasElement {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d')!; const col = '#' + hex.toString(16).padStart(6, '0');
    x.shadowColor = col; x.shadowBlur = 26; x.strokeStyle = col; x.lineWidth = 5;
    x.beginPath(); (x as CanvasRenderingContext2D).roundRect(14, 18, 484, 92, 18); x.stroke();
    x.font = 'bold 52px "JetBrains Mono",Menlo,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = col; x.fillText(text, 256, 66);
    return c;
}

/** A name label or act sign over a Nous in the district: text on a dark plate. */
export function drawLabel(text: string, size: number, color: string): HTMLCanvasElement {
    const c = document.createElement('canvas'); const ctx = c.getContext('2d')!;
    ctx.font = `600 ${size}px sans-serif`; c.width = Math.ceil(ctx.measureText(text).width) + 24; c.height = size + 20;
    ctx.font = `600 ${size}px sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2,6,16,.72)'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = color; ctx.fillText(text, c.width / 2, c.height / 2 + 1);
    return c;
}
