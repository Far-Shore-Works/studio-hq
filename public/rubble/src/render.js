// Canvas drawing for the Toybox look: bright flat sky, rounded green hills, chunky wooden
// slingshot, chunky blocks. All flat fills with a dark-blue ink outline; no gradients.
import { C } from './palette.js';
import { CELL } from './tower.js';
import { ANCHOR_H } from './physics.js';
import { drawObject } from './sprites.js';
import { drawDummy } from './dummy.js';

export const TAU = Math.PI * 2;

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

export function starPath(ctx, cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, rad = i % 2 ? r : R;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const MAT = {
  1: { fill: C.glass, edge: C.glassDark },
  2: { fill: C.plank, edge: C.plankDark },
  3: { fill: C.stone, edge: C.stoneDark },
};

/** One block, drawn with its lower-left corner at (sx, sy_bottom) in screen px. Each material has its own texture. */
export function drawBlock(ctx, v, px, lw) {
  const w = v.w * px, h = v.h * px;
  const m = v.key ? { fill: C.gold, edge: C.goldDark } : MAT[v.tier];
  const id = v.id === undefined ? 0 : v.id;
  const rnd = (k) => { const x = Math.sin((id + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  ctx.save();
  ctx.globalAlpha = v.alpha === undefined ? 1 : v.alpha;
  ctx.translate(v.sx + w / 2, v.sy - h / 2);
  if (v.rot) ctx.rotate(v.rot);
  const x = -w / 2 + lw / 2, y = -h / 2 + lw / 2, bw = w - lw, bh = h - lw, rad = px * 0.18;
  roundRect(ctx, x, y, bw, bh, rad);
  ctx.fillStyle = m.fill; ctx.fill();
  ctx.save(); ctx.clip();
  const a0 = ctx.globalAlpha;
  const band = (yy, hh, col, al) => { ctx.globalAlpha = a0 * al; ctx.fillStyle = col; ctx.fillRect(x, yy, bw, hh); ctx.globalAlpha = a0; };
  if (v.key) {
    band(y, bh * 0.22, '#FFF0A6', 0.85); band(y + bh * 0.8, bh * 0.2, m.edge, 0.45);
    ctx.globalAlpha = a0 * 0.55; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(x + bw * 0.12, y + bh); ctx.lineTo(x + bw * 0.38, y); ctx.lineTo(x + bw * 0.5, y); ctx.lineTo(x + bw * 0.24, y + bh); ctx.closePath(); ctx.fill(); ctx.globalAlpha = a0;
  } else if (v.tier === 1) {            // glass: pale pane, inner frame, two shine streaks, a sparkle
    band(y + bh * 0.78, bh * 0.22, m.edge, 0.28);
    roundRect(ctx, x + bw * 0.07, y + bh * 0.1, bw * 0.86, bh * 0.8, rad * 0.6); ctx.globalAlpha = a0 * 0.4; ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.lineWidth = lw * 0.55; ctx.strokeStyle = m.edge; ctx.globalAlpha = a0 * 0.5; ctx.stroke(); ctx.globalAlpha = a0;
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = a0 * 0.8;
    ctx.beginPath(); ctx.moveTo(x + bw * 0.14, y + bh); ctx.lineTo(x + bw * 0.42, y); ctx.lineTo(x + bw * 0.56, y); ctx.lineTo(x + bw * 0.28, y + bh); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + bw * 0.64, y + bh); ctx.lineTo(x + bw * 0.8, y); ctx.lineTo(x + bw * 0.86, y); ctx.lineTo(x + bw * 0.7, y + bh); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = a0;
  } else if (v.tier === 2) {            // wood: lighter top, darker underside, grain, a knot, nails
    band(y, bh * 0.16, '#FBE0A4', 0.85); band(y + bh * 0.82, bh * 0.18, m.edge, 0.4);
    ctx.strokeStyle = m.edge; ctx.lineWidth = Math.max(1, lw * 0.5); ctx.lineCap = 'round'; ctx.globalAlpha = a0 * 0.5;
    const rows = Math.max(2, Math.round(v.h * 3));
    for (let r = 1; r < rows; r++) {
      const yy = y + (bh * r) / rows, a = rnd(r) * 6;
      ctx.beginPath(); ctx.moveTo(x, yy);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x + (bw * k) / 6, yy + Math.sin(a + k * 1.3) * bh * 0.025);
      ctx.stroke();
    }
    ctx.globalAlpha = a0 * 0.8;
    const kx = x + bw * (0.25 + rnd(9) * 0.5), ky = y + bh * (0.35 + rnd(10) * 0.3);
    ctx.beginPath(); ctx.ellipse(kx, ky, bw * 0.045, bh * 0.1, 0, 0, TAU); ctx.fillStyle = '#C98B3F'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(kx, ky, bw * 0.02, bh * 0.045, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a0; ctx.fillStyle = '#8E5A2B';
    for (const nx of [x + bw * 0.08, x + bw * 0.92]) for (const ny of [y + bh * 0.2, y + bh * 0.8]) { ctx.beginPath(); ctx.arc(nx, ny, Math.max(1.2, px * 0.045), 0, TAU); ctx.fill(); }
  } else {                              // stone: lit top-left edge, dark underside, speckles, hairline cracks, sometimes moss
    band(y, bh * 0.13, '#DCE3EC', 0.85); band(y + bh * 0.84, bh * 0.16, m.edge, 0.5);
    ctx.globalAlpha = a0 * 0.14; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, bw * 0.1, bh);
    ctx.globalAlpha = a0 * 0.45; ctx.fillStyle = m.edge;
    for (let i = 0; i < v.w * v.h * 4; i++) { ctx.beginPath(); ctx.arc(x + rnd(20 + i) * bw, y + bh * (0.18 + rnd(50 + i) * 0.64), px * (0.02 + rnd(80 + i) * 0.035), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = a0 * 0.3; ctx.strokeStyle = m.edge; ctx.lineWidth = Math.max(1, lw * 0.5);
    ctx.beginPath(); const cx0 = x + bw * (0.2 + rnd(3) * 0.5), cy0 = y + bh * 0.25; ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + bw * 0.06, cy0 + bh * 0.2); ctx.lineTo(cx0 - bw * 0.02, cy0 + bh * 0.4); ctx.stroke();
    ctx.globalAlpha = a0;
    if (rnd(5) > 0.55) { ctx.fillStyle = '#7FC47A'; ctx.beginPath(); ctx.ellipse(x + bw * (0.15 + rnd(6) * 0.6), y + bh * 0.04, bw * 0.13, bh * 0.1, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + bw * (0.28 + rnd(6) * 0.6), y + bh * 0.03, bw * 0.07, bh * 0.07, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  roundRect(ctx, x, y, bw, bh, rad);
  ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
  if (v.key) {
    starPath(ctx, 0, 0, Math.min(w, h) * 0.3, Math.min(w, h) * 0.13);
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.stroke();
  }
  if (v.crack > 0) {
    ctx.strokeStyle = C.ink; ctx.lineWidth = lw * 0.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = v.crack;
    ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.4); ctx.lineTo(w * 0.05, -h * 0.1); ctx.lineTo(-w * 0.08, h * 0.08);
    if (k > 1) { ctx.moveTo(w * 0.05, -h * 0.1); ctx.lineTo(w * 0.3, -h * 0.02); ctx.lineTo(w * 0.26, h * 0.3); }
    if (k > 2) { ctx.moveTo(-w * 0.08, h * 0.08); ctx.lineTo(-w * 0.3, h * 0.2); ctx.moveTo(-w * 0.2, -h * 0.3); ctx.lineTo(-w * 0.4, -h * 0.2); }
    ctx.stroke();
  }
  ctx.restore();
}

function hill(ctx, cx, gy, R, col, rise) {
  ctx.beginPath(); ctx.arc(cx, gy + R - rise, R, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// tile a shape across the screen with parallax: fn(x) draws one copy centred at screen x
function tiled(ctx, W, cam, f, period, fn) {
  const off = -cam.cx * cam.ppm * f;
  const first = Math.floor((-period - off) / period);
  for (let k = first; k * period + off < W + period; k++) fn(k * period + off, k);
}
const frac = (n) => { const x = Math.sin(n * 91.345) * 43758.5453; return x - Math.floor(x); };

function drawBackdrop(ctx, S, u) {
  const { W, H, gy, cam } = S, ppm = cam.ppm, t = S.time || 0;
  const hs = Math.max(0.6, Math.min(2.2, ppm / 14));
  // sun with a halo
  const sr = Math.min(W, H) * 0.055;
  ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.beginPath(); ctx.arc(W * 0.84, H * 0.085 + 6, sr * 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(W * 0.84, H * 0.085 + 6, sr, 0, TAU); ctx.fill();
  // clouds drift and barely follow the camera
  for (const [fx, fy, s] of [[0.15, 0.1, 1], [0.5, 0.18, 0.8], [0.72, 0.07, 0.7], [1.05, 0.14, 0.9]]) {
    const cx = ((fx * W - cam.cx * ppm * 0.03 + t * 3) % (W + 160) + (W + 160)) % (W + 160) - 80, cy = H * fy + 30, cw = 80 * s;
    ctx.fillStyle = C.cloud; roundRect(ctx, cx - cw / 2, cy, cw, 24 * s, 12 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - cw * 0.12, cy, 18 * s, 0, TAU); ctx.arc(cx + cw * 0.14, cy - 4 * s, 22 * s, 0, TAU); ctx.fill();
  }
  // birds
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, 2.4 * Math.min(1.6, u)); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = ((((t) * (14 + i * 5) + i * 160) % (W + 120)) + W + 120) % (W + 120) - 60, by = H * (0.22 + i * 0.05) + Math.sin(t * 1.3 + i) * 6;
    const f = Math.sin(t * 7 + i * 2) * 5;
    ctx.beginPath(); ctx.moveTo(bx - 9, by + f * 0.3); ctx.quadraticCurveTo(bx - 4, by - 5 - f, bx, by); ctx.quadraticCurveTo(bx + 4, by - 5 - f, bx + 9, by + f * 0.3); ctx.stroke();
  }
  // far mountains with snow caps
  const mp = 430 * hs;
  tiled(ctx, W, cam, 0.05, mp, (x, k) => {
    for (const [dx, hh, ww] of [[0, 170, 150], [mp * 0.55, 120, 120]]) {
      const bx = x + dx, hgt = hh * hs * (0.85 + frac(k + dx) * 0.3), ww2 = ww * hs;
      ctx.beginPath(); ctx.moveTo(bx - ww2, gy); ctx.lineTo(bx - 8 * hs, gy - hgt); ctx.quadraticCurveTo(bx, gy - hgt - 10 * hs, bx + 8 * hs, gy - hgt); ctx.lineTo(bx + ww2, gy); ctx.closePath();
      ctx.fillStyle = '#B7D4EE'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 8 * hs - (hgt * 0.22) * 0.9, gy - hgt * 0.78); ctx.lineTo(bx - 8 * hs, gy - hgt); ctx.quadraticCurveTo(bx, gy - hgt - 10 * hs, bx + 8 * hs, gy - hgt); ctx.lineTo(bx + 8 * hs + hgt * 0.2, gy - hgt * 0.8); ctx.lineTo(bx + hgt * 0.07, gy - hgt * 0.7); ctx.lineTo(bx - hgt * 0.03, gy - hgt * 0.8); ctx.lineTo(bx - hgt * 0.1, gy - hgt * 0.7); ctx.closePath();
      ctx.fillStyle = '#F4FAFF'; ctx.fill();
    }
  });
  // far hills with a windmill
  const fp = 760 * hs;
  tiled(ctx, W, cam, 0.12, fp, (x, k) => {
    hill(ctx, x, gy, 190 * hs, C.hillFar, 90 * hs); hill(ctx, x + fp * 0.62, gy, 140 * hs, C.hillFar, 62 * hs);
    if (frac(k + 3) > 0.35) {                          // windmill on the left hill
      const mx = x + 6 * hs, my = gy - 84 * hs, mh = 30 * hs;
      ctx.beginPath(); ctx.moveTo(mx - 9 * hs, my + 2); ctx.lineTo(mx - 6 * hs, my - mh); ctx.lineTo(mx + 6 * hs, my - mh); ctx.lineTo(mx + 9 * hs, my + 2); ctx.closePath(); ctx.fillStyle = '#F7EBD2'; ctx.fill(); ctx.lineWidth = 2 * Math.min(1.5, u); ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.save(); ctx.translate(mx, my - mh); ctx.rotate(t * 0.6);
      for (let b = 0; b < 4; b++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(2 * hs, -2.2 * hs, 22 * hs, 4.4 * hs); ctx.strokeRect(2 * hs, -2.2 * hs, 22 * hs, 4.4 * hs); }
      ctx.restore(); ctx.beginPath(); ctx.arc(mx, my - mh, 3.5 * hs, 0, TAU); ctx.fillStyle = C.red; ctx.fill(); ctx.stroke();
    }
  });
  // mid hills with round trees
  const mp2 = 560 * hs;
  tiled(ctx, W, cam, 0.25, mp2, (x, k) => {
    hill(ctx, x, gy, 150 * hs, C.hillMid, 50 * hs); hill(ctx, x + mp2 * 0.5, gy, 120 * hs, C.hillMid, 40 * hs);
    for (const [dx, sc] of [[-20, 1], [10, 0.8], [mp2 * 0.5 + 24, 0.9], [mp2 * 0.5 + 54, 0.7]]) {
      const tx = x + dx * hs, ty = gy - (36 + frac(k * 7 + dx) * 12) * hs, ts = sc * hs;
      ctx.fillStyle = '#8E5A2B'; ctx.fillRect(tx - 2.5 * ts, ty - 8 * ts, 5 * ts, 14 * ts);
      ctx.beginPath(); ctx.arc(tx, ty - 18 * ts, 12 * ts, 0, TAU); ctx.fillStyle = '#4FB35C'; ctx.fill(); ctx.lineWidth = 2 * Math.min(1.5, u); ctx.strokeStyle = '#2E8B4E'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx - 4 * ts, ty - 22 * ts, 4 * ts, 0, TAU); ctx.fillStyle = '#6FCB78'; ctx.fill();
    }
  });
  // near hill band
  const np = 460 * hs;
  tiled(ctx, W, cam, 0.4, np, (x) => { hill(ctx, x, gy, 120 * hs, C.hillNear, 24 * hs); hill(ctx, x + np * 0.55, gy, 100 * hs, C.hillNear, 18 * hs); });
}

function drawGround(ctx, S, u) {
  const { W, H, gy, cam } = S, ppm = cam.ppm;
  const sx = (x) => W / 2 + (x - cam.cx) * ppm;
  // grass in three lanes (a little perspective), then the soil
  ctx.fillStyle = C.ground; ctx.fillRect(-20, gy, W + 40, 56 * u);
  ctx.fillStyle = '#6FC26A'; ctx.fillRect(-20, gy, W + 40, 12 * u);
  ctx.fillStyle = '#4EA553'; ctx.fillRect(-20, gy + 34 * u, W + 40, 22 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-20, gy, W + 40, 3 * u);
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, 2 * Math.min(1.6, u)); ctx.beginPath(); ctx.moveTo(-20, gy); ctx.lineTo(W + 20, gy); ctx.stroke();
  // soil layers
  const sy0 = gy + 56 * u;
  ctx.fillStyle = C.dirt; ctx.fillRect(-20, sy0, W + 40, H);
  ctx.fillStyle = '#AC7C4B'; ctx.fillRect(-20, sy0 + 26 * u, W + 40, 22 * u);
  ctx.fillStyle = '#85582F'; ctx.fillRect(-20, sy0 + 78 * u, W + 40, H);
  // scalloped grass edge hanging over the soil
  ctx.fillStyle = '#4EA553';
  for (let x = -((-cam.cx * ppm) % (22 * u)) - 22 * u; x < W + 30; x += 22 * u) { ctx.beginPath(); ctx.arc(x + 11 * u, sy0 - 1, 11 * u, 0, Math.PI); ctx.fill(); }
  ctx.strokeStyle = 'rgba(47,75,110,0.45)'; ctx.lineWidth = Math.max(1, 1.5 * Math.min(1.6, u));
  ctx.beginPath(); for (let x = -((-cam.cx * ppm) % (22 * u)) - 22 * u; x < W + 30; x += 22 * u) { ctx.moveTo(x, sy0); ctx.arc(x + 11 * u, sy0 - 1, 11 * u, Math.PI, 0, true); } ctx.stroke();
  // pebbles and little buried treasures, fixed in the world
  const per = 9;
  for (let i = Math.floor((cam.cx - W / 2 / ppm) / per) - 1; i * per < cam.cx + W / 2 / ppm + per; i++) {
    for (let n = 0; n < 4; n++) {
      const x = sx((i + frac(i * 4 + n)) * per), y = sy0 + (8 + frac(i * 9 + n * 3) * 100) * u, r = (2.5 + frac(i + n) * 3) * u;
      if (n === 3 && frac(i) > 0.5) { // a bone
        ctx.save(); ctx.translate(x, y); ctx.rotate(frac(i * 3) * 3); ctx.fillStyle = '#F5EBD3'; ctx.strokeStyle = '#6B4524'; ctx.lineWidth = Math.max(1, u);
        ctx.beginPath(); ctx.rect(-9 * u, -1.8 * u, 18 * u, 3.6 * u); ctx.fill(); ctx.stroke();
        for (const sgn of [-1, 1]) for (const dy of [-2.6, 2.6]) { ctx.beginPath(); ctx.arc(sgn * 9 * u, dy * u, 2.6 * u, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else { ctx.fillStyle = n % 2 ? C.dirtDark : '#B58D63'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r, 0, 0, TAU); ctx.fill(); }
    }
  }
}

/** The whole scene. S carries everything that changes frame to frame. */
export function drawScene(ctx, S) {
  const { W, H, gy, cam } = S;
  const ppm = cam.ppm;
  const sx = (x) => W / 2 + (x - cam.cx) * ppm;
  const sy = (y) => gy - y * ppm;
  const u = Math.max(1, ppm / 12);              // size unit that scales with zoom
  ctx.save();
  if (S.shake) ctx.translate(S.shake.x, S.shake.y);
  ctx.fillStyle = C.sky; ctx.fillRect(-20, -20, W + 40, H + 40);
  drawBackdrop(ctx, S, u);
  drawGround(ctx, S, u);
  for (let i = -2; i < 120; i++) {
    const x = i * 1.9 + ((i * 53) % 11) * 0.17, X = sx(x);
    if (X < -20 || X > W + 20) continue;
    const m5 = ((x % 5) + 5) % 5;
    if (m5 < 1.1 || m5 > 3.9 + 0.2 && m5 > 3.95) continue;       // keep clear of the distance numbers
    const k = (i * 29) % 7, y = gy + (7 + ((i * 17) % 3) * 9) * u;
    if (k === 0 || k === 3) { ctx.fillStyle = '#4FB35C'; for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(X + d * 4 * u - 2.5 * u, y); ctx.lineTo(X + d * 4 * u, y - (8 - Math.abs(d) * 2) * u); ctx.lineTo(X + d * 4 * u + 2.5 * u, y); ctx.fill(); } }
    else if (k === 1 || k === 5) {
      ctx.strokeStyle = '#3FA24E'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(X, y + 3 * u); ctx.lineTo(X, y - 6 * u); ctx.stroke();
      const col = k === 1 ? '#FFFFFF' : '#FF8FA3';
      ctx.fillStyle = col; for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.arc(X + Math.cos(a * 1.2566) * 3.4 * u, y - 7 * u + Math.sin(a * 1.2566) * 3.4 * u, 2.5 * u, 0, TAU); ctx.fill(); }
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(X, y - 7 * u, 2.2 * u, 0, TAU); ctx.fill();
    }
  }
  // distance ticks
  ctx.font = `800 ${Math.max(9, 10 * u)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`; ctx.textAlign = 'center';
  const step = ppm < 9 ? 10 : 5;
  const x0m = Math.ceil((cam.cx - W / 2 / ppm) / step) * step;
  for (let m = Math.max(0, x0m); sx(m) < W + 10; m += step) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx(m) - 1, gy + 1, 2, 7 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillText(`${m}`, sx(m), gy + 20 * u);
  }
  // distance bracket on the grass: slingshot to tower
  const T = S.tower0;
  if (T && S.bracket) {
    const x1 = sx(0), x2 = sx(T.x0), yb = gy + 33 * u;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x2, yb); ctx.stroke();
    for (const x of [x1, x2]) { ctx.beginPath(); ctx.moveTo(x, yb - 6 * u); ctx.lineTo(x, yb + 6 * u); ctx.stroke(); }
    const mx = (x1 + x2) / 2, label = `${Math.round(T.x0)} m`;
    ctx.font = `900 ${14 * u}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 18 * u;
    roundRect(ctx, mx - tw / 2, yb - 12 * u, tw, 24 * u, 12 * u); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(label, mx, yb + 5 * u);
  }
  // wind streaks
  if (S.wind) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
    const dir = S.wind > 0 ? 1 : -1;
    for (let i = 0; i < 5; i++) {
      const y = gy - (12 + i * 11) * u * 1.1, off = (((S.time || 0) * 90 * dir * (0.6 + 0.2 * i)) % (W + 60)) + i * 83;
      const x = (((off % (W + 60)) + (W + 60)) % (W + 60)) - 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * 34 * u, y); ctx.stroke();
    }
  }
  // bushes behind the action, tufts and flowers on the grass in front
  for (let i = -2; i < 70; i++) {
    const x = i * 3.3 + ((i * 37) % 7) * 0.25, X = sx(x);
    if (X < -40 || X > W + 40) continue;
    const tw0 = S.tower0 ? S.tower0.x0 : 99, tw1 = S.tower0 ? S.tower0.x0 + S.tower0.width * CELL : 99;
    if (Math.abs(x) < 2.6 || (x > tw0 - 2.4 && x < tw1 + 2.4)) continue;
    if ((i * 13) % 5 === 0) {
      const r = (13 + ((i * 7) % 5) * 2) * u;
      ctx.fillStyle = '#4FB35C'; ctx.strokeStyle = '#2E8B4E'; ctx.lineWidth = 2 * u;
      for (const [dx, dy, k] of [[-0.9, 0.1, 0.7], [0.9, 0.1, 0.75], [0, -0.35, 1]]) { ctx.beginPath(); ctx.arc(X + dx * r, gy - 4 * u - dy * r - r * 0.35 * k, r * 0.62 * k, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#4FB35C'; ctx.beginPath(); ctx.arc(X, gy - 4 * u - r * 0.5, r * 0.55, 0, TAU); ctx.fill();
    }
  }
  // soft shadows on the grass
  if (S.tower0) { const t0 = S.tower0, a = sx(t0.x0) - 0.4 * ppm, b = sx(t0.x0 + t0.width * CELL) + 1.4 * ppm; ctx.fillStyle = 'rgba(30,80,50,0.22)'; ctx.beginPath(); ctx.ellipse((a + b) / 2, gy + 9 * u, (b - a) / 2, 7 * u, 0, 0, TAU); ctx.fill(); }
  if (S.proj && S.proj.show) { const hgt = Math.max(0, S.proj.y), k = 1 / (1 + hgt * 0.12), rr = S.proj.size * ppm * 0.45 * k; ctx.fillStyle = `rgba(30,80,50,${0.26 * k})`; ctx.beginPath(); ctx.ellipse(sx(S.proj.x), gy + 8 * u, rr * 1.2, rr * 0.28, 0, 0, TAU); ctx.fill(); }
  // stone slab under the tower
  if (S.tower0) {
    const t0 = S.tower0, x1 = sx(t0.x0) - 0.5 * ppm, x2 = sx(t0.x0 + t0.width * CELL) + 0.5 * ppm, h = 0.32 * ppm;
    roundRect(ctx, x1, gy - h * 0.55, x2 - x1, h + 0.55 * h, h * 0.4); ctx.fillStyle = '#9FB3C8'; ctx.fill(); ctx.lineWidth = Math.max(2, ppm * 0.07); ctx.strokeStyle = C.ink; ctx.stroke();
  }
  // tower
  const px = CELL * ppm, lw = Math.max(1.5, px * 0.09);
  if (S.blocks) for (const v of S.blocks) {
    if (v.alpha === 0) continue;
    drawBlock(ctx, { ...v, sx: sx(S.tower0.x0 + v.x * CELL), sy: sy(v.y * CELL) }, px, lw);
  }
  // rubble left on the ground by earlier throws, then the dummies, then flying chunks
  for (const c of S.debris || []) drawDebris(ctx, c, sx, sy, ppm);
  for (const d of S.dummies || []) drawDummy(ctx, d.pose, sx, sy, ppm, d.face, 1, d.role);
  if (S.ghost) drawGhost(ctx, S.ghost, sx, sy, u, ppm);
  for (const c of S.chunks || []) drawChunk(ctx, c, sx, sy, ppm);
  // slingshot
  drawSling(ctx, S, sx, sy, u);
  // projectile
  if (S.proj && S.proj.show) {
    drawObject(ctx, S.proj.id, sx(S.proj.x), sy(S.proj.y), S.proj.size * ppm, S.proj.rot || 0, S.proj.sq);
  }
  // particles
  for (const p of S.particles || []) drawParticle(ctx, p, sx, sy, u);
  ctx.restore();
  if (S.flash > 0.01) { ctx.save(); ctx.globalAlpha = Math.min(0.6, S.flash); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

/** Last throw's path, left on the screen as dots so the next throw is an adjustment. */
function drawGhost(ctx, g, sx, sy, u, ppm) {
  const pts = g.real; if (!pts || pts.length < 2) return;
  ctx.save();
  const step = Math.max(1.0, 20 / ppm);
  let acc = 0; const r = Math.max(2.6, 0.13 * ppm);
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(47,75,110,0.85)'; ctx.lineWidth = Math.max(1.2, r * 0.35);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    if (acc >= step) { acc = 0; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), r, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
  if (g.hit) { starPath(ctx, sx(g.hit.x), sy(g.hit.y), r * 3, r * 1.3, 8, 0); ctx.fillStyle = 'rgba(255,210,63,0.9)'; ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function drawChunk(ctx, c, sx, sy, ppm) {
  ctx.save(); ctx.globalAlpha = c.alpha;
  ctx.beginPath(); c.verts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)))); ctx.closePath();
  ctx.fillStyle = c.fill; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, ppm * 0.045); ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}
function drawDebris(ctx, c, sx, sy, ppm) {
  ctx.save(); ctx.beginPath();
  c.verts.forEach(([x, y], i) => { const X = sx(c.x + x), Y = sy(c.y + y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath();
  ctx.fillStyle = c.fill; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, ppm * 0.04); ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}

export function anchorScreen(S) {
  const { W, gy, cam } = S;
  return { x: W / 2 + (0 - cam.cx) * cam.ppm, y: gy - ANCHOR_H * cam.ppm };
}

function drawSling(ctx, S, sx, sy, u) {
  const ax = sx(0), ay = sy(ANCHOR_H);
  const fork = 1.0 * S.cam.ppm, forkTop = ay - 0.7 * S.cam.ppm;
  const trunkW = Math.max(14, 1.35 * S.cam.ppm), gyy = S.gy;
  const stretch = (S.aim && S.aim.stretch) || 0;
  const pouch = S.aim && S.aim.pouch ? S.aim.pouch : { x: ax, y: ay };
  const R = Math.max(7, 0.45 * S.cam.ppm);
  // far band + far fork arm
  const band = (tipX, tipY) => { ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(pouch.x, pouch.y); ctx.lineWidth = Math.max(3.5, 0.22 * S.cam.ppm) * (1 - 0.5 * stretch); ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = Math.max(2, 0.14 * S.cam.ppm) * (1 - 0.5 * stretch); ctx.strokeStyle = stretch > 0.6 ? '#C2503C' : C.band; ctx.stroke(); };
  const arm = (tx) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay + 0.1 * S.cam.ppm); ctx.lineTo(tx, forkTop); ctx.lineWidth = trunkW * 0.82 + 5; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay + 0.1 * S.cam.ppm); ctx.lineTo(tx, forkTop); ctx.lineWidth = trunkW * 0.82; ctx.strokeStyle = C.wood; ctx.stroke();
  };
  arm(ax - fork); band(ax - fork, forkTop);
  // trunk
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, gyy + 2); ctx.lineTo(ax, ay + 0.2 * S.cam.ppm); ctx.lineWidth = trunkW + 5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax, gyy + 2); ctx.lineTo(ax, ay + 0.2 * S.cam.ppm); ctx.lineWidth = trunkW; ctx.strokeStyle = C.wood; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax - trunkW * 0.18, gyy - 4); ctx.lineTo(ax - trunkW * 0.18, ay + 0.5 * S.cam.ppm); ctx.lineWidth = Math.max(2, trunkW * 0.14); ctx.strokeStyle = C.woodDark; ctx.stroke();
  arm(ax + fork);
  // the leather pouch, then the object in it (between the bands)
  if (S.aim && S.aim.pouch && (S.aim.visible || S.aim.empty)) {
    const pr = Math.max(8, 0.34 * S.cam.ppm), ang = Math.atan2(ay - pouch.y, ax - pouch.x);
    ctx.save(); ctx.translate(pouch.x, pouch.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 0.9, pr * 1.25, 0, 0, TAU); ctx.fillStyle = '#9A5A33'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-pr * 0.1, -pr * 0.2, pr * 0.4, pr * 0.7, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
    ctx.restore();
  }
  if (S.aim && S.aim.obj && S.aim.visible) {
    drawObject(ctx, S.aim.obj.id, pouch.x, pouch.y, S.aim.size * S.cam.ppm, 0, S.aim.sq);
  }
  band(ax + fork, forkTop);
  // fork tips
  for (const tx of [ax - fork, ax + fork]) { ctx.beginPath(); ctx.arc(tx, forkTop, R, 0, TAU); ctx.fillStyle = C.woodDark; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); }
  // dashed no-air arc
  if (S.aim && S.aim.arc) {
    const pts = S.aim.arc;
    ctx.save();
    ctx.setLineDash([Math.max(8, 8 * u), Math.max(7, 7 * u)]); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.lineWidth = Math.max(5, 5 * u); ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.55; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = Math.max(3, 3 * u); ctx.strokeStyle = C.dash; ctx.stroke();
    ctx.restore();
  }
  // reveal paths: the real path (solid) over the no-air arc (dashed)
  if (S.reveal) {
    const { real, ghost, hit } = S.reveal;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([Math.max(8, 8 * u), Math.max(7, 7 * u)]);
    ctx.beginPath(); ghost.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.lineWidth = Math.max(5, 5 * u); ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.5; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = Math.max(3, 3 * u); ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); real.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.lineWidth = Math.max(6, 6 * u); ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.lineWidth = Math.max(3.5, 3.5 * u); ctx.strokeStyle = C.red; ctx.stroke();
    ctx.restore();
    if (hit) { starPath(ctx, sx(hit.x), sy(hit.y), 11 * u, 5 * u, 8, 0); ctx.fillStyle = C.gold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); }
  }
  // pull band lines when pulling are drawn above via band(); nothing more
}

function drawParticle(ctx, p, sx, sy, u) {
  const a = Math.max(0, Math.min(1, p.life / p.max));
  ctx.save(); ctx.globalAlpha = p.kind === 'puff' ? a * 0.9 : Math.min(1, a * 2.2);
  const x = sx(p.x), y = sy(p.y);
  if (p.kind === 'chip') {
    ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.col; const s = p.size * u;
    roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.25); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; ctx.stroke();
  } else if (p.kind === 'dust') {
    const r = p.size * u * (0.7 + (1 - a) * 1.1);
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#F4E6C8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, TAU); ctx.fill();
  } else if (p.kind === 'splinter') {
    ctx.translate(x, y); ctx.rotate(p.rot); const L = p.size * u * 1.7, T = Math.max(2, p.size * u * 0.32);
    roundRect(ctx, -L / 2, -T / 2, L, T, T * 0.4); ctx.fillStyle = C.plank; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = C.plankDark; ctx.stroke();
  } else if (p.kind === 'shard') {
    ctx.translate(x, y); ctx.rotate(p.rot); const s = p.size * u;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.6); ctx.lineTo(-s * 0.6, s * 0.4); ctx.closePath();
    ctx.fillStyle = '#E2F6FF'; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = C.glassDark; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(s * 0.25, s * 0.1); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (p.kind === 'glint') {
    const s = p.size * u * Math.sin(Math.PI * (1 - a)) * 0.9 + 0.5;
    ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.22 : s; const ang = (i / 8) * TAU; i ? ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); }
    ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = C.glassDark; ctx.stroke();
  } else if (p.kind === 'ring') {
    const r = p.size * u * (0.5 + (1 - a) * 2.2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = (5 * a + 1) * Math.min(1.5, u); ctx.strokeStyle = C.ink; ctx.globalAlpha = a * 0.8; ctx.stroke();
    ctx.lineWidth = (2.6 * a + 0.5) * Math.min(1.5, u); ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = a; ctx.stroke();
  } else if (p.kind === 'rays') {
    ctx.translate(x, y); ctx.rotate(p.rot); ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * TAU, r0 = p.size * u * (0.5 + (1 - a) * 1.1), r1 = r0 + p.size * u * (0.5 + a * 0.5);
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineWidth = 5 * u * 0.6; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 2.6 * u * 0.6; ctx.strokeStyle = '#FFE27A'; ctx.stroke();
    }
  } else if (p.kind === 'puff') {
    ctx.beginPath(); ctx.arc(x, y, p.size * u * (1.4 - a * 0.6), 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  } else if (p.kind === 'star') {
    starPath(ctx, x, y, p.size * u * (0.6 + (1 - a)), p.size * u * 0.35, 5, p.rot); ctx.fillStyle = C.gold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
  } else if (p.kind === 'burst') {
    const s = p.size * u * (0.4 + (1 - a) * 1.2);
    starPath(ctx, x, y, s, s * 0.5, 8, 0); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  } else if (p.kind === 'text') {
    ctx.font = `900 ${p.size * u}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 5 * u * 0.5; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col || '#FFFFFF'; ctx.fillText(p.text, x, y);
  }
  ctx.restore();
}

/** Small picture of a tower's current state (results screen and share image). */
export function drawTowerPicture(ctx, tower, ox, oy, cell, opts = {}) {
  // oy is the ground line. Gone blocks are drawn as faint outlines.
  const lw = Math.max(1.5, cell * 0.09);
  for (const b of tower.blocks) {
    if (!b.alive) {
      if (opts.ghosts === false) continue;
      ctx.save(); ctx.globalAlpha = 0.28; ctx.setLineDash([4, 4]);
      roundRect(ctx, ox + b.c0 * cell + 1, oy - (b.r0 + b.h) * cell + 1, b.w * cell - 2, b.h * cell - 2, cell * 0.18);
      ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.restore();
    }
  }
  for (const b of tower.blocks) {
    if (!b.alive) continue;
    drawBlock(ctx, { ...b, x: b.c, y: b.r, sx: ox + b.c * cell, sy: oy - b.r * cell, alpha: 1, crack: b.hp < b.hp0 * 0.5 ? 2 : b.hp < b.hp0 * 0.85 ? 1 : 0 }, cell, lw);
  }
}
