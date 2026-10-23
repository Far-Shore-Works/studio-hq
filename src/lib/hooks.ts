import { useEffect, useState } from "react";

export function useMedia(q: string) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");

/** Current time, refreshed every `every` ms, for "5m ago" labels. */
export function useNow(every = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

// Theme: "system" follows the OS; an explicit choice sets data-theme on <html>. Remembered per browser.
export type ThemePref = "system" | "light" | "dark";
const KEY = "studio-hq-theme";
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
    } catch {
      /* storage blocked */
    }
    return "system";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* storage blocked */
    }
  }, [pref]);
  return { pref, setPref };
}

/** Which section is in view (for the nav pill). */
export function useScrollSpy(ids: string[]) {
  const [cur, setCur] = useState(ids[0]);
  useEffect(() => {
    const on = () => {
      let best = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 170) best = id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        const last = ids.filter((id) => document.getElementById(id)).pop();
        if (last && window.matchMedia("(max-width: 1023px)").matches) best = last;
      }
      setCur(best);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [ids.join(",")]);
  return cur;
}
