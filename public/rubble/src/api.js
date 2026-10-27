// The score server, stubbed. Nothing is sent anywhere in v1: ENABLED is false and no account
// or project exists. The design (server/README.md) is a small Supabase project that stores
// anonymous daily scores, re-runs each run with src/verify.js, and answers "better than N%".
export const API = { ENABLED: false, URL: '', ANON_KEY: '' };

/** Anonymous per-device id, so one device counts once per day. Stored locally. */
export function clientId() {
  try {
    let id = localStorage.getItem('topple:v1:cid');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem('topple:v1:cid', id); }
    return id;
  } catch { return 'anon'; }
}

/** Would POST { key, shots, clientId } to the server. Returns null while disabled. */
export async function submitRun(run) {
  if (!API.ENABLED) return null;
  const r = await fetch(`${API.URL}/functions/v1/submit`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: API.ANON_KEY }, body: JSON.stringify({ ...run, clientId: clientId() }) });
  return r.ok ? r.json() : null;
}

/** { betterThan: 0..100, players: n } for a day, or null while disabled. */
export async function fetchRank(key, pct) {
  if (!API.ENABLED) return null;
  const r = await fetch(`${API.URL}/rest/v1/rpc/day_rank`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: API.ANON_KEY }, body: JSON.stringify({ p_day: key, p_pct: pct }) });
  return r.ok ? r.json() : null;
}

/** Dev only (?dev=1&mockrank=1): a made-up rank so the screen can be checked. Never shown to players. */
export function mockRank(pct) {
  const better = Math.max(1, Math.min(99, Math.round(100 * (1 - Math.pow(1 - pct / 100, 2.2)))));
  return { betterThan: better, players: 1234, mock: true };
}
