// The day-checker bot. It plays a day's tower many ways and says whether the day is worth
// shipping: possible to clear (best play), not clearable by one lucky throw, and not
// something average aiming already wins. Used offline by tools/make-schedule.mjs and in tests.
import { simulate } from './physics.js';
import { DIRS, pullToCross } from './calibrate.js';
import { CELL, throwAt, fractionDown } from './tower.js';
import { makeRng, hash32 } from './daily.js';

/** Candidate shots for one object: aim at several heights of the tower from several angles. */
export function candidates(puzzle, obj) {
  const opts = { g: puzzle.g, wind: puzzle.wind };
  const H = Math.max(...puzzle.tower.blocks.map((b) => b.r0 + b.h)) * CELL;
  const out = [];
  const seen = new Set();
  for (const [dx, dy] of DIRS) {
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const p = pullToCross(obj, dx, dy, puzzle.distance + 0.2, H * f, opts);
      if (!p) continue;
      const key = `${p.px},${p.py}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ px: p.px, py: p.py, flight: simulate(obj, p.px, p.py, opts) });
    }
  }
  return out;
}

function play(puzzle, tower, obj, cand) {
  return throwAt(tower, obj, cand.px, cand.py, { g: puzzle.g, wind: puzzle.wind, flight: cand.flight });
}

function perms(n) {
  if (n <= 1) return [[0]];
  const out = [];
  for (const p of perms(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

export function evaluateDay(puzzle, { randomRuns = 150, beam = 3 } = {}) {
  const objs = puzzle.objects;
  const cands = objs.map((o) => candidates(puzzle, o));
  // best single throw from the fresh tower
  let bestSingle = 0;
  for (let i = 0; i < objs.length; i++) for (const c of cands[i]) {
    const d = play(puzzle, puzzle.tower, objs[i], c).delta;
    if (d > bestSingle) bestSingle = d;
  }
  // best three-throw play (beam search over each order)
  let bestTotal = 0, bestPlan = null;
  for (const perm of perms(objs.length)) {
    let states = [{ tower: puzzle.tower, plan: [] }];
    for (const idx of perm) {
      const next = [];
      for (const st of states) for (const c of cands[idx]) {
        const out = play(puzzle, st.tower, objs[idx], c);
        next.push({ tower: out.tower, score: fractionDown(out.tower), plan: [...st.plan, { idx, px: c.px, py: c.py }] });
      }
      next.sort((a, b) => b.score - a.score);
      states = next.slice(0, beam);
    }
    if (states[0].score > bestTotal) { bestTotal = states[0].score; bestPlan = states[0].plan; }
  }
  // average-ish play: random candidate for each object in random order
  const rng = makeRng(hash32(`bot|${puzzle.key}|${puzzle.attempt}`));
  const totals = [];
  for (let n = 0; n < randomRuns; n++) {
    const order = objs.map((_, k) => k).sort(() => rng() - 0.5);
    let tower = puzzle.tower;
    for (const idx of order) {
      const list = cands[idx];
      if (list.length === 0) continue;
      tower = play(puzzle, tower, objs[idx], list[Math.floor(rng() * list.length)]).tower;
    }
    totals.push(fractionDown(tower));
  }
  totals.sort((a, b) => a - b);
  const q = (p) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
  const m = { bestPlan, bestSingle, bestTotal, randomMedian: q(0.5), randomP90: q(0.9), randomP10: q(0.1) };
  const reasons = [];
  if (cands.some((c) => c.length < 6)) reasons.push('an object has too few ways to reach the tower');
  if (bestTotal < 0.6) reasons.push(`best play only gets ${(bestTotal * 100) | 0}%`);
  if (bestSingle > 0.75) reasons.push(`one throw alone can do ${(bestSingle * 100) | 0}%`);
  if (m.randomMedian > 0.6) reasons.push(`random aiming already gets ${(m.randomMedian * 100) | 0}%`);
  if (m.randomMedian < 0.1) reasons.push(`random aiming gets only ${(m.randomMedian * 100) | 0}%`);
  if (m.randomP90 < 0.25) reasons.push(`even good random aiming rarely passes ${(m.randomP90 * 100) | 0}%`);
  return { ...m, ok: reasons.length === 0, reasons };
}
