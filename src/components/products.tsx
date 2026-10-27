import { useMemo, useState } from "react";
import { ArrowUpRight, Boxes, ChevronDown, GitBranch, Pencil } from "lucide-react";
import { nowIso, useStore } from "@/lib/store";
import { byOrder, PRODUCT_STATUSES, type Product } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Empty, Menu, Section, Skel } from "./bits";

/** Status as a tone: live is green, in development is the studio navy, the rest are quiet. */
function tone(status: string) {
  const s = status.toLowerCase();
  if (/live|launched|shipped/.test(s)) return "chip-ok";
  if (/develop|build|progress|beta/.test(s)) return "chip-accent";
  if (/pause|hold|blocked/.test(s)) return "chip-late";
  return "";
}

export function Products() {
  const { products, ready } = useStore();
  const list = useMemo(() => products.slice().sort(byOrder), [products]);
  return (
    <Section id="products" icon={<Boxes size={17} strokeWidth={2.1} />} title="Products" meta={ready.products ? `${list.length} ${list.length === 1 ? "product" : "products"}` : "Loading"}>
      <p className="mb-3 text-[14px] leading-relaxed text-ink2">
        <b className="font-semibold text-ink">Every game and app either of you makes goes into the studio</b>, agreed Oct 26, so this list is a convenience and not the record. Aaron's games are in too and aren't listed here yet.
      </p>
      {!ready.products ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skel className="h-40 rounded-2xl" />
          <Skel className="h-40 rounded-2xl" />
        </div>
      ) : list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty icon={<Boxes size={16} />} title="No products yet." />
      )}
    </Section>
  );
}

function ProductCard({ p }: { p: Product }) {
  const { canWrite, update, me } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.next);
  const set = (f: Record<string, unknown>) => update("products/" + p.id, { ...f, updatedAt: nowIso(), updatedBy: me || "" });
  const statuses = PRODUCT_STATUSES.includes(p.status) || !p.status ? PRODUCT_STATUSES : [p.status, ...PRODUCT_STATUSES];
  const saveNext = async () => {
    const v = draft.trim();
    if (v !== p.next && !(await set({ next: v }))) return;
    setEditing(false);
  };
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface2/70 p-4 ring-1 ring-line/60 sm:p-5">
      <header className="flex items-start gap-3">
        <h3 className="display min-w-0 flex-1 text-[19px] leading-tight">{p.name}</h3>
        <Menu
          label={`Status of ${p.name}: ${p.status || "not set"}. Change it.`}
          disabled={!canWrite}
          align="right"
          trigger={(open) => (
            <span className={cn("chip font-semibold", tone(p.status), canWrite && "pr-1.5")}>
              {p.status || "No status"}
              {canWrite && <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />}
            </span>
          )}
          items={statuses.map((s) => ({ id: s, label: s, active: s === p.status, onSelect: () => s !== p.status && set({ status: s }) }))}
        />
      </header>
      {p.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.platforms.map((x) => (
            <span key={x} className="chip !bg-raised ring-1 ring-line">
              {x}
            </span>
          ))}
        </div>
      )}
      {p.summary && <p className="text-[14px] leading-relaxed text-ink2">{p.summary}</p>}
      <div className="rounded-xl bg-raised px-3.5 py-2.5 ring-1 ring-line/70">
        <div className="flex items-center gap-2">
          <span className="eyebrow !text-[12.5px]">Next</span>
          {canWrite && !editing && (
            <button type="button" onClick={() => (setDraft(p.next), setEditing(true))} className="tap hit ml-auto flex h-6 items-center gap-1 rounded-full px-2 text-[12.5px] font-semibold text-muted hover:bg-hover hover:text-ink" aria-label={`Edit the next step for ${p.name}`}>
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
        {editing ? (
          <form
            className="mt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              saveNext();
            }}
          >
            <div className="field !bg-surface2 !pr-1.5">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} autoFocus maxLength={200} aria-label={`Next step for ${p.name}`} className="text-[14px]" />
              <button type="submit" className="btn btn-primary btn-sm">
                Save
              </button>
            </div>
          </form>
        ) : (
          <p className={cn("mt-0.5 text-[14px] leading-snug", p.next ? "text-ink" : "text-faintText")}>{p.next || "Nothing set yet."}</p>
        )}
      </div>
      {(p.inCompany || p.repo) && (
        <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
          {p.inCompany && (
            <span>
              In the company: <b className={cn("font-semibold", /yes|in\b/i.test(p.inCompany) ? "text-ok" : "text-ink2")}>{p.inCompany}</b>
            </span>
          )}
          {p.repo && (
            <a href={p.repo} target="_blank" rel="noopener noreferrer" className="link ml-auto inline-flex items-center gap-1 font-semibold">
              <GitBranch size={13} /> {p.repo.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              <ArrowUpRight size={13} />
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
