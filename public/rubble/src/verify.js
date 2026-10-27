// Server-side check of a submitted run. Pure functions with no DOM, so a Supabase edge
// function (or any Node/Deno host) can import this file and src/*.js as they are.
// A run is: { key: 'YYYY-MM-DD', shots: [[px, py, objectIndex], ...] }.
import { dailyPuzzle } from './daily.js';
import { throwAt, fractionDown } from './tower.js';
import { quantizePull, fsqrt, MIN_PULL, PULL_MAX } from './physics.js';

/** Shape and legality of a list of shots for a puzzle with n objects. Returns an error string or null. */
export function validateShots(shots, n, requireAll = true) {
  if (!Array.isArray(shots)) return 'no shots';
  if (shots.length > n || (requireAll && shots.length !== n)) return 'wrong number of throws';
  const used = new Set();
  for (const sh of shots) {
    if (!Array.isArray(sh) || sh.length !== 3 || !sh.every(Number.isInteger)) return 'shots must be whole numbers';
    const [px, py, idx] = sh;
    if (idx < 0 || idx >= n || used.has(idx)) return 'bad object choice';
    used.add(idx);
    const q = quantizePull(px, py);
    if (q.px !== px || q.py !== py) return 'pull is not a legal whole-number pull';
    if (fsqrt(px * px + py * py) < MIN_PULL || px * px + py * py > PULL_MAX * PULL_MAX) return 'pull out of range';
  }
  return null;
}

/**
 * Replays the run on the day's puzzle and returns { ok, pct, deltas, reason }.
 * `entry` is the day's row from data/schedule.json (attempt and pinned objects).
 */
export function verifyRun(run, entry = {}) {
  const bad = (reason) => ({ ok: false, reason });
  if (!run || typeof run.key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(run.key)) return bad('bad date');
  if (!Array.isArray(run.shots)) return bad('no shots');
  const puzzle = dailyPuzzle(run.key, entry.attempt || 0, undefined, entry.objects || null);
  const err = validateShots(run.shots, puzzle.objects.length);
  if (err) return bad(err);
  let tower = puzzle.tower; const deltas = [];
  for (const [px, py, idx] of run.shots) {
    const out = throwAt(tower, puzzle.objects[idx], px, py, { g: puzzle.g, wind: puzzle.wind });
    tower = out.tower; deltas.push(out.delta);
  }
  return { ok: true, pct: Math.round(fractionDown(tower) * 100), deltas, number: puzzle.number };
}
