import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronDown, CircleDollarSign, Map as MapIcon, MessageSquare, Plus, X } from "lucide-react";
import { nowIso, useAuthor, useStore } from "@/lib/store";
import { ago, currentPhase, dayLabel, dueInfo, phaseStats, PHASES, sortSteps, STATUSES, type Owner, type Status, type Step } from "@/lib/model";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { AddField, Avatar, Empty, OwnerChip, Section, Seg, SkelRows, StatusGlyph } from "./bits";
import { useUi } from "./ui";

type View = "open" | "all";
type Who = "everyone" | "chris" | "aaron";

export function Gameplan() {
  const { steps, ready, roleName, role } = useStore();
  const { pinned } = useUi();
  const [view, setView] = useState<View>("open");
  const [who, setWho] = useState<Who>("everyone");
  const sorted = useMemo(() => sortSteps(steps), [steps]);
  const stats = useMemo(() => phaseStats(steps), [steps]);
  const cur = currentPhase(steps);
  const done = steps.filter((s) => s.status === "done").length;
  const visible = (s: Step) => s.id === pinned || ((view === "all" || s.status !== "done") && (who === "everyone" || s.owner === who || s.owner === "both"));

  return (
    <Section
      id="gameplan"
      icon={<MapIcon size={17} strokeWidth={2.1} />}
      title="Gameplan"
      meta={ready.steps ? `${done} of ${steps.length} steps done` : "Loading"}
      action={
        <>
          <Seg<Who>
            label="Whose steps"
            value={who}
            onChange={setWho}
            size="sm"
            options={[
              { id: "everyone", label: "Everyone" },
              { id: "chris", label: role === "chris" ? "Mine" : roleName("chris") },
              { id: "aaron", label: role === "aaron" ? "Mine" : roleName("aaron") },
            ]}
          />
          <Seg<View> label="Show" value={view} onChange={setView} size="sm" options={[{ id: "open", label: "Open" }, { id: "all", label: "All" }]} />
        </>
      }
    >
      <PhaseRail stats={stats} cur={cur} loading={!ready.steps} />
      {!ready.steps ? (
        <SkelRows n={6} />
      ) : (
        <div className="mt-2">
          {PHASES.map((p) => {
            const all = sorted.filter((s) => s.phase === p.n);
            const shown = all.filter(visible);
            const hiddenDone = all.filter((s) => s.status === "done" && !visible(s)).length;
            return <PhaseGroup key={p.n} n={p.n} all={all} shown={shown} hiddenDone={hiddenDone} current={p.n === cur} showAll={() => setView("all")} filtered={who !== "everyone"} />;
          })}
          {!steps.length && (
            <Empty icon={<MapIcon size={16} />} title="The gameplan is empty." className="mt-4">
              Add the first step under any phase.
            </Empty>
          )}
        </div>
      )}
    </Section>
  );
}

function PhaseRail({ stats, cur, loading }: { stats: ReturnType<typeof phaseStats>; cur: number; loading: boolean }) {
  const { scrollTo } = useUi();
  return (
    <nav aria-label="Phases" className="scroll-x -mx-[var(--card-pad)] px-[var(--card-pad)]">
      <ol className="flex min-w-[600px] items-start">
        {stats.map((p, i) => {
          const complete = p.total > 0 && p.done === p.total;
          const isCur = p.n === cur;
          return (
            <li key={p.n} className="relative flex-1">
              {i > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 top-[15px] h-[2px] w-full", p.n <= cur || complete ? "bg-accent/45" : "bg-line")} />}
              <button type="button" onClick={() => scrollTo("phase-" + p.n)} className="group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 pb-2 pt-0.5 text-center">
                <span
                  className={cn(
                    "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-[13.5px] font-bold transition-colors",
                    complete ? "bg-ok text-white" : isCur ? "bg-accent text-accentInk shadow-[0_6px_16px_-6px_rgb(var(--accent)/0.8)]" : "bg-raised text-muted ring-1 ring-line2 group-hover:text-ink",
                  )}
                >
                  {complete ? <Check size={16} strokeWidth={3} /> : p.n}
                  {isCur && <span className="animate-ping2 absolute inset-0 rounded-full bg-accent/25" aria-hidden="true" />}
                </span>
                <span className={cn("text-[13.5px] font-semibold leading-tight", isCur ? "text-ink" : "text-ink2")}>{p.name}</span>
                <span className="num text-[12px] leading-none text-muted">{loading ? " " : p.total ? `${p.done}/${p.total}` : "—"}</span>
                <span className="sr-only">{isCur ? "current phase" : complete ? "complete" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PhaseGroup({ n, all, shown, hiddenDone, current, showAll, filtered }: { n: number; all: Step[]; shown: Step[]; hiddenDone: number; current: boolean; showAll: () => void; filtered: boolean }) {
  const { canWrite, add, me } = useStore();
  const [adding, setAdding] = useState(false);
  const p = PHASES[n - 1];
  const done = all.filter((s) => s.status === "done").length;
  const addStep = async (title: string) => {
    const order = all.reduce((m, s) => Math.max(m, s.order), 0) + 10;
    const at = nowIso();
    const ok = await add("steps", { phase: n, order, title, owner: "both", status: "todo", createdBy: me || "", createdAt: at, updatedAt: at, updatedBy: me || "" });
    if (ok) setAdding(false);
    return ok;
  };
  return (
    <div id={"phase-" + n} className="pt-6 first:pt-4">
      <div className="flex items-baseline gap-3">
        <span className={cn("num text-[13px] font-bold", current ? "text-accent" : "text-faint")}>{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-baseline gap-x-2 text-[16.5px] font-bold tracking-[-0.01em]">
            {p.name}
            {current && <span className="chip chip-accent !h-[20px] !text-[11.5px] font-semibold">Now</span>}
          </h3>
          <p className="text-[13.5px] leading-snug text-muted">{p.why}</p>
        </div>
        <span className="num shrink-0 text-[13px] text-muted">
          {done}/{all.length}
        </span>
      </div>
      <div className="rows mt-1.5 pl-0 sm:pl-6">
        {shown.map((s) => (
          <StepRow key={s.id} s={s} />
        ))}
        {!shown.length && all.length > 0 && (
          <p className="py-3 text-[13.5px] text-muted">{filtered && all.some((s) => s.status !== "done") ? "Nothing here for this person." : `All ${all.length} done.`}</p>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 sm:pl-6">
        {hiddenDone > 0 && (
          <button type="button" onClick={showAll} className="py-1.5 text-[13px] text-muted hover:text-ink">
            {hiddenDone} done and tucked away. <span className="font-semibold underline underline-offset-2">Show</span>
          </button>
        )}
        {canWrite &&
          (adding ? (
            <div className="w-full py-1.5">
              <AddField placeholder={`A new step for ${p.name}`} label={`Add a step to ${p.name}`} onAdd={addStep} autoFocus onCancel={() => setAdding(false)} />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="tap -ml-1 flex items-center gap-1.5 rounded-full px-1 py-1.5 text-[13.5px] font-semibold text-muted hover:text-accent">
              <Plus size={15} /> Add a step
            </button>
          ))}
      </div>
    </div>
  );
}

const NEXT_TOGGLE: Record<Status, Status> = { todo: "done", doing: "done", blocked: "done", done: "todo" };

function StepRow({ s }: { s: Step }) {
  const { comments, canWrite, update, me } = useStore();
  const { expanded, toggleStep } = useUi();
  const open = expanded.has(s.id);
  const n = comments.filter((c) => c.stepId === s.id).length;
  const due = dueInfo(s.due);
  const set = (fields: Record<string, unknown>) => update("steps/" + s.id, { ...fields, updatedAt: nowIso(), updatedBy: me || "" });
  return (
    <div id={"step-" + s.id} className="-mx-2 px-2">
      <div className="flex items-start gap-3 py-2.5">
        <button
          type="button"
          className="tap mt-[1px] shrink-0 rounded-full disabled:opacity-60"
          onClick={() => set({ status: NEXT_TOGGLE[s.status] })}
          disabled={!canWrite}
          aria-label={s.status === "done" ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
          title={s.status === "done" ? "Mark not done" : "Mark done"}
        >
          <StatusGlyph status={s.status} />
        </button>
        <button type="button" onClick={() => toggleStep(s.id)} aria-expanded={open} aria-controls={"step-d-" + s.id} className="group min-w-0 flex-1 text-left">
          <span className={cn("block text-[15px] leading-snug", s.status === "done" ? "text-muted line-through decoration-line2" : "text-ink group-hover:text-ink")}>{s.title}</span>
          {s.note && !open && <span className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-muted">{s.note}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <OwnerChip owner={s.owner} dense />
            {s.status === "doing" && <span className="chip chip-accent font-semibold">Doing</span>}
            {s.status === "blocked" && <span className="chip chip-bad font-semibold">Blocked</span>}
            {s.cost && (
              <span className="chip" title="Estimated cost">
                <CircleDollarSign size={12} className="text-faint" />
                {s.cost}
              </span>
            )}
            {n > 0 && (
              <span className="chip">
                <MessageSquare size={12} className="text-faint" />
                {n}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 pt-[1px]">
          {due && <span className={cn("chip", due.tone === "late" ? "chip-bad" : due.tone === "soon" ? "chip-late" : "")}>{due.label}</span>}
          <button type="button" onClick={() => toggleStep(s.id)} className="tap flex h-7 w-7 items-center justify-center rounded-full text-faint hover:bg-hover hover:text-ink" aria-label={open ? "Close details" : "Open details"} tabIndex={-1}>
            <ChevronDown size={16} className={cn("transition-transform duration-200", open && "rotate-180")} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={"step-d-" + s.id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.1, 1] }} className="overflow-hidden">
            <StepDetail s={s} set={set} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepDetail({ s, set }: { s: Step; set: (f: Record<string, unknown>) => Promise<boolean> }) {
  const { canWrite, roleName, role } = useStore();
  const now = useNow();
  const ownerLabel = (o: Owner) => (o === "both" ? "Both" : role === o ? `${roleName(o)} (you)` : roleName(o));
  return (
    <div className="pb-4 pl-[34px] pr-1">
      {(s.note || s.detail) && (
        <div className="mb-3 space-y-1.5 rounded-xl bg-surface2 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink2">
          {s.note && <p>{s.note}</p>}
          {s.detail && <p className="whitespace-pre-wrap">{s.detail}</p>}
        </div>
      )}
      <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-[64px_minmax(0,1fr)] sm:items-center">
        <span className="eyebrow">Status</span>
        <Seg<Status> label="Status" value={s.status} onChange={(v) => set({ status: v })} disabled={!canWrite} size="sm" options={STATUSES.map((x) => ({ id: x.id, label: x.label }))} />
        <span className="eyebrow">Owner</span>
        <Seg<Owner> label="Owner" value={(s.owner || "both") as Owner} onChange={(v) => set({ owner: v })} disabled={!canWrite} size="sm" options={(["chris", "aaron", "both"] as Owner[]).map((o) => ({ id: o, label: ownerLabel(o) }))} />
        <span className="eyebrow">Due</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="field !min-h-[32px] !rounded-full !py-0 !pl-3 !pr-2 text-[13.5px]">
            <CalendarDays size={14} className="text-faint" />
            <input type="date" value={s.due} onChange={(e) => set({ due: e.target.value })} disabled={!canWrite} aria-label="Due date" className="!py-1 text-[13.5px]" />
          </label>
          {s.due && canWrite && (
            <button type="button" className="btn btn-ghost btn-sm !h-7 !px-2" onClick={() => set({ due: "" })} aria-label="Clear the due date">
              <X size={14} /> Clear
            </button>
          )}
          {!s.due && <span className="text-[13px] text-faintText">No date yet</span>}
          {s.due && <span className="text-[13px] text-muted">{dayLabel(s.due)}</span>}
        </div>
      </div>
      <Comments stepId={s.id} />
      {s.updatedAt && <p className="mt-3 text-[12px] text-faintText">Updated {ago(s.updatedAt, now)}</p>}
    </div>
  );
}

function Comments({ stepId }: { stepId: string }) {
  const { comments, canWrite, add, me, profile, team } = useStore();
  const author = useAuthor();
  const now = useNow();
  const list = comments.filter((c) => c.stepId === stepId);
  return (
    <div className="mt-4">
      <p className="eyebrow mb-1.5">{list.length ? `Comments · ${list.length}` : "Comments"}</p>
      {list.length > 0 && (
        <ul className="mb-2 space-y-2.5">
          {list.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar profile={profile(c.authorId)} label={author(c.authorId)} role={c.authorId === team.chris ? "chris" : c.authorId === team.aaron ? "aaron" : null} size={22} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-muted">
                  <b className="font-semibold text-ink">{author(c.authorId, { you: true })}</b> · {ago(c.createdAt, now)}
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-snug text-ink2">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canWrite && <AddField placeholder="Add a comment" label="Add a comment" buttonLabel="Post" maxLength={1000} onAdd={(text) => add("comments", { stepId, text, authorId: me || "", createdAt: nowIso() })} />}
    </div>
  );
}
