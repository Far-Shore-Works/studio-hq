import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CircleDollarSign, FileSignature, Flag, ListChecks, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { costSummary, currentPhase, dueInfo, isSettled, moneyRange, phaseStats, PHASES, signingState, upNext, yourMove, type Role, type SigningItem } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Avatar, Count, Skel, StatusGlyph } from "./bits";
import { useUi } from "./ui";

export function Overview() {
  const { steps, decisions, team, ready, mode, role: viewer } = useStore();
  const { scrollTo } = useUi();
  const noData = (mode === "error" || mode === "offline") && steps.length === 0;
  const [costsOpen, setCostsOpen] = useState(false);
  const loading = !ready.steps;
  const stats = useMemo(() => phaseStats(steps), [steps]);
  const cur = currentPhase(steps);
  const costs = useMemo(() => costSummary(steps), [steps]);
  const done = steps.filter((s) => s.status === "done").length;
  const doing = steps.filter((s) => s.status === "doing").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const openDecisions = decisions.filter((d) => !isSettled(d, team)).length;
  const curName = cur >= 1 && cur <= 6 ? PHASES[cur - 1].name : "";

  return (
    <div id="overview" className="space-y-3">
      <MoveCard />
      <SigningCard />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Phase */}
        <button type="button" className="stat tap" onClick={() => scrollTo(cur >= 1 && cur <= 6 ? "phase-" + cur : "gameplan")} aria-label={curName ? `Current phase ${cur}, ${curName}. Go to it.` : "Go to the gameplan"}>
          <span className="stat-label">
            <Flag size={15} strokeWidth={2.2} /> Phase
          </span>
          {loading ? (
            <Skel className="mt-2 h-8 w-28" />
          ) : (
            <span className="stat-num">{noData ? "—" : cur === 0 ? "Not started" : cur === 7 ? "All done" : <>{cur}<span className="text-faint"> · </span>{curName}</>}</span>
          )}
          <span className="mt-2.5 flex gap-1" aria-hidden="true">
            {stats.map((p) => (
              <span key={p.n} className={cn("relative h-1.5 flex-1 overflow-hidden rounded-full bg-sunk", p.n === cur && "ring-1 ring-accent/60 ring-offset-1 ring-offset-raised")}>
                <motion.span
                  className={cn("absolute inset-y-0 left-0 rounded-full", p.total && p.done === p.total ? "bg-ok" : "bg-accent")}
                  initial={{ width: 0 }}
                  animate={{ width: p.total ? (100 * p.done) / p.total + "%" : 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 + p.n * 0.04 }}
                />
              </span>
            ))}
          </span>
          <span className="stat-sub mt-1.5 sm:truncate">{cur >= 1 && cur < 6 ? "Then " + PHASES[cur].name : cur === 6 ? "The last phase" : " "}</span>
        </button>

        {/* Progress */}
        <button type="button" className="stat tap" onClick={() => scrollTo("gameplan")} aria-label={`${done} of ${steps.length} steps done. Go to the gameplan.`}>
          <span className="stat-label">
            <ListChecks size={15} strokeWidth={2.2} /> Progress
          </span>
          {loading ? (
            <Skel className="mt-2 h-8 w-24" />
          ) : (
            <span className="stat-num">
              {noData ? "—" : <><Count to={done} />
              <span className="text-[17px] font-semibold text-muted"> of {steps.length}</span></>}
            </span>
          )}
          <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
            <motion.span className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: steps.length ? (100 * done) / steps.length + "%" : 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          </span>
          <span className="stat-sub mt-1.5 sm:truncate">{loading ? " " : `steps done${doing ? ` · ${doing} in progress` : ""}`}</span>
        </button>

        {/* Costs ahead */}
        <button type="button" className="stat tap" onClick={() => setCostsOpen((o) => !o)} aria-expanded={costsOpen} aria-controls="cost-breakdown">
          <span className="stat-label">
            <CircleDollarSign size={15} strokeWidth={2.2} /> Costs ahead
            <ChevronDown size={14} className={cn("ml-auto text-faint transition-transform", costsOpen && "rotate-180")} />
          </span>
          {loading ? <Skel className="mt-2 h-8 w-32" /> : <span className="stat-num">{noData ? "—" : costs.lines.length ? moneyRange(costs.lo, costs.hi) : "$0"}</span>}
          <span className="stat-sub mt-auto pt-1 sm:truncate">{loading ? " " : `Estimates · ${costs.lines.length} open ${costs.lines.length === 1 ? "step" : "steps"}`}</span>
        </button>

        {/* Open items */}
        <button type="button" className="stat tap" onClick={() => scrollTo("decisions")} aria-label={`${openDecisions} open decisions, ${blocked} blocked steps. Go to decisions.`}>
          <span className="stat-label">
            <Scale size={15} strokeWidth={2.2} /> Open decisions
          </span>
          {loading ? <Skel className="mt-2 h-8 w-12" /> : <span className="stat-num">{noData ? "—" : openDecisions}</span>}
          <span className={cn("stat-sub mt-auto pt-1 sm:truncate", blocked > 0 && "font-semibold text-bad")}>{loading ? " " : blocked ? `${blocked} blocked ${blocked === 1 ? "step" : "steps"}` : "Nothing blocked"}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {costsOpen && (
          <motion.div id="cost-breakdown" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.1, 1] }} className="overflow-hidden">
            <div className="card px-5 py-4 sm:px-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-semibold">Where the money goes</h3>
                <span className="num text-[13px] text-muted">{moneyRange(costs.lo, costs.hi)} estimated</span>
              </div>
              <ul className="rows mt-2">
                {costs.lines.map((l) => (
                  <li key={l.id} className="flex items-baseline gap-3 py-2 text-[14px]">
                    <span className="min-w-0 flex-1 text-ink2">{l.title}</span>
                    <span className="shrink-0 text-[13px] text-muted">{l.cost}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12.5px] text-faintText">
                Ranges come from each step's cost note. One-time fees and yearly fees are added together, and a step drops off once it's done.
                {costs.unpriced ? ` ${costs.unpriced} more ${costs.unpriced === 1 ? "step has" : "steps have"} a cost with no figure yet.` : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The viewer's own items are in "Your move" above, so this shows only the other founder's. */}
      <div className={cn("grid gap-3", !viewer && "md:grid-cols-2")}>
        {(!viewer || viewer !== "chris") && <UpNext who="chris" />}
        {(!viewer || viewer !== "aaron") && <UpNext who="aaron" />}
      </div>
    </div>
  );
}

function UpNext({ who }: { who: Role }) {
  const { steps, ready, role, roleName, roleProfile, mode } = useStore();
  const { focusStep } = useUi();
  const list = upNext(steps, who);
  const open = steps.filter((s) => s.status !== "done" && (s.owner === who || s.owner === "both")).length;
  const mine = role === who;
  return (
    <section className={cn("card px-5 pb-3 pt-4 sm:px-6", mine && "shadow-[var(--card-shadow),inset_0_0_0_1.5px_rgb(var(--accent)/0.35)]")} aria-label={`What ${roleName(who)} has next`}>
      <header className="flex items-center gap-2.5">
        <Avatar profile={roleProfile(who)} label={roleName(who)} role={who} size={28} />
        <h3 className="text-[16px] font-bold tracking-[-0.01em]">
          {roleName(who)}
          <span className="font-semibold text-muted"> has next</span>
        </h3>
        {mine && <span className="chip chip-accent !h-[22px]">You</span>}
        <span className="num ml-auto text-[13px] text-muted">{ready.steps ? `${open} open` : ""}</span>
      </header>
      {!ready.steps ? (
        <div className="space-y-2.5 py-3">
          <Skel className="h-4 w-4/5" />
          <Skel className="h-4 w-3/5" />
          <Skel className="h-4 w-2/3" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-4 text-[14px] text-muted">{(mode === "error" || mode === "offline") && !steps.length ? "No data to show yet." : "Nothing open right now."}</p>
      ) : (
        <ul className="rows mt-2">
          {list.map((s) => {
            const due = dueInfo(s.due);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => focusStep(s.id)} className="group flex w-full items-start gap-3 rounded-lg py-2.5 text-left">
                  <span className="mt-[1px]">
                    <StatusGlyph status={s.status} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[14.5px] leading-snug text-ink group-hover:text-accent">{s.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                      <span>{PHASES[s.phase - 1].name}</span>
                      {s.status === "doing" && <span className="font-semibold text-accent">Doing</span>}
                      {s.status === "blocked" && <span className="font-semibold text-bad">Blocked</span>}
                      {s.owner === "both" && <span>with {roleName(who === "chris" ? "aaron" : "chris")}</span>}
                    </span>
                  </span>
                  {due && <span className={cn("chip shrink-0", due.tone === "late" ? "chip-bad" : due.tone === "soon" ? "chip-late" : "")}>{due.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** What is left before the founders sign the operating agreement, read from the gameplan and decisions. */
function SigningCard() {
  const { steps, decisions, team, ready, roleName, role, status } = useStore();
  const known = ready.steps && ready.decisions && ready.members;
  const { focusStep, scrollTo } = useUi();
  const st = useMemo(() => signingState(steps, decisions, team, status), [steps, decisions, team, status]);
  // With nothing written down to wait on, say so rather than claim it is ready.
  const unknown = !st.signed && st.before.length === 0;
  if (!known)
    return (
      <section className="card px-5 pb-4 pt-4 sm:px-6" aria-busy="true" aria-label="Before the operating agreement is signed, loading">
        <Skel className="h-5 w-3/4" />
        <div className="mt-4 space-y-3">
          <Skel className="h-4 w-full" />
          <Skel className="h-4 w-5/6" />
          <Skel className="h-4 w-2/3" />
        </div>
      </section>
    );
  if (!st.step) return null;
  const who = (w: SigningItem["who"]) => (w === "state" ? "The state" : w === "both" ? "Both" : role === w ? "You" : roleName(w));
  const open = (i: SigningItem) => (i.id === "agree" ? scrollTo("decisions") : i.stepId ? focusStep(i.stepId) : undefined);
  const row = (i: SigningItem) => (
    <li key={i.id}>
      <button type="button" onClick={() => open(i)} className="group flex min-h-[46px] w-full items-center gap-3 rounded-lg py-1.5 text-left">
        <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full", i.done ? "bg-ok text-white" : "ring-[1.6px] ring-inset ring-line2")} aria-hidden="true">
          {i.done && <Check size={14} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[14.5px] leading-snug group-hover:text-accent", i.done ? "text-muted line-through decoration-line2" : "text-ink")}>
            <span className="sr-only">{i.done ? "Done: " : "Still open: "}</span>
            {i.label}
          </span>
          {i.note && !i.done && <span className="block text-[12.5px] leading-snug text-muted">{i.note}</span>}
        </span>
        <span className={cn("chip shrink-0", !i.done && role && i.who === role && "chip-accent font-semibold")}>{i.done ? "Done" : who(i.who)}</span>
      </button>
    </li>
  );
  return (
    <section className="card px-5 pb-2 pt-4 sm:px-6" aria-labelledby="signing-h" title="Read from the gameplan and decisions below, so it changes when they do.">
      <header className="flex items-start gap-2.5">
        <FileSignature size={17} strokeWidth={2.1} className="mt-[3px] shrink-0 text-accent" aria-hidden="true" />
        <h2 id="signing-h" className="min-w-0 flex-1 text-[16px] font-bold leading-snug tracking-[-0.01em]">
          Before the operating agreement is signed
        </h2>
        <span className={cn("chip shrink-0 font-semibold", st.signed || (!st.left && !unknown) ? "chip-ok" : st.left ? "chip-late" : "")}>{st.signed ? "Signed" : unknown ? "Not signed" : st.left ? `${st.left} left` : "Ready to sign"}</span>
      </header>
      {st.signed ? (
        <p className="py-3 text-[14px] text-muted">The operating agreement is signed.</p>
      ) : (
        <>
          <ul className="rows mt-1">{st.before.map(row)}</ul>
          {st.alongside.some((i) => !i.done) && (
            <>
              <p className="eyebrow mt-2">Also open nearby</p>
              <ul className="rows mt-0.5">{st.alongside.filter((i) => !i.done).map(row)}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** What is waiting on the signed-in founder: decisions to agree to, then their open steps. */
function MoveCard() {
  const { steps, decisions, team, ready, role, roleName, roleProfile } = useStore();
  const { focusStep, scrollTo } = useUi();
  const mv = useMemo(() => (role ? yourMove(steps, decisions, team, role) : null), [steps, decisions, team, role]);
  if (!role) return null;
  if (!ready.steps || !ready.decisions || !ready.members)
    return (
      <section className="card px-5 pb-4 pt-4 sm:px-6" aria-busy="true" aria-label="Your move, loading">
        <Skel className="h-5 w-1/2" />
        <div className="mt-4 space-y-3">
          <Skel className="h-4 w-full" />
          <Skel className="h-4 w-4/5" />
        </div>
      </section>
    );
  const items = mv!.items;
  const shown = items.slice(0, 5);
  return (
    <section className="card px-5 pb-2 pt-4 sm:px-6" aria-labelledby="move-h" style={{ boxShadow: "var(--card-shadow), inset 0 0 0 1.5px rgb(var(--accent) / 0.35)" }}>
      <header className="flex items-center gap-2.5">
        <Avatar profile={roleProfile(role)} label={roleName(role)} role={role} size={26} />
        <h2 id="move-h" className="min-w-0 flex-1 text-[16px] font-bold tracking-[-0.01em]">
          Your move, {roleName(role)}
        </h2>
        <span className={cn("chip shrink-0 font-semibold", items.length ? "chip-accent" : "chip-ok")}>{items.length ? `${items.length} open` : "All clear"}</span>
      </header>
      {items.length === 0 ? (
        <p className="py-3 text-[14px] text-muted">Nothing is waiting on you right now.</p>
      ) : (
        <ul className="rows mt-1">
          {shown.map((i) => {
            const due = dueInfo(i.due || "");
            return (
              <li key={i.kind + i.id}>
                <button type="button" onClick={() => (i.kind === "decision" ? scrollTo("decisions") : focusStep(i.id))} className="group flex min-h-[46px] w-full items-center gap-3 rounded-lg py-1.5 text-left">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center" aria-hidden="true">
                    {i.kind === "decision" ? <Scale size={18} className="text-accent" /> : <StatusGlyph status={i.status || "todo"} size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] leading-snug text-ink group-hover:text-accent">
                      <span className="sr-only">{i.kind === "decision" ? "Decision to agree to: " : "Step: "}</span>
                      {i.title}
                    </span>
                    <span className="block text-[12.5px] leading-snug text-muted">
                      {i.sub}
                      {i.status === "doing" ? " · Doing" : i.status === "blocked" ? " · Blocked" : ""}
                      {i.both ? ` · with ${roleName(role === "chris" ? "aaron" : "chris")}` : ""}
                    </span>
                  </span>
                  {due && <span className={cn("chip shrink-0", due.tone === "late" ? "chip-bad" : due.tone === "soon" ? "chip-late" : "")}>{due.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > shown.length && (
        <button type="button" onClick={() => scrollTo("gameplan")} className="tap mb-1 mt-1 min-h-[40px] text-[13.5px] font-semibold text-accent hover:underline">
          {items.length - shown.length} more in the gameplan
        </button>
      )}
    </section>
  );
}
