import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  normComment, normDecision, normMessage, normMeta, normName, normProduct, normStatus, normStep, normTeam, roleOf,
  type Comment, type Decision, type Message, type Meta, type NameIdea, type Product, type Role, type StatusDoc, type Step, type Team,
} from "./model";
import { normAudit, planUpdate, rowToDoc, docToRow, type AuditEntry, type Row } from "./rows";
import { supabase } from "@/lib/supabase";

// Live data comes from Supabase. Each table is read once at start and read again whenever realtime says it
// changed (the tables are small, so a fresh read is simpler and never drifts). Row-level security decides
// what a signed-in founder can see and change; the database stamps who changed what into audit_log.
//
// Tables: steps, comments (step threads), messages (team thread), decisions, names, products,
// meta (studio + status), members (who is Chris and who is Aaron), audit_log (the Changes view).

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string;
  color: string;
}
export interface Member {
  id: string;
  role: Role;
  name: string;
  email: string;
  userId: string;
  avatarUrl: string;
}

export type Mode = "loading" | "live" | "offline" | "error";
const KEYS = ["steps", "comments", "messages", "decisions", "names", "products", "meta", "members", "audit"] as const;
type Key = (typeof KEYS)[number];
const TABLE: Record<Key, string> = {
  steps: "steps",
  comments: "comments",
  messages: "messages",
  decisions: "decisions",
  names: "names",
  products: "products",
  meta: "meta",
  members: "members",
  audit: "audit_log",
};

interface Store {
  mode: Mode;
  /** Which tables have delivered their first read. */
  ready: Record<Key, boolean>;
  steps: Step[];
  comments: Comment[];
  messages: Message[];
  decisions: Decision[];
  names: NameIdea[];
  products: Product[];
  meta: Meta;
  status: StatusDoc | null;
  team: Team;
  audit: AuditEntry[];
  /** My members.id (the id written into agree, votes and authorId). */
  me: string | null;
  role: Role | null;
  canWrite: boolean;
  profile: (id: string) => Profile | null;
  roleName: (r: Role) => string;
  roleProfile: (r: Role) => Profile | null;
  update: (path: string, fields: Record<string, unknown>) => Promise<boolean>;
  add: (collection: string, doc: Record<string, unknown>) => Promise<boolean>;
  toasts: Toast[];
  toast: (text: string, tone?: "ok" | "err") => void;
  dismiss: (id: number) => void;
  retry: () => void;
  signOut: () => Promise<void>;
  email: string;
}
export type Toast = { id: number; text: string; tone: "ok" | "err" };

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
};

const LABEL: Record<Role, string> = { chris: "Chris", aaron: "Aaron" };
const nowIso = () => new Date().toISOString();
type DbErr = { code?: string; message?: string };
const errText = (e: DbErr | undefined) =>
  e && (e.code === "42501" || e.code === "PGRST301")
    ? "You don't have permission to change that. Sign out and back in with your founder email."
    : e && e.code === "23514"
      ? "That didn't fit the rules for this field (too long or an unknown value)."
      : "Couldn't save that. Check your connection and try again.";

function list<T>(rows: Row[] | null, f: (id: string, d: Row) => T | null): T[] {
  const out: T[] = [];
  for (const r of rows || []) {
    try {
      const { id, data } = rowToDoc(r);
      const v = f(id, data);
      if (v) out.push(v);
    } catch {
      /* a malformed row never reaches a view */
    }
  }
  return out;
}

export function StoreProvider({ children, userId, email }: { children: ReactNode; userId: string; email: string }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [ready, setReady] = useState<Record<Key, boolean>>(() => Object.fromEntries(KEYS.map((k) => [k, false])) as Record<Key, boolean>);
  const [steps, setSteps] = useState<Step[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [names, setNames] = useState<NameIdea[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<Meta>(() => normMeta(null));
  const [status, setStatus] = useState<StatusDoc | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef(new Map<string, Promise<unknown>>());
  const seq = useRef(0);

  const toast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t.filter((x) => x.text !== text).slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "err" ? 8000 : 3500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    let alive = true;
    const mark = (k: Key) => setReady((r) => (r[k] ? r : { ...r, [k]: true }));
    let loaded = 0;

    const read = async (k: Key) => {
      const t = TABLE[k];
      let q = supabase.from(t).select("*");
      if (k === "comments") q = q.order("created_at", { ascending: false }).limit(500);
      if (k === "messages") q = q.order("created_at", { ascending: false }).limit(200);
      if (k === "audit") q = q.order("at", { ascending: false }).limit(150);
      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        mark(k);
        if (!loaded) setMode("error");
        return;
      }
      loaded++;
      const rows = (data || []) as Row[];
      switch (k) {
        case "steps":
          setSteps(list(rows, normStep));
          setMode("live");
          break;
        case "comments":
          setComments(list(rows, normComment).reverse());
          break;
        case "messages":
          setMessages(list(rows, normMessage).reverse());
          break;
        case "decisions":
          setDecisions(list(rows, normDecision));
          break;
        case "names":
          setNames(list(rows, normName));
          break;
        case "products":
          setProducts(list(rows, normProduct));
          break;
        case "meta": {
          const byId = new Map(rows.map((r) => [String(r.id), (r.data || {}) as Row]));
          setMeta(normMeta(byId.get("studio") || null));
          setStatus(normStatus(byId.get("status") || null));
          break;
        }
        case "members":
          setMembers(
            rows
              .filter((r) => r.role === "chris" || r.role === "aaron")
              .map((r) => ({
                id: String(r.id),
                role: r.role as Role,
                name: String(r.name || ""),
                email: String(r.email || ""),
                userId: String(r.user_id || ""),
                avatarUrl: String(r.avatar_url || ""),
              })),
          );
          break;
        case "audit":
          setAudit(rows.map(normAudit).filter((x): x is AuditEntry => !!x));
          break;
      }
      mark(k);
    };

    const timers = new Map<Key, ReturnType<typeof setTimeout>>();
    const soon = (k: Key) => {
      clearTimeout(timers.get(k));
      timers.set(k, setTimeout(() => void read(k), 150));
    };
    const all = () => KEYS.forEach((k) => soon(k));

    KEYS.forEach((k) => void read(k));

    let channel: RealtimeChannel | null = supabase.channel("studio-hq");
    for (const k of KEYS) {
      // Every change, deletes included, also writes an audit_log row; deletes aren't published (they would
      // skip row-level security), so an audit event refreshes everything.
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: TABLE[k] }, () => {
        if (k === "audit") all();
        else soon(k);
      });
    }
    let first = true;
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        if (!first) all(); // caught up after a reconnect
        first = false;
      }
    });
    // Back from the background (phone lock, another tab): read again in case a realtime event was missed.
    const onVis = () => document.visibilityState === "visible" && all();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", all);

    return () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", all);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [attempt]);

  const meRow = members.find((m) => m.userId === userId) || null;
  const me = meRow ? meRow.id : null;
  const team: Team = useMemo(() => {
    const t: Record<string, unknown> = {};
    members.forEach((m) => (t[m.role] = m.id));
    return normTeam(t);
  }, [members]);

  // One write at a time per row: each write waits for the previous one to the same path.
  const serial = useCallback(<T,>(path: string, fn: () => Promise<T>): Promise<T> => {
    const prev = queue.current.get(path) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    queue.current.set(path, next);
    next.finally(() => queue.current.get(path) === next && queue.current.delete(path)).catch(() => {});
    return next;
  }, []);

  const fail = useCallback((e: DbErr) => toast(errText(e), "err"), [toast]);

  const update = useCallback(
    async (path: string, fields: Record<string, unknown>) => {
      if (!me) return false;
      try {
        await serial(path, async () => {
          for (const w of planUpdate(path, fields, me)) {
            const { error } =
              w.kind === "rpc" ? await supabase.rpc(w.fn, w.args) : await supabase.from(w.table).update(w.row).eq("id", w.id);
            if (error) throw error;
          }
        });
        return true;
      } catch (e) {
        fail(e as DbErr);
        return false;
      }
    },
    [serial, fail, me],
  );
  const add = useCallback(
    async (collection: string, doc: Record<string, unknown>) => {
      if (!me) return false;
      try {
        const { error } = await supabase.from(collection).insert(docToRow(doc));
        if (error) throw error;
        return true;
      } catch (e) {
        fail(e as DbErr);
        return false;
      }
    },
    [fail, me],
  );

  const profiles = useMemo(() => {
    const p: Record<string, Profile> = {};
    members.forEach((m) => (p[m.id] = { id: m.id, name: m.name, avatarUrl: m.avatarUrl, color: "" }));
    return p;
  }, [members]);

  const role = meRow ? meRow.role : roleOf(me, team, null);
  const profile = useCallback((id: string) => (id && profiles[id]) || null, [profiles]);
  const roleProfile = useCallback((r: Role) => profile(team[r]), [profile, team]);
  const roleName = useCallback(
    (r: Role) => {
      const p = roleProfile(r);
      return (p && p.name ? p.name.trim().split(/\s+/)[0] : "") || LABEL[r];
    },
    [roleProfile],
  );

  const value: Store = {
    mode,
    ready,
    steps,
    comments,
    messages,
    decisions,
    names,
    products,
    meta,
    status,
    team,
    audit,
    me,
    role,
    canWrite: !!me && mode !== "offline",
    profile,
    roleName,
    roleProfile,
    update,
    add,
    toasts,
    toast,
    dismiss,
    retry: () => {
      setMode("loading");
      setReady(Object.fromEntries(KEYS.map((k) => [k, false])) as Record<Key, boolean>);
      setAttempt((a) => a + 1);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    email,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The name to show for any author id: their profile name, else Chris/Aaron by the team roster, else "Someone". */
export function useAuthor() {
  const { profile, team, me } = useStore();
  return useCallback(
    (id: string, opts?: { you?: boolean }) => {
      if (opts?.you && id && id === me) return "You";
      const p = profile(id);
      if (p && p.name) return p.name.trim().split(/\s+/)[0];
      if (id && id === team.chris) return "Chris";
      if (id && id === team.aaron) return "Aaron";
      return "Someone";
    },
    [profile, team, me],
  );
}
export { nowIso };
