// Day calibration: set each material's toughness from what the day's three objects can do.
//
// Toughness is in joules and is hidden from players; they see glass, wood and stone. The
// weakest object of the day is just able to break glass, the middle one wood, the strongest
// stone. So a ping-pong ball day is as playable as a piano day.
import { simulate, heightAt, fsqrt, PULL_MAX } from './physics.js';
import { CELL } from './tower.js';

// Whole-number launch directions, about 20 to 55 degrees (no trig needed).
export const DIRS = [[940, 342], [906, 423], [866, 500], [819, 574], [766, 643], [707, 707], [643, 766], [574, 819]];
export const ALPHA = { 1: 0.8, 2: 0.7, 3: 0.8 };
export const LIMITS = { woodMin: 0, woodMax: 1e9, glassMin: 0, glassMax: 1e9, step: 1.5 };

/** Speed state where the path crosses x: {y, vx, vy} or null. */
export function stateAt(path, x) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.x <= x && b.x >= x && b.x > a.x) {
      const f = (x - a.x) / (b.x - a.x);
      return { y: a.y + f * (b.y - a.y), vx: a.vx + f * (b.vx - a.vx), vy: a.vy + f * (b.vy - a.vy) };
    }
  }
  return null;
}

/** Pull length along (dx,dy) that crosses x at height y; null when it cannot. */
export function pullToCross(obj, dx, dy, x, y, opts = {}) {
  const len = fsqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const pull = (L) => ({ px: Math.round(ux * L), py: Math.round(uy * L) });
  const h = (L) => {
    const p = pull(L);
    return heightAt(simulate(obj, p.px, p.py, opts).path, x);
  };
  const top = h(PULL_MAX);
  if (top === null) return null;
  if (top < y) return null;               // even a full pull passes below that point
  let lo = 0, hi = PULL_MAX;
  for (let i = 0; i < 22; i++) {
    const mid = 0.5 * (lo + hi);
    const hm = h(mid);
    if (hm === null || hm < y) lo = mid; else hi = mid;
  }
  return pull(hi);
}

/** Typical impact energy (J) of an object at the tower front: median over sensible shots. */
export function typicalEnergy(obj, x0, towerHeightCells, opts = {}) {
  const y = (towerHeightCells * CELL) / 2;
  const es = [];
  for (const [dx, dy] of DIRS) {
    const p = pullToCross(obj, dx, dy, x0, y, opts);
    if (!p) continue;
    const s = stateAt(simulate(obj, p.px, p.py, opts).path, x0);
    if (s) es.push(0.5 * obj.mass * (s.vx * s.vx + s.vy * s.vy));
  }
  if (es.length === 0) {                   // cannot even reach: use a full flat pull
    const sim = simulate(obj, 966, 259, opts);
    const s = stateAt(sim.path, Math.min(x0, sim.landX * 0.99)) || sim.path[sim.path.length - 1];
    return 0.5 * obj.mass * (s.vx * s.vx + s.vy * s.vy);
  }
  es.sort((a, b) => a - b);
  return es[Math.floor(es.length / 2)];
}

/** hpByTier for a day: {1, 2, 3} in joules. */
export function calibrate(objs, x0, towerHeightCells, opts = {}) {
  const e = objs.map((o) => typicalEnergy(o, x0, towerHeightCells, opts)).sort((a, b) => a - b);
  const n = e.length;
  const hp1 = ALPHA[1] * e[0];
  const hp2 = Math.max(ALPHA[2] * e[Math.floor((n - 1) / 2) === 0 ? 1 : Math.floor((n - 1) / 2)], LIMITS.step * hp1);
  const hp3 = Math.max(ALPHA[3] * e[n - 1], LIMITS.step * hp2);
  return { 1: hp1, 2: hp2, 3: hp3, energies: e };
}
