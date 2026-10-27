// Menu, how to play, the object collection ("museum") and the archive of past towers.
import { OBJECTS } from '../data/objects.js';
import { drawObject } from './sprites.js';
import { describeCard } from './card.js';
import { factsFor } from './facts.js';
import { loadSeen, history, flag, setFlag } from './store.js';
import { EPOCH, dateKey } from './daily.js';
import { addDays } from './streak.js';
import { isMuted, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
function open(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
export function closeModal() { $('modal').classList.add('hidden'); }

export function openHowTo() {
  open(`<h2>How to play</h2><ol>
    <li><b>Pick an object.</b> Heavy things break tough blocks. Light things only pop glass.</li>
    <li><b>Pull back and let go.</b> The big number is your power. The dashed line is where it would fly with no air.</li>
    <li><b>Air slows light, bulky things down.</b> After each throw you see the real path and what the air cost you.</li>
    <li><b>Same tower for everyone today.</b> You get ${window.__topple ? window.__topple.puzzle.objects.length : 3} throws, in any order. The score is how far the tower comes down.</li></ol>
    <button class="btn" id="howOk">Let me throw</button>`);
  $('howOk').onclick = () => { setFlag('howto'); closeModal(); };
}

export function openCollection() {
  const seen = loadSeen();
  const cards = OBJECTS.map((o) => {
    const has = !!seen[o.id];
    const c = describeCard(o);
    return `<div class="mcard ${has ? '' : 'locked'}" data-id="${o.id}"><canvas width="128" height="128"></canvas>
      <b>${has ? c.name : '???'}</b>${has ? `<div>${c.stats}</div><ul>${factsFor(o).map((f) => `<li>${f}</li>`).join('')}</ul>` : '<div>Shows up on some day</div>'}</div>`;
  }).join('');
  open(`<h2>My collection</h2><p>${Object.keys(seen).length} of ${OBJECTS.length} objects. Each day you play adds that day\u2019s objects.</p><div class="grid">${cards}</div>`);
  document.querySelectorAll('.mcard').forEach((el) => {
    const o = OBJECTS.find((x) => x.id === el.dataset.id), g = el.querySelector('canvas').getContext('2d');
    if (seen[o.id]) drawObject(g, o.id, 64, 64, 100);
    else { g.filter = 'brightness(0)'; drawObject(g, o.id, 64, 64, 100); }
  });
}

export function openArchive(todayKey = dateKey()) {
  const played = Object.fromEntries(history().map(([k, v]) => [k, v]));
  const rows = [];
  for (let k = addDays(todayKey, -1); k >= EPOCH && rows.length < 30; k = addDays(k, -1)) {
    const rec = played[k];
    rows.push(`<div class="archRow"><span class="nm">${k}<small>${rec && rec.done ? `You: ${Math.round(rec.pct * 100)}% down` : 'Not played'}</small></span><a href="?practice=${k}"><button class="btn">Practice</button></a></div>`);
  }
  open(`<h2>Past towers</h2><p>Practice runs do not count toward your streak or rank.</p>${rows.join('') || '<p>Nothing here yet. Yesterday\u2019s tower shows up tomorrow.</p>'}`);
}

export function openMenu(todayKey) {
  open(`<h2>Menu</h2><div class="menuList">
    <button class="btn" id="mHow">How to play</button><button class="btn" id="mColl">My collection</button>
    <button class="btn" id="mArch">Past towers (practice)</button><button class="btn" id="mSound">Sound: ${isMuted() ? 'off' : 'on'}</button>
    <a href="privacy.html"><button class="btn">Privacy and credits</button></a></div>`);
  $('mHow').onclick = openHowTo; $('mColl').onclick = openCollection; $('mArch').onclick = () => openArchive(todayKey);
  $('mSound').onclick = () => { $('muteBtn').click(); openMenu(todayKey); };
}

export function initMenu(todayKey) {
  $('menuBtn').onclick = () => openMenu(todayKey);
  $('modalClose').onclick = closeModal;
  $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closeModal(); });
  if (!flag('howto')) setTimeout(openHowTo, 500);
}
