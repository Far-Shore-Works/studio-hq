// Turns a throw result into a timed animation plan, and answers "what does everything look
// like at time t?". Cosmetic only: every outcome was already decided by tower.js.
import { C } from './palette.js';
import { CELL } from './tower.js';
import { G } from './physics.js';

const WAVE = 0.62;

export function buildPlan(res, towerBefore) {
  const imp = res.impact;
  const lastT = res.flight.path[res.flight.path.length - 1].t;
  const plan = { res, tc: imp ? imp.time : null, flightEnd: lastT, items: [], byBlock: new Map(), end: lastT + 0.9 };
  const push = (it) => { plan.items.push(it); if (!plan.byBlock.has(it.id)) plan.byBlock.set(it.id, []); plan.byBlock.get(it.id).push(it); };
  if (!imp) return plan;
  let at = imp.time + 0.04;
  for (const e of res.events) if (e.k === 'hit') { push({ ...e, at }); at += 0.09; }
  const base = at + 0.4;
  const falls = new Map();
  for (const e of res.events) if (e.k === 'fall') {
    const rows = Math.max(1, e.from - e.to), side = e.toC !== e.fromC;
    const it = { ...e, at: base + (e.wave - 1) * WAVE, d: (side ? 0.45 : 0.22) + 0.1 * rows };
    falls.set(`${e.id}|${e.wave}`, it); push(it);
  }
  for (const e of res.events) {
    if (e.k === 'break') {
      const f = falls.get(`${e.id}|${e.wave}`);
      push({ ...e, at: f ? f.at + f.d : base + (e.wave - 1) * WAVE + (e.cause === 'tip' ? 0.05 : 0.3) });
    } else if (e.k === 'dmg') {
      const f = falls.get(`${e.id}|${e.wave}`);
      push({ ...e, at: f ? f.at + f.d : base + (e.wave - 1) * WAVE + 0.3 });
    }
  }
  let end = at;
  for (const it of plan.items) end = Math.max(end, it.at + (it.d || 0));
  plan.end = end + 0.75;
  for (const list of plan.byBlock.values()) list.sort((a, b) => a.at - b.at);
  return plan;
}

export const crackLevel = (hp, hp0) => { const f = 1 - hp / hp0; return f < 0.12 ? 0 : f < 0.4 ? 1 : f < 0.7 ? 2 : 3; };

/** Visual state of every block of `towerBefore` at plan time t. */
export function blockViews(towerBefore, plan, t) {
  const out = [];
  for (const b of towerBefore.blocks) {
    if (!b.alive) continue;
    const v = { id: b.id, x: b.c, y: b.r, w: b.w, h: b.h, tier: b.tier, key: b.key, alpha: 1, rot: 0, crack: crackLevel(b.hp, b.hp0) };
    const list = plan ? plan.byBlock.get(b.id) : null;
    if (list) for (const e of list) {
      if (t < e.at) break;
      if (e.k === 'hit') { if (e.broken) { v.alpha = 0; break; } v.crack = crackLevel(e.hpAfter, b.hp0); }
      else if (e.k === 'dmg') v.crack = crackLevel(e.hp, b.hp0);
      else if (e.k === 'break') { v.alpha = 0; break; }
      else if (e.k === 'fall') {
        if (t >= e.at + e.d) { v.x = e.toC; v.y = e.to; v.rot = 0; }
        else {
          const p = (t - e.at) / e.d, k = p * p;
          v.x = e.fromC + (e.toC - e.fromC) * k; v.y = e.from + (e.to - e.from) * k;
          v.rot = (e.toC - e.fromC) * 0.25 * Math.sin(p * Math.PI) + 0.05 * Math.sin(p * 9);
        }
      }
    }
    out.push(v);
  }
  return out;
}

/** Position of the projectile at plan time t, with rest/bounce after contact. */
export function projectileAt(plan, obj, t, g = G) {
  const path = plan.res.flight.path;
  const imp = plan.res.impact;
  const along = (pth, tt) => {
    if (tt <= 0) return pth[0];
    for (let i = 1; i < pth.length; i++) {
      if (pth[i].t >= tt) { const a = pth[i - 1], b = pth[i], f = (tt - a.t) / (b.t - a.t || 1); return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) }; }
    }
    return pth[pth.length - 1];
  };
  const spin = (obj.size > 0.5 ? 1.5 : 7) * t;
  const rad = Math.max(0.05, Math.min(0.5, obj.size / 2)) * 0.9;
  if (!imp) { const p = along(path, t); return { ...p, rot: p.y <= 0.001 ? 0 : spin, rest: t > plan.flightEnd, y: Math.max(rad * 0.5, p.y) }; }
  if (t <= imp.time) { const p = along(path, t); return { ...p, rot: spin, rest: false }; }
  const dt = t - imp.time;
  if (plan.res.endPath) {
    const p = along(plan.res.endPath, dt);
    return { x: p.x, y: Math.max(rad * 0.5, p.y), rot: spin, rest: false };
  }
  const first = path.find((q) => q.t >= imp.time) || path[path.length - 1];
  let vx, vy, x0 = imp.x, y0 = imp.y;
  if (imp.broke === 0) { vx = -0.28 * first.vx; vy = 2 + 0.12 * Math.abs(first.vx); }
  else { vx = 0.4; vy = 0; x0 = imp.stopX; y0 = imp.stopY; }
  const y = y0 + vy * dt - 0.5 * g * dt * dt;
  if (y > rad * 0.5) return { x: x0 + vx * dt, y, rot: spin, rest: false };
  // landed: tiny second hop then rest
  const tl = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y0 - rad * 0.5)))) / g;
  const t2 = dt - tl, vy2 = 2.2;
  const y2 = vy2 * t2 - 0.5 * g * t2 * t2;
  return { x: x0 + vx * Math.min(dt, tl + 0.5), y: rad * 0.5 + Math.max(0, t2 < 0 ? 0 : y2), rot: 0, rest: true };
}

// ---- particles ---------------------------------------------------------------------------
export function makeParticles(rnd) {
  const list = [];
  const add = (p) => list.push({ rot: 0, vr: 0, g: 0, vx: 0, vy: 0, ...p, max: p.life });
  return {
    list,
    chips(x, y, col, n, dirx = 1) {
      for (let i = 0; i < n; i++) add({ kind: 'chip', x, y, vx: (rnd() * 6 - 1.5) * dirx, vy: 2 + rnd() * 6, g: 16, size: 5 + rnd() * 5, rot: rnd() * 6, vr: (rnd() - 0.5) * 14, col, life: 0.9 + rnd() * 0.5 });
    },
    puff(x, y, n = 3) { for (let i = 0; i < n; i++) add({ kind: 'puff', x: x + (rnd() - 0.5), y: y + (rnd() - 0.5), vx: (rnd() - 0.5) * 2, vy: 0.5 + rnd() * 1.5, size: 5 + rnd() * 6, life: 0.45 + rnd() * 0.25 }); },
    burst(x, y, size = 16) { add({ kind: 'burst', x, y, size, life: 0.28 }); },
    stars(x, y, n = 6) { for (let i = 0; i < n; i++) add({ kind: 'star', x, y, vx: (rnd() - 0.5) * 9, vy: 3 + rnd() * 6, g: 12, size: 7 + rnd() * 5, rot: rnd() * 6, vr: 6, life: 0.9 + rnd() * 0.4 }); },
    text(x, y, text, size = 26, col = '#FFFFFF') { add({ kind: 'text', x, y, vy: 1.4, text, size, col, life: 1.7 }); },
    update(dt) {
      for (const p of list) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
    },
  };
}

export const chipColor = (v) => (v.key ? C.gold : v.tier === 1 ? C.glass : v.tier === 2 ? C.plank : C.stone);
export { CELL };
