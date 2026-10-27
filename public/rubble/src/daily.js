// The daily puzzle: date string -> the same objects, tower and twist on every device.
// Integer-only hashing and PRNG (Math.imul, shifts), so no engine can disagree.
import { OBJECTS } from '../data/objects.js';
import { RECIPES, doubleRecipe } from './recipes.js';
import { dragK, maxRange } from './physics.js';
import { buildTower } from './tower.js';
import { calibrate } from './calibrate.js';

export const GAME_NAME = 'Topple';
export const EPOCH = '2026-10-27';   // puzzle #1 (placeholder until the launch date is chosen)
export const SEED_SALT = 'topple-v1';
export const MARS_G = 3.71;

/** 32-bit string hash (FNV-1a). */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small fast PRNG (mulberry32). Returns a function giving floats in [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How the card describes drag, from the drag constant k. */
export function dragClass(obj) {
  const k = dragK(obj);
  if (k < 0.01) return 'true';
  if (k < 0.05) return 'mid';
  return 'floaty';
}

export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dayMs = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const dayNumber = (key) => Math.round((dayMs(key) - dayMs(EPOCH)) / 86400000) + 1;
export const weekday = (key) => new Date(dayMs(key)).getUTCDay();   // 0 = Sunday

const TWISTS = [
  { id: 'none', weight: 50 }, { id: 'wind', weight: 15 },
  { id: 'lowgravity', weight: 15 }, { id: 'heavykey', weight: 20 },
];

export const TWIST_TEXT = {
  none: '',
  wind: (p) => (p.wind > 0 ? `Tailwind today: ${p.wind} m/s pushes your throws toward the tower` : `Headwind today: ${-p.wind} m/s pushes your throws back`),
  lowgravity: () => 'Low gravity today (like Mars): everything flies much farther',
  heavykey: () => 'The gold block is made of stone today',
};

/**
 * Build one day's puzzle. `attempt` lets the schedule bot re-roll a day that failed its
 * checks (attempt 0 is the plain date seed).
 */
export function dailyPuzzle(key, attempt = 0, table = OBJECTS, pinned = null) {
  const rng = makeRng(hash32(`${SEED_SALT}|${key}|${attempt}`));
  // twist
  let roll = rng() * TWISTS.reduce((s, t) => s + t.weight, 0), twist = 'none';
  for (const t of TWISTS) { if (roll < t.weight) { twist = t.id; break; } roll -= t.weight; }
  const g = twist === 'lowgravity' ? MARS_G : undefined;
  let wind = 0;
  if (twist === 'wind') { const mag = 2 + Math.floor(rng() * 4); wind = rng() < 0.5 ? mag : -mag; }
  const opts = { g, wind };

  // recipe and distance
  const sunday = weekday(key) === 0;                         // the weekly big build: two towers, four throws
  const r1 = RECIPES[Math.floor(rng() * RECIPES.length)];
  const recipe = sunday ? doubleRecipe(r1, RECIPES[Math.floor(rng() * RECIPES.length)]) : r1;
  const mirror = rng() < 0.5;
  const maxD = sunday ? 11 : twist === 'lowgravity' ? 24 : 16;
  const short = rng() < 0.35;                  // short days make room for the floaty objects
  const D = short ? 6 + Math.floor(rng() * 3) : 9 + Math.floor(rng() * (maxD - 9 + 1));

  // objects that can actually get there with a margin
  const eligible = table.filter((o) => maxRange(o, opts) * 0.8 >= D + 1);
  const pool = { true: [], mid: [], floaty: [] };
  for (const o of eligible) pool[dragClass(o)].push(o);
  const patterns = pool.floaty.length > 0
    ? [['true', 'mid', 'floaty'], ['true', 'mid', 'floaty'], ['mid', 'floaty', 'true'], ['true', 'true', 'floaty']]
    : [['true', 'mid', 'mid'], ['true', 'true', 'mid'], ['mid', 'true', 'mid']];
  const pat = patterns[Math.floor(rng() * patterns.length)];
  const chosen = [];
  const classes = sunday ? [...pat, pat[Math.floor(rng() * 3)]] : pat;
  for (const cls of classes) {
    let cand = pool[cls].filter((o) => !chosen.includes(o));
    if (cand.length === 0) cand = eligible.filter((o) => !chosen.includes(o));
    chosen.push(cand[Math.floor(rng() * cand.length)]);
  }
  for (let i = chosen.length - 1; i > 0; i--) {              // shuffle the order they are offered
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  if (pinned) {                                              // a published day keeps its objects even if the table grows
    const byId = new Map(table.map((o) => [o.id, o]));
    if (pinned.every((id) => byId.has(id))) chosen.splice(0, chosen.length, ...pinned.map((id) => byId.get(id)));
  }

  const heightCells = Math.max(...recipe.blocks.map((b) => b.r + b.h));
  const hp = calibrate(chosen, D, heightCells, opts);
  const tower = buildTower(recipe.blocks, {
    x0: D, hpByTier: hp, mirror, keyTier: twist === 'heavykey' ? 3 : null,
  });
  return {
    key, attempt, number: dayNumber(key), twist, sunday, recipe: recipe.id, recipeName: sunday ? `Sunday big build: ${recipe.name}` : recipe.name,
    mirror, distance: D, wind, g, objects: chosen, tower, hp, throws: chosen.length,
  };
}

/** A short fingerprint of a puzzle (day, objects, tower, toughness). Saves carry it so a save is never replayed on a different puzzle. */
export function puzzleSig(p) {
  return hash32(JSON.stringify([p.key, p.attempt, p.objects.map((o) => o.id), p.recipe, p.mirror, p.distance, p.twist, p.wind, p.g || 0, Math.round(p.hp[1] * 1e6), Math.round(p.hp[3] * 1e3)])).toString(16);
}
