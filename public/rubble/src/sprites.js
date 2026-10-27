// Hand-drawn flat object sprites for the Toybox look. Each one draws inside a box of
// width w and height h centred on (0,0). No images, no downloads: all vector shapes.
import { C } from './palette.js';

const TAU = Math.PI * 2;
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fillStroke(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
function ball(ctx, r, fill, lw) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillStroke(ctx, fill, lw); }
function dot(ctx, x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); }
function line(ctx, pts, lw, col = C.ink) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
}

// aspect = width / height of each sprite
export const ASPECT = { piano: 1.35, fridge: 0.5, anvil: 1.7, tire: 1, block: 2, pillow: 1.3 };

const ART = {
  piano(ctx, w, h, lw) {
    ctx.beginPath(); rr(ctx, -w / 2, -h * 0.5, w, h * 0.62, h * 0.12); fillStroke(ctx, '#3A4559', lw);
    ctx.beginPath(); rr(ctx, -w / 2, h * 0.12, w, h * 0.16, h * 0.04); fillStroke(ctx, '#FFFFFF', lw);
    for (let i = 1; i < 7; i++) line(ctx, [[-w / 2 + (w * i) / 7, h * 0.12], [-w / 2 + (w * i) / 7, h * 0.28]], lw * 0.5);
    ctx.beginPath(); ctx.moveTo(-w * 0.38, -h * 0.42); ctx.lineTo(w * 0.38, -h * 0.42); ctx.lineTo(w * 0.28, -h * 0.1); ctx.lineTo(-w * 0.38, -h * 0.1); ctx.closePath(); ctx.fillStyle = '#566178'; ctx.fill();
    line(ctx, [[-w * 0.38, h * 0.28], [-w * 0.38, h * 0.5]], lw * 1.6); line(ctx, [[w * 0.38, h * 0.28], [w * 0.38, h * 0.5]], lw * 1.6);
  },
  fridge(ctx, w, h, lw) {
    ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, w * 0.14); fillStroke(ctx, '#F4F7FA', lw);
    line(ctx, [[-w / 2, -h * 0.18], [w / 2, -h * 0.18]], lw);
    line(ctx, [[w * 0.28, -h * 0.4], [w * 0.28, -h * 0.26]], lw * 1.6); line(ctx, [[w * 0.28, -h * 0.1], [w * 0.28, h * 0.1]], lw * 1.6);
    dot(ctx, -w * 0.18, -h * 0.34, w * 0.07, '#BFD0E3');
  },
  anvil(ctx, w, h, lw) {
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.5); ctx.lineTo(w * 0.5, -h * 0.5); ctx.lineTo(w * 0.28, -h * 0.12);
    ctx.lineTo(w * 0.2, -h * 0.12); ctx.lineTo(w * 0.26, h * 0.5); ctx.lineTo(-w * 0.26, h * 0.5); ctx.lineTo(-w * 0.2, -h * 0.12);
    ctx.lineTo(-w * 0.35, -h * 0.12); ctx.quadraticCurveTo(-w * 0.5, -h * 0.2, -w / 2, -h * 0.5); ctx.closePath(); fillStroke(ctx, '#5C6A7E', lw);
    line(ctx, [[-w * 0.4, -h * 0.36], [w * 0.4, -h * 0.36]], lw * 0.6, '#8DA0B8');
  },
  tire(ctx, w, h, lw) {
    ball(ctx, w / 2, '#39404D', lw); ball(ctx, w * 0.28, '#B8C2CF', lw * 0.8); ball(ctx, w * 0.1, '#39404D', lw * 0.6);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; line(ctx, [[Math.cos(a) * w * 0.12, Math.sin(a) * w * 0.12], [Math.cos(a) * w * 0.26, Math.sin(a) * w * 0.26]], lw * 0.7); }
  },
  block(ctx, w, h, lw) {
    ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, h * 0.12); fillStroke(ctx, '#B7BFC9', lw);
    ctx.beginPath(); rr(ctx, -w * 0.32, -h * 0.22, w * 0.24, h * 0.44, h * 0.08); ctx.fillStyle = '#8A95A3'; ctx.fill();
    ctx.beginPath(); rr(ctx, w * 0.08, -h * 0.22, w * 0.24, h * 0.44, h * 0.08); ctx.fillStyle = '#8A95A3'; ctx.fill();
  },
  bowling(ctx, w, h, lw) {
    ball(ctx, w / 2, '#2C3E78', lw); dot(ctx, -w * 0.12, -w * 0.2, w * 0.06, '#E7EEFF');
    dot(ctx, w * 0.02, -w * 0.12, w * 0.06, '#12203F'); dot(ctx, w * 0.18, -w * 0.08, w * 0.06, '#12203F'); dot(ctx, w * 0.1, w * 0.04, w * 0.06, '#12203F');
  },
  golf(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFFFFF', lw);
    for (const [x, y] of [[-0.2, -0.15], [0.05, -0.25], [0.22, -0.02], [-0.05, 0.05], [-0.25, 0.2], [0.15, 0.25]]) dot(ctx, x * w, y * w, w * 0.05, '#D5E3F2');
  },
  tennis(ctx, w, h, lw) {
    ball(ctx, w / 2, '#D6F03D', lw);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, w / 2 - lw / 2, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.arc(-w * 0.62, 0, w * 0.62, -0.9, 0.9); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.62, 0, w * 0.62, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); ctx.restore();
  },
  soccer(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFFFFF', lw);
    ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; const x = Math.cos(a) * w * 0.17, y = Math.sin(a) * w * 0.17; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; line(ctx, [[Math.cos(a) * w * 0.17, Math.sin(a) * w * 0.17], [Math.cos(a) * w * 0.36, Math.sin(a) * w * 0.36]], lw * 0.7); dot(ctx, Math.cos(a) * w * 0.4, Math.sin(a) * w * 0.4, w * 0.06, C.ink); }
  },
  volleyball(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFE066', lw);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, w / 2 - lw / 2, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-w / 2, -w * 0.1); ctx.quadraticCurveTo(0, -w * 0.45, w / 2, -w * 0.05); ctx.lineTo(w / 2, w * 0.15); ctx.quadraticCurveTo(0, -w * 0.2, -w / 2, w * 0.1); ctx.closePath(); ctx.fillStyle = '#4C9BE8'; ctx.fill();
    line(ctx, [[-w * 0.3, -w * 0.45], [0, w * 0.1], [w * 0.3, w * 0.5]], lw * 0.8); ctx.restore();
  },
  basketball(ctx, w, h, lw) {
    ball(ctx, w / 2, '#F28B30', lw);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, w / 2 - lw / 2, 0, TAU); ctx.clip();
    line(ctx, [[-w / 2, 0], [w / 2, 0]], lw * 0.8); line(ctx, [[0, -w / 2], [0, w / 2]], lw * 0.8);
    ctx.beginPath(); ctx.arc(-w * 0.62, 0, w * 0.55, -1, 1); ctx.lineWidth = lw * 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.62, 0, w * 0.55, Math.PI - 1, Math.PI + 1); ctx.stroke(); ctx.restore();
  },
  pingpong(ctx, w, h, lw) { ball(ctx, w / 2, '#FFB347', lw); dot(ctx, -w * 0.15, -w * 0.18, w * 0.12, '#FFE0B0'); },
  paperball(ctx, w, h, lw) {
    ctx.beginPath(); const pts = [[-0.5, -0.1], [-0.3, -0.42], [0.05, -0.5], [0.4, -0.3], [0.5, 0.1], [0.28, 0.42], [-0.1, 0.5], [-0.42, 0.3]];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); fillStroke(ctx, '#F7F7F2', lw);
    line(ctx, [[-0.3 * w, -0.1 * h], [0, 0.05 * h], [0.25 * w, -0.2 * h]], lw * 0.6, '#B8C1CC'); line(ctx, [[-0.1 * w, 0.3 * h], [0.15 * w, 0.1 * h]], lw * 0.6, '#B8C1CC');
  },
  pillow(ctx, w, h, lw) {
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.4); ctx.quadraticCurveTo(0, -h * 0.62, w / 2, -h * 0.4); ctx.quadraticCurveTo(w * 0.56, 0, w / 2, h * 0.4);
    ctx.quadraticCurveTo(0, h * 0.62, -w / 2, h * 0.4); ctx.quadraticCurveTo(-w * 0.56, 0, -w / 2, -h * 0.4); ctx.closePath(); fillStroke(ctx, '#E6F0FF', lw);
    line(ctx, [[-w * 0.36, -h * 0.28], [w * 0.36, -h * 0.28]], lw * 0.5, '#9DB8DD'); line(ctx, [[-w * 0.36, h * 0.28], [w * 0.36, h * 0.28]], lw * 0.5, '#9DB8DD');
  },
};

/** Draw object `id` centred at (x,y); size is the bigger side in pixels. */
export function drawObject(ctx, id, x, y, size, rot = 0) {
  const a = ASPECT[id] || 1;
  const w = a >= 1 ? size : size * a, h = a >= 1 ? size / a : size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  (ART[id] || ART.bowling)(ctx, w, h, Math.max(1.5, size * 0.055));
  ctx.restore();
}
export const hasSprite = (id) => id in ART;
