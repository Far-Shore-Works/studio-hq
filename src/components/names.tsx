import { useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Check, Crown, Globe, Signature } from "lucide-react";
import { nowIso, useAuthor, useStore } from "@/lib/store";
import { rankNames, type NameIdea } from "@/lib/model";
import { cn } from "@/lib/utils";
import { AddField, Avatar, Empty, Section, Seg, SkelRows } from "./bits";

type View = "all" | "mine";

/** "Small and scrappy. .com is free." → the note, plus the domain fact as its own badge. */
export function splitNote(note: string): { text: string; domain: { tld: string; free: boolean } | null } {
  const m = note.match(/\s*(\.[a-z]{2,})\s+is\s+(free|taken|available|gone)\.?\s*$/i);
  if (!m) return { text: note, domain: null };
  return { text: note.slice(0, m.index).trim(), domain: { tld: m[1].toLowerCase(), free: /free|available/i.test(m[2]) } };
}

export function Names() {
  const { names, ready, canWrite, add, me, team } = useStore();
  const [view, setView] = useState<View>("all");
  const { list } = useMemo(() => rankNames(names), [names]);
  // Leaders float up: the top three names with any votes sit on a podium above the list.
  const podium = list.filter((n) => n.voters.length > 0).slice(0, 3);
  const rest = list.filter((n) => !podium.includes(n));
  const mineOnly = view === "mine";
  const shown = mineOnly ? list.filter((n) => me && n.voters.includes(me)) : rest;
  const myCount = me ? names.filter((n) => n.voters.includes(me)).length : 0;
  const both = (n: NameIdea) => !!team.chris && !!team.aaron && n.voters.includes(team.chris) && n.voters.includes(team.aaron);
  // When every name shares the same domain note (".com is free."), say it once instead of on every row.
  const domains = names.map((n) => splitNote(n.note).domain);
  const shared = domains.length > 1 && domains.every((d) => d && domains[0] && d.tld === domains[0].tld && d.free === domains[0].free) ? domains[0] : null;
  const suggest = (name: string) => {
    const order = names.reduce((m, n) => Math.max(m, n.order), 0) + 1;
    return add("names", { name, note: "", order, votes: me ? { [me]: true } : {}, suggestedBy: me || "", createdAt: nowIso() });
  };
  return (
    <Section
      id="names"
      icon={<Signature size={17} strokeWidth={2.1} />}
      title="Name vote"
      meta={
        ready.names
          ? `${names.length} ${names.length === 1 ? "name" : "names"}${shared ? ` · all have the ${shared.tld} ${shared.free ? "free" : "taken"}` : ""} · vote for every one you'd be glad to see on the paperwork`
          : "Loading"
      }
      action={me ? <Seg<View> label="Show" value={view} onChange={setView} size="sm" options={[{ id: "all", label: "All" }, { id: "mine", label: `Your picks${myCount ? " · " + myCount : ""}` }]} /> : null}
    >
      {!ready.names ? (
        <SkelRows n={6} />
      ) : (
        <LayoutGroup>
          {!mineOnly && podium.length > 0 && (
            <motion.ol layout className={cn("mb-3 grid gap-2.5", podium.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")} aria-label="Leading names">
              <AnimatePresence initial={false}>
                {podium.map((n, i) => (
                  <Leader key={n.id} n={n} rank={i + 1} top={i === 0 || n.voters.length === podium[0].voters.length} both={both(n)} hideDomain={!!shared} />
                ))}
              </AnimatePresence>
            </motion.ol>
          )}
          {!mineOnly && podium.length === 0 && names.length > 0 && <p className="mb-2 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13.5px] text-muted">No votes yet. Names with votes move up here as you both pick.</p>}
          {shown.length > 0 ? (
            <motion.ol layout className="grid gap-x-6 md:grid-cols-2" start={mineOnly ? 1 : podium.length + 1}>
              <AnimatePresence initial={false}>
                {shown.map((n) => (
                  <NameRow key={n.id} n={n} rank={list.indexOf(n) + 1} both={both(n)} hideDomain={!!shared} />
                ))}
              </AnimatePresence>
            </motion.ol>
          ) : mineOnly && names.length ? (
            <p className="py-3 text-[14px] text-muted">You haven't voted yet. Switch to All and tap the ones you like.</p>
          ) : !names.length ? (
            <Empty icon={<Signature size={16} />} title="No names yet.">
              Suggest the first one below.
            </Empty>
          ) : null}
          {canWrite && (
            <div className="mt-4 max-w-[520px]">
              <AddField placeholder="Suggest a name" label="Suggest a name" onAdd={suggest} maxLength={60} />
            </div>
          )}
        </LayoutGroup>
      )}
    </Section>
  );
}

function VoteButton({ n, big }: { n: NameIdea; big?: boolean }) {
  const { me, canWrite, update } = useStore();
  const mine = !!me && n.voters.includes(me);
  // One tap, one write: the button rests until the save lands, so a double tap can't send the same vote twice.
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const toggle = async () => {
    if (!me || lock.current) return;
    lock.current = true;
    setBusy(true);
    await update("names/" + n.id, { votes: { [me]: !mine } });
    lock.current = false;
    setBusy(false);
  };
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      disabled={!canWrite || !me}
      aria-busy={busy}
      onClick={toggle}
      aria-pressed={mine}
      aria-label={mine ? `Remove your vote for ${n.name}` : `Vote for ${n.name}`}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-50",
        big ? "h-9 px-4 text-[14px]" : "h-8 px-3 text-[13px]",
        mine ? "bg-accent text-accentInk" : big ? "bg-raised text-ink2 shadow-[var(--card-shadow)] hover:text-ink" : "bg-surface2 text-ink2 hover:bg-hover hover:text-ink",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={mine ? "y" : "n"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="flex items-center">
          {mine ? <Check size={14} strokeWidth={3} /> : null}
        </motion.span>
      </AnimatePresence>
      {mine ? "Voted" : "Vote"}
    </motion.button>
  );
}

function Voters({ n, size = 20 }: { n: NameIdea; size?: number }) {
  const { profile, team } = useStore();
  const author = useAuthor();
  if (!n.voters.length) return null;
  return (
    <span className="flex -space-x-1.5" title={n.voters.map((v) => author(v, { you: true })).join(" and ")}>
      {n.voters.slice(0, 3).map((v) => (
        <motion.span key={v} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}>
          <Avatar profile={profile(v)} label={author(v)} role={v === team.chris ? "chris" : v === team.aaron ? "aaron" : null} size={size} ring />
        </motion.span>
      ))}
    </span>
  );
}

function Domain({ d }: { d: { tld: string; free: boolean } }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 text-[11.5px] font-semibold leading-[18px]", d.free ? "bg-ok/10 text-ok" : "bg-late/10 text-late")} title={`${d.tld} is ${d.free ? "free" : "taken"}`}>
      <Globe size={11} strokeWidth={2.4} />
      {d.tld}
      {d.free ? " free" : " taken"}
    </span>
  );
}

function NameRow({ n, rank, both, hideDomain }: { n: NameIdea; rank: number; both: boolean; hideDomain: boolean }) {
  const { text, domain } = splitNote(n.note);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 } }}
      className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0"
    >
      <span className="num w-5 shrink-0 text-right text-[12.5px] font-semibold text-faint">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold tracking-[-0.005em]">{n.name}</span>
          {both && <span className="chip chip-gold !h-[19px] !px-1.5 !text-[11px] font-semibold">Both</span>}
          {domain && !hideDomain && <Domain d={domain} />}
        </p>
        {text && (
          <p className="line-clamp-2 text-[13px] leading-snug text-muted" title={text}>
            {text}
          </p>
        )}
      </div>
      <Voters n={n} />
      <VoteButton n={n} />
    </motion.li>
  );
}

function Leader({ n, rank, top, both, hideDomain }: { n: NameIdea; rank: number; top: boolean; both: boolean; hideDomain: boolean }) {
  const { text, domain } = splitNote(n.note);
  const votes = n.voters.length;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 } }}
      className={cn("flex min-w-0 flex-col gap-1.5 rounded-2xl p-4", both ? "bg-gold/[0.11] ring-1 ring-gold/40" : top ? "bg-gold/[0.06] ring-1 ring-gold/20" : "bg-surface2")}
    >
      <p className={cn("flex items-center gap-1.5 text-[12px] font-bold", top || both ? "text-gold" : "text-muted")}>
        {top || both ? <Crown size={13} strokeWidth={2.4} /> : null}
        {both ? "You both picked this" : top ? "Leading" : `No. ${rank} · ${votes} ${votes === 1 ? "vote" : "votes"}`}
      </p>
      <h3 className="display text-[20px] leading-tight">{n.name}</h3>
      {text && <p className="line-clamp-2 text-[13px] leading-snug text-muted">{text}</p>}
      <div className="mt-auto flex items-center gap-2 pt-1.5">
        {domain && !hideDomain && <Domain d={domain} />}
        <span className="ml-auto">
          <Voters n={n} size={22} />
        </span>
        <VoteButton n={n} big />
      </div>
    </motion.li>
  );
}
