import { dailyPuzzle, dateKey, dayNumber } from './daily.js';
import { Game } from './game.js';
import { parseChallenge } from './share.js';
import { devResetDay, devResetAll, loadStreak } from './store.js';
import { streakNow } from './streak.js';
import { initMenu } from './menu.js';
import { EPOCH } from './daily.js';
import { GAME_NAME } from './brand.js';

document.title = GAME_NAME;
const logo = document.getElementById('logo'); if (logo) logo.textContent = GAME_NAME;

const q = new URLSearchParams(location.search);
const dev = q.has('dev');
let key = dateKey();
if (dev && /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '')) key = q.get('date');
const today = key;
const pr = q.get('practice');
const practice = /^\d{4}-\d{2}-\d{2}$/.test(pr || '') && pr >= EPOCH && pr < today;
if (practice) key = pr;

// The schedule says which attempt and objects each published day uses. A day that is in the
// schedule must NOT silently fall back to the plain date seed (that would be a different tower),
// so a failed download uses the copy cached from the last good load, or stops with a message.
async function loadSchedule() {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('data/schedule.json', { cache: 'no-cache' });
      if (r.ok) { const data = await r.json(); try { localStorage.setItem('topple:v1:sched', JSON.stringify(data)); } catch { /* ignore */ } return { data, source: 'network' }; }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  try { const c = JSON.parse(localStorage.getItem('topple:v1:sched')); if (c) return { data: c, source: 'cache' }; } catch { /* none */ }
  return null;
}

const loaded = await loadSchedule();
if (!loaded) {
  document.getElementById('hint').textContent = 'Could not load today\u2019s tower. Check your connection and reload.';
  document.getElementById('hint').classList.add('warn');
  document.getElementById('hint').style.top = '40%';
  throw new Error('schedule unavailable');
}
const sched = loaded.data;
if (!sched[key]) console.warn(`No scheduled entry for ${key}; using the plain date seed (fine for development, not for a published day).`);
const attempt = sched[key] ? sched[key].attempt : 0;
const puzzle = dailyPuzzle(key, attempt, undefined, sched[key] ? sched[key].objects : null);
const game = new Game(puzzle, { challenge: parseChallenge(location.search), dev, practice, mockrank: q.has('mockrank'), today });
initMenu(today);
if (practice) { const c = document.getElementById('dayno'); c.textContent = `#${puzzle.number} practice`; }

const sn = streakNow(loadStreak(), today);
if (sn.days > 0) { const c = document.getElementById('streakChip'); c.textContent = `${sn.days} day${sn.days === 1 ? '' : 's'}`; c.classList.remove('hidden'); }

if (dev) {
  const d = document.getElementById('dev'); if (!q.has('clean')) d.classList.remove('hidden');
  document.getElementById('devToggle').onclick = () => d.classList.toggle('open');
  document.getElementById('devInfo').textContent = `${key} · ${puzzle.recipe} · ${puzzle.twist} · D${puzzle.distance} · attempt ${attempt}`;
  document.getElementById('devDate').value = key;
  document.getElementById('devDate').onchange = (e) => { const u = new URL(location.href); u.searchParams.set('date', e.target.value); location.href = u; };
  document.getElementById('devReset').onclick = () => { devResetDay(key); location.reload(); };
  document.getElementById('devResetAll').onclick = () => { devResetAll(); location.reload(); };
}
