import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Page-level UI state shared across sections: which steps are expanded, and jumping to a section or step.
interface Ui {
  expanded: Set<string>;
  toggleStep: (id: string) => void;
  /** Open a step and bring it into view (from Up next). */
  focusStep: (id: string) => void;
  scrollTo: (id: string) => void;
  /** A step id the gameplan should show even when its filters would hide it. */
  pinned: string | null;
}
const Ctx = createContext<Ui | null>(null);
export const useUi = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi outside UiProvider");
  return v;
};

const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

export function UiProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pinned, setPinned] = useState<string | null>(null);
  const toggleStep = useCallback((id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: smooth(), block: "start" });
  }, []);
  const focusStep = useCallback((id: string) => {
    setPinned(id);
    setExpanded((s) => new Set(s).add(id));
    // Wait a frame so the row exists (and is open) before scrolling to it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById("step-" + id);
        if (!el) return;
        el.scrollIntoView({ behavior: smooth(), block: "center" });
        el.animate?.([{ backgroundColor: "rgb(var(--accent) / 0.12)" }, { backgroundColor: "rgb(var(--accent) / 0)" }], { duration: 1600, easing: "ease-out" });
      }),
    );
  }, []);
  return <Ctx.Provider value={{ expanded, toggleStep, focusStep, scrollTo, pinned }}>{children}</Ctx.Provider>;
}
