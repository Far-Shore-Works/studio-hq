// Rubble physics (engine carried over from the Three Throws prototype). Pure functions, no DOM, no Math.* beyond abs/floor/min/max.
//
// Fairness rule: every phone must land the object on the same spot, to the last digit.
// So the flight uses ONLY + - * / (exactly specified by IEEE 754 and identical in every
// browser), a hand-written square root made of those same operations, and a fixed time
// step that does not depend on the screen frame rate. No Math.sin / cos / pow / exp / sqrt.

export const G = 9.80665;          // standard gravity, m/s^2
export const RHO = 1.225;          // sea-level air density, kg/m^3 (ISA)
export const DT = 1 / 120;         // fixed time step, seconds
export const MAX_STEPS = 120 * 60; // a flight longer than 60 s is cut off
export const ANCHOR_H = 2.2;       // slingshot launch height above the ground, metres (a tall toy slingshot)
export const PULL_MAX = 1000;      // longest pull, in whole pull units
export const V_MAX = 30;           // launch speed at a full pull, m/s
export const MIN_PULL = 40;        // shorter pulls are treated as "never mind"

/** Square root from + - * / only (Newton's method, fixed iteration count). */
export function fsqrt(x) {
  if (!(x > 0)) return 0;
  let r = x > 1 ? x : 1;           // start at or above the root so Newton falls steadily
  for (let i = 0; i < 40; i++) r = 0.5 * (r + x / r);
  return r;
}

/** Drag constant k in a = -k |v| v, from mass, frontal area and drag coefficient. */
export function dragK(obj) {
  return (RHO * obj.cd * obj.area) / (2 * obj.mass);
}

/** Round a pull vector to whole units and clamp it to the allowed disc and quadrant. */
export function quantizePull(px, py) {
  let x = Math.round(px), y = Math.round(py);
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  const len2 = x * x + y * y;
  if (len2 > PULL_MAX * PULL_MAX) {
    const s = PULL_MAX / fsqrt(len2);
    x = Math.floor(x * s);
    y = Math.floor(y * s);
  }
  return { px: x, py: y };
}

/** Launch velocity from a whole-unit pull vector. Linear, so no trig is needed. */
export function launchVelocity(px, py) {
  const s = V_MAX / PULL_MAX;
  return { vx: px * s, vy: py * s };
}

/** The big number on screen: pull length as 0 to 100. */
export function powerNumber(px, py) {
  return Math.round(fsqrt(px * px + py * py) / (PULL_MAX / 100));
}

/** Launch angle in degrees, for display only (never feeds the physics). */
export function angleDeg(px, py) {
  return Math.round((Math.atan2(py, px) * 180) / Math.PI);
}

/**
 * Fly one object from any starting state. Classic RK4 at a fixed step. Returns the landing
 * spot (linear interpolation inside the last step), flight time, peak height, and the whole
 * path; every path point carries its velocity (vx, vy) for the collision code.
 * opts.noDrag switches drag off (same code path), opts.wind is a steady horizontal wind in
 * m/s (positive blows toward the tower), opts.g overrides gravity (moon day).
 */
export function flyFrom(obj, x0, y0, vx0, vy0, opts = {}) {
  const k = opts.noDrag ? 0 : dragK(obj);
  const wind = opts.wind || 0;
  const g = opts.g || G;
  let x = x0, y = y0, vx = vx0, vy = vy0;
  const path = [{ x, y, t: 0, vx, vy }];
  let peak = y, t = 0;
  const acc = (ux, uy) => {
    const rx = ux - wind;                    // speed relative to the moving air
    const sp = fsqrt(rx * rx + uy * uy);
    return [-k * sp * rx, -g - k * sp * uy];
  };
  for (let i = 0; i < MAX_STEPS; i++) {
    const [a1x, a1y] = acc(vx, vy);
    const k1x = vx, k1y = vy;
    const [a2x, a2y] = acc(vx + 0.5 * DT * a1x, vy + 0.5 * DT * a1y);
    const k2x = vx + 0.5 * DT * a1x, k2y = vy + 0.5 * DT * a1y;
    const [a3x, a3y] = acc(vx + 0.5 * DT * a2x, vy + 0.5 * DT * a2y);
    const k3x = vx + 0.5 * DT * a2x, k3y = vy + 0.5 * DT * a2y;
    const [a4x, a4y] = acc(vx + DT * a3x, vy + DT * a3y);
    const k4x = vx + DT * a3x, k4y = vy + DT * a3y;
    const nx = x + (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const ny = y + (DT / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    const nvx = vx + (DT / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
    const nvy = vy + (DT / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    if (ny <= 0) {
      const f = y / (y - ny);                // fraction of the step before touching ground
      const lx = x + f * (nx - x);
      const lt = t + f * DT;
      const lvx = vx + f * (nvx - vx), lvy = vy + f * (nvy - vy);
      path.push({ x: lx, y: 0, t: lt, vx: lvx, vy: lvy });
      return { landX: lx, time: lt, peak, path, landed: true, impactSpeed: fsqrt(lvx * lvx + lvy * lvy) };
    }
    x = nx; y = ny; vx = nvx; vy = nvy; t += DT;
    if (y > peak) peak = y;
    path.push({ x, y, t, vx, vy });
  }
  return { landX: x, time: t, peak, path, landed: false, impactSpeed: 0 };
}

/** Fly one object from the slingshot with a whole-unit pull. */
export function simulate(obj, px, py, opts = {}) {
  const { vx, vy } = launchVelocity(px, py);
  return flyFrom(obj, 0, ANCHOR_H, vx, vy, opts);
}

/** Closed-form flight with no air at all: the dashed arc players aim with. */
export function noAirArc(px, py, samples = 80, g = G) {
  const { vx, vy } = launchVelocity(px, py);
  const tEnd = (vy + fsqrt(vy * vy + 2 * g * ANCHOR_H)) / g;
  const landX = vx * tEnd;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (tEnd * i) / samples;
    pts.push({ x: vx * t, y: ANCHOR_H + vy * t - 0.5 * g * t * t, t });
  }
  pts[samples].y = 0;
  return { landX, time: tEnd, peak: ANCHOR_H + (vy > 0 ? (vy * vy) / (2 * g) : 0), path: pts };
}

/** Fixed table of launch directions (whole-number pull vectors) used to size the daily range. */
const PROBE_DIRS = [[966, 259], [866, 500], [707, 707], [500, 866]]; // 15, 30, 45, 60 degrees

/** Furthest this object can go at a full pull, over a few launch angles. */
const rangeCache = new Map();
export function maxRange(obj, opts = {}) {
  const ck = `${obj.id}|${opts.g || ''}|${opts.wind || ''}|${obj.mass}|${obj.area}|${obj.cd}`;
  if (rangeCache.has(ck)) return rangeCache.get(ck);
  let best = 0;
  for (const [dx, dy] of PROBE_DIRS) {
    const q = quantizePull(dx, dy);
    const r = simulate(obj, q.px, q.py, opts).landX;
    if (r > best) best = r;
  }
  rangeCache.set(ck, best);
  return best;
}

/**
 * Teaching helper: along the same launch direction the player used, which pull length
 * would have hit the target dead on? Bisection on the (monotonic) range. Returns the
 * power number 0..100, or null when even a full pull cannot reach.
 */
export function powerToHit(obj, px, py, targetX, opts = {}) {
  const len = fsqrt(px * px + py * py);
  if (len === 0) return null;
  const ux = px / len, uy = py / len;
  const at = (L) => simulate(obj, Math.round(ux * L), Math.round(uy * L), opts).landX;
  if (at(PULL_MAX) < targetX) return null;
  let lo = 0, hi = PULL_MAX;
  for (let i = 0; i < 24; i++) {
    const mid = 0.5 * (lo + hi);
    if (at(mid) < targetX) lo = mid; else hi = mid;
  }
  return Math.round(hi / (PULL_MAX / 100));
}

/** Height of a path where it crosses x (linear between samples), or null if it never gets there. */
export function heightAt(path, x) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.x <= x && b.x >= x && b.x > a.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return null;
}
