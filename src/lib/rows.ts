// Pure mapping between Supabase rows (snake_case columns) and the doc shapes the page's normalizers read
// (camelCase, `order`). No imports, so the tests run on plain Node.

export type Row = Record<string, unknown>;

/** Columns the database fills in itself (trigger); the page never sends them. */
const SERVER_ONLY = new Set(["updatedAt", "updatedBy", "createdBy", "id"]);

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

/** A database row as a doc: sort_order -> order, step_id -> stepId, created_at -> createdAt. */
export function rowToDoc(row: Row): { id: string; data: Row } {
  const data: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id") continue;
    data[k === "sort_order" ? "order" : camel(k)] = v;
  }
  return { id: String(row.id ?? ""), data };
}

/** Page fields as columns, dropping what the server owns. */
export function docToRow(fields: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SERVER_ONLY.has(k)) continue;
    out[k === "order" ? "sort_order" : snake(k)] = v;
  }
  return out;
}

/** "steps/s110" -> ["steps", "s110"]. */
export function splitPath(path: string): [string, string] {
  const i = path.indexOf("/");
  return i < 0 ? [path, ""] : [path.slice(0, i), path.slice(i + 1)];
}

export type Write =
  | { kind: "rpc"; fn: "set_agree"; args: { p_decision: string; p_on: boolean } }
  | { kind: "rpc"; fn: "set_vote"; args: { p_name: string; p_on: boolean } }
  | { kind: "update"; table: string; id: string; row: Row };

/** Turn the page's update(path, fields) into what Supabase needs. Agreeing and voting are per-person
 *  merges into a JSON map, so they go through functions that only touch the caller's own key. */
export function planUpdate(path: string, fields: Row, me: string): Write[] {
  const [table, id] = splitPath(path);
  const out: Write[] = [];
  const rest: Row = { ...fields };
  if (table === "decisions" && rest.agree && typeof rest.agree === "object") {
    const a = rest.agree as Row;
    if (me in a) out.push({ kind: "rpc", fn: "set_agree", args: { p_decision: id, p_on: a[me] != null && a[me] !== false } });
    delete rest.agree;
  }
  if (table === "names" && rest.votes && typeof rest.votes === "object") {
    const v = rest.votes as Row;
    if (me in v) out.push({ kind: "rpc", fn: "set_vote", args: { p_name: id, p_on: v[me] === true } });
    delete rest.votes;
  }
  const row = docToRow(rest);
  if (Object.keys(row).length) out.push({ kind: "update", table, id, row });
  return out;
}

// ---- Changes (audit log) ----------------------------------------------------------------------
export interface AuditEntry {
  id: number;
  at: string;
  table: string;
  rowId: string;
  op: "insert" | "update" | "delete";
  who: string;
  via: string;
  changes: Row;
}
export function normAudit(r: Row): AuditEntry | null {
  if (!r || typeof r !== "object" || typeof r.table_name !== "string") return null;
  const op = r.op === "insert" || r.op === "update" || r.op === "delete" ? r.op : null;
  if (!op) return null;
  return {
    id: Number(r.id) || 0,
    at: String(r.at || ""),
    table: r.table_name,
    rowId: String(r.row_id ?? ""),
    op,
    who: typeof r.who === "string" ? r.who : "",
    via: typeof r.via === "string" ? r.via : "",
    changes: r.changes && typeof r.changes === "object" ? (r.changes as Row) : {},
  };
}

const LABEL: Record<string, string> = {
  steps: "step",
  comments: "comment",
  messages: "message",
  decisions: "decision",
  names: "name",
  products: "product",
  meta: "page info",
  ledger: "ledger line",
  docs: "doc",
  hours: "weekly hours",
};
const FIELD: Record<string, string> = {
  sort_order: "order",
  in_company: "in company",
  proposed_by: "proposer",
  suggested_by: "suggested by",
  author_id: "author",
  step_id: "step",
  amount_usd: "amount",
  week_start: "week",
};

/** Who did it, in words: "Chris", "Aaron's Claude", "an agent (service role)", "the import". */
export function actorLabel(e: Pick<AuditEntry, "who" | "via">, name: (role: string) => string): string {
  const v = e.via.trim();
  if (e.who) return name(e.who); // a founder's own edit in the app
  if (v === "migration") return "The import";
  if (v === "service_role") return "An agent (service role)";
  if (v === "postgres" || v === "supabase_admin" || v === "authenticator") return "SQL (dashboard or MCP)";
  return v || "Someone";
}

/** One line on what changed: "status: doing → done", "added", "removed". */
export function changeSummary(e: AuditEntry): string {
  if (e.op === "insert") return "added";
  if (e.op === "delete") return "removed";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(e.changes)) {
    if (k === "agree" || k === "votes") {
      const from = keyCount((v as Row)?.from);
      const to = keyCount((v as Row)?.to);
      parts.push(k === "agree" ? (to > from ? "agreed" : "took back agreement") : to > from ? "voted" : "took back a vote");
      continue;
    }
    const to = (v as Row)?.to;
    const label = FIELD[k] || k.replace(/_/g, " ");
    parts.push((typeof to === "string" && to.length <= 40) || typeof to === "number" ? `${label} → ${to}` : to == null ? `${label} cleared` : `${label} edited`);
  }
  return parts.join(", ") || "edited";
}
function keyCount(v: unknown): number {
  return v && typeof v === "object" ? Object.keys(v as Row).length : 0;
}
export function tableLabel(t: string): string {
  return LABEL[t] || t;
}
