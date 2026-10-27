// Local saves only (no accounts, no server in v1). Every call survives a blocked or missing
// localStorage (private windows, previews) by falling back to memory.
import { emptyStreak, recordPlay } from './streak.js';

const P = 'topple:v1:';
const mem = new Map();

function read(k) {
  try { const v = localStorage.getItem(P + k); return v === null ? (mem.get(k) ?? null) : JSON.parse(v); } catch { return mem.get(k) ?? null; }
}
function write(k, v) {
  mem.set(k, v);
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* memory only */ }
}
function drop(k) {
  mem.delete(k);
  try { localStorage.removeItem(P + k); } catch { /* ignore */ }
}

/** Today's saved play: { shots: [[px,py],...], done, pct, deltas } or null. */
export const loadDay = (key, ns = 'day') => read(`${ns}:${key}`);
export const saveDay = (key, rec, ns = 'day') => write(`${ns}:${key}`, rec);
/** Move a record we cannot trust or replay out of the way (kept, not deleted). */
export function quarantine(key, ns = 'day') { const rec = read(`${ns}:${key}`); if (rec) write(`${ns}-old:${key}:${Date.now()}`, rec); drop(`${ns}:${key}`); }
export const clearPractice = (key) => drop('practice:' + key);
export const flag = (name) => read('flag:' + name) === true;
export const setFlag = (name) => write('flag:' + name, true);
export const loadStreak = () => read('streak') || emptyStreak();

/** Finish a day: save the record, update the streak and the collection. Returns { streak, froze }. */
export function finishDay(key, rec, objectIds) {
  write('day:' + key, { ...rec, done: true });
  const { state, froze } = recordPlay(loadStreak(), key);
  write('streak', state);
  const seen = read('seen') || {};
  for (const id of objectIds) if (!seen[id]) seen[id] = key;
  write('seen', seen);
  return { streak: state, froze };
}
export const loadSeen = () => read('seen') || {};

/** Past results (for the archive and the local best). */
export function history() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P + 'day:')) out.push([k.slice((P + 'day:').length), JSON.parse(localStorage.getItem(k))]);
    }
  } catch { for (const [k, v] of mem) if (k.startsWith('day:')) out.push([k.slice(4), v]); }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Dev only: forget today so you can play it again. */
export const devResetDay = (key) => { drop('day:' + key); drop('practice:' + key); };
export function devResetAll() {
  for (const [k] of [...mem]) drop(k);
  try {
    const ks = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P)) ks.push(k); }
    ks.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
