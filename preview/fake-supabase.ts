// Local preview only (vite --mode shots): an in-memory stand-in for the Supabase client so the signed-in
// page can be screenshotted without a real sign-in. Never part of the production build (vite.config.ts
// swaps it in only in "shots" mode). Data comes from preview/seed.local.json (gitignored; made by
// scripts/make-preview-seed.py from an export) or an empty seed.
//   ?out=1        signed out (the sign-in screen)
//   ?as=aaron     view as Aaron instead of Chris
//   ?outsider=1   signed in with an email that isn't on the list
//   ?missing=docs,hours   those tables error as if the database migration hadn't been applied

type Row = Record<string, unknown>;
type Cb = () => void;
const qs = new URLSearchParams(location.search);
const ME_ROLE = qs.get("as") === "aaron" ? "aaron" : "chris";
const USER_ID = "00000000-0000-4000-8000-0000000000" + (ME_ROLE === "chris" ? "01" : "02");

let db: Record<string, Row[]> = {};
const listeners: Cb[] = [];
const ready = fetch("/preview/seed.local.json")
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}))
  .then((seed: Record<string, Row[]>) => {
    db = seed || {};
    db.members = qs.get("outsider") ? [] : (db.members || []).map((m) => ({ ...m, user_id: m.role === ME_ROLE ? USER_ID : null }));
  });
const missing = (qs.get("missing") || "").split(",").filter(Boolean);
const emit = () => listeners.forEach((f) => setTimeout(f, 30));

function query(table: string) {
  // Like the real row-level security on docs: shared docs and the viewer's own private ones.
  const myId = () => (db.members || []).find((m) => m.role === ME_ROLE)?.id;
  let rows = () => (db[table] || []).filter((r) => table !== "docs" || r.visibility === "shared" || r.owner === myId());
  let single = false;
  const api = {
    select: () => api,
    order: (col: string, o?: { ascending?: boolean }) => {
      const prev = rows;
      rows = () => prev().sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (o?.ascending === false ? -1 : 1));
      return api;
    },
    limit: (n: number) => {
      const prev = rows;
      rows = () => prev().slice(0, n);
      return api;
    },
    eq: (col: string, v: unknown) => {
      const prev = rows;
      rows = () => prev().filter((r) => r[col] === v);
      return api;
    },
    maybeSingle: () => {
      single = true;
      return api;
    },
    then: (res: (v: { data: unknown; error: null }) => void) =>
      ready.then(() => {
        if (missing.includes(table)) return res({ data: null, error: { code: "42P01", message: "relation does not exist" } } as never);
        const r = rows();
        res({ data: single ? r[0] || null : r, error: null });
      }),
    insert: async (row: Row) => {
      await ready;
      (db[table] = db[table] || []).push({ id: Math.random().toString(36).slice(2), created_at: new Date().toISOString(), ...row });
      emit();
      return { error: null };
    },
    update: (row: Row) => ({
      eq: async (_c: string, id: unknown) => {
        await ready;
        const r = (db[table] || []).find((x) => x.id === id);
        if (r) Object.assign(r, row, { updated_at: new Date().toISOString() });
        emit();
        return { error: null };
      },
    }),
  };
  return api;
}

const session = { user: { id: USER_ID, email: qs.get("outsider") ? "someone@example.com" : ME_ROLE === "chris" ? "chris@example.com" : "aaron@example.com" } };
let authCb: ((e: string, s: unknown) => void) | null = null;

export const SUPABASE_URL = "http://preview.invalid";
export const SUPABASE_KEY = "preview";
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: qs.get("out") ? null : session } }),
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      authCb = cb;
      return { data: { subscription: { unsubscribe: () => (authCb = null) } } };
    },
    signOut: async () => authCb && authCb("SIGNED_OUT", null),
    signInWithOtp: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: { message: "preview" } }),
  },
  from: (t: string) => query(t),
  rpc: async (fn: string, args: Row) => {
    await ready;
    const me = (db.members || []).find((m) => m.role === ME_ROLE)?.id as string;
    if (fn === "set_vote") {
      const n = (db.names || []).find((x) => x.id === args.p_name);
      if (n) {
        const v = { ...(n.votes as Row) };
        if (args.p_on) v[me] = true;
        else delete v[me];
        n.votes = v;
      }
    }
    if (fn === "set_agree") {
      const d = (db.decisions || []).find((x) => x.id === args.p_decision);
      if (d && d.agree) {
        const a = { ...(d.agree as Row) };
        if (args.p_on) a[me] = new Date().toISOString();
        else delete a[me];
        d.agree = a;
      }
    }
    emit();
    return { data: null, error: null };
  },
  channel: () => {
    const ch = {
      on: (_e: string, _f: unknown, cb: Cb) => {
        listeners.push(cb);
        return ch;
      },
      subscribe: (cb?: (s: string) => void) => {
        cb && cb("SUBSCRIBED");
        return ch;
      },
    };
    return ch;
  },
  removeChannel: async () => {},
};
export async function authSettings() {
  return { github: qs.get("github") === "1", email: true };
}
