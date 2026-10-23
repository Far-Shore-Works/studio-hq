import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, FolderOpen, Lock, Search, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ago, DOC_FOLDERS, searchDocs, type Doc, type DocFolder } from "@/lib/model";
import { useNow } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Empty, Section, Seg, Skel } from "./bits";

// The Docs tab: markdown documents in folders, searchable, each either shared with both founders or private
// to the founder who owns it. Privacy is enforced by the database (row-level security on public.docs): a
// private doc is never sent to the other founder's browser, so there is nothing here to hide client-side.
// Docs are written by agents from files (`bin/studio-hq docs-sync`); the page only reads them.

const Md = lazy(() => import("./markdown"));

type Folder = DocFolder | "all";

export function Docs() {
  const { docs, ready, unavailable, me, roleName, members } = useStore();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<Folder>("all");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const open = useCallback((slug: string | null) => {
    setOpenSlug(slug);
    // Bring the top of the card into view so a doc never opens scrolled halfway down.
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start", behavior: "auto" }));
  }, []);
  const doc = openSlug ? docs.find((d) => d.slug === openSlug) || null : null;
  // A doc that disappears (made private by its owner, or removed) closes the reader.
  useEffect(() => {
    if (openSlug && ready.docs && !doc) setOpenSlug(null);
  }, [openSlug, ready.docs, doc]);

  const hits = useMemo(() => searchDocs(docs, query, folder), [docs, query, folder]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    docs.forEach((d) => (c[d.folder] = (c[d.folder] || 0) + 1));
    return c;
  }, [docs]);
  const mine = docs.filter((d) => d.visibility === "private" && d.owner === me).length;
  const ownerName = (d: Doc) => {
    const m = members.find((x) => x.id === d.owner);
    return m ? roleName(m.role) : "";
  };

  const meta = unavailable.docs
    ? "Not switched on yet"
    : !ready.docs
      ? "Loading"
      : `${docs.length} ${docs.length === 1 ? "doc" : "docs"}${mine ? ` · ${mine} private to you` : ""}`;

  return (
    <Section
      id="docs"
      icon={<FileText size={17} strokeWidth={2.1} />}
      title="Docs"
      meta={meta}
      action={
        !doc && ready.docs && !unavailable.docs && docs.length > 0 ? (
          <label className="field !min-h-[36px] w-full sm:w-[240px]">
            <Search size={15} className="shrink-0 text-faint" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs"
              aria-label="Search docs by title or text"
              className="text-[14px]"
              maxLength={80}
              autoComplete="off"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="tap flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
        ) : undefined
      }
    >
      <div ref={top} className="scroll-mt-20" />
      {unavailable.docs ? (
        <Empty icon={<FileText size={16} />} title="Docs aren't switched on yet.">
          They appear here as soon as the database update for this tab is applied.
        </Empty>
      ) : !ready.docs ? (
        <div className="space-y-2">
          <Skel className="h-12" />
          <Skel className="h-12" />
          <Skel className="h-12" />
        </div>
      ) : doc ? (
        <Reader doc={doc} docs={docs} owner={ownerName(doc)} isMine={doc.owner === me} now={now} onBack={() => open(null)} onOpen={open} />
      ) : docs.length === 0 ? (
        <Empty icon={<FileText size={16} />} title="No docs yet.">
          Chris and Aaron's agents add docs here from files in the studio folders. Each one is either shared or private to its owner.
        </Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Seg<Folder>
              label="Folder"
              value={folder}
              onChange={setFolder}
              size="sm"
              options={[{ id: "all", label: `All ${counts.all}` }, ...DOC_FOLDERS.filter((f) => counts[f]).map((f) => ({ id: f as Folder, label: `${f} ${counts[f]}` }))]}
            />
          </div>
          {hits.length === 0 ? (
            <Empty icon={<Search size={16} />} title={`Nothing matches "${query}".`}>
              Search looks in titles and text, and every word has to appear.
            </Empty>
          ) : query.trim() ? (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <DocRow key={h.doc.id} doc={h.doc} snippet={h.snippet} showFolder now={now} isMine={h.doc.owner === me} onOpen={() => open(h.doc.slug)} />
              ))}
            </ul>
          ) : (
            <div className="space-y-5">
              {DOC_FOLDERS.map((f) => {
                const list = hits.filter((h) => h.doc.folder === f);
                if (!list.length) return null;
                return (
                  <div key={f}>
                    {folder === "all" && (
                      <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
                        <FolderOpen size={14} aria-hidden="true" /> {f}
                      </h3>
                    )}
                    <ul className="divide-y divide-line">
                      {list.map((h) => (
                        <DocRow key={h.doc.id} doc={h.doc} snippet="" now={now} isMine={h.doc.owner === me} onOpen={() => open(h.doc.slug)} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function Visibility({ doc, isMine, owner }: { doc: Doc; isMine: boolean; owner?: string }) {
  return doc.visibility === "shared" ? (
    <span className="chip chip-ok" title="Both founders can read this">
      <Users size={12} aria-hidden="true" /> Shared
    </span>
  ) : (
    <span className="chip chip-gold" title={isMine ? "Only you can read this" : `Only ${owner || "its owner"} can read this`}>
      <Lock size={12} aria-hidden="true" /> {isMine ? "Private to you" : "Private"}
    </span>
  );
}

function DocRow({ doc, snippet, showFolder, now, isMine, onOpen }: { doc: Doc; snippet: string; showFolder?: boolean; now: number; isMine: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="tap -mx-2 flex w-[calc(100%+16px)] items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-hover">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface2 text-muted" aria-hidden="true">
          <FileText size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-ink">{doc.title}</span>
            {showFolder && <span className="chip">{doc.folder}</span>}
            <Visibility doc={doc} isMine={isMine} />
          </span>
          {snippet && <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{snippet}</span>}
        </span>
        {doc.updatedAt && (
          <time dateTime={doc.updatedAt} className="shrink-0 whitespace-nowrap pt-1 text-[12.5px] text-faintText" title={new Date(doc.updatedAt).toLocaleString()}>
            {ago(doc.updatedAt, now)}
          </time>
        )}
      </button>
    </li>
  );
}

function Reader({ doc, docs, owner, isMine, now, onBack, onOpen }: { doc: Doc; docs: Doc[]; owner: string; isMine: boolean; now: number; onBack: () => void; onOpen: (slug: string) => void }) {
  // The title is already shown above, so drop a first "# Title" line from the body.
  const body = useMemo(() => doc.body.replace(/^\s*#[ \t]+[^\n]*\n+/, ""), [doc.body]);
  return (
    <article aria-label={doc.title}>
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2.5 mb-2">
        <ArrowLeft size={14} /> All docs
      </button>
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="display min-w-0 basis-full text-[24px] leading-tight sm:text-[28px]">{doc.title}</h3>
        <span className="chip">{doc.folder}</span>
        <Visibility doc={doc} isMine={isMine} owner={owner} />
        {doc.updatedAt && <span className="text-[13px] text-faintText">Updated {ago(doc.updatedAt, now)}</span>}
        {doc.sourcePath && <span className="num truncate text-[12.5px] text-faintText" title={doc.sourcePath}>{doc.sourcePath.split("/").slice(-2).join("/")}</span>}
      </header>
      <Suspense fallback={<div className={cn("space-y-2")}><Skel className="h-5 w-2/3" /><Skel className="h-5" /><Skel className="h-5 w-4/5" /></div>}>
        <Md text={body} docs={docs} onOpen={onOpen} />
      </Suspense>
    </article>
  );
}
