/**
 * neon-sign — the station's neon signage, drawn on a 512×128 canvas. Shared by both
 * renderers of the orbital map: the three.js scene makes a sprite of it, the Bevy scene
 * (viz-rs) asks for its pixels through `renderSign`.
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
