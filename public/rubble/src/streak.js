// Streaks with a forgiving weekly freeze. Pure functions on a small state object.
//   streak:  days in a row, counting played days (a frozen day bridges a gap, it is not "played")
//   freezeWeeks: weeks (Monday-start) whose free freeze is already used
// Rule: miss exactly one day and a freeze is free that week -> the streak survives.
// Miss two or more days (or no freeze left) -> the streak starts over at 1 on the next play.

const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
/** Week index, Monday first (1970-01-01 was a Thursday). */
export const weekKey = (key) => Math.floor((dayNum(key) + 3) / 7);
export const addDays = (key, n) => new Date((dayNum(key) + n) * 86400000).toISOString().slice(0, 10);

export const emptyStreak = () => ({ streak: 0, best: 0, last: null, freezeWeeks: [], frozen: [] });

/** The player finished the puzzle for `key`. Returns { state, froze } (froze = the bridged day or null). */
export function recordPlay(st, key) {
  const s = { ...st, freezeWeeks: [...st.freezeWeeks], frozen: [...st.frozen] };
  let froze = null;
  if (s.last === key) return { state: s, froze };
  if (s.last !== null && daysBetween(s.last, key) < 0) return { state: s, froze };   // an older day (stale tab, clock change): never rewind or inflate
  if (s.last === null) s.streak = 1;
  else {
    const gap = daysBetween(s.last, key);
    if (gap === 1) s.streak += 1;
    else if (gap === 2) {
      const missed = addDays(s.last, 1);
      const wk = weekKey(missed);
      if (!s.freezeWeeks.includes(wk)) {
        s.freezeWeeks.push(wk); s.frozen.push(missed); froze = missed;
        s.streak += 1;
      } else s.streak = 1;
    } else if (gap > 2) s.streak = 1;
  }
  s.last = key;
  if (s.streak > s.best) s.best = s.streak;
  return { state: s, froze };
}

/** What to show on opening the game today (before playing). */
export function streakNow(st, today) {
  if (st.last === null) return { days: 0, atRisk: false, freezeReady: true };
  const gap = daysBetween(st.last, today);
  const freezeReady = !st.freezeWeeks.includes(weekKey(addDays(today, -1)));
  if (gap <= 1) return { days: st.streak, atRisk: gap === 1, freezeReady };
  if (gap === 2 && freezeReady) return { days: st.streak, atRisk: true, freezeReady, needsFreeze: true };
  return { days: 0, atRisk: false, freezeReady: true, lost: st.streak };
}
