import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowUpRight, CloudOff, LogOut, Monitor, Moon, RotateCw, Sun, X } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { useScrollSpy, useTheme, type ThemePref } from "@/lib/hooks";
import { ago, dayLabel } from "@/lib/model";
import { cn } from "@/lib/utils";
import { UiProvider, useUi } from "@/components/ui";
import { Overview } from "@/components/overview";
import { Gameplan } from "@/components/gameplan";
import { Decisions } from "@/components/decisions";
import { Products } from "@/components/products";
import { Founders } from "@/components/founders";
import { Docs } from "@/components/docs";
import { Thread } from "@/components/thread";
import { Skel } from "@/components/bits";
import { AuthGate } from "@/components/auth";
import { Changes } from "@/components/changes";
import { BRAND, BrandBand, Mark } from "@/components/brand";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthGate>
        {(session) => (
          <StoreProvider key={session.user.id} userId={session.user.id} email={session.user.email || ""}>
            <UiProvider>
              <Page />
            </UiProvider>
          </StoreProvider>
        )}
      </AuthGate>
    </MotionConfig>
  );
}

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "gameplan", label: "Gameplan" },
  { id: "decisions", label: "Decisions" },
  { id: "products", label: "Products" },
  { id: "founders", label: "Founders" },
  { id: "docs", label: "Docs" },
  { id: "changes", label: "Changes" },
  { id: "thread", label: "Thread", phoneOnly: true },
];

function Page() {
  const { meta } = useStore();
  const { pref, setPref } = useTheme();
  const name = meta.name || "Studio HQ";
  useEffect(() => {
    document.title = name;
  }, [name]);
  const pad = { paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" };
  return (
    <>
      <a href="#main" className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-3">
        Skip to content
      </a>
      <BrandBand />
      <TopBar name={name} theme={pref} setTheme={setPref} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] pb-20 outline-none" style={pad}>
        <Hero />
        <StateBanner />
        <Overview />
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]">
          <div className="min-w-0 space-y-6">
            <Gameplan />
            <Decisions />
            <Products />
            <Founders />
            <Docs />
            <Changes />
          </div>
          <aside className="min-w-0 lg:sticky lg:top-[68px] lg:h-[min(calc(100vh-84px),1000px)]" aria-label="Team thread">
            <Thread rail />
          </aside>
        </div>
        <Footer />
      </main>
      <Toasts />
    </>
  );
}

function TopBar({ name, theme, setTheme }: { name: string; theme: ThemePref; setTheme: (t: ThemePref) => void }) {
  const { scrollTo } = useUi();
  const { signOut, email } = useStore();
  const cur = useScrollSpy(NAV.map((n) => n.id));
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const next: Record<ThemePref, ThemePref> = { system: "dark", dark: "light", light: "system" };
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const pad = { paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" };
  const nav = (
    <nav aria-label="Sections" className="scroll-x">
      <ul className="flex items-center gap-0.5 rounded-full bg-raised p-1 shadow-[var(--card-shadow)]">
        {NAV.map((n) => (
          <li key={n.id} className={cn(n.phoneOnly && "lg:hidden")}>
            <a
              href={"#" + n.id}
              onClick={(e) => (e.preventDefault(), scrollTo(n.id))}
              aria-current={cur === n.id ? "location" : undefined}
              className={cn("tap relative block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-medium max-md:py-2.5", cur === n.id ? "text-ink" : "text-muted hover:bg-hover hover:text-ink")}
            >
              {cur === n.id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-accent/[0.13]" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
              <span className={cn("relative", cur === n.id && "font-semibold")}>{n.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
  return (
    <header className="sticky top-0 z-40" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{ opacity: scrolled ? 1 : 0, background: "linear-gradient(rgb(var(--bg) / 0.97) 0%, rgb(var(--bg) / 0.97) 86%, rgb(var(--bg) / 0) 100%)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      />
      <div className="relative mx-auto flex max-w-[1240px] items-center gap-3 py-2.5" style={pad}>
        <a href="#overview" onClick={(e) => (e.preventDefault(), window.scrollTo({ top: 0, behavior: "smooth" }))} className="tap flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-2" aria-label={`${BRAND} ${name}, back to the top`}>
          <Mark />
          <span className="brand-word truncate text-[16px] sm:text-[17px]">{BRAND}</span>
        </a>
        <div className="mx-auto hidden md:block">{nav}</div>
        <button
          type="button"
          onClick={() => setTheme(next[theme])}
          className="tap ml-auto flex h-9 w-9 max-md:h-10 max-md:w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink md:ml-0"
          aria-label={`Theme: ${theme}. Switch to ${next[theme]}`}
          title={`Theme: ${theme}`}
        >
          <Icon size={16} />
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="tap flex h-9 w-9 max-md:h-10 max-md:w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink"
          aria-label={`Sign out${email ? " of " + email : ""}`}
          title={`Sign out${email ? " (" + email + ")" : ""}`}
        >
          <LogOut size={16} />
        </button>
      </div>
      <div className="relative pb-2 md:hidden" style={pad}>
        {nav}
      </div>
    </header>
  );
}

function Hero() {
  const { meta, status, ready, mode } = useStore();
  const loading = !ready.meta && mode !== "offline";
  return (
    <div className="pb-5 pt-4 md:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-[720px]">
          {loading ? <Skel className="h-10 w-56" /> : <h1 className="brand-title text-[32px] leading-[1.04] sm:text-[42px]">{meta.name || "Studio HQ"}</h1>}
          <p className="mt-2 text-[16px] leading-relaxed text-muted">{meta.subtitle || "Chris and Aaron's studio: where things stand, what's next, and what we've decided."}</p>
        </div>
        {meta.links.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Links">
            {meta.links.map((l, i) => (
              <li key={i}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="tap inline-flex h-8 items-center gap-1.5 rounded-full bg-raised px-3.5 max-md:h-10 text-[13.5px] font-semibold text-ink shadow-[var(--card-shadow)] hover:text-accent">
                    {l.label}
                    <ArrowUpRight size={14} className="text-faint" />
                  </a>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-full border border-dashed border-line2 px-3.5 text-[13.5px] text-muted">{l.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {status && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-raised/70 px-4 py-3 shadow-[0_0_0_1px_rgb(var(--line))]">
          <span className="relative mt-[7px] flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="animate-ping2 absolute inset-0 rounded-full bg-sun" />
            <span className="relative h-2 w-2 rounded-full bg-sun" />
          </span>
          <p className="min-w-0 text-[14.5px] leading-relaxed text-ink2">
            <b className="font-semibold text-ink">Where things stand. </b>
            {status.summary}
            {status.asOf && <span className="whitespace-nowrap text-faintText"> · {/^\d{4}-\d{2}-\d{2}$/.test(status.asOf) ? dayLabel(status.asOf) : ago(status.asOf)}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function StateBanner() {
  const { mode, retry, canWrite } = useStore();
  if (mode === "offline")
    return (
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-surface2 px-4 py-3 text-[14px]">
        <CloudOff size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="min-w-0">
          <b className="font-semibold">No live data here.</b> <span className="text-muted">Studio HQ couldn't reach its database. Check your connection.</span>
        </p>
      </div>
    );
  if (mode === "error")
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-bad/10 px-4 py-3 text-[14px]">
        <span className="h-2 w-2 rounded-full bg-bad" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Can't reach the studio data right now.</b> <span className="text-ink2">Your changes won't save until it's back.</span>
        </span>
        <button type="button" className="btn btn-sm" onClick={retry}>
          <RotateCw size={13} /> Try again
        </button>
      </div>
    );
  if (mode === "live" && !canWrite)
    return (
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-surface2 px-4 py-3 text-[14px]">
        <CloudOff size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="min-w-0 text-ink2">
          <b className="font-semibold text-ink">View only.</b> You're signed in, but this account isn't linked to a founder yet. Sign out and back in with your founder email.
        </p>
      </div>
    );
  return null;
}

function Footer() {
  return (
    <footer className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-faintText">
      <Mark size={16} />
      <span>Shared by Chris and Aaron. Every change saves for both of you as soon as you make it, and shows under Changes.</span>
    </footer>
  );
}

function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            className={cn("pop pointer-events-auto flex max-w-[460px] items-center gap-3 px-4 py-2.5 text-[14px]", t.tone === "err" && "ring-1 ring-bad/40")}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", t.tone === "err" ? "bg-bad" : "bg-ok")} />
            <span className="min-w-0 flex-1">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="tap -mr-1 rounded-full p-1 text-muted hover:text-ink" aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
