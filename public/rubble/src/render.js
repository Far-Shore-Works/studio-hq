// Canvas drawing for the Toybox look: bright flat sky, rounded green hills, chunky wooden
// slingshot, chunky blocks. All flat fills with a dark-blue ink outline; no gradients.
import { C } from './palette.js';
import { CELL } from './tower.js';
import { ANCHOR_H } from './physics.js';
import { drawObject } from './sprites.js';

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

/** One block, drawn with its lower-left corner at (sx, sy_bottom) in screen px. */
export function drawBlock(ctx, v, px, lw) {
  const w = v.w * px, h = v.h * px;
  const m = v.key ? { fill: C.gold, edge: C.goldDark } : MAT[v.tier];
  ctx.save();
  ctx.globalAlpha = v.alpha === undefined ? 1 : v.alpha;
  ctx.translate(v.sx + w / 2, v.sy - h / 2);
  if (v.rot) ctx.rotate(v.rot);
  const x = -w / 2 + lw / 2, y = -h / 2 + lw / 2, bw = w - lw, bh = h - lw;
  roundRect(ctx, x, y, bw, bh, px * 0.18);
  ctx.fillStyle = m.fill; ctx.fill();
  ctx.save(); ctx.clip();
  if (v.key) {
    // nothing extra: the star does the talking
  } else if (v.tier === 1) {
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha *= 0.65;
    ctx.beginPath(); ctx.moveTo(x + bw * 0.15, y + bh); ctx.lineTo(x + bw * 0.45, y); ctx.lineTo(x + bw * 0.6, y); ctx.lineTo(x + bw * 0.3, y + bh); ctx.closePath(); ctx.fill();
  } else if (v.tier === 2) {
    ctx.strokeStyle = m.edge; ctx.lineWidth = lw * 0.7; ctx.globalAlpha *= 0.55;
    for (let i = 1; i < v.h * 2; i++) { ctx.beginPath(); ctx.moveTo(x, y + (bh * i) / (v.h * 2)); ctx.lineTo(x + bw, y + (bh * i) / (v.h * 2)); ctx.stroke(); }
  } else {
    ctx.fillStyle = m.edge; ctx.globalAlpha *= 0.4;
    for (let i = 0; i < v.w * v.h * 3; i++) {
      const fx = ((i * 37 + v.id * 11) % 100) / 100, fy = ((i * 53 + v.id * 7) % 100) / 100;
      ctx.beginPath(); ctx.arc(x + fx * bw, y + fy * bh, px * 0.05, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  roundRect(ctx, x, y, bw, bh, px * 0.18);
  ctx.lineWidth = lw; ctx.strokeStyle = C.ink; ctx.stroke();
  if (v.key) {
    starPath(ctx, 0, 0, Math.min(w, h) * 0.3, Math.min(w, h) * 0.13);
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.stroke();
  }
  if (v.crack > 0) {
    ctx.strokeStyle = C.ink; ctx.lineWidth = lw * 0.8; ctx.lineCap = 'round';
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
  // sun and clouds (screen-anchored with slight parallax)
  ctx.beginPath(); ctx.arc(W * 0.84, H * 0.085 + 6, Math.min(W, H) * 0.055, 0, TAU); ctx.fillStyle = C.sun; ctx.fill();
  const par = (f) => -cam.cx * ppm * f;
  for (const [fx, fy, s] of [[0.15, 0.1, 1], [0.5, 0.18, 0.8], [0.72, 0.07, 0.7], [1.05, 0.14, 0.9]]) {
    const cx = ((fx * W + par(0.08) + (S.time || 0) * 3) % (W + 160) + (W + 160)) % (W + 160) - 80, cy = H * fy + 30;
    const cw = 80 * s;
    ctx.fillStyle = C.cloud; roundRect(ctx, cx - cw / 2, cy, cw, 24 * s, 12 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - cw * 0.12, cy, 18 * s, 0, TAU); ctx.arc(cx + cw * 0.14, cy - 4 * s, 22 * s, 0, TAU); ctx.fill();
  }
  // a few birds
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, 2.4 * Math.min(1.6, u)); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = ((((S.time || 0) * (14 + i * 5) + i * 160) % (W + 120)) + W + 120) % (W + 120) - 60, by = H * (0.22 + i * 0.05) + Math.sin((S.time || 0) * 1.3 + i) * 6;
    const f = Math.sin((S.time || 0) * 7 + i * 2) * 5;
    ctx.beginPath(); ctx.moveTo(bx - 9, by + f * 0.3); ctx.quadraticCurveTo(bx - 4, by - 5 - f, bx, by); ctx.quadraticCurveTo(bx + 4, by - 5 - f, bx + 9, by + f * 0.3); ctx.stroke();
  }
  // hills
  const hs = Math.max(0.6, ppm / 14);
  for (const [fx, R, rise] of [[0.1, 150, 70], [0.55, 190, 90], [1.0, 140, 60]]) hill(ctx, ((fx * W + par(0.15)) % (W + 300) + W + 300) % (W + 300) - 150, gy, R * hs, C.hillFar, rise * hs);
  for (const [fx, R, rise] of [[0.0, 120, 40], [0.4, 160, 55], [0.82, 130, 38], [1.2, 150, 45]]) hill(ctx, ((fx * W + par(0.35)) % (W + 300) + W + 300) % (W + 300) - 150, gy, R * hs, C.hillMid, rise * hs);
  // ground
  ctx.fillStyle = C.ground; ctx.fillRect(-20, gy, W + 40, H - gy + 20);
  ctx.fillStyle = C.hillNear; ctx.fillRect(-20, gy, W + 40, 10 * u);
  ctx.fillStyle = C.dirt; ctx.fillRect(-20, gy + 56 * u, W + 40, H);
  ctx.fillStyle = C.dirtDark; for (let i = 0; i < 24; i++) { const x = ((i * 97) % (W + 60)) - 20, y = gy + 50 * u + ((i * 41) % 90) * u * 0.5; ctx.beginPath(); ctx.arc(x, y, 3 * u, 0, TAU); ctx.fill(); }
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
  // slingshot
  drawSling(ctx, S, sx, sy, u);
  // projectile
  if (S.proj && S.proj.show) {
    const size = S.proj.size * u;
    drawObject(ctx, S.proj.id, sx(S.proj.x), sy(S.proj.y), size, S.proj.rot || 0);
  }
  // particles
  for (const p of S.particles || []) drawParticle(ctx, p, sx, sy, u);
  ctx.restore();
}

export function anchorScreen(S) {
  const { W, gy, cam } = S;
  return { x: W / 2 + (0 - cam.cx) * cam.ppm, y: gy - ANCHOR_H * cam.ppm };
}

function drawSling(ctx, S, sx, sy, u) {
  const ax = sx(0), ay = sy(ANCHOR_H);
  const fork = 1.0 * S.cam.ppm, forkTop = ay - 0.7 * S.cam.ppm;
  const trunkW = Math.max(12, 1.1 * S.cam.ppm), gyy = S.gy;
  const pouch = S.aim && S.aim.pouch ? S.aim.pouch : { x: ax, y: ay };
  const R = Math.max(7, 0.45 * S.cam.ppm);
  // far band + far fork arm
  const band = (tipX, tipY) => { ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(pouch.x, pouch.y); ctx.lineWidth = Math.max(3.5, 0.2 * S.cam.ppm); ctx.lineCap = 'round'; ctx.strokeStyle = C.band; ctx.stroke(); };
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
  // object in the pouch (between the bands)
  if (S.aim && S.aim.obj && S.aim.visible) {
    drawObject(ctx, S.aim.obj.id, pouch.x, pouch.y, S.aim.size * u);
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
