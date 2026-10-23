import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, LogOut, Mail, MailCheck } from "lucide-react";
import { authSettings, supabase } from "@/lib/supabase";
import { BrandBand, Mark } from "./brand";

// Who gets in: a Supabase Auth session whose user is linked to a row in public.members (the founders'
// emails). The database enforces it (RLS + a sign-up hook); this screen only explains it.

type Gate =
  | { state: "loading" }
  | { state: "out" }
  | { state: "outsider"; email: string }
  | { state: "in"; session: Session };

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [urlError] = useState(() => readUrlError());

  useEffect(() => {
    let alive = true;
    const check = async (session: Session | null) => {
      if (!session) return alive && setGate({ state: "out" });
      // A member row comes back only for a linked founder (RLS); anyone else gets none.
      // Rows come back only when this account's confirmed email is on the founders list (RLS).
      const { data, error } = await supabase.from("members").select("id").limit(1);
      if (!alive) return;
      if (data && data.length) setGate({ state: "in", session });
      else if (error && !/permission|JWT/i.test(error.message)) setGate({ state: "in", session }); // offline: let the app show its own banner
      else setGate({ state: "outsider", email: session.user.email || "" });
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void check(session);
      else if (event === "TOKEN_REFRESHED" && session) setGate((g) => (g.state === "in" ? { state: "in", session } : g));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (gate.state === "loading") return <Shell><p className="text-center text-[14px] text-muted">Checking your sign-in…</p></Shell>;
  if (gate.state === "out") return <SignIn urlError={urlError} />;
  if (gate.state === "outsider") return <Outsider email={gate.email} />;
  return <>{children(gate.session)}</>;
}

/** Errors Supabase puts in the URL after a bad or expired link. */
function readUrlError(): string {
  try {
    const p = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const d = p.get("error_description");
    if (!d) return "";
    history.replaceState(null, "", window.location.pathname);
    if (/expired|invalid/i.test(d)) return "That sign-in link has expired or was already used. Send yourself a new one.";
    return d.replace(/\+/g, " ");
  } catch {
    return "";
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <BrandBand />
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[10vh] sm:pt-[14vh]">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}

function Heading({ sub }: { sub: string }) {
  return (
    <div className="mb-7 flex flex-col items-center text-center">
      <Mark size={44} />
      <h1 className="brand-title mt-5 text-[34px] leading-[1.05]">Studio HQ</h1>
      <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

function SignIn({ urlError }: { urlError: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"" | "email" | "github">("");
  const [sent, setSent] = useState("");
  const [err, setErr] = useState(urlError);
  const [github, setGithub] = useState<boolean | null>(null);
  useEffect(() => {
    authSettings().then((s) => setGithub(s.github));
  }, []);

  const sendLink = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || busy) return setErr(e ? "That doesn't look like an email address." : "");
    setBusy("email");
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
    setBusy("");
    if (error) {
      setErr(
        /not on the founders list|private/i.test(error.message)
          ? "That email isn't on the founders list. Use the address you gave Chris."
          : /rate|seconds|too many/i.test(error.message)
            ? "Too many links in a short time. Wait a minute, then try again."
            : "Couldn't send the link: " + error.message,
      );
      return;
    }
    setSent(e);
  };

  const withGithub = async () => {
    setBusy("github");
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.origin + window.location.pathname } });
    if (error) {
      setBusy("");
      setErr("GitHub sign-in isn't available right now. Use the email link.");
    }
  };

  if (sent)
    return (
      <Shell>
        <Heading sub="Private to the founders." />
        <div className="card px-6 py-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/[0.12] text-accent">
            <MailCheck size={20} />
          </span>
          <p className="text-[16px] font-semibold text-ink">Check your email</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            We sent a sign-in link to <b className="font-semibold text-ink2">{sent}</b>. Open it on any device and you're in.
          </p>
          <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setSent("")}>
            Use a different email
          </button>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <Heading sub="Private to the founders. Sign in with the email you use for the studio." />
      <div className="card space-y-4 px-5 py-5 sm:px-6 sm:py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendLink();
          }}
          className="space-y-3"
        >
          <label htmlFor="email" className="block text-[13px] font-semibold text-ink2">
            Email
          </label>
          <div className="field">
            <Mail size={16} className="shrink-0 text-faint" aria-hidden="true" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-[15px]"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary h-11 w-full text-[15px]" disabled={!email.trim() || busy !== ""}>
            {busy === "email" ? "Sending…" : "Email me a sign-in link"}
            {busy !== "email" && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="flex items-center gap-3 text-[12.5px] text-faintText" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>
        <button type="button" className="btn h-11 w-full text-[15px]" onClick={withGithub} disabled={busy !== "" || github === false}>
          <GithubMark />
          {busy === "github" ? "Opening GitHub…" : "Sign in with GitHub"}
        </button>
        {github === false && <p className="-mt-1 text-center text-[12.5px] text-faintText">GitHub sign-in turns on once its OAuth app is connected.</p>}
        {err && (
          <p role="alert" className="rounded-xl bg-bad/10 px-3.5 py-2.5 text-[13.5px] text-ink2">
            {err}
          </p>
        )}
      </div>
    </Shell>
  );
}

function GithubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Outsider({ email }: { email: string }) {
  return (
    <Shell>
      <Heading sub="Private to the founders." />
      <div className="card px-6 py-6 text-center">
        <p className="text-[16px] font-semibold text-ink">This account isn't on the list</p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
          You're signed in as <b className="font-semibold text-ink2">{email || "an account with no email"}</b>, which isn't one of the founders' addresses. If you signed
          in with GitHub, its email has to match the one on the list.
        </p>
        <button type="button" className="btn btn-sm mt-4" onClick={() => void supabase.auth.signOut()}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </Shell>
  );
}
