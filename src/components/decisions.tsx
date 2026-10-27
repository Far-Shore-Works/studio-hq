import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Scale } from "lucide-react";
import { nowIso, useAuthor, useStore } from "@/lib/store";
import { agreedIds, dayLabel, isSettled, localDay, sortDecisions, type Decision, type Role } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Avatar, Empty, Folded, Section, SkelRows } from "./bits";

export function Decisions() {
  const { decisions, team, ready, canWrite } = useStore();
  const [proposing, setProposing] = useState(false);
  const sorted = useMemo(() => sortDecisions(decisions), [decisions]);
  const open = sorted.filter((d) => !isSettled(d, team));
  const settled = sorted.filter((d) => isSettled(d, team));
  return (
    <Section
      id="decisions"
      icon={<Scale size={17} strokeWidth={2.1} />}
      title="Decisions"
      meta={ready.decisions ? `${settled.length} settled${open.length ? ` · ${open.length} open` : ""}` : "Loading"}
      action={
        canWrite && !proposing ? (
          <button type="button" className="btn btn-sm" onClick={() => setProposing(true)}>
            <Plus size={15} /> Propose
          </button>
        ) : null
      }
    >
      <p className="mb-3 text-[13.5px] text-muted">
        Name: <span className="font-semibold text-ink">Far Shore Works</span> (decided Oct 22)
      </p>
      <AnimatePresence initial={false}>{proposing && <ProposeForm key="form" close={() => setProposing(false)} />}</AnimatePresence>
      {!ready.decisions ? (
        <SkelRows n={4} />
      ) : (
        <>
          {open.length > 0 && (
            <div className="mb-4 space-y-2.5">
              <p className="eyebrow">Waiting on agreement</p>
              <AnimatePresence initial={false}>
                {open.map((d) => (
                  <OpenDecision key={d.id} d={d} />
                ))}
              </AnimatePresence>
            </div>
          )}
          {settled.length > 0 && (
            <>
              {open.length > 0 && <p className="eyebrow">Settled</p>}
              <ul className="rows">
                {settled.map((d) => (
                  <SettledRow key={d.id} d={d} />
                ))}
              </ul>
            </>
          )}
          {!decisions.length && (
            <Empty icon={<Scale size={16} />} title="Nothing decided yet.">
              Propose a decision and it settles once you've both agreed.
            </Empty>
          )}
        </>
      )}
    </Section>
  );
}

function ProposeForm({ close }: { close: () => void }) {
  const { add, me } = useStore();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const at = nowIso();
    const ok = await add("decisions", { title: t, detail: detail.trim(), date: localDay(), createdAt: at, proposedBy: me || "", agree: me ? { [me]: at } : {} });
    setBusy(false);
    if (ok) close();
  };
  return (
    <motion.form
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.1, 1] }}
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="mb-4 space-y-2 rounded-2xl bg-surface2/70 p-3">
        <div className="field !bg-raised">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What should we decide?" aria-label="Decision" maxLength={160} autoFocus className="text-[15px] font-semibold" />
        </div>
        <div className="field !bg-raised !items-start">
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Why, or the details (optional)" aria-label="Details" rows={2} maxLength={1000} className="text-[14px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim() || busy}>
            Propose
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            Cancel
          </button>
          <span className="text-[12.5px] text-faintText">Proposing counts as your agreement. It settles when the other person agrees too.</span>
        </div>
      </div>
    </motion.form>
  );
}

function Slot({ who, d }: { who: Role; d: Decision }) {
  const { team, roleName, roleProfile } = useStore();
  const ids = agreedIds(d);
  const yes = !!team[who] && ids.includes(team[who]);
  return (
    <span className="flex items-center gap-1.5" title={`${roleName(who)}: ${yes ? "agreed" : "not yet"}`}>
      <span className="relative">
        <span className={cn("block rounded-full", !yes && "opacity-45 grayscale")}>
          <Avatar profile={roleProfile(who)} label={roleName(who)} role={who} size={26} />
        </span>
        {yes && (
          <span className="absolute -bottom-0.5 -right-1 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-ok text-white ring-2 ring-raised">
            <Check size={9} strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className={cn("text-[13px]", yes ? "font-semibold text-ink" : "text-muted")}>{roleName(who)}</span>
    </span>
  );
}

function OpenDecision({ d }: { d: Decision }) {
  const { me, team, canWrite, update, roleName, role } = useStore();
  const author = useAuthor();
  const mine = !!me && agreedIds(d).includes(me);
  const other: Role | null = role === "chris" ? "aaron" : role === "aaron" ? "chris" : null;
  const waitingOn = (["chris", "aaron"] as Role[]).filter((r) => !(team[r] && agreedIds(d).includes(team[r])));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const toggle = async () => {
    if (!me || lock.current) return;
    lock.current = true;
    setBusy(true);
    await update("decisions/" + d.id, { agree: { [me]: mine ? null : nowIso() } });
    lock.current = false;
    setBusy(false);
  };
  return (
    <motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="rounded-2xl bg-accent/[0.06] p-4 ring-1 ring-accent/15">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-semibold leading-snug">{d.title}</h3>
          {d.detail && <Folded text={d.detail} className="mt-1 text-[14px] leading-relaxed text-ink2" />}
          <p className="mt-1.5 text-[12.5px] text-muted">
            {d.proposedBy ? (d.proposedBy === me ? "You proposed this" : `Proposed by ${author(d.proposedBy)}`) : "Proposed"}
            {d.date ? ` · ${dayLabel(d.date)}` : ""}
            {waitingOn.length === 1 ? ` · waiting on ${role === waitingOn[0] ? "you" : roleName(waitingOn[0])}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Slot who="chris" d={d} />
          <Slot who="aaron" d={d} />
          {canWrite && me && (
            <button
              type="button"
              className={cn("btn btn-sm", mine ? "btn-ghost" : "btn-primary")}
              onClick={toggle}
              disabled={busy}
              aria-pressed={mine}
              title={mine ? "Take back your agreement" : other ? `Agree. It settles once ${roleName(other)} agrees too.` : "Agree"}
            >
              {mine ? "Take back" : (
                <>
                  <Check size={15} strokeWidth={2.6} /> Agree
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function SettledRow({ d }: { d: Decision }) {
  const { roleName, roleProfile } = useStore();
  const both = !!d.agree;
  return (
    <motion.li layout className="flex gap-4 py-3">
      <span className="num w-[54px] shrink-0 pt-[2px] text-[12.5px] text-muted">{d.date ? dayLabel(d.date) : ""}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug">{d.title}</h3>
        {d.detail && <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{d.detail}</p>}
      </div>
      <span className="flex shrink-0 items-start gap-1.5 pt-[1px]" title={both ? "Both agreed" : "Settled"}>
        {both && (
          <span className="flex -space-x-1.5">
            <Avatar profile={roleProfile("chris")} label={roleName("chris")} role="chris" size={20} ring />
            <Avatar profile={roleProfile("aaron")} label={roleName("aaron")} role="aaron" size={20} ring />
          </span>
        )}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok/15 text-ok" aria-label={both ? "Both agreed" : "Settled"}>
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
    </motion.li>
  );
}
