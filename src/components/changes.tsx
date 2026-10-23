import { useMemo, useState } from "react";
import { Bot, History, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/hooks";
import { ago } from "@/lib/model";
import { actorLabel, changeSummary, tableLabel, type AuditEntry } from "@/lib/rows";
import { cn } from "@/lib/utils";
import { Empty, Section, Seg, Skel } from "./bits";

// The audit log, newest first: who (or whose agent) changed what, and when. Filled by a database trigger on
// every table, so changes made by an agent through SQL or the Supabase MCP show up here too.

type Filter = "all" | "people" | "agents";

export function Changes() {
  const { audit, ready, roleName, steps, decisions, names, products, docs } = useStore();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const title = useMemo(() => {
    const m = new Map<string, string>();
    steps.forEach((s) => m.set("steps/" + s.id, s.title));
    decisions.forEach((d) => m.set("decisions/" + d.id, d.title));
    names.forEach((n) => m.set("names/" + n.id, n.name));
    products.forEach((p) => m.set("products/" + p.id, p.name));
    docs.forEach((d) => m.set("docs/" + d.id, d.title));
    return (e: AuditEntry) => {
      const t = m.get(e.table + "/" + e.rowId);
      if (t) return t;
      const c = e.changes as Record<string, unknown>;
      const v = c.title ?? c.name ?? c.text ?? c.item;
      return typeof v === "string" ? v : e.table === "meta" ? (e.rowId === "status" ? "status line" : "page info") : "";
    };
  }, [steps, decisions, names, products, docs]);

  const isAgent = (e: AuditEntry) => !e.who;
  const list = audit.filter((e) => e.via !== "migration" && (filter === "all" || (filter === "agents" ? isAgent(e) : !isAgent(e))));
  const shown = open ? list : list.slice(0, 8);
  const name = (r: string) => (r === "chris" || r === "aaron" ? roleName(r) : r);

  return (
    <Section
      id="changes"
      icon={<History size={17} strokeWidth={2.1} />}
      title="Changes"
      meta={ready.audit ? "Who changed what, people and agents" : "Loading"}
      action={<Seg<Filter> label="Show changes by" value={filter} onChange={setFilter} size="sm" options={[{ id: "all", label: "All" }, { id: "people", label: "People" }, { id: "agents", label: "Agents" }]} />}
    >
      {!ready.audit ? (
        <div className="space-y-2">
          <Skel className="h-10" />
          <Skel className="h-10" />
        </div>
      ) : list.length ? (
        <>
          <ol className="divide-y divide-line">
            {shown.map((e) => {
              const t = title(e);
              const agent = isAgent(e);
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", agent ? "bg-gold/15 text-gold" : "bg-accent/[0.12] text-accent")} aria-hidden="true">
                    {agent ? <Bot size={14} /> : <User size={14} />}
                  </span>
                  <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink2">
                    <b className="font-semibold text-ink">{actorLabel(e, name)}</b> {changeSummary(e)} {e.op === "update" ? "on" : ""} the {tableLabel(e.table)}
                    {t && <span className="text-ink"> “{t.length > 70 ? t.slice(0, 68) + "…" : t}”</span>}
                  </p>
                  <time dateTime={e.at} className="shrink-0 whitespace-nowrap pt-0.5 text-[12.5px] text-faintText" title={new Date(e.at).toLocaleString()}>
                    {ago(e.at, now)}
                  </time>
                </li>
              );
            })}
          </ol>
          {list.length > 8 && (
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setOpen((o) => !o)}>
              {open ? "Show fewer" : `Show all ${list.length}`}
            </button>
          )}
        </>
      ) : (
        <Empty icon={<History size={16} />} title={filter === "agents" ? "No agent changes yet." : "No changes since the move to the studio domain."} />
      )}
    </Section>
  );
}
