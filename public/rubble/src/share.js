// The share card: text with a small picture of what is left of the tower, and a PNG version.
import { alive, CELL } from './tower.js';

import { GAME_NAME, SHARE_HOST } from './brand.js';
export const SHARE_URL = SHARE_HOST;
const pct = (x) => `${Math.round(x * 100)}%`;

/** Emoji picture of the tower: orange = still standing, white = gone, blank = never there. */
export function towerEmoji(tower) {
  const orig = new Set();
  let maxR = 0, maxC = 0;
  for (const b of tower.blocks) {
    for (let c = b.c0; c < b.c0 + b.w; c++) for (let r = b.r0; r < b.r0 + b.h; r++) orig.add(`${c},${r}`);
    if (b.r0 + b.h > maxR) maxR = b.r0 + b.h;
    if (b.c0 + b.w > maxC) maxC = b.c0 + b.w;
  }
  const now = new Map();
  for (const b of alive(tower)) for (let c = b.c; c < b.c + b.w; c++) for (let r = b.r; r < b.r + b.h; r++) now.set(`${c},${r}`, b.key ? 'K' : 'B');
  const rows = [];
  for (let r = maxR - 1; r >= 0; r--) {
    let line = '';
    for (let c = 0; c < maxC; c++) {
      const k = `${c},${r}`;
      const have = now.get(k);
      line += have === 'K' ? '\u{1F7E8}' : have ? '\u{1F7E7}' : orig.has(k) ? '⬜' : '　';
    }
    rows.push(line);
  }
  return rows.join('\n');
}

/**
 * day: { number, objects:[{name}], deltas:[0..1], total:0..1, tower, rankText? }
 */
export function buildShareText(day) {
  const parts = day.objects.map((o, i) => `${o.name.toLowerCase()} ${pct(day.deltas[i] || 0)}`);
  const lines = [
    `${GAME_NAME} #${day.number}`,
    `Tower ${pct(day.total)} down${day.rankText ? `  ${day.rankText}` : ''}`,
    parts.join(' · '),
    towerEmoji(day.tower),
    SHARE_URL,
  ];
  return lines.join('\n');
}

/** Challenge link: same day, with a friend's score to beat. */
export function challengeUrl(base, number, total) {
  return `${base}?d=${number}&c=${Math.round(total * 100)}`;
}
export function parseChallenge(search) {
  const q = new URLSearchParams(search);
  const d = Number(q.get('d')), c = Number(q.get('c'));
  return Number.isFinite(d) && Number.isFinite(c) && q.has('c') && c >= 0 && c <= 100 ? { number: d, score: c } : null;
}

export { CELL };
