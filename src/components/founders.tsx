import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Clock, CircleDollarSign, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  addDays, dayLabel, dollars, firstName, fmtHours, GIFT_THRESHOLD_USD, hoursStats, localDay, moneyIn, weekLabel, weekStartOf,
  type FounderMoney, type HoursRow, type Role,
} from "@/lib/model";
import { cn } from "@/lib/utils";
import { Avatar, Empty, Section, Skel } from "./bits";

// The Founders panel: each founder's money in (from the ledger) and weekly hours (each founder logs their own).
// Both founders see both founders' numbers: this is the shared studio record. The database enforces that you
// can only write your own hours (row-level security on public.hours).

const ROLES: Role[] = ["chris", "aaron"];
const WEEKS_SHOWN = 8;

export function Founders() {
  const { ledger, hours, ready, unavailable, role, roleName, roleProfile, members } = useStore();
  const [allLines, setAllLines] = useState(false);
  const today = localDay();

  const names = useMemo(() => {
    const n: Record<Role, string[]> = { chris: ["chris"], aaron: ["aaron"] };
    members.forEach((m) => {
      const f = firstName(m.name).toLowerCase();
      if (f && !n[m.role].includes(f)) n[m.role].push(f);
    });
    return n;
  }, [members]);
  const money = useMemo(() => moneyIn(ledger, names), [ledger, names]);
  const memberId = (r: Role) => members.find((m) => m.role === r)?.id || "";

  const allOff = unavailable.ledger && unavailable.hours;
  const loading = !allOff && (!ready.ledger || !ready.hours || !ready.members);
  const lines = allLines ? ledger : ledger.slice(0, 5);

  return (
    <Section
      id="founders"
      icon={<Users size={17} strokeWidth={2.1} />}
      title="Founders"
      meta="Money in and weekly hours, for both of you"
    >
      {allOff ? (
        <Empty icon={<Users size={16} />} title="The founders panel isn't switched on yet.">
          It appears here as soon as the database update for this tab is applied.
        </Empty>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            {ROLES.map((r) => (
              <FounderCard
                key={r}
                r={r}
                name={roleName(r)}
                you={role === r}
                avatar={<Avatar profile={roleProfile(r)} label={roleName(r)} role={r} size={28} />}
                money={money[r]}
                stats={hoursStats(hours, memberId(r), today)}
                loading={loading}
                moneyOff={unavailable.ledger}
                hoursOff={unavailable.hours}
              />
            ))}
          </div>

          {!unavailable.hours && <HoursLog hours={hours} loading={!ready.hours} memberOf={memberId} />}

          {!unavailable.ledger && (
            <div>
              <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
                <CircleDollarSign size={14} aria-hidden="true" /> Money in, line by line
              </h3>
              {!ready.ledger ? (
                <Skel className="h-12" />
              ) : ledger.length === 0 ? (
                <Empty icon={<CircleDollarSign size={16} />} title="No purchases logged yet.">
                  Every studio purchase goes in the ledger the day it happens.
                </Empty>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {lines.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                        <span className="num w-[58px] shrink-0 text-[12.5px] text-faintText">{l.date ? dayLabel(l.date) : ""}</span>
                        <span className="min-w-0 flex-1 basis-[200px] text-[14.5px] text-ink">
                          {l.item || "Purchase"}
                          {l.vendor && <span className="text-muted"> · {l.vendor}</span>}
                        </span>
                        <span className="chip">Paid by {l.paidBy || "unknown"}</span>
                        {l.approvedBy ? <span className="chip chip-ok">Approved</span> : <span className="chip chip-late">Not approved yet</span>}
                        <span className="num w-[72px] shrink-0 text-right text-[14.5px] font-semibold text-ink">{dollars(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  {ledger.length > 5 && (
                    <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setAllLines((o) => !o)}>
                      {allLines ? "Show fewer" : `Show all ${ledger.length}`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <p className="text-[12.5px] leading-relaxed text-faintText">
            Money comes from the ledger. A cost counts once someone has approved it. Under the founder terms (draft v2, item 7), Chris's first {dollars(GIFT_THRESHOLD_USD)} of approved costs is a gift to the studio; every
            other approved cost, and Aaron's from his first dollar, is repaid before profit is split.
            {money.other.purchases > 0 && ` ${dollars(money.other.amount)} in ${money.other.purchases} ${money.other.purchases === 1 ? "line was" : "lines were"} paid by neither of you and isn't counted above.`} Hours are self-reported, and you can
            only edit your own.
          </p>
        </div>
      )}
    </Section>
  );
}

function FounderCard({
  r, name, you, avatar, money, stats, loading, moneyOff, hoursOff,
}: {
  r: Role;
  name: string;
  you: boolean;
  avatar: ReactNode;
  money: FounderMoney;
  stats: ReturnType<typeof hoursStats>;
  loading: boolean;
  moneyOff: boolean;
  hoursOff: boolean;
}) {
  const isChris = r === "chris";
  const pct = Math.min(100, Math.round((100 * money.approved) / GIFT_THRESHOLD_USD));
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface2/70 p-4 ring-1 ring-line/60 sm:p-5" aria-label={`${name}'s numbers`}>
      <header className="flex items-center gap-2.5">
        {avatar}
        <h3 className="display text-[19px] leading-tight">{name}</h3>
        {you && <span className="chip chip-accent">You</span>}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="eyebrow !text-[12.5px]">Money in</p>
          {loading ? <Skel className="mt-1 h-8 w-24" /> : <p className="stat-num !mt-1 !text-[26px]">{moneyOff ? "n/a" : dollars(money.paid)}</p>}
          <p className="stat-sub mt-1">{moneyOff ? "Not switched on" : `${money.purchases} ${money.purchases === 1 ? "purchase" : "purchases"}`}</p>
        </div>
        <div className="min-w-0">
          <p className="eyebrow !text-[12.5px]">Hours per week</p>
          {loading ? <Skel className="mt-1 h-8 w-24" /> : <p className="stat-num !mt-1 !text-[26px]">{hoursOff ? "n/a" : stats.logged ? fmtHours(stats.avg4) : "none"}</p>}
          <p className="stat-sub mt-1">
            {hoursOff ? "Not switched on" : stats.logged ? `${stats.weeksCounted}-week average` : "Nothing logged yet"}
          </p>
        </div>
      </div>

      {!moneyOff && !loading && (
        <div>
          {isChris ? (
            <>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-semibold text-ink">Gift toward {dollars(GIFT_THRESHOLD_USD)}</span>
                <span className="num text-muted">
                  {dollars(money.gift)} of {dollars(GIFT_THRESHOLD_USD)}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunk"
                role="progressbar"
                aria-label={`Chris's approved costs toward the ${dollars(GIFT_THRESHOLD_USD)} gift`}
                aria-valuemin={0}
                aria-valuemax={GIFT_THRESHOLD_USD}
                aria-valuenow={Math.min(money.approved, GIFT_THRESHOLD_USD)}
              >
                <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: pct + "%" }} />
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">
                {money.approved >= GIFT_THRESHOLD_USD
                  ? `Gift threshold reached. ${dollars(money.owedBack)} above it is repaid to him.`
                  : `${dollars(GIFT_THRESHOLD_USD - money.approved)} more of approved costs before repayment starts. Nothing is repaid until then.`}
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-snug text-muted">
              <b className="font-semibold text-ink">{dollars(money.owedBack)} owed back.</b> Every approved dollar Aaron pays is repaid before profit is split.
            </p>
          )}
          {money.unapproved > 0 && <p className="mt-1.5 text-[13px] leading-snug text-late">{dollars(money.unapproved)} paid but not approved yet, so it isn't counted.</p>}
        </div>
      )}

      {!hoursOff && !loading && (
        <p className="num border-t border-line pt-3 text-[13px] leading-snug text-muted">
          {stats.logged ? (
            <>
              <b className="font-semibold text-ink">{fmtHours(stats.total)} h</b> in total over {stats.logged} {stats.logged === 1 ? "week" : "weeks"} logged.
            </>
          ) : (
            "Hours total appears once a week is logged."
          )}
        </p>
      )}
    </article>
  );
}

function HoursLog({ hours, loading, memberOf }: { hours: HoursRow[]; loading: boolean; memberOf: (r: Role) => string }) {
  const { canWrite, role, me, logHours, roleName, toast } = useStore();
  const today = localDay();
  const cur = weekStartOf(today);
  const [week, setWeek] = useState(cur);
  const [draft, setDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byKey = useMemo(() => {
    const m = new Map<string, HoursRow>();
    hours.forEach((h) => m.set(h.memberId + "|" + h.weekStart, h));
    return m;
  }, [hours]);
  const weeks = useMemo(() => Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(cur, -7 * i)), [cur]);
  const max = Math.max(1, ...hours.filter((h) => weeks.includes(h.weekStart)).map((h) => h.hours));
  const saved = me ? byKey.get(me + "|" + week) : undefined;
  const value = draft ?? (saved ? fmtHours(saved.hours) : "");
  const note = noteDraft ?? saved?.note ?? "";
  const n = value.trim() === "" ? NaN : Number(value);
  const valid = Number.isFinite(n) && n >= 0 && n <= 168;
  const dirty = (draft !== null && draft !== (saved ? fmtHours(saved.hours) : "")) || (noteDraft !== null && noteDraft !== (saved?.note ?? ""));

  const pick = (w: string) => {
    setWeek(w);
    setDraft(null);
    setNoteDraft(null);
  };
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await logHours(week, n, note);
    setBusy(false);
    if (ok) {
      toast(`Saved ${fmtHours(n)} h for ${weekLabel(week)}`);
      setDraft(null);
      setNoteDraft(null);
    }
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
        <Clock size={14} aria-hidden="true" /> Weekly hours
      </h3>
      {loading ? (
        <Skel className="h-40" />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {canWrite && role ? (
            <form
              className="min-w-0 rounded-2xl bg-surface2/70 p-4 ring-1 ring-line/60"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              aria-label="Log your hours"
            >
              <p className="text-[14px] font-semibold text-ink">Log your hours</p>
              <p className="mt-0.5 text-[13px] text-muted">One number per week, about how long you worked on the studio. You can change it later.</p>
              <div className="mt-3 flex items-center gap-1">
                <button type="button" className="tap flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink" onClick={() => pick(addDays(week, -7))} aria-label="Previous week">
                  <ChevronLeft size={16} />
                </button>
                <p className="num min-w-0 flex-1 text-center text-[14px] font-semibold text-ink" aria-live="polite">
                  {week === cur ? "This week" : weekLabel(week)}
                  {week === cur && <span className="font-normal text-muted"> · {weekLabel(week)}</span>}
                </p>
                <button
                  type="button"
                  className="tap flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink disabled:opacity-30"
                  onClick={() => pick(addDays(week, 7))}
                  disabled={week >= cur}
                  aria-label="Next week"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                <label className="field">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={168}
                    step={0.5}
                    value={value}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Hours"
                    aria-label={`Hours for ${weekLabel(week)}`}
                    className="num text-[15px]"
                  />
                  <span className="pr-3 text-[13px] text-muted" aria-hidden="true">
                    h
                  </span>
                </label>
                <label className="field">
                  <input value={note} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Note (optional)" aria-label="Note for the week" maxLength={300} className="text-[14px]" />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="submit" className={cn("btn btn-sm", valid && dirty ? "btn-primary" : "")} disabled={!valid || !dirty || busy}>
                  {saved ? "Update" : "Save"}
                </button>
                {value !== "" && !valid && <span className="text-[13px] text-bad">Enter 0 to 168.</span>}
                {saved && !dirty && <span className="text-[13px] text-muted">Saved</span>}
              </div>
            </form>
          ) : (
            <p className="rounded-2xl bg-surface2/70 p-4 text-[13.5px] text-muted ring-1 ring-line/60">Sign in with a founder email to log hours.</p>
          )}

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-[14px]">
              <caption className="sr-only">Hours per week, last {WEEKS_SHOWN} weeks</caption>
              <thead>
                <tr className="text-left text-[12.5px] font-semibold text-muted">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">
                    Week
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="py-1.5 pr-3 font-semibold">
                      {roleName(r)}
                      {role === r && <span className="font-normal"> (you)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {weeks.map((w) => (
                  <tr key={w} className={cn(w === week && role && "bg-accent/[0.06]")}>
                    <th scope="row" className="num whitespace-nowrap py-2 pr-3 text-left text-[13px] font-medium text-ink2">
                      {w === cur ? "This week" : weekLabel(w)}
                    </th>
                    {ROLES.map((r) => {
                      const h = byKey.get(memberOf(r) + "|" + w);
                      const mineCell = canWrite && role === r;
                      const inner = h ? (
                        <span className="flex items-center gap-2">
                          <span className="num w-8 text-right font-semibold sm:w-9 text-ink" title={h.note || undefined}>
                            {fmtHours(h.hours)}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
                            <span className="block h-full rounded-full" style={{ width: Math.max(4, (100 * h.hours) / max) + "%", background: `rgb(var(--p-${r}))` }} />
                          </span>
                        </span>
                      ) : (
                        <span className="text-faintText">{mineCell ? "log" : "none"}</span>
                      );
                      return (
                        <td key={r} className="min-w-[92px] py-2 pr-2.5 sm:min-w-[120px] sm:pr-3">
                          {mineCell ? (
                            <button type="button" onClick={() => pick(w)} className="tap -my-1 block w-full rounded-lg px-1 py-1 text-left hover:bg-hover" aria-label={`Edit your hours for ${weekLabel(w)}`}>
                              {inner}
                            </button>
                          ) : (
                            inner
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
