// Hand-drawn flat object sprites for the Toybox look. Each one draws inside a box of
// width w and height h centred on (0,0). No images, no downloads: all vector shapes.
// Style: chunky ink outline, flat fills, one flat shade shape and one shine on each.
import { C } from './palette.js';

const TAU = Math.PI * 2;
const SHADE = 'rgba(47,75,110,0.20)', SHADE2 = 'rgba(47,75,110,0.32)';
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fillStroke(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function dot(ctx, x, y, r, col) { circle(ctx, x, y, r); ctx.fillStyle = col; ctx.fill(); }
function line(ctx, pts, lw, col = C.ink) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
/** Filled ball with a flat crescent shade at the lower right and a glint at the upper left. */
function ball(ctx, r, fill, lw, o = {}) {
  circle(ctx, 0, 0, r); ctx.fillStyle = fill; ctx.fill();
  ctx.save(); circle(ctx, 0, 0, Math.max(0.1, r - lw * 0.4)); ctx.clip();
  if (!o.noShade) { ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.arc(-r * 0.3, -r * 0.3, r * 1.05, 0, TAU); ctx.fillStyle = o.shade || SHADE; ctx.fill('evenodd'); }
  if (o.inside) o.inside();
  ctx.restore();
  circle(ctx, 0, 0, r); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
  if (!o.noShine) { ctx.save(); ctx.translate(-r * 0.38, -r * 0.4); ctx.rotate(-0.7); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.2, r * 0.1, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); ctx.restore(); dot(ctx, -r * 0.17, -r * 0.6, r * 0.05, 'rgba(255,255,255,0.85)'); }
}

// aspect = width / height of each sprite
export const ASPECT = { piano: 1.35, fridge: 0.5, anvil: 1.7, tire: 1, block: 2, pillow: 1.3 };

const ART = {
  piano(ctx, w, h, lw) {
    const ink = '#34405A', ink2 = '#46557A', ink3 = '#2A3348';
    // legs and pedals
    for (const s of [-1, 1]) { rr(ctx, s * w * 0.4 - w * 0.06, h * 0.22, w * 0.12, h * 0.28, w * 0.025); fillStroke(ctx, ink3, lw); }
    for (const s of [-1, 1]) rr(ctx, s * w * 0.1 - w * 0.045, h * 0.4, w * 0.09, h * 0.07, h * 0.03), fillStroke(ctx, C.gold, lw * 0.7);
    // cabinet
    rr(ctx, -w / 2, -h * 0.5, w, h * 0.74, h * 0.07); fillStroke(ctx, ink, lw);
    ctx.save(); rr(ctx, -w / 2 + lw, -h * 0.5 + lw, w - 2 * lw, h * 0.74 - 2 * lw, h * 0.06); ctx.clip();
    ctx.fillStyle = ink2; ctx.fillRect(-w / 2, -h * 0.5, w, h * 0.09);                       // lid
    ctx.fillStyle = ink3; ctx.fillRect(-w / 2, h * 0.14, w, h * 0.12);                       // shade at the foot
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(-w * 0.42, h * 0.26); ctx.lineTo(-w * 0.18, -h * 0.5); ctx.lineTo(-w * 0.06, -h * 0.5); ctx.lineTo(-w * 0.3, h * 0.26); ctx.fill();
    ctx.restore();
    // music rack with sheet music
    rr(ctx, -w * 0.33, -h * 0.36, w * 0.66, h * 0.3, h * 0.04); fillStroke(ctx, ink2, lw * 0.8);
    rr(ctx, -w * 0.27, -h * 0.33, w * 0.54, h * 0.23, h * 0.02); ctx.fillStyle = '#FFFDF2'; ctx.fill();
    for (let i = 0; i < 4; i++) line(ctx, [[-w * 0.24, -h * 0.29 + i * h * 0.045], [w * 0.24, -h * 0.29 + i * h * 0.045]], lw * 0.3, '#9DB0C8');
    for (const [x, y] of [[-0.14, 0], [-0.04, 1], [0.07, 0], [0.16, 2]]) dot(ctx, w * x, -h * 0.29 + y * h * 0.045, h * 0.02, C.ink);
    // keyboard
    rr(ctx, -w * 0.46, h * 0.02, w * 0.92, h * 0.16, h * 0.03); fillStroke(ctx, '#FFFFFF', lw * 0.9);
    for (let i = 1; i < 10; i++) line(ctx, [[-w * 0.46 + (w * 0.92 * i) / 10, h * 0.02], [-w * 0.46 + (w * 0.92 * i) / 10, h * 0.18]], lw * 0.45);
    for (const i of [1, 2, 4, 5, 6, 8, 9]) { ctx.fillStyle = C.ink; ctx.fillRect(-w * 0.46 + (w * 0.92 * i) / 10 - w * 0.02, h * 0.02, w * 0.04, h * 0.09); }
  },
  fridge(ctx, w, h, lw) {
    for (const s of [-1, 1]) { rr(ctx, s * w * 0.32 - w * 0.07, h * 0.44, w * 0.14, h * 0.06, h * 0.02); fillStroke(ctx, '#7D8DA5', lw * 0.8); }
    rr(ctx, -w / 2, -h / 2, w, h * 0.96, w * 0.16); ctx.fillStyle = '#F4F8FC'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#D5E1EE'; ctx.fillRect(w * 0.2, -h / 2, w, h);                          // flat shade on the right
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-w * 0.4, -h * 0.46, w * 0.1, h * 0.28);   // shine, top door
    ctx.fillRect(-w * 0.4, -h * 0.12, w * 0.1, h * 0.4);                                     // shine, bottom door
    ctx.restore();
    rr(ctx, -w / 2, -h / 2, w, h * 0.96, w * 0.16); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
    line(ctx, [[-w / 2, -h * 0.18], [w / 2, -h * 0.18]], lw);
    for (const [y0, y1] of [[-0.4, -0.25], [-0.12, 0.1]]) { rr(ctx, w * 0.22, h * y0, w * 0.09, h * (y1 - y0), w * 0.04); fillStroke(ctx, '#9FB1C7', lw * 0.7); }
    // a magnet and a note
    dot(ctx, -w * 0.15, -h * 0.34, w * 0.07, C.red); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.1, -h * 0.05); ctx.rotate(-0.08); rr(ctx, -w * 0.17, -h * 0.07, w * 0.34, h * 0.14, 2); ctx.fillStyle = '#FFF3A3'; ctx.fill(); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = C.ink; ctx.stroke(); line(ctx, [[-w * 0.11, -h * 0.02], [w * 0.1, -h * 0.02]], lw * 0.4); line(ctx, [[-w * 0.11, h * 0.025], [w * 0.04, h * 0.025]], lw * 0.4); ctx.restore();
  },
  anvil(ctx, w, h, lw) {
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(w * 0.5, -h * 0.5); ctx.lineTo(w * 0.34, -h * 0.12);
    ctx.lineTo(w * 0.2, -h * 0.06); ctx.lineTo(w * 0.28, h * 0.5); ctx.lineTo(-w * 0.28, h * 0.5); ctx.lineTo(-w * 0.2, -h * 0.06);
    ctx.lineTo(-w * 0.3, -h * 0.12); ctx.quadraticCurveTo(-w * 0.5, -h * 0.14, -w * 0.5, -h * 0.5); ctx.closePath(); ctx.fillStyle = '#6A788D'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#8DA0B8'; ctx.fillRect(-w * 0.6, -h * 0.5, w * 1.2, h * 0.2);        // lit top face
    ctx.fillStyle = SHADE2; ctx.fillRect(w * 0.1, -h * 0.5, w, h);                         // shade on the right
    ctx.fillStyle = SHADE; ctx.fillRect(-w * 0.6, h * 0.32, w * 1.2, h * 0.2);             // dark foot
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(w * 0.5, -h * 0.5); ctx.lineTo(w * 0.34, -h * 0.12); ctx.lineTo(w * 0.2, -h * 0.06); ctx.lineTo(w * 0.28, h * 0.5); ctx.lineTo(-w * 0.28, h * 0.5); ctx.lineTo(-w * 0.2, -h * 0.06); ctx.lineTo(-w * 0.3, -h * 0.12); ctx.quadraticCurveTo(-w * 0.5, -h * 0.14, -w * 0.5, -h * 0.5); ctx.closePath();
    ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
    line(ctx, [[-w * 0.4, -h * 0.4], [w * 0.2, -h * 0.4]], lw * 0.7, 'rgba(255,255,255,0.8)');
    dot(ctx, 0, h * 0.18, w * 0.03, SHADE2);
  },
  tire(ctx, w, h, lw) {
    const R = w / 2;
    circle(ctx, 0, 0, R); ctx.fillStyle = '#2B313C'; ctx.fill();
    for (let i = 0; i < 14; i++) { ctx.save(); ctx.rotate((i / 14) * TAU); rr(ctx, -R * 0.1, -R, R * 0.2, R * 0.16, R * 0.04); ctx.fillStyle = '#434C5B'; ctx.fill(); ctx.restore(); }   // tread blocks
    circle(ctx, 0, 0, R); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
    ball(ctx, R * 0.74, '#3A4250', lw * 0.8, { noShine: true, shade: SHADE2 });
    ball(ctx, R * 0.44, '#CBD5E1', lw * 0.8, { noShine: true, shade: SHADE2 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; dot(ctx, Math.cos(a) * R * 0.27, Math.sin(a) * R * 0.27, R * 0.07, '#5E6B7E'); }
    ball(ctx, R * 0.12, '#5E6B7E', lw * 0.6, { noShade: true, noShine: true });
    ctx.save(); ctx.rotate(-2.4); ctx.beginPath(); ctx.arc(0, 0, R * 0.86, -0.5, 0.35); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  },
  block(ctx, w, h, lw) {
    rr(ctx, -w / 2, -h / 2, w, h, h * 0.12); ctx.fillStyle = '#BCC4CE'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.14);
    ctx.fillStyle = SHADE; ctx.fillRect(-w / 2, h * 0.34, w, h * 0.2);
    for (let i = 0; i < 16; i++) dot(ctx, ((i * 37) % 100) / 100 * w - w / 2, ((i * 53) % 100) / 100 * h - h / 2, h * 0.018, 'rgba(47,75,110,0.28)');
    ctx.restore();
    rr(ctx, -w / 2, -h / 2, w, h, h * 0.12); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
    for (const x of [-w * 0.2, w * 0.2]) { rr(ctx, x - w * 0.12, -h * 0.2, w * 0.24, h * 0.4, h * 0.08); fillStroke(ctx, '#8794A4', lw * 0.8); rr(ctx, x - w * 0.12, -h * 0.2, w * 0.24, h * 0.14, h * 0.06); ctx.fillStyle = SHADE2; ctx.fill(); }
  },
  bowling(ctx, w, h, lw) {
    ball(ctx, w / 2, '#2E4A93', lw, { shade: 'rgba(8,15,45,0.32)', inside() {
      ctx.beginPath(); ctx.arc(w * 0.1, -w * 0.12, w * 0.5, 0.6, 2.6); ctx.lineWidth = w * 0.06; ctx.strokeStyle = 'rgba(160,190,255,0.35)'; ctx.stroke();
    } });
    for (const [x, y, r] of [[-0.06, -0.26, 0.055], [0.1, -0.2, 0.055], [0.02, -0.08, 0.06]]) dot(ctx, w * x, w * y, w * r, '#0E1830');
  },
  golf(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFFFFF', lw, { shade: 'rgba(47,75,110,0.16)', inside() {
      const R = w / 2; for (let gx = -3; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) { const x = (gx + (gy % 2 ? 0.5 : 0)) * R * 0.3, y = gy * R * 0.27; if (x * x + y * y < R * R * 0.85) dot(ctx, x, y, R * 0.06, 'rgba(120,150,185,0.45)'); }
    } });
  },
  tennis(ctx, w, h, lw) {
    ball(ctx, w / 2, '#D8F23F', lw, { shade: 'rgba(80,100,0,0.22)', inside() {
      ctx.lineWidth = lw * 1.2; ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(-w * 0.62, 0, w * 0.62, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(w * 0.62, 0, w * 0.62, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
      for (let i = 0; i < 12; i++) dot(ctx, ((i * 41) % 100) / 100 * w - w / 2, ((i * 67) % 100) / 100 * w - w / 2, w * 0.012, 'rgba(120,150,0,0.4)');
    } });
  },
  soccer(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFFFFF', lw, { shade: 'rgba(47,75,110,0.18)', inside() {
      const R = w / 2, pent = (cx, cy, r, a0) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = a0 + (i / 5) * TAU; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); };
      pent(0, 0, R * 0.2, -Math.PI / 2);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; line(ctx, [[Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2], [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5]], lw * 0.7); pent(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * 0.26, a + Math.PI / 2 * 0 + 0.3); }
    } });
  },
  volleyball(ctx, w, h, lw) {
    ball(ctx, w / 2, '#FFE066', lw, { shade: 'rgba(120,70,0,0.2)', inside() {
      ctx.beginPath(); ctx.moveTo(-w / 2, -w * 0.1); ctx.quadraticCurveTo(0, -w * 0.45, w / 2, -w * 0.05); ctx.lineTo(w / 2, w * 0.15); ctx.quadraticCurveTo(0, -w * 0.2, -w / 2, w * 0.1); ctx.closePath(); ctx.fillStyle = '#4C9BE8'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.3, w * 0.5); ctx.quadraticCurveTo(-w * 0.1, w * 0.15, w * 0.3, w * 0.12); ctx.lineTo(w * 0.5, w * 0.3); ctx.lineTo(w * 0.2, w * 0.5); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      line(ctx, [[-w * 0.3, -w * 0.45], [0, w * 0.1], [w * 0.3, w * 0.5]], lw * 0.8); line(ctx, [[-w * 0.5, w * 0.05], [-w * 0.1, w * 0.15], [w * 0.5, w * 0.12]], lw * 0.6);
    } });
  },
  basketball(ctx, w, h, lw) {
    ball(ctx, w / 2, '#F58A2E', lw, { shade: 'rgba(120,40,0,0.26)', inside() {
      line(ctx, [[-w / 2, 0], [w / 2, 0]], lw * 0.8); line(ctx, [[0, -w / 2], [0, w / 2]], lw * 0.8);
      ctx.lineWidth = lw * 0.8; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.arc(-w * 0.62, 0, w * 0.55, -1, 1); ctx.stroke(); ctx.beginPath(); ctx.arc(w * 0.62, 0, w * 0.55, Math.PI - 1, Math.PI + 1); ctx.stroke();
      for (let i = 0; i < 14; i++) dot(ctx, ((i * 43) % 100) / 100 * w - w / 2, ((i * 71) % 100) / 100 * w - w / 2, w * 0.012, 'rgba(120,40,0,0.35)');
    } });
  },
  pingpong(ctx, w, h, lw) { ball(ctx, w / 2, '#FFB347', lw, { shade: 'rgba(150,60,0,0.22)' }); },
  paperball(ctx, w, h, lw) {
    const P = [[-0.5, -0.1], [-0.3, -0.42], [0.05, -0.5], [0.4, -0.3], [0.5, 0.1], [0.28, 0.42], [-0.1, 0.5], [-0.42, 0.3]];
    const path = () => { ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); };
    path(); ctx.fillStyle = '#F8F8F2'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    const facet = (pts, col) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    facet([[0.5, 0.1], [0.28, 0.42], [-0.1, 0.5], [0.05, 0.1]], 'rgba(47,75,110,0.18)');
    facet([[-0.5, -0.1], [-0.3, -0.42], [0.05, -0.5], [-0.1, -0.15]], 'rgba(255,255,255,0.9)');
    facet([[-0.42, 0.3], [-0.1, 0.5], [0.05, 0.1], [-0.3, 0.05]], 'rgba(47,75,110,0.1)');
    line(ctx, [[-0.3 * w, -0.1 * h], [0.02 * w, 0.08 * h], [0.25 * w, -0.2 * h]], lw * 0.6, '#9FB0C6'); line(ctx, [[0.05 * w, 0.08 * h], [0.1 * w, 0.4 * h]], lw * 0.6, '#9FB0C6'); line(ctx, [[0.25 * w, -0.2 * h], [0.4 * w, -0.3 * h]], lw * 0.6, '#9FB0C6');
    ctx.restore();
    path(); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
  },
  pillow(ctx, w, h, lw) {
    const path = () => { ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.4); ctx.quadraticCurveTo(0, -h * 0.62, w / 2, -h * 0.4); ctx.quadraticCurveTo(w * 0.56, 0, w / 2, h * 0.4); ctx.quadraticCurveTo(0, h * 0.62, -w / 2, h * 0.4); ctx.quadraticCurveTo(-w * 0.56, 0, -w / 2, -h * 0.4); ctx.closePath(); };
    path(); ctx.fillStyle = '#EAF2FF'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = SHADE; ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.1); ctx.quadraticCurveTo(0, h * 0.34, w / 2, h * 0.05); ctx.lineTo(w / 2, h); ctx.lineTo(-w / 2, h); ctx.fill();
    ctx.fillStyle = '#BFD4F4'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * w * 0.22 - w * 0.03, -h, w * 0.06, h * 2);   // soft stripes
    ctx.restore();
    path(); ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.setLineDash([h * 0.07, h * 0.06]); ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.28); ctx.quadraticCurveTo(0, -h * 0.46, w * 0.4, -h * 0.28); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = '#7E9ACB'; ctx.stroke(); ctx.setLineDash([]);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { dot(ctx, sx * w * 0.5, sy * h * 0.4, h * 0.07, '#FF8FA3'); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.ink; ctx.stroke(); }
    ctx.save(); ctx.translate(-w * 0.28, -h * 0.28); ctx.rotate(-0.4); ctx.beginPath(); ctx.ellipse(0, 0, w * 0.1, h * 0.05, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.restore();
  },
};

/** Draw object `id` centred at (x,y); size is the bigger side in pixels. sq = { ang, k } squashes (k<0) or stretches (k>0) along ang. */
export function drawObject(ctx, id, x, y, size, rot = 0, sq = null) {
  const a = ASPECT[id] || 1;
  const w = a >= 1 ? size : size * a, h = a >= 1 ? size / a : size;
  ctx.save(); ctx.translate(x, y);
  if (sq && Math.abs(sq.k) > 0.01) { const f = 1 + sq.k; ctx.rotate(sq.ang); ctx.scale(f, 1 / f); ctx.rotate(rot - sq.ang); } else ctx.rotate(rot);
  (ART[id] || ART.bowling)(ctx, w, h, Math.max(1.5, size * 0.05));
  ctx.restore();
}
export const hasSprite = (id) => id in ART;
