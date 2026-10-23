import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, MessagesSquare } from "lucide-react";
import { nowIso, useAuthor, useStore } from "@/lib/store";
import { dayLabel, localDay, type Message } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Avatar, Skel } from "./bits";

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
};
const dayOf = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? localDay(new Date(t)) : "";
};
function dayHeading(day: string) {
  const today = localDay();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === today) return "Today";
  if (day === localDay(y)) return "Yesterday";
  return dayLabel(day, today);
}

/** The team thread: a plain chat between the two cofounders. Fills the right rail on desktop. */
export function Thread({ rail }: { rail?: boolean }) {
  const { messages, ready, me, canWrite, add, profile, team, roleName, role } = useStore();
  const author = useAuthor();
  const other = role === "chris" ? roleName("aaron") : role === "aaron" ? roleName("chris") : "";
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  // Stay pinned to the newest message unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, ready.messages]);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(140, el.scrollHeight) + "px";
  }, [text]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    stick.current = true;
    const ok = await add("messages", { text: t, authorId: me || "", kind: "msg", createdAt: nowIso() });
    setBusy(false);
    if (ok) setText("");
  };

  let lastDay = "";
  let lastAuthor = "";
  return (
    <section id="thread" aria-labelledby="thread-t" className={cn("card flex min-w-0 flex-col", rail ? "h-full" : "")}>
      <header className="sect-h !pb-3">
        <span className="ico-chip" aria-hidden="true">
          <MessagesSquare size={17} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="thread-t" className="sect-t">
            Team thread
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{other ? `Just you and ${other}` : "Just the two of you"}</p>
        </div>
        <span className="flex -space-x-1.5" aria-hidden="true">
          <Avatar profile={profile(team.chris)} label={roleName("chris")} role="chris" size={24} ring />
          <Avatar profile={profile(team.aaron)} label={roleName("aaron")} role="aaron" size={24} ring />
        </span>
      </header>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className={cn("min-h-0 flex-1 overflow-y-auto border-t border-line px-4 py-3 sm:px-5", rail ? "" : "max-h-[460px] min-h-[220px]")}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {!ready.messages ? (
          <div className="space-y-3 py-2">
            <Skel className="h-10 w-2/3" />
            <Skel className="ml-auto h-10 w-1/2" />
            <Skel className="h-10 w-3/5" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="empty-ico">
              <MessagesSquare size={16} />
            </span>
            <p className="text-[14px] font-semibold text-ink2">No messages yet</p>
            <p className="max-w-[240px] text-[13px] leading-relaxed text-muted">Questions, links, a quick "done". Anything you'd text each other about the studio.</p>
          </div>
        ) : (
          <ol className="space-y-1">
            <AnimatePresence initial={false}>
              {messages.map((m: Message) => {
                const d = dayOf(m.createdAt);
                const newDay = d !== lastDay;
                const first = newDay || m.authorId !== lastAuthor;
                lastDay = d;
                lastAuthor = m.authorId;
                const mine = !!me && m.authorId === me;
                const r = m.authorId === team.chris ? "chris" : m.authorId === team.aaron ? "aaron" : null;
                return (
                  <motion.li key={m.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {newDay && d && <p className="my-3 text-center text-[12px] font-semibold text-faintText">{dayHeading(d)}</p>}
                    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", first && "mt-2.5")}>
                      {!mine && <span className="w-6 shrink-0">{first && <Avatar profile={profile(m.authorId)} label={author(m.authorId)} role={r} size={24} />}</span>}
                      <div className={cn("flex max-w-[82%] flex-col", mine ? "items-end" : "items-start")}>
                        {first && (
                          <span className="mb-0.5 px-1 text-[12px] text-muted">
                            {!mine && <b className="font-semibold text-ink2">{author(m.authorId)} </b>}
                            {time(m.createdAt)}
                          </span>
                        )}
                        <p className={cn("whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-[14.5px] leading-snug", mine ? "rounded-br-md bg-accent text-accentInk" : "rounded-bl-md bg-surface2 text-ink")}>{m.text}</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>
      {canWrite ? (
        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="field !items-end !pr-1.5">
            <textarea
              ref={ta}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={other ? `Message ${other}` : "Write a message"}
              aria-label="Message"
              maxLength={4000}
              className="text-[14.5px]"
            />
            <button type="submit" disabled={!text.trim() || busy} className={cn("mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors", text.trim() ? "bg-accent text-accentInk" : "bg-sunk text-faint")} aria-label="Send">
              <ArrowUp size={17} strokeWidth={2.4} />
            </button>
          </div>
          <p className="mt-1.5 hidden px-1 text-[11.5px] text-faintText sm:block">Enter sends · Shift+Enter for a new line</p>
        </form>
      ) : (
        <p className="border-t border-line px-5 py-3 text-[13px] text-muted">You can read the thread here. Posting needs a founder sign-in.</p>
      )}
    </section>
  );
}
