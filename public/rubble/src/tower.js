// The tower: blocks on a grid, hit points, support rules, impact damage and collapse.
//
// Everything here is arithmetic on whole-number grid cells plus the flight from physics.js,
// so every phone reaches the same final tower. The collapse ANIMATION is only a replay of
// the event list this file returns; it never decides anything.
//
// Rules in plain words:
//  1. A thrown object carries energy E = 1/2 m v^2 at the moment it first touches a block.
//  2. It breaks blocks along a straight line. Breaking a block costs that block's
//     remaining hit points out of E. If E runs out first, the block is only cracked.
//  3. A block stays up only if blocks that stand firmly under it cover at least half its
//     width (or it rests on the ground). Blocks that lose their support fall straight down
//     to the next thing under them.
//  4. A falling block hits what it lands on for 15% of its own toughness per row fallen,
//     and takes 5% of that toughness per row itself. That can break more blocks, which can
//     drop more blocks, until everything is still.
//  5. Score: how far the tower came down: block size times height, summed (the gold
//     keystone counts double); a gone block loses all its height, a dropped one loses the drop.

import { fsqrt, simulate, flyFrom } from './physics.js';

export const CELL = 1.6;            // metres per grid cell (toy scale)
export const KEY_WEIGHT = 2;
export const FALL_HIT = 0.15;       // share of a block's toughness it deals per row fallen
export const FALL_SELF = 0.05;      // share it takes per row fallen
export const PEN_COST = { v: 1 };  // breaking a block absorbs this many times its hit points of energy
export const MAX_BREAK = { v: 3 };  // an object stops after breaking this many blocks
export const HIT_RADIUS_MAX = 0.7;  // biggest hit radius an object can have, metres
const EPS = 1e-9;

export function hitRadius(obj) {
  const r = obj.size / 2;
  return r < 0.08 ? 0.08 : r > HIT_RADIUS_MAX ? HIT_RADIUS_MAX : r;
}

/** Build a tower state from a recipe. hpByTier = {1: joules, 2: ..., 3: ...}. */
export function buildTower(recipeBlocks, { x0, hpByTier, mirror = false, keyTier = null }) {
  let width = 0;
  for (const b of recipeBlocks) if (b.c + b.w > width) width = b.c + b.w;
  const blocks = recipeBlocks.map((b, i) => {
    const tier = b.key && keyTier ? keyTier : b.tier;
    const c = mirror ? width - b.c - b.w : b.c;
    return {
      id: i, c, r: b.r, w: b.w, h: b.h, c0: c, r0: b.r, tier, key: !!b.key,
      hp0: hpByTier[tier] * fsqrt(b.w * b.h), hp: hpByTier[tier] * fsqrt(b.w * b.h), alive: true,
    };
  });
  blocks.sort((a, b) => a.r - b.r || a.c - b.c);
  blocks.forEach((b, i) => { b.id = i; });
  return { x0, width, blocks };
}

export const cloneTower = (t) => JSON.parse(JSON.stringify(t));
const weightOf = (b) => b.w * b.h * (b.key ? KEY_WEIGHT : 1);

/**
 * 0..1: how far the tower has come down. Each block counts by its size (the gold keystone
 * counts double) times its height off the ground, so a block that is gone loses all of
 * its height and a block that dropped one row loses one row. Knocking the top off a tall
 * tower therefore scores more than nudging a base block.
 */
export function fractionDown(tower) {
  let before = 0, now = 0;
  for (const b of tower.blocks) {
    const w = weightOf(b);
    before += w * (b.r0 + b.h / 2);
    if (b.alive) now += w * (b.r + b.h / 2);
  }
  return before === 0 ? 0 : 1 - now / before;
}

export const alive = (tower) => tower.blocks.filter((b) => b.alive);

function overlap(a, b) {
  const lo = a.c > b.c ? a.c : b.c;
  const hi = a.c + a.w < b.c + b.w ? a.c + a.w : b.c + b.w;
  return hi > lo ? hi - lo : 0;
}

/** Which alive blocks are firmly supported? Bottom-up pass. */
export function supportedSet(tower) {
  const bs = alive(tower).sort((a, b) => a.r - b.r || a.c - b.c);
  const ok = new Set();
  for (const b of bs) {
    if (b.r === 0) { ok.add(b.id); continue; }
    let cover = 0;
    for (const s of bs) {
      if (s.r + s.h === b.r && ok.has(s.id)) cover += overlap(b, s);
    }
    if (cover * 2 >= b.w) ok.add(b.id);
  }
  return ok;
}

function cellsFree(tower, b, c, r) {
  for (const o of tower.blocks) {
    if (!o.alive || o === b) continue;
    const hx = c < o.c + o.w && o.c < c + b.w;
    const hy = r < o.r + o.h && o.r < r + b.h;
    if (hx && hy) return false;
  }
  return true;
}

/** Best landing level for block b at its current columns, given the blocks already placed. */
function landing(b, placed) {
  const below = placed.filter((s) => s.alive && s.id !== b.id && s.r + s.h <= b.r && overlap(b, s) > 0);
  if (below.length === 0) return { level: 0, supporters: [], firm: true };
  // A block cannot pass through anything, so only the highest thing under it counts.
  let top = 0;
  for (const s of below) if (s.r + s.h > top) top = s.r + s.h;
  const sup = below.filter((s) => s.r + s.h === top);
  let cover = 0;
  for (const s of sup) cover += overlap(b, s);
  // If that covers less than half its width, it tips off the edge it sits on.
  return { level: top, supporters: sup, firm: cover * 2 >= b.w };
}

/**
 * Let unsupported blocks fall (or tip off an edge) until the tower is still. Events:
 * {k:'fall', id, from, to, fromC, toC, wave} and {k:'break', id, cause, wave}.
 */
export function settle(tower, events, startWave = 1) {
  let wave = startWave;
  for (let guard = 0; guard < 60; guard++) {
    const ok = supportedSet(tower);
    const unsupported = alive(tower).filter((b) => !ok.has(b.id)).sort((a, b) => a.r - b.r || a.c - b.c);
    if (unsupported.length === 0) return wave;
    const placed = alive(tower).filter((b) => ok.has(b.id));
    for (const b of unsupported) {
      const fromR = b.r, fromC = b.c;
      let L = landing(b, placed);
      for (let tip = 0; tip < 3 && !L.firm; tip++) {
        // Slide off the side with more overhang, just far enough to clear what it sat on.
        let edgeL = Infinity, edgeR = -Infinity;
        for (const s of L.supporters) { if (s.c < edgeL) edgeL = s.c; if (s.c + s.w > edgeR) edgeR = s.c + s.w; }
        const mid2 = 2 * b.c + b.w;                      // twice the block's centre column
        const goLeftFirst = mid2 < edgeL + edgeR;        // block centre is left of the support centre
        const tries = goLeftFirst ? [edgeL - b.w, edgeR] : [edgeR, edgeL - b.w];
        let moved = false;
        for (const nc of tries) {
          if (cellsFree(tower, b, nc, b.r)) { b.c = nc; moved = true; break; }
        }
        if (!moved) { b.alive = false; events.push({ k: 'break', id: b.id, cause: 'tip', wave }); break; }
        L = landing(b, placed);
      }
      if (!b.alive) continue;
      if (!L.firm) { b.alive = false; events.push({ k: 'break', id: b.id, cause: 'tip', wave }); continue; }
      const rows = b.r - L.level;
      b.r = L.level;
      events.push({ k: 'fall', id: b.id, from: fromR, to: b.r, fromC, toC: b.c, wave });
      placed.push(b);
      if (rows > 0) {
        let total = 0;
        for (const s of L.supporters) total += overlap(b, s);
        for (const s of L.supporters) {
          s.hp -= (rows * FALL_HIT * b.hp0 * overlap(b, s)) / total;
          if (s.hp <= EPS && s.alive) { s.alive = false; events.push({ k: 'break', id: s.id, cause: 'fall', wave }); }
          else if (s.alive) events.push({ k: 'dmg', id: s.id, hp: s.hp, wave });
        }
        b.hp -= rows * FALL_SELF * b.hp0;
        if (b.hp <= EPS) { b.alive = false; events.push({ k: 'break', id: b.id, cause: 'fall', wave }); }
        else events.push({ k: 'dmg', id: b.id, hp: b.hp, wave });
      }
    }
    wave++;
  }
  return wave;
}

// ---- geometry: a segment against a block box grown by the object's radius -------------

function boxOf(tower, b, rad) {
  return {
    xmin: tower.x0 + b.c * CELL - rad, xmax: tower.x0 + (b.c + b.w) * CELL + rad,
    ymin: b.r * CELL - rad, ymax: (b.r + b.h) * CELL + rad,
  };
}

/** Entry parameter t in [0,1] where segment a->b first enters the box, or null. */
function segmentEntry(ax, ay, bx, by, box) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  if (dx === 0) { if (ax < box.xmin || ax > box.xmax) return null; }
  else {
    let ta = (box.xmin - ax) / dx, tb = (box.xmax - ax) / dx;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (dy === 0) { if (ay < box.ymin || ay > box.ymax) return null; }
  else {
    let ta = (box.ymin - ay) / dy, tb = (box.ymax - ay) / dy;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return t0;
}

/** First block the flight path touches: {block, x, y, vx, vy, time} or null. */
export function firstContact(tower, path, rad) {
  const bs = alive(tower);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    let best = null;
    for (const blk of bs) {
      const t = segmentEntry(a.x, a.y, b.x, b.y, boxOf(tower, blk, rad));
      if (t === null) continue;
      if (best === null || t < best.t || (t === best.t && (blk.r < best.blk.r || (blk.r === best.blk.r && blk.c < best.blk.c)))) best = { t, blk };
    }
    if (best) {
      const t = best.t;
      return {
        block: best.blk, time: a.t + t * (b.t - a.t),
        x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y),
        vx: a.vx + t * (b.vx - a.vx), vy: a.vy + t * (b.vy - a.vy), index: i,
      };
    }
  }
  return null;
}

/**
 * Throw one object at the tower. Returns {tower, events, impact, down, delta}.
 * The input tower is not changed. opts: {wind, g, flight} (flight = a precomputed path).
 */
export function throwAt(tower0, obj, px, py, opts = {}) {
  const tower = cloneTower(tower0);
  const before = fractionDown(tower);
  const flight = opts.flight || simulate(obj, px, py, opts);
  const rad = hitRadius(obj);
  const events = [];
  const contact = firstContact(tower, flight.path, rad);
  let impact = null, endPath = null;
  if (contact) {
    const speed2 = contact.vx * contact.vx + contact.vy * contact.vy;
    const speed = fsqrt(speed2);
    let E = 0.5 * obj.mass * speed2;
    const E0 = E;
    const ux = contact.vx / speed, uy = contact.vy / speed;
    // Everything on the straight line from the contact point, nearest first.
    const L = 60;
    const hits = [];
    for (const blk of alive(tower)) {
      const t = segmentEntry(contact.x, contact.y, contact.x + ux * L, contact.y + uy * L, boxOf(tower, blk, rad));
      if (t !== null) hits.push({ t, blk });
    }
    hits.sort((a, b) => a.t - b.t || a.blk.r - b.blk.r || a.blk.c - b.blk.c);
    let broke = 0, keyHit = false, lastT = 0, firstTier = contact.block.tier, stopped = false;
    for (const h of hits) {
      const blk = h.blk;
      if (E <= EPS) break;
      if (broke >= MAX_BREAK.v) { stopped = true; break; }
      const dmg = E < blk.hp ? E : blk.hp;
      const broken = E >= blk.hp - EPS;
      blk.hp -= dmg;
      E -= broken ? PEN_COST.v * dmg : dmg;
      if (E < 0) E = 0;
      lastT = h.t;
      if (broken) { blk.alive = false; broke++; }
      if (blk.key) keyHit = true;
      events.push({ k: 'hit', id: blk.id, dmg, broken, hpAfter: blk.hp, wave: 0, t: contact.time + (h.t * L) / (speed > 0 ? speed : 1) });
      if (!broken) { stopped = true; break; }   // stopped by this block
    }
    const through = E > EPS && !stopped;
    // Where the object goes next (for the animation): drops dead, or keeps flying.
    if (through) {
      const sp = fsqrt((2 * E) / obj.mass);
      const sx = contact.x + ux * lastT * L, sy = contact.y + uy * lastT * L;
      endPath = flyFrom(obj, sx, sy, ux * sp, uy * sp, opts).path;
    }
    impact = {
      time: contact.time, x: contact.x, y: contact.y, speed, energy: E0,
      block: contact.block.id, tier: firstTier, broke, keyHit, through,
      stopX: contact.x + ux * lastT * L, stopY: contact.y + uy * lastT * L,
    };
    settle(tower, events, 1);
  }
  const after = fractionDown(tower);
  return { tower, events, flight, impact, endPath, down: after, delta: after - before };
}

/** ASCII picture, top row first. Digits are tiers, K the keystone, '.' empty or gone. */
export function dump(tower) {
  const rows = [];
  const maxR = Math.max(...tower.blocks.map((b) => b.r0 + b.h));
  for (let r = maxR - 1; r >= 0; r--) {
    let line = '';
    for (let c = 0; c < tower.width; c++) {
      const b = alive(tower).find((s) => c >= s.c && c < s.c + s.w && r >= s.r && r < s.r + s.h);
      line += b ? (b.key ? 'K' : String(b.tier)) : '.';
    }
    rows.push(line);
  }
  return rows.join('\n');
}
