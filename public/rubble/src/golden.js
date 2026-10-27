// A fingerprint of everything that must match on every device: the daily puzzles, flights, and tower results.
// tools/golden.html runs this in any browser and compares it with data/golden.json (made by tools/make-golden.mjs).
import { dailyPuzzle, hash32 } from './daily.js';
import { simulate } from './physics.js';
import { throwAt } from './tower.js';
import { OBJECTS } from '../data/objects.js';

export function fingerprint() {
  const out = [];
  for (let i = 0; i < 30; i++) {
    const key = new Date(Date.UTC(2026, 9, 27 + i)).toISOString().slice(0, 10);
    out.push([`puzzle ${key}`, hash32(JSON.stringify(dailyPuzzle(key))).toString(16)]);
  }
  for (const o of OBJECTS) {
    const s = simulate(o, 612, 377);
    out.push([`flight ${o.id}`, `${s.landX}|${s.time}|${s.peak}`]);
  }
  const p = dailyPuzzle('2026-11-02');
  let t = p.tower;
  [[480, 330, 0], [560, 400, 1], [610, 300, 2]].forEach(([px, py, i], k) => {
    const r = throwAt(t, p.objects[i], px, py, { g: p.g, wind: p.wind });
    t = r.tower;
    out.push([`throw ${k + 1}`, hash32(JSON.stringify([r.delta, r.events, r.impact, t])).toString(16)]);
  });
  return out;
}
