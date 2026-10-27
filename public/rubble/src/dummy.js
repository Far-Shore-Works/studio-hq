// Little crash-test dummies that stand on the tower. Cosmetic only: they never touch the score.
// Friendly and cartoony: they go limp and flop when their block is hit or falls, with swirly
// dizzy eyes and no injuries. Poses are plain data { head, torso, armL, armR, legL, legR }, each
// { x, y, a } (centre in metres, y up; a = clockwise screen angle in radians).
import { CELL } from './tower.js';
import { makeRng, hash32 } from './daily.js';

const K = 1.9;     // dummies are drawn bigger than life so they read on a phone
export const D = { hr: 0.19 * K, tw: 0.36 * K, th: 0.44 * K, al: 0.4 * K, aw: 0.13 * K, ll: 0.44 * K, lw: 0.17 * K };
export const LIMITS = [['head', [-0.9, 0.9]], ['armL', [-2.7, 2.7]], ['armR', [-2.7, 2.7]], ['legL', [-1.35, 1.1]], ['legR', [-1.1, 1.35]]];
const PARTS = ['legL', 'legR', 'torso', 'head', 'armL', 'armR'];
const INK = '#2F4B6E';
const CRASH = { skin: '#FFE45C', skinD: '#E0B71E', torso: '#FFE45C', arm: '#FFE45C', armEnd: INK, leg: '#FFE45C', legEnd: '#3A4559' };
const FORE = { skin: '#FFCBA4', skinD: '#E7A878', torso: '#FF8A3D', arm: '#FF8A3D', armEnd: '#FFCBA4', leg: '#4568B5', legEnd: '#3A4559' };
let PAL = CRASH;

// local (lx, ly: y up) -> world offset for a part turned clockwise by a
const rot = (lx, ly, a) => ({ x: lx * Math.cos(a) + ly * Math.sin(a), y: -lx * Math.sin(a) + ly * Math.cos(a) });

/** Forward kinematics: a whole pose from a torso centre and joint angles. */
export function poseFrom(cx, cy, ang) {
  const { hr, tw, th, al, ll } = D;
  const A0 = ang.torso || 0;
  const pt = (lx, ly) => { const r = rot(lx, ly, A0); return { x: cx + r.x, y: cy + r.y }; };
  const neck = pt(0, th / 2 - (0.03 * K));
  const ah = ang.head || 0, hh = rot(0, hr * 0.78, A0 + ah);
  const limb = (anchor, len, a) => { const r = rot(0, -(len / 2 - (0.03 * K)), a); return { x: anchor.x + r.x, y: anchor.y + r.y, a }; };
  const shL = pt(-(tw / 2 - 0.02 * K), th / 2 - 0.09 * K), shR = pt(tw / 2 - 0.02 * K, th / 2 - 0.09 * K);
  const hpL = pt(-tw * 0.27, -(th / 2 - (0.03 * K))), hpR = pt(tw * 0.27, -(th / 2 - (0.03 * K)));
  return {
    torso: { x: cx, y: cy, a: A0 },
    head: { x: neck.x + hh.x, y: neck.y + hh.y, a: A0 + ah },
    armL: limb(shL, al, A0 + (ang.armL || 0)), armR: limb(shR, al, A0 + (ang.armR || 0)),
    legL: limb(hpL, ll, A0 + (ang.legL || 0)), legR: limb(hpR, ll, A0 + (ang.legR || 0)),
  };
}

/** Lowest point of a pose (metres). */
export function poseBottom(p) {
  let lo = Infinity;
  for (const k of PARTS) {
    const q = p[k];
    const hy = k === 'head' ? D.hr : Math.abs((k.startsWith('leg') ? D.lw : k.startsWith('arm') ? D.aw : D.tw) / 2 * Math.sin(q.a)) + Math.abs(((k.startsWith('leg') ? D.ll : k.startsWith('arm') ? D.al : D.th) / 2) * Math.cos(q.a));
    if (q.y - hy < lo) lo = q.y - hy;
  }
  return lo;
}
const shift = (p, dx, dy) => { const o = {}; for (const k of PARTS) o[k] = { ...p[k], x: p[k].x + dx, y: p[k].y + dy }; return o; };

/** Standing pose with its feet at (x, base). */
export function standPose(x, base, t = 0, o = {}) {
  const sway = Math.sin(t * 1.7 + (o.phase || 0)) * 0.025;
  const wave = o.wave ? Math.sin(t * 12) * 0.25 - 2.45 : null;      // right arm up and waving
  const worry = o.worry ? 0.55 : 0;
  const p = poseFrom(x, 0, { torso: sway, head: -sway * 0.7, armL: 0.14 + worry + sway, armR: wave === null ? -0.14 - worry + sway : wave, legL: 0.05, legR: -0.05 });
  return shift(p, 0, base - poseBottom(p));
}
const LY = [
  { torso: 1.38, head: 0.3, armL: 1.9, armR: -2.3, legL: -0.7, legR: 0.35 },
  { torso: -1.5, head: -0.35, armL: 2.6, armR: -1.2, legL: 0.5, legR: -0.7 },
  { torso: 1.25, head: 0.1, armL: 0.6, armR: -2.8, legL: -1.0, legR: 0.9 },
];
/** A limp pose lying at (x, base). `seed` picks one of a few flops. */
export function lyingPose(x, base, seed = 0) {
  const p = poseFrom(x, 0, LY[Math.abs(seed | 0) % LY.length]);
  return shift(p, 0, base - poseBottom(p));
}

/** Top surface under x: { y, id } from the alive blocks of a tower, or the ground. */
export function supportAt(tower, x, bottom, reach = 1.0) {
  let top = 0, id = null;
  for (const b of tower.blocks) {
    if (!b.alive) continue;
    const x1 = tower.x0 + b.c * CELL, x2 = x1 + b.w * CELL, y2 = (b.r + b.h) * CELL;
    if (x > x1 + 0.1 && x < x2 - 0.1 && y2 <= bottom + reach && y2 > top) { top = y2; id = b.id; }
  }
  return { y: top, id };
}

/** Pick 1-3 blocks with a free top surface and stand a dummy on each. Deterministic from the day key. */
export function chooseDummies(tower, key) {
  const rnd = makeRng(hash32(`${key}|dummies`));
  const exposed = (b) => !tower.blocks.some((o) => o.alive && o.r === b.r + b.h && o.c < b.c + b.w && o.c + o.w > b.c);
  const alive = tower.blocks.filter((b) => b.alive && exposed(b));
  if (!alive.length) return [];
  // the foreman stands on the highest block (the gold keystone when it is on top)
  const topY = Math.max(...alive.map((b) => b.r + b.h));
  const tops = alive.filter((b) => b.r + b.h === topY);
  const host = tops.find((b) => b.key) || tops[Math.floor(rnd() * tops.length)];
  const out = [{ id: 0, role: 'foreman', host: host.id, x: tower.x0 + (host.c + host.w / 2) * CELL, base: (host.r + host.h) * CELL, state: 'stand', face: 'smug', phase: rnd() * 6.28, seed: Math.floor(rnd() * 3), pose: standPose(tower.x0 + (host.c + host.w / 2) * CELL, (host.r + host.h) * CELL) }];
  const pool = alive.filter((b) => !b.key && b.id !== host.id).sort((a, b) => b.r + b.h - (a.r + a.h) || a.c - b.c);   // high blocks first: they get knocked more
  const n = 1 + (rnd() < 0.5 ? 1 : 0);
  let tries = 0;
  while (out.length < n + 1 && pool.length && tries++ < 12) {
    const b = pool.splice(Math.floor(rnd() * rnd() * pool.length), 1)[0];
    const half = (b.w * CELL) / 2 - 0.5;
    const x = tower.x0 + b.c * CELL + (b.w * CELL) / 2 + (rnd() * 2 - 1) * Math.max(0, half) * 0.7;
    if (out.some((d) => Math.abs(d.x - x) < 1.9)) continue;
    const base = (b.r + b.h) * CELL;
    out.push({ id: out.length, role: 'dummy', host: b.id, x, base, state: 'stand', face: 'happy', phase: rnd() * 6.28, seed: Math.floor(rnd() * 3), pose: standPose(x, base) });
  }
  return out;
}

// ---- matter.js ragdoll --------------------------------------------------------------------
export function buildRagdoll(M, pose, group, filter, S) {
  const { Bodies, Body, Constraint } = M;
  const mk = (k, w, h, circle) => {
    const q = pose[k];
    const b = circle ? Bodies.circle(q.x * S, -q.y * S, w * S) : Bodies.rectangle(q.x * S, -q.y * S, w * S, h * S, { chamfer: { radius: Math.min(w, h) * 0.4 * S } });
    b.collisionFilter = { category: filter.category, mask: filter.mask, group };
    b.friction = 0.7; b.frictionStatic = 0.8; b.restitution = 0.22; b.frictionAir = 0.012; b.slop = 0.3; b.sleepThreshold = 50;
    Body.setDensity(b, 0.0009);
    Body.setAngle(b, q.a);
    b.plugin = { kind: 'dummy' };
    return b;
  };
  const r = { head: mk('head', D.hr, 0, true), torso: mk('torso', D.tw, D.th), armL: mk('armL', D.aw, D.al), armR: mk('armR', D.aw, D.al), legL: mk('legL', D.lw, D.ll), legR: mk('legR', D.lw, D.ll) };
  const j = (a, pa, b, pb) => Constraint.create({ bodyA: r[a], pointA: { x: pa[0] * S, y: pa[1] * S }, bodyB: r[b], pointB: { x: pb[0] * S, y: pb[1] * S }, length: 0, stiffness: 0.92, damping: 0.12 });
  const { hr, tw, th, al, ll } = D;
  r.constraints = [
    j('torso', [0, -th / 2 + (0.03 * K)], 'head', [0, hr * 0.78]),
    j('torso', [-(tw / 2 - 0.02 * K), -th / 2 + 0.09 * K], 'armL', [0, -(al / 2 - (0.03 * K))]),
    j('torso', [tw / 2 - 0.02 * K, -th / 2 + 0.09 * K], 'armR', [0, -(al / 2 - (0.03 * K))]),
    j('torso', [-tw * 0.27, th / 2 - (0.03 * K)], 'legL', [0, -(ll / 2 - (0.03 * K))]),
    j('torso', [tw * 0.27, th / 2 - (0.03 * K)], 'legR', [0, -(ll / 2 - (0.03 * K))]),
  ];
  r.list = [r.legL, r.legR, r.torso, r.head, r.armL, r.armR];
  return r;
}
export function ragdollPose(r, S) {
  const o = {};
  for (const k of PARTS) o[k] = { x: r[k].position.x / S, y: -r[k].position.y / S, a: r[k].angle };
  return o;
}

// ---- drawing --------------------------------------------------------------------------------------
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * Draw a dummy or the foreman. sx, sy map world metres to screen px, ppm is px per metre.
 * face: 'happy' | 'worried' | 'dizzy' (dummies), 'smug' | 'grin' | 'cheeky' | 'worried' | 'dizzy' (foreman).
 */
export function drawDummy(ctx, pose, sx, sy, ppm, face = 'happy', alpha = 1, role = 'dummy') {
  const lw = Math.max(1.6, ppm * 0.04);
  PAL = role === 'foreman' ? FORE : CRASH;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const k of PARTS) {
    const q = pose[k];
    ctx.save(); ctx.translate(sx(q.x), sy(q.y)); ctx.rotate(q.a);
    if (k === 'head') head(ctx, ppm, lw, face, role);
    else if (k === 'torso') torso(ctx, ppm, lw, role);
    else limb(ctx, ppm, lw, k.startsWith('leg'));
    ctx.restore();
  }
  ctx.restore();
}
function limb(ctx, ppm, lw, leg) {
  const w = (leg ? D.lw : D.aw) * ppm, h = (leg ? D.ll : D.al) * ppm;
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.5); ctx.fillStyle = leg ? PAL.leg : PAL.arm; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = leg ? PAL.legEnd : PAL.armEnd; ctx.fillRect(-w, h * (leg ? 0.18 : 0.26), w * 2, h);
  ctx.fillStyle = 'rgba(47,75,110,0.2)'; ctx.fillRect(w * 0.12, -h / 2, w, h); ctx.restore();
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.5); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}
function torso(ctx, ppm, lw, role) {
  const w = D.tw * ppm, h = D.th * ppm;
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.28); ctx.fillStyle = PAL.torso; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(47,75,110,0.2)'; ctx.fillRect(w * 0.14, -h / 2, w, h);
  if (role === 'foreman') {
    ctx.fillStyle = '#FFF6CF'; ctx.fillRect(-w, -h * 0.12, w * 2, h * 0.1); ctx.fillRect(-w, h * 0.14, w * 2, h * 0.1);   // hi-vis stripes
    ctx.fillStyle = INK; ctx.fillRect(-w * 0.03, -h / 2, w * 0.06, h);                                                  // vest zip
  } else { ctx.fillStyle = INK; ctx.fillRect(-w, h * 0.3, w * 2, h * 0.12); }
  ctx.restore();
  if (role !== 'foreman') {
    // the classic crash-test target on the chest
    const r = w * 0.27, cx = 0, cy = -h * 0.1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = INK; ctx.stroke();
  }
  rrect(ctx, -w / 2, -h / 2, w, h, w * 0.28); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}
function head(ctx, ppm, lw, face, role) {
  const r = D.hr * ppm;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = PAL.skin; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = PAL.skinD; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.3, r * 1.25, 0, Math.PI * 2); ctx.rect(-r * 2, -r * 2, r * 4, r * 4); ctx.fill('evenodd'); ctx.globalAlpha = 1;
  ctx.restore();
  if (role !== 'foreman') {   // cheek target
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(r * 0.62, r * 0.28); ctx.arc(r * 0.62, r * 0.28, r * 0.2, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.62, r * 0.28); ctx.arc(r * 0.62, r * 0.28, r * 0.2, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
  }
  const ex = r * 0.38, ey = -r * 0.1, er = r * 0.24;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * ex, ey, er, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = INK; ctx.stroke();
    if (face === 'dizzy') {
      ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i * 0.9, rr = er * 0.12 + (er * 0.7 * i) / 14; const x = s * ex + Math.cos(a) * rr, y = ey + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.lineWidth = lw * 0.7; ctx.stroke();
    } else if (face === 'smug') {
      ctx.beginPath(); ctx.arc(s * ex + er * 0.28, ey + er * 0.18, er * 0.46, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(s * ex, ey, Math.max(0.1, er - 1), 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = PAL.skin; ctx.fillRect(s * ex - er, ey - er, er * 2, er * 1.05); ctx.restore();   // heavy lids
      ctx.beginPath(); ctx.moveTo(s * ex - er, ey + er * 0.05); ctx.lineTo(s * ex + er, ey + er * 0.05); ctx.lineWidth = lw * 0.9; ctx.strokeStyle = INK; ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(s * ex + (face === 'worried' ? 0 : r * 0.04), ey + (face === 'worried' ? -r * 0.02 : r * 0.02), er * 0.48, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.9;
  if (face === 'worried') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * ex - s * er, ey - er * 1.5 + s * -er * 0.1); ctx.lineTo(s * ex + s * er * 0.7, ey - er * 1.9 - s * er * 0.1); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, r * 0.52, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  } else if (face === 'dizzy') {
    ctx.beginPath(); ctx.moveTo(-r * 0.32, r * 0.5); ctx.bezierCurveTo(-r * 0.15, r * 0.34, r * 0.0, r * 0.66, r * 0.15, r * 0.48); ctx.bezierCurveTo(r * 0.22, r * 0.42, r * 0.3, r * 0.5, r * 0.34, r * 0.54); ctx.stroke();
  } else if (face === 'smug') {
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(r * 0.05, r * 0.62, r * 0.42, r * 0.34); ctx.stroke();                 // smirk
    ctx.beginPath(); ctx.moveTo(-ex - er, ey - er * 1.25); ctx.lineTo(-ex + er, ey - er * 1.5); ctx.stroke();                                    // low brow
    ctx.beginPath(); ctx.moveTo(ex - er, ey - er * 1.55); ctx.quadraticCurveTo(ex, ey - er * 2.15, ex + er, ey - er * 1.75); ctx.stroke();      // raised brow
  } else if (face === 'grin' || face === 'cheeky') {
    ctx.beginPath(); ctx.moveTo(-r * 0.46, r * 0.3); ctx.quadraticCurveTo(0, r * 0.95, r * 0.46, r * 0.3); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke();
    if (face === 'cheeky') { ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.62, r * 0.17, r * 0.2, 0, 0, Math.PI); ctx.fillStyle = '#FF7E8B'; ctx.fill(); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.34, 0.25, Math.PI - 0.25); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  if (role === 'foreman') {   // hard hat with brim and a stripe
    ctx.beginPath(); ctx.moveTo(-r * 1.02, -r * 0.18); ctx.arc(0, -r * 0.18, r * 1.02, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-r * 0.2, -r * 1.3, r * 0.22, r); ctx.fillStyle = 'rgba(47,75,110,0.18)'; ctx.fillRect(r * 0.35, -r * 1.3, r, r); ctx.restore();
    rrect(ctx, -r * 1.22, -r * 0.3, r * 2.44, r * 0.22, r * 0.1); ctx.fillStyle = '#F2B600'; ctx.fill(); ctx.lineWidth = lw; ctx.stroke();
  }
}
