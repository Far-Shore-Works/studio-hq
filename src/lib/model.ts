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
  /** YYYY-MM-DD the state approved the LLC; set only when that has happened. */
  llcApprovedOn: string;
}
export interface Team {
  chris: string;
  aaron: string;
}

type Raw = Record<string, unknown> | null | undefined;
const MAC_ROMAN_HIGH = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
/** Text that was UTF-8 but got read as Mac Roman somewhere in an import ("PC ¬∑ Steam", "‚Äúquoted‚Äù") is
 *  turned back into what it was. Anything that doesn't decode cleanly is left alone. */
export function fixMojibake(s: string): string {
  if (!/[¬‚„Ä√ÇÃ]/.test(s)) return s;
  const high = "\\u0080-\\uFFFF";
  // Repair each run of non-ASCII characters on its own, so clean text around it is left alone.
  return s.replace(new RegExp(`[${high}]{2,}`, "gu"), (run) => {
    const bytes: number[] = [];
    for (const ch of run) {
      const i = MAC_ROMAN_HIGH.indexOf(ch);
      if (i < 0) return run;
      bytes.push(0x80 + i);
    }
    try {
      const out = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      // Only punctuation and symbols that imports commonly mangle; a decode that lands on a letter is left alone.
      return out.length < run.length && /^[·•“”‘’‚„—–…‹›©®™°±×÷→←↑↓✓✔§¶€£¢ ]+$/.test(out) ? out : run;
    } catch {
      return run;
    }
  });
}
const str = (v: unknown) => (typeof v === "string" ? fixMojibake(v) : typeof v === "number" ? String(v) : "");
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(+v) ? +v : d);
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isRealDay = (s: string) => {
  if (!isDay(s)) return false;
  const t = new Date(s + "T00:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
};

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
    due: isRealDay(due) ? due : "",
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
  // A comma only separates platforms in a plain list ("Web, iOS"), not in a phrase ("itch.io first, then Steam").
  const text = str(v);
  const splitter = /,\s*(then|and|later|first)\b/i.test(text) ? /\s*[·/|]\s*/ : /\s*[·,/|]\s*/;
  const parts = Array.isArray(v) ? v.map(str) : text.split(splitter);
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
  const ap = str(d.llcApprovedOn);
  const llcApprovedOn = isRealDay(ap) ? ap : "";
  return summary || llcApprovedOn ? { summary, asOf: str(d.asOf), llcApprovedOn } : null;
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

// ---- Docs -------------------------------------------------------------------------------------
export const DOC_FOLDERS = ["Plan", "Money", "Decisions", "Game", "Admin"] as const;
export type DocFolder = (typeof DOC_FOLDERS)[number];
export type Visibility = "shared" | "private";

export interface Doc {
  id: string;
  folder: DocFolder;
  title: string;
  slug: string;
  body: string;
  visibility: Visibility;
  /** members.id of the founder who owns it. A private doc is only ever returned to its owner. */
  owner: string;
  sourcePath: string;
  /** The file on GitHub (a Far-Shore-Works repo only); "" for a doc that isn't from a repo. */
  sourceUrl: string;
  /** Short hash of the last commit that changed the source file. */
  sourceCommit: string;
  /** When the doc's content last changed (a sync that finds nothing new leaves this alone). */
  updatedAt: string;
  /** When a sync last checked the doc against its source. */
  syncedAt: string;
}
/** Only a file in one of the studio's own GitHub repos is ever linked as a doc's source. */
export function sourceLink(u: string): string {
  return /^https:\/\/github\.com\/Far-Shore-Works\/[A-Za-z0-9._-]+\/blob\/[^\s]+$/.test(u) ? u : "";
}
/** "Far-Shore-Works/studio" and "ledger/expenses.csv" from a source link. */
export function sourceParts(u: string): { repo: string; path: string } | null {
  const m = /^https:\/\/github\.com\/(Far-Shore-Works\/[A-Za-z0-9._-]+)\/blob\/[^/\s]+\/([^\s?#]+)/.exec(u);
  if (!m) return null;
  try {
    return { repo: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return { repo: m[1], path: m[2] };
  }
}
/** Docs made from other files in the same repo folder (ledger/README.md and ledger/expenses.csv), for "also in this folder".
 *  Top-level files don't count: that would list every doc. */
export function siblingDocs(doc: Doc, docs: Doc[]): Doc[] {
  const dir = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const mine = dir(doc.sourcePath);
  if (mine.split("/").length < 2) return [];
  return docs.filter((d) => d.id !== doc.id && dir(d.sourcePath) === mine).sort((a, b) => a.title.localeCompare(b.title));
}
export function normDoc(id: string, d: Raw): Doc | null {
  if (!d || typeof d !== "object") return null;
  const title = str(d.title).trim();
  const slug = str(d.slug).trim();
  const folder = str(d.folder) as DocFolder;
  if (!title || !slug || !DOC_FOLDERS.includes(folder)) return null;
  return {
    id,
    folder,
    title,
    slug,
    body: str(d.bodyMd),
    visibility: d.visibility === "shared" ? "shared" : "private",
    owner: str(d.owner),
    sourcePath: str(d.sourcePath).trim(),
    sourceUrl: sourceLink(str(d.sourceUrl).trim()),
    sourceCommit: /^[0-9a-f]{7,40}$/.test(str(d.sourceCommit).trim()) ? str(d.sourceCommit).trim() : "",
    updatedAt: str(d.updatedAt),
    syncedAt: str(d.syncedAt),
  };
}

/** Plain text of some markdown, for searching and snippets (no syntax characters, one line). */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, " "))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:[#>]+|[-*+]|\d+\.)[ \t]+/gm, "")
    .replace(/[`*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export interface DocHit {
  doc: Doc;
  score: number;
  /** A short piece of the body around the first match; "" when only the title matched. */
  snippet: string;
}
/** Every word of the query must appear somewhere in the title, folder or body (case-insensitive). Title
 *  matches rank first. An empty query returns every doc in folder order, then title. */
export function searchDocs(docs: Doc[], query: string, folder: DocFolder | "all" = "all"): DocHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const pool = docs.filter((d) => folder === "all" || d.folder === folder);
  const byFolder = (a: Doc, b: Doc) => DOC_FOLDERS.indexOf(a.folder) - DOC_FOLDERS.indexOf(b.folder) || a.title.localeCompare(b.title);
  if (!words.length) return pool.slice().sort(byFolder).map((doc) => ({ doc, score: 0, snippet: "" }));
  const hits: DocHit[] = [];
  for (const doc of pool) {
    const title = doc.title.toLowerCase();
    const text = plainText(doc.body);
    const low = text.toLowerCase();
    const head = (title + " " + doc.folder.toLowerCase() + " " + doc.slug).toLowerCase();
    if (!words.every((w) => head.includes(w) || low.includes(w))) continue;
    let score = 0;
    for (const w of words) score += (title.includes(w) ? 10 : 0) + (head.includes(w) ? 2 : 0) + Math.min(5, low.split(w).length - 1);
    let snippet = "";
    const at = words.map((w) => low.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (at !== undefined && !words.every((w) => title.includes(w))) {
      let from = Math.max(0, at - 50);
      if (from > 0) from = text.indexOf(" ", from) + 1 || from; // start on a whole word
      snippet = (from > 0 ? "…" : "") + text.slice(from, at + 110).trim() + (at + 110 < text.length ? "…" : "");
    }
    hits.push({ doc, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score || byFolder(a.doc, b.doc));
}

// ---- Hours ------------------------------------------------------------------------------------
export interface HoursRow {
  id: string;
  memberId: string;
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  hours: number;
  note: string;
}
export function normHours(id: string, d: Raw): HoursRow | null {
  if (!d || typeof d !== "object") return null;
  const weekStart = str(d.weekStart);
  const hours = num(d.hours, NaN);
  if (!isDay(weekStart) || !Number.isFinite(hours) || hours < 0) return null;
  return { id, memberId: str(d.memberId), weekStart, hours, note: str(d.note).trim() };
}
/** Monday of the week that contains `day` (YYYY-MM-DD), as YYYY-MM-DD. */
export function weekStartOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** "Oct 19 – 25" for the week starting on a Monday. */
export function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const a = dayLabel(weekStart, weekStart);
  const b = dayLabel(end, end);
  return a.slice(0, 3) === b.slice(0, 3) ? `${a.replace(/,.*/, "")} – ${+end.slice(8)}` : `${a.replace(/,.*/, "")} – ${b.replace(/,.*/, "")}`;
}
export function fmtHours(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
export interface HoursStats {
  /** Hours across every logged week. */
  total: number;
  /** Weeks with an entry. */
  logged: number;
  /** Average per week over the last 4 weeks, this week included. Starts at the first logged week, so a new
   *  log isn't diluted by weeks before it began; a week after that with no entry counts as 0. */
  avg4: number;
  /** How many weeks that average is over (1 to 4). */
  weeksCounted: number;
}
export function hoursStats(rows: HoursRow[], memberId: string, today = localDay()): HoursStats {
  const mine = rows.filter((r) => r.memberId === memberId);
  const total = mine.reduce((a, r) => a + r.hours, 0);
  if (!mine.length) return { total: 0, logged: 0, avg4: 0, weeksCounted: 0 };
  const cur = weekStartOf(today);
  const first = mine.map((r) => r.weekStart).sort()[0];
  const windowStart = addDays(cur, -21);
  const from = first > windowStart ? first : windowStart;
  const weeksCounted = Math.max(1, Math.round(dayDiff(cur, weekStartOf(from)) / 7) + 1);
  const inWindow = mine.filter((r) => r.weekStart >= weekStartOf(from) && r.weekStart <= cur).reduce((a, r) => a + r.hours, 0);
  return { total, logged: mine.length, avg4: inWindow / weeksCounted, weeksCounted };
}

// ---- Money in ---------------------------------------------------------------------------------
/** Founder terms item 7 (draft v2): Chris's first $500 of approved costs is a gift to the studio; every other
 *  approved cost, and Aaron's from his first dollar, is repaid before profit is split. */
export const GIFT_THRESHOLD_USD = 500;
export interface LedgerRow {
  id: string;
  date: string;
  item: string;
  vendor: string;
  amount: number;
  paidBy: string;
  approvedBy: string;
  category: string;
  notes: string;
}
export function normLedger(id: string, d: Raw): LedgerRow | null {
  if (!d || typeof d !== "object") return null;
  const amount = num(d.amountUsd, NaN);
  if (!Number.isFinite(amount)) return null;
  return {
    id,
    date: str(d.date),
    item: str(d.item).trim(),
    vendor: str(d.vendor).trim(),
    amount,
    paidBy: str(d.paidBy).trim(),
    approvedBy: str(d.approvedBy).trim(),
    category: str(d.category).trim(),
    notes: str(d.notes).trim(),
  };
}
export interface FounderMoney {
  /** Everything this founder paid, approved or not. */
  paid: number;
  /** Paid with an approver on the line: what counts under the terms. */
  approved: number;
  /** Paid with nobody's approval recorded yet: stays personal until the founders agree otherwise. */
  unapproved: number;
  purchases: number;
  /** Part of `approved` that is a gift to the studio (Chris only, up to the threshold). */
  gift: number;
  /** Part of `approved` the studio repays before splitting profit. */
  owedBack: number;
}
export interface MoneyIn {
  chris: FounderMoney;
  aaron: FounderMoney;
  /** Lines whose paid_by is neither founder (for example "Studio"). */
  other: { amount: number; purchases: number };
  threshold: number;
  /** 0 to 1: how much of Chris's gift threshold his approved costs fill. */
  giftProgress: number;
}
/** Totals by paid_by. `names` are the words that identify each founder in the ledger (role, first name). */
export function moneyIn(rows: LedgerRow[], names: Record<Role, string[]>): MoneyIn {
  const empty = (): FounderMoney => ({ paid: 0, approved: 0, unapproved: 0, purchases: 0, gift: 0, owedBack: 0 });
  const out: MoneyIn = { chris: empty(), aaron: empty(), other: { amount: 0, purchases: 0 }, threshold: GIFT_THRESHOLD_USD, giftProgress: 0 };
  const who = (paidBy: string): Role | null => {
    const p = paidBy.trim().toLowerCase();
    if (!p) return null;
    for (const r of ["chris", "aaron"] as Role[]) if (names[r].some((n) => n && (p === n || p.split(/[\s,&/+]+/)[0] === n))) return r;
    return null;
  };
  for (const row of rows) {
    const r = who(row.paidBy);
    if (!r) {
      out.other.amount += row.amount;
      out.other.purchases++;
      continue;
    }
    const f = out[r];
    f.paid += row.amount;
    f.purchases++;
    if (row.approvedBy) f.approved += row.amount;
    else f.unapproved += row.amount;
  }
  out.chris.gift = Math.min(out.chris.approved, GIFT_THRESHOLD_USD);
  out.chris.owedBack = Math.max(0, out.chris.approved - GIFT_THRESHOLD_USD);
  out.aaron.owedBack = out.aaron.approved;
  out.giftProgress = Math.min(1, out.chris.approved / GIFT_THRESHOLD_USD);
  const cents = (n: number) => Math.round(n * 100) / 100;
  for (const f of [out.chris, out.aaron]) for (const k of ["paid", "approved", "unapproved", "gift", "owedBack"] as const) f[k] = cents(f[k]);
  return out;
}
/** Dollars with cents only when there are some: $11.25, $500. */
export function dollars(n: number): string {
  const r = Math.round(n * 100) / 100;
  return "$" + (Number.isInteger(r) ? r.toLocaleString("en-US") : r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

// ---- Before the operating agreement is signed ---------------------------------------------------
export interface SigningItem {
  id: string;
  /** What has to happen, in plain words. */
  label: string;
  /** Who it waits on. */
  who: Owner | "state";
  done: boolean;
  /** One more line of context, when there is one. */
  note?: string;
  /** The step to open when the item is tapped. */
  stepId?: string;
}
export interface SigningState {
  /** The "sign the operating agreement" step; null when the plan has none. */
  step: Step | null;
  signed: boolean;
  /** Has to happen before the signing. */
  before: SigningItem[];
  /** Open in the same stretch of the plan, but not tied to the signing by anything written down. */
  alongside: SigningItem[];
  left: number;
}
/** What is still open before the two founders sign, read from the plan as it stands: the signing step's "Still open:"
 *  sentence, whether both founders agreed to the terms, whether the state approved the LLC, and the nearby steps. */
export function signingState(steps: Step[], decisions: Decision[], team: Team, status?: StatusDoc | null): SigningState {
  const find = (re: RegExp) => steps.find((s) => re.test(s.title));
  const sign = find(/\bsign\b.*operating agreement/i) || null;
  const before: SigningItem[] = [];
  const alongside: SigningItem[] = [];
  const signed = !!sign && sign.status === "done";

  // 1. Both founders agree to the terms (the decision about the agreement).
  const dec = decisions.filter((d) => /operating agreement/i.test(d.title) && d.agree).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))[0];
  if (dec) {
    const ids = agreedIds(dec);
    const chris = !!team.chris && ids.includes(team.chris);
    const aaron = !!team.aaron && ids.includes(team.aaron);
    const waiting = !chris && !aaron ? "Neither founder has agreed yet" : !chris ? "Waiting on Chris" : !aaron ? "Waiting on Aaron" : "Both agreed";
    before.push({ id: "agree", label: "Both founders agree to the terms", who: !chris && !aaron ? "both" : !chris ? "chris" : "aaron", done: isSettled(dec, team), note: waiting });
  }

  // 2. What the signing step says is still open ("Still open: ...; ... Sign once ...").
  const m = sign?.note.match(/Still open:\s*(.+?)(?:\.\s+(?:Sign|Not signed)\b|\.\s*$|$)/is);
  if (m && !signed) {
    m[1]
      .split(/;\s*/)
      .map((t) => t.trim().replace(/\.$/, ""))
      .filter((t) => t && !/^(sign|not signed)\b/i.test(t))
      .forEach((t, i) => {
        const who: Owner = /^aaron\b/i.test(t) ? "aaron" : /^chris\b/i.test(t) ? "chris" : "both";
        before.push({ id: "open-" + i, label: t.charAt(0).toUpperCase() + t.slice(1), who, done: false, stepId: sign!.id });
      });
  }

  // 3. The state approves the LLC. Only an explicit signal counts: a date in the status doc (llcApprovedOn) or a
  //    separate step about the state's approval marked done. Finishing the filing step is not approval.
  const { filing, approvalStep, approved } = llcApproval(steps, status);
  if (filing || approvalStep || status?.llcApprovedOn) {
    before.push({
      id: "state",
      label: "New Mexico approves the LLC",
      who: "state",
      done: approved,
      note: approved ? undefined : filingNote(filing),
      stepId: (approvalStep || filing)?.id,
    });
  }

  // Alongside: not written down as a condition for signing.
  const spouse = find(/spouse consent/i);
  if (spouse) alongside.push({ id: spouse.id, label: "Spouse consent forms", who: spouse.owner || "both", done: spouse.status === "done", stepId: spouse.id });
  const air = find(/outside-activity approval \(DAF/i);
  if (air) alongside.push({ id: air.id, label: "Air Force written approval", who: air.owner || "chris", done: air.status === "done", note: "Verbal go-ahead given; written approval pending", stepId: air.id });

  const left = before.filter((i) => !i.done).length;
  return { step: sign, signed, before, alongside, left };
}

/** The year a yearless "Mon D" most recently happened in: this year, or last year if that date is still ahead. */
function yearFor(mo: number, day: number, now: Date): number {
  const y = now.getUTCFullYear();
  return Date.UTC(y, mo, day) > now.getTime() + 86400000 ? y - 1 : y;
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Filed Oct 23, approval pending (~early Nov)" from the filing step's note; plain fallbacks when it says less. */
export function filingNote(filing?: Step): string {
  if (!filing || filing.status === "todo") return "Not filed yet";
  const m = filing.note.match(/\bfiled\b[^.]*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2})\b/i);
  const behind = filing.note.match(/about (\d{1,2}) days behind/i);
  let eta = "";
  const said = filing.note.match(/\b(early|mid|late)[- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i);
  if (said) eta = `${said[1].toLowerCase()} ${said[2]}`;
  else if (m && behind) {
    // Day arithmetic on a real calendar date (year from the note, else this year), so month ends and leap years hold.
    const mo = MON.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0, 3));
    const yr = +(filing.note.match(/\b(20\d{2})\b/)?.[1] || yearFor(mo, +m[2], new Date()));
    const at = new Date(Date.UTC(yr, mo, +m[2] + +behind[1]));
    const d2 = at.getUTCDate();
    eta = `${d2 <= 10 ? "early" : d2 <= 20 ? "mid" : "late"} ${MON[at.getUTCMonth()]}`;
  }
  return `${m ? `Filed ${MON[MON.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0, 3))]} ${m[2]}` : "Filed"}, approval pending${eta ? ` (~${eta})` : ""}`;
}

// ---- Your move ----------------------------------------------------------------------------------
export interface MoveItem {
  kind: "decision" | "step";
  id: string;
  title: string;
  /** One short line of context. */
  sub: string;
  status?: Status;
  due?: string;
  /** Shared with the other founder. */
  both?: boolean;
}
/** What is waiting on one founder: decisions they haven't agreed to yet, then their open steps (their own and shared),
 *  doing first, then blocked, then the soonest due, then plan order. */
export function yourMove(steps: Step[], decisions: Decision[], team: Team, role: Role): { items: MoveItem[]; total: number } {
  const me = team[role];
  const items: MoveItem[] = [];
  for (const d of sortDecisions(decisions))
    if (d.agree && !isSettled(d, team) && me && !agreedIds(d).includes(me)) items.push({ kind: "decision", id: d.id, title: d.title, sub: "Waiting for your Agree" });
  const rank = (s: Step) => (s.status === "doing" ? 0 : s.status === "blocked" ? 1 : 2);
  steps
    .filter((s) => s.status !== "done" && (s.owner === role || s.owner === "both"))
    .sort((a, b) => rank(a) - rank(b) || (a.due && b.due ? a.due.localeCompare(b.due) : a.due ? -1 : b.due ? 1 : 0) || a.phase - b.phase || a.order - b.order)
    .forEach((s) => items.push({ kind: "step", id: s.id, title: s.title, sub: PHASES[s.phase - 1].name, status: s.status, due: s.due, both: s.owner === "both" }));
  return { items, total: items.length };
}

/** Whether the state has approved the LLC, from an explicit signal only (see signingState). */
export function llcApproval(steps: Step[], status?: StatusDoc | null): { filing?: Step; approvalStep?: Step; approved: boolean } {
  const filing = steps.find((s) => /articles of organization/i.test(s.title));
  const approvalStep = steps.find((s) => s !== filing && /^(the state|state|new mexico|nm)\b.*\bapprov(es|ed|al)\b/i.test(s.title) && !/\b(check|confirm|pending|waiting|air force|daf)\b/i.test(s.title));
  return { filing, approvalStep, approved: !!status?.llcApprovedOn || approvalStep?.status === "done" };
}

// ---- Coming up ----------------------------------------------------------------------------------
export interface Upcoming {
  id: string;
  date: string; // YYYY-MM-DD
  /** The date is an estimate, shown with a "~". */
  approx?: boolean;
  title: string;
  owner: Owner | "state" | "";
  stepId?: string;
}
/** The filing step's note ("Filed Oct 23 ... about 9 days behind") as an estimated approval date. */
export function filingEtaDate(filing: Step | undefined, now = new Date()): string {
  if (!filing || filing.status === "todo") return "";
  const m = filing.note.match(/\bfiled\b[^.]*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2})\b/i);
  const behind = filing.note.match(/about (\d{1,2}) days behind/i);
  if (!m || !behind) return "";
  const mo = MON.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0, 3));
  const yr = +(filing.note.match(/\b(20\d{2})\b/)?.[1] || yearFor(mo, +m[2], now));
  return new Date(Date.UTC(yr, mo, +m[2] + +behind[1])).toISOString().slice(0, 10);
}
/** Dated, not-done steps in date order, plus the expected state approval while it is still pending. */
export function comingUp(steps: Step[], status?: StatusDoc | null, now = new Date()): Upcoming[] {
  const out: Upcoming[] = steps
    .filter((s) => s.due && s.status !== "done")
    .map((s) => ({ id: s.id, date: s.due, title: s.title, owner: s.owner, stepId: s.id }));
  const { filing, approved } = llcApproval(steps, status);
  const eta = approved ? "" : filingEtaDate(filing, now);
  if (eta) out.push({ id: "state-approval", date: eta, approx: true, title: "New Mexico approves the LLC (expected)", owner: "state", stepId: filing?.id });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
