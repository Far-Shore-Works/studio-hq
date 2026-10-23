// Pure data rules for Studio HQ: no React, no imports, so the tests run on plain Node.
// Every normalizer accepts whatever is in the database (old docs, missing fields, junk) and returns a
// renderable shape or null. Nothing here writes.

export type Role = "chris" | "aaron";
export type Owner = Role | "both";
export type Status = "todo" | "doing" | "done" | "blocked";

export const STATUSES: { id: Status; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];
export const OWNERS: Owner[] = ["chris", "aaron", "both"];

export const PHASES = [
  { n: 1, name: "Agree", why: "Settle the founder terms in writing before anyone writes code for the company." },
  { n: 2, name: "Clear", why: "Approvals and answers that have to come first." },
  { n: 3, name: "Form", why: "Create the LLC and put the ownership on paper." },
  { n: 4, name: "Set up", why: "Bank, identity and the shared tools." },
  { n: 5, name: "Ship", why: "Store accounts and the first release." },
  { n: 6, name: "Run", why: "Books, taxes and the yearly filings." },
] as const;

export const PRODUCT_STATUSES = ["Idea", "Backlog", "In development", "Live", "Paused"];

export interface Step {
  id: string;
  phase: number;
  order: number;
  title: string;
  /** chris | aaron | both. Anything else (an old value) reads as unassigned: "". */
  owner: Owner | "";
  status: Status;
  cost: string;
  note: string;
  detail: string;
  /** YYYY-MM-DD or "". */
  due: string;
  updatedAt: string;
  createdAt: string;
}
export interface Comment {
  id: string;
  stepId: string;
  text: string;
  authorId: string;
  createdAt: string;
}
export interface Message {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
}
export interface Decision {
  id: string;
  date: string;
  title: string;
  detail: string;
  /** null = an older doc with no agreement data: it reads as settled. */
  agree: Record<string, string> | null;
  proposedBy: string;
  createdAt: string;
}
export interface NameIdea {
  id: string;
  name: string;
  note: string;
  order: number;
  voters: string[];
  createdAt: string;
}
export interface Product {
  id: string;
  order: number;
  name: string;
  status: string;
  platforms: string[];
  summary: string;
  next: string;
  inCompany: string;
  repo: string;
}
export interface Link {
  label: string;
  url: string;
}
export interface Meta {
  name: string;
  subtitle: string;
  links: Link[];
}
export interface StatusDoc {
  summary: string;
  asOf: string;
}
export interface Team {
  chris: string;
  aaron: string;
}

type Raw = Record<string, unknown> | null | undefined;
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : d);
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function normStep(id: string, d: Raw): Step | null {
  if (!d || typeof d !== "object") return null;
  const title = str(d.title).trim();
  if (!title) return null;
  const phase = Math.round(num(d.phase, 1));
  const st = str(d.status) as Status;
  const ow = str(d.owner) as Owner;
  const due = str(d.due);
  return {
    id,
    phase: phase >= 1 && phase <= 6 ? phase : phase > 6 ? 6 : 1,
    order: num(d.order, 999),
    title,
    owner: OWNERS.includes(ow) ? ow : "",
    status: STATUSES.some((s) => s.id === st) ? st : "todo",
    cost: str(d.cost).trim(),
    note: str(d.note).trim(),
    detail: str(d.detail).trim(),
    due: isDay(due) ? due : "",
    updatedAt: str(d.updatedAt),
    createdAt: str(d.createdAt),
  };
}
export function normComment(id: string, d: Raw): Comment | null {
  if (!d || typeof d !== "object") return null;
  const text = str(d.text).trim();
  const stepId = str(d.stepId);
  if (!text || !stepId) return null;
  return { id, stepId, text, authorId: str(d.authorId), createdAt: str(d.createdAt) };
}
export function normMessage(id: string, d: Raw): Message | null {
  if (!d || typeof d !== "object") return null;
  const text = str(d.text).trim();
  if (!text) return null;
  return { id, text, authorId: str(d.authorId), createdAt: str(d.createdAt) };
}
export function normDecision(id: string, d: Raw): Decision | null {
  if (!d || typeof d !== "object") return null;
  const title = str(d.title).trim();
  if (!title) return null;
  let agree: Record<string, string> | null = null;
  if (d.agree && typeof d.agree === "object" && !Array.isArray(d.agree)) {
    agree = {};
    for (const [k, v] of Object.entries(d.agree as Record<string, unknown>)) if (v) agree[k] = typeof v === "string" ? v : "yes";
  }
  return { id, date: str(d.date), title, detail: str(d.detail).trim(), agree, proposedBy: str(d.proposedBy), createdAt: str(d.createdAt) };
}
export function normName(id: string, d: Raw): NameIdea | null {
  if (!d || typeof d !== "object") return null;
  const name = str(d.name).trim();
  if (!name) return null;
  const votes = d.votes && typeof d.votes === "object" && !Array.isArray(d.votes) ? (d.votes as Record<string, unknown>) : {};
  return { id, name, note: str(d.note).trim(), order: num(d.order, 999), voters: Object.keys(votes).filter((k) => votes[k] === true).sort(), createdAt: str(d.createdAt) };
}
/** "PC · Steam", "Web, iOS" or an array, as chips. */
export function splitPlatforms(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.map(str) : str(v).split(/\s*[·,/|]\s*/);
  return parts.map((s) => s.trim()).filter(Boolean);
}
export function normProduct(id: string, d: Raw): Product | null {
  if (!d || typeof d !== "object") return null;
  const name = str(d.name).trim();
  if (!name) return null;
  const repo = str(d.repo).trim();
  return {
    id,
    order: num(d.order, 999),
    name,
    status: str(d.status).trim(),
    platforms: splitPlatforms(d.platforms),
    summary: str(d.summary).trim(),
    next: str(d.next).trim(),
    inCompany: str(d.inCompany).trim(),
    repo: safeUrl(repo),
  };
}
/** Only http(s) links are ever rendered as links. */
export function safeUrl(u: string): string {
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : "";
}
export function normMeta(d: Raw): Meta {
  const links: Link[] = [];
  if (d && Array.isArray(d.links))
    for (const l of d.links as unknown[]) {
      if (!l || typeof l !== "object") continue;
      const label = str((l as Record<string, unknown>).label).trim();
      if (label) links.push({ label, url: safeUrl(str((l as Record<string, unknown>).url).trim()) });
    }
  return { name: d ? str(d.name).trim() : "", subtitle: d ? str(d.subtitle).trim() : "", links };
}
export function normStatus(d: Raw): StatusDoc | null {
  if (!d) return null;
  const summary = str(d.summary).trim();
  return summary ? { summary, asOf: str(d.asOf) } : null;
}
export function normTeam(d: Raw): Team {
  return { chris: d ? str(d.chris) : "", aaron: d ? str(d.aaron) : "" };
}

export const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
export function sortSteps(steps: Step[]): Step[] {
  return steps.slice().sort((a, b) => a.phase - b.phase || a.order - b.order || a.title.localeCompare(b.title));
}

// ---- Progress -------------------------------------------------------------------------------
export interface PhaseStat {
  n: number;
  name: string;
  why: string;
  total: number;
  done: number;
  doing: number;
  blocked: number;
}
export function phaseStats(steps: Step[]): PhaseStat[] {
  return PHASES.map((p) => {
    const list = steps.filter((s) => s.phase === p.n);
    return {
      n: p.n,
      name: p.name,
      why: p.why,
      total: list.length,
      done: list.filter((s) => s.status === "done").length,
      doing: list.filter((s) => s.status === "doing").length,
      blocked: list.filter((s) => s.status === "blocked").length,
    };
  });
}
/** The first phase that still has open steps; 0 when there are no steps; 7 when everything is done. */
export function currentPhase(steps: Step[]): number {
  if (!steps.length) return 0;
  const open = steps.filter((s) => s.status !== "done").map((s) => s.phase);
  return open.length ? Math.min(...open) : 7;
}

// ---- Costs ------------------------------------------------------------------------------------
/** A cost note as a dollar range. "free" is 0; "~$150-300" is 150..300; "LA $100 / NM $50" is 50..100
 *  (one of the two applies); "$0-125/yr" is 0..125. null when there is no dollar figure to read. */
export function parseCost(s: string): { lo: number; hi: number } | null {
  const t = (s || "").toLowerCase();
  if (!t.trim()) return null;
  const vals: { lo: number; hi: number }[] = [];
  const re = /\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s*[-–]\s*\$?\s?(\d[\d,]*(?:\.\d+)?))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = parseFloat(m[1].replace(/,/g, ""));
    const b = m[2] ? parseFloat(m[2].replace(/,/g, "")) : a;
    if (Number.isFinite(a) && Number.isFinite(b)) vals.push({ lo: Math.min(a, b), hi: Math.max(a, b) });
  }
  if (vals.length) return { lo: Math.min(...vals.map((v) => v.lo)), hi: Math.max(...vals.map((v) => v.hi)) };
  if (/\b(free|no cost|\$0)\b/.test(t)) return { lo: 0, hi: 0 };
  return null;
}
export interface CostLine {
  id: string;
  title: string;
  cost: string;
  lo: number;
  hi: number;
}
export interface CostSummary {
  lo: number;
  hi: number;
  lines: CostLine[];
  /** Open steps with a cost note that has no dollar figure. */
  unpriced: number;
}
/** Upcoming costs: every step that isn't done and has a cost note. */
export function costSummary(steps: Step[]): CostSummary {
  const lines: CostLine[] = [];
  let unpriced = 0;
  for (const s of sortSteps(steps)) {
    if (s.status === "done" || !s.cost) continue;
    const c = parseCost(s.cost);
    if (!c) {
      unpriced++;
      continue;
    }
    lines.push({ id: s.id, title: s.title, cost: s.cost, lo: c.lo, hi: c.hi });
  }
  return { lo: lines.reduce((a, l) => a + l.lo, 0), hi: lines.reduce((a, l) => a + l.hi, 0), lines, unpriced };
}
export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
export function moneyRange(lo: number, hi: number): string {
  if (hi === 0) return "$0";
  return lo === hi ? money(lo) : `${money(lo)}–${Math.round(hi).toLocaleString("en-US")}`;
}

// ---- People ---------------------------------------------------------------------------------
/** Which cofounder this viewer is: by the team roster (members); isOwner is a fallback kept for older callers. */
export function roleOf(me: string | null, team: Team, isOwner: boolean | null): Role | null {
  if (me && team.chris === me) return "chris";
  if (me && team.aaron === me) return "aaron";
  if (isOwner === true) return "chris";
  // Anyone else is Aaron only until Aaron's own id is on file; after that, a third viewer is nobody's "you".
  if (isOwner === false && me && !team.aaron) return "aaron";
  return null;
}

/** Open steps for one cofounder (their own and shared ones): doing first, then blocked, then the soonest
 *  due date, then plan order. */
export function upNext(steps: Step[], role: Role, n = 3): Step[] {
  const rank = (s: Step) => (s.status === "doing" ? 0 : s.status === "blocked" ? 1 : 2);
  return steps
    .filter((s) => s.status !== "done" && (s.owner === role || s.owner === "both"))
    .sort((a, b) => rank(a) - rank(b) || (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0) || a.phase - b.phase || a.order - b.order)
    .slice(0, n);
}

// ---- Decisions --------------------------------------------------------------------------------
/** Who has agreed (ids). An older doc with no agreement data has no names on it. */
export function agreedIds(d: Decision): string[] {
  return d.agree ? Object.keys(d.agree).filter((k) => d.agree![k]) : [];
}
/** Settled when both cofounders agreed. Older docs (no `agree` field) were settled when written. */
export function isSettled(d: Decision, team: Team): boolean {
  if (!d.agree) return true;
  const ids = agreedIds(d);
  return !!team.chris && !!team.aaron && team.chris !== team.aaron && ids.includes(team.chris) && ids.includes(team.aaron);
}
export function sortDecisions(list: Decision[]): Decision[] {
  const key = (d: Decision) => d.createdAt || d.date;
  return list.slice().sort((a, b) => key(b).localeCompare(key(a)) || a.title.localeCompare(b.title));
}

// ---- Names ----------------------------------------------------------------------------------
export function rankNames(names: NameIdea[]): { list: NameIdea[]; top: number } {
  const list = names.slice().sort((a, b) => b.voters.length - a.voters.length || a.order - b.order || a.name.localeCompare(b.name));
  return { list, top: list.length ? list[0].voters.length : 0 };
}

// ---- Dates ----------------------------------------------------------------------------------
export function localDay(d = new Date()): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayLabel(day: string, today = localDay()): string {
  if (!isDay(day)) return day;
  const [y, m, d] = day.split("-").map(Number);
  const ty = +today.slice(0, 4);
  return `${MONTHS[m - 1]} ${d}` + (y !== ty ? `, ${y}` : "");
}
function dayDiff(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
}
/** A due date as a chip: overdue, soon (within 7 days) or plain. */
export function dueInfo(due: string, today = localDay()): { label: string; tone: "late" | "soon" | "plain" } | null {
  if (!isDay(due)) return null;
  const n = dayDiff(due, today);
  if (n < 0) return { label: `Overdue ${-n}d`, tone: "late" };
  if (n === 0) return { label: "Due today", tone: "soon" };
  if (n === 1) return { label: "Due tomorrow", tone: "soon" };
  if (n <= 7) return { label: dayLabel(due, today), tone: "soon" };
  return { label: dayLabel(due, today), tone: "plain" };
}
/** "just now", "5m ago", "3h ago", "yesterday", "Oct 12". */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = (now - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 172800) return "yesterday";
  const d = new Date(t);
  return dayLabel(localDay(d), localDay(new Date(now)));
}
export function firstName(full: string): string {
  return (full || "").trim().split(/\s+/)[0] || "";
}
