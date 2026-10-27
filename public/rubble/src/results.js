// End-of-day screen: percent down, the tower that is left, per-throw rows, share card, streak.
import { C } from './palette.js';
import { drawObject } from './sprites.js';
import { drawTowerPicture, roundRect, starPath, TAU } from './render.js';
import { fractionDown } from './tower.js';
import { buildShareText, challengeUrl, SHARE_URL } from './share.js';
import { finishDay, loadStreak, saveDay, clearPractice } from './store.js';
import { fetchRank, mockRank } from './api.js';
import { openCollection, openArchive } from './menu.js';
import { streakNow } from './streak.js';
import { sfx } from './audio.js';
import { GAME_NAME } from './brand.js';
import { startReplay } from './replay.js';

const $ = (id) => document.getElementById(id);
const pct = (x) => Math.round(x * 100);

function note(sum) {
  if (!sum.hit) return 'missed the tower';
  if (sum.key) return 'hit the gold block';
  if (sum.broke === 0) return 'bounced off';
  return `smashed ${sum.broke} block${sum.broke > 1 ? 's' : ''}`;
}

export function makeShareImage(game, w = 900, h = 600) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = C.sky; g.fillRect(0, 0, w, h);
  g.fillStyle = C.sun; g.beginPath(); g.arc(w * 0.86, 86, 44, 0, TAU); g.fill();
  g.fillStyle = C.hillFar; g.beginPath(); g.arc(200, h - 130 + 330, 330, Math.PI, 0); g.fill();
  g.fillStyle = C.hillMid; g.beginPath(); g.arc(700, h - 130 + 280, 280, Math.PI, 0); g.fill();
  g.fillStyle = C.ground; g.fillRect(0, h - 130, w, 130);
  g.fillStyle = C.dirt; g.fillRect(0, h - 70, w, 70);
  const tower = game.tower;
  const rows = Math.max(...tower.blocks.map((b) => b.r0 + b.h));
  const cell = Math.min(54, 330 / rows, 440 / tower.width);
  drawTowerPicture(g, tower, w * 0.5 - (tower.width * cell) / 2 + 150, h - 130, cell);
  g.fillStyle = C.ink; g.textAlign = 'left';
  g.font = '900 54px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  roundRect(g, 36, 30, 230, 74, 22); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 5; g.strokeStyle = C.ink; g.stroke();
  g.fillStyle = C.ink; g.fillText(GAME_NAME, 56, 86);
  g.font = '900 150px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  g.lineWidth = 12; g.strokeStyle = '#FFFFFF'; g.lineJoin = 'round'; g.strokeText(`${pct(fractionDown(tower))}%`, 40, 250); g.fillStyle = C.ink; g.fillText(`${pct(fractionDown(tower))}%`, 40, 250);
  g.font = '900 34px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; g.fillStyle = C.ink;
  g.fillText(`of the tower down  ·  #${game.puzzle.number}`, 44, 298);
  // objects row
  game.thrownObjects().forEach((o, i) => {
    const x = 70 + i * 120, y = h - 36;
    roundRect(g, x - 48, y - 62, 96, 96, 24); g.fillStyle = '#FFFFFFD0'; g.fill();
    drawObject(g, o.id, x, y - 14, 62);
    g.font = '900 26px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = C.ink;
    g.fillText(`${pct(game.deltas[i] || 0)}%`, x, y + 28);
  });
  g.textAlign = 'right'; g.font = '800 24px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; g.fillStyle = '#FFFFFF'; g.fillText(SHARE_URL, w - 24, h - 16);
  return cv;
}

export function showResults(game, restored) {
  const p = game.puzzle, tower = game.tower;
  const total = fractionDown(tower);
  const rec = { shots: game.shots, pct: total, deltas: game.deltas, summaries: game.summaries };
  const practice = !!game.opts.practice;
  let streak = loadStreak(), froze = null;
  if (practice) { if (!game.alreadyDone) saveDay(game.key, { ...rec, done: true, sig: game.sig }, 'practice'); }
  else if (!game.alreadyDone) ({ streak, froze } = finishDay(game.key, { ...rec, sig: game.sig }, p.objects.map((o) => o.id)));
  const objs = game.thrownObjects();
  const day = { number: p.number, objects: objs, deltas: game.deltas, total, tower };
  const text = buildShareText(day);
  game.shareText = text;

  $('resTitle').textContent = `${practice ? 'Practice \u00B7 ' : ''}${GAME_NAME} #${p.number} \u00B7 ${p.recipeName}`;
  $('resPct').textContent = `${pct(total)}%`;
  const ctx = $('resTower').getContext('2d');
  ctx.clearRect(0, 0, 360, 190);
  ctx.fillStyle = '#DFF1FF'; ctx.fillRect(0, 0, 360, 190);
  ctx.fillStyle = C.ground; ctx.fillRect(0, 160, 360, 30);
  const rows = Math.max(...tower.blocks.map((b) => b.r0 + b.h));
  const cell = Math.min(24, 140 / rows, 300 / tower.width);
  drawTowerPicture(ctx, tower, 180 - (tower.width * cell) / 2, 160, cell);

  const ul = $('resThrows'); ul.innerHTML = '';
  objs.forEach((o, i) => {
    const li = document.createElement('li');
    const c = document.createElement('canvas'); c.width = 68; c.height = 68; drawObject(c.getContext('2d'), o.id, 34, 34, 54);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.innerHTML = `${o.name}<small>${note(game.summaries[i] || { hit: false })}</small>`;
    const b = document.createElement('b'); b.textContent = `+${pct(game.deltas[i] || 0)}%`;
    li.append(c, nm, b); ul.append(li);
  });

  const ch = game.opts.challenge, cmp = $('resCompare');
  if (ch && ch.number === p.number) {
    cmp.classList.remove('hidden');
    const me = pct(total);
    cmp.textContent = me > ch.score ? `You beat your friend: ${me}% to ${ch.score}%.` : me === ch.score ? `A tie at ${me}%.` : `Your friend wins this one: ${ch.score}% to ${me}%.`;
  } else cmp.classList.add('hidden');

  $('shareText').textContent = text;
  const copy = async (str, btn, label) => {
    try { await navigator.clipboard.writeText(str); btn.textContent = 'Copied!'; btn.classList.add('done'); }
    catch { const ta = document.createElement('textarea'); ta.value = str; document.body.append(ta); ta.select(); try { document.execCommand('copy'); btn.textContent = 'Copied!'; btn.classList.add('done'); } catch { btn.textContent = 'Press and hold to copy'; } ta.remove(); }
    setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800);
  };
  $('copyBtn').onclick = () => copy(text, $('copyBtn'), 'Copy result');
  $('linkBtn').onclick = () => copy(challengeUrl(location.origin + location.pathname, p.number, total), $('linkBtn'), 'Challenge a friend');
  $('pngBtn').onclick = async () => {
    const cv = makeShareImage(game);
    cv.toBlob(async (blob) => {
      try {
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], `${GAME_NAME.toLowerCase()}.png`, { type: 'image/png' })] })) { await navigator.share({ files: [new File([blob], `${GAME_NAME.toLowerCase()}-${p.number}.png`, { type: 'image/png' })], text }); return; }
      } catch { /* fall through to download */ }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${GAME_NAME.toLowerCase()}-${p.number}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  };

  const sNow = streak.streak;
  let line = `Day streak: ${sNow} ${sNow === 1 ? 'day' : 'days'}${streak.best > sNow ? ` \u00B7 best ${streak.best}` : ''}`;
  if (froze) line += `. A free freeze covered ${froze}.`;
  $('resStreak').textContent = practice ? 'Practice run: it does not count toward your streak or rank.' : line;
  if (!practice && sNow > 0) { const chip = $('streakChip'); chip.textContent = `${sNow} day${sNow === 1 ? '' : 's'}`; chip.classList.remove('hidden'); }
  $('resRank').textContent = practice ? '' : 'Today\u2019s rank: coming when the score server is switched on.';
  if (!practice) fetchRank(game.key, pct(total)).then((r) => { if (!r && game.opts.mockrank) r = mockRank(pct(total)); if (r) $('resRank').textContent = `Better than ${r.betterThan ?? r.better_than}% of ${r.players} players${r.mock ? ' (made-up test numbers)' : ''}`; });
  $('collBtn').onclick = () => openCollection();
  $('archBtn').onclick = () => openArchive(game.today || game.key);
  $('againBtn').classList.toggle('hidden', !practice);
  $('againBtn').onclick = () => { clearPractice(game.key); location.reload(); };
  const tick = () => {
    const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    const s = Math.max(0, Math.floor((next - n) / 1000)), pad = (v) => String(v).padStart(2, '0');
    $('resNext').textContent = `Next tower in ${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };
  tick(); clearInterval(game._cd); game._cd = setInterval(tick, 1000);
  $('results').classList.remove('hidden');
  $('card').classList.add('hidden');
  try { startReplay(game, $('resReplay')); } catch (e) { console.warn('replay failed', e); $('resReplay').parentElement.classList.add('hidden'); }
  if (!restored) { sfx('win'); if (total >= 0.5) confetti(); }
}

function confetti() {
  const cols = ['#E5484D', '#FFD23F', '#3FB950', '#4C9BE8', '#F28B30', '#FFFFFF'];
  for (let i = 0; i < 46; i++) {
    const d = document.createElement('div'); d.className = 'confetti';
    d.style.left = `${Math.random() * 100}vw`; d.style.background = cols[i % cols.length];
    d.style.animationDelay = `${Math.random() * 0.9}s`; d.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    d.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.append(d); setTimeout(() => d.remove(), 5200);
  }
}
