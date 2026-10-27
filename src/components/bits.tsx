import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type Profile } from "@/lib/store";
import type { Owner, Role, Status } from "@/lib/model";
import { useReducedMotion } from "@/lib/hooks";

/** A card section with an icon chip, a title, an optional meta line and actions on the right. */
export function Section({
  id,
  icon,
  title,
  meta,
  action,
  children,
  className,
  bodyClass,
}: {
  id?: string;
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? id + "-t" : undefined} className={cn("card min-w-0", className)}>
      <header className="sect-h">
        <span className="ico-chip" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1 basis-[230px]">
          <h2 id={id ? id + "-t" : undefined} className="sect-t">
            {title}
          </h2>
          {meta && <p className="num mt-0.5 text-[13px] leading-snug text-muted">{meta}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </header>
      <div className={cn("sect-b", bodyClass)}>{children}</div>
    </section>
  );
}

export function Empty({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("empty", className)}>
      {icon && <span className="empty-ico">{icon}</span>}
      <div className="min-w-0">
        <p className="font-semibold text-ink2">{title}</p>
        {children && <div className="mt-0.5 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Rows of skeleton lines for a list that hasn't loaded yet. */
export function SkelRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skel className="h-5 w-5 rounded-full" />
          <Skel className={cn("h-4", i % 3 === 0 ? "w-2/3" : i % 3 === 1 ? "w-1/2" : "w-3/5")} />
        </div>
      ))}
    </div>
  );
}

/** Number that counts up the first time it appears. */
export function Count({ to, className }: { to: number; className?: string }) {
  const rm = useReducedMotion();
  const mv = useMotionValue(rm ? to : 0);
  const txt = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    if (rm) {
      mv.set(to);
      return;
    }
    const c = animate(mv, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [to, rm, mv]);
  return <motion.span className={className}>{txt}</motion.span>;
}

// ---- People -----------------------------------------------------------------------------------
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/** A round avatar: the profile photo when the platform gives one, else initials on the person's color. */
export function Avatar({ profile, label, role, size = 22, ring }: { profile: Profile | null; label: string; role?: Role | null; size?: number; ring?: boolean }) {
  const [broken, setBroken] = useState(false);
  const color = profile?.color || (role ? `rgb(var(--p-${role}))` : "rgb(var(--faint))");
  const photo = profile?.avatarUrl && !broken && (profile.name || !profile.avatarUrl.startsWith("data:")) ? profile.avatarUrl : "";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white", ring && "ring-2 ring-raised")}
      style={{ width: size, height: size, background: color, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : initials(label)}
    </span>
  );
}

/** A role's avatar and name as one chip. "both" shows the two avatars overlapped. */
export function OwnerChip({ owner, className, dense }: { owner: Owner | ""; className?: string; dense?: boolean }) {
  const { roleName, roleProfile, role } = useStore();
  if (!owner)
    return (
      <span className={cn("chip", className)}>
        <span className="inline-block h-[14px] w-[14px] rounded-full border border-dashed border-line2" aria-hidden="true" />
        Unassigned
      </span>
    );
  if (owner === "both")
    return (
      <span className={cn("chip pl-1", className)}>
        <span className="flex -space-x-1">
          <Avatar profile={roleProfile("chris")} label={roleName("chris")} role="chris" size={16} ring />
          <Avatar profile={roleProfile("aaron")} label={roleName("aaron")} role="aaron" size={16} ring />
        </span>
        {dense ? "Both" : "Both of you"}
      </span>
    );
  const you = role === owner;
  return (
    <span className={cn("chip pl-1", you && !dense && "chip-accent", className)}>
      <Avatar profile={roleProfile(owner)} label={roleName(owner)} role={owner} size={16} />
      {roleName(owner)}
      {you && !dense && <span className="opacity-70">(you)</span>}
    </span>
  );
}

// ---- Status -----------------------------------------------------------------------------------
/** The step's status as a glyph: an empty ring (to do), a half-filled navy ring (doing), a green check
 *  (done) or a red ring with a bar (blocked). State is never color alone: each has its own shape. */
export function StatusGlyph({ status, size = 22 }: { status: Status; size?: number }) {
  const r = size / 2 - 1.5;
  const c = size / 2;
  if (status === "done")
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-ok text-white" style={{ width: size, height: size }}>
        <Check size={size * 0.62} strokeWidth={3} />
      </span>
    );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth="1.6" className={status === "blocked" ? "stroke-bad" : status === "doing" ? "stroke-accent" : "stroke-line2"} />
      {status === "doing" && <path d={`M ${c} ${c - r + 3} A ${r - 3} ${r - 3} 0 0 1 ${c} ${c + r - 3} Z`} className="fill-accent" />}
      {status === "blocked" && <line x1={c - r * 0.45} y1={c} x2={c + r * 0.45} y2={c} strokeWidth="2.2" strokeLinecap="round" className="stroke-bad" />}
    </svg>
  );
}

// ---- Segmented control ------------------------------------------------------------------------
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const uid = useId();
  return (
    <div
      className="seg scroll-x w-fit"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        // Arrow keys move the choice, as in any radio group; only the chosen item is a tab stop.
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step || disabled) return;
        e.preventDefault();
        const i = options.findIndex((o) => o.id === value);
        const next = options[(i + step + options.length) % options.length];
        onChange(next.id);
        requestAnimationFrame(() => (e.currentTarget.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
      }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          disabled={disabled}
          onClick={() => value !== o.id && onChange(o.id)}
          className={cn("seg-item tap", size === "sm" && "!h-[26px] !px-2.5 !text-[12.5px] max-md:!h-[34px] max-md:!px-3")}
        >
          {value === o.id && <motion.span layoutId={"seg-" + uid} className="seg-pill" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Menu (a small popover list) ---------------------------------------------------------------
export function Menu({
  trigger,
  items,
  label,
  disabled,
  align = "left",
}: {
  trigger: (open: boolean) => ReactNode;
  items: { id: string; label: ReactNode; active?: boolean; onSelect: () => void }[];
  label: string;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trig = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // Keyboard: land on the current choice, and give focus back to the button when the menu closes with Escape.
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    (Array.from(items || []).find((b) => b.getAttribute("aria-checked") === "true") || items?.[0])?.focus();
    const off = (e: MouseEvent | TouchEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trig.current?.focus();
    };
    document.addEventListener("mousedown", off);
    document.addEventListener("touchstart", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("touchstart", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex">
      <button ref={trig} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} disabled={disabled} onClick={() => setOpen((o) => !o)} className="tap hit rounded-full disabled:cursor-default">
        {trigger(open)}
      </button>
      {open && (
        <motion.div
          role="menu"
          onKeyDown={(e) => {
            const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
            const i = all.indexOf(document.activeElement as HTMLElement);
            const to = e.key === "ArrowDown" ? all[(i + 1) % all.length] : e.key === "ArrowUp" ? all[(i - 1 + all.length) % all.length] : e.key === "Home" ? all[0] : e.key === "End" ? all[all.length - 1] : null;
            if (to) (e.preventDefault(), to.focus());
          }}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14 }}
          className={cn("pop absolute top-full z-30 mt-1.5 min-w-[180px] p-1.5", align === "right" ? "right-0" : "left-0")}
        >
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitemradio"
              aria-checked={!!it.active}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn("flex min-h-[38px] w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[14px] hover:bg-hover max-md:min-h-[44px]", it.active ? "font-semibold text-ink" : "text-ink2")}
            >
              <span className="min-w-0 flex-1">{it.label}</span>
              {it.active && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/** A one-line text input with an Add button that only wakes up when there's text. */
export function AddField({
  placeholder,
  label,
  onAdd,
  disabled,
  maxLength = 140,
  autoFocus,
  onCancel,
  buttonLabel = "Add",
}: {
  placeholder: string;
  label: string;
  onAdd: (text: string) => Promise<boolean> | boolean;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onCancel?: () => void;
  buttonLabel?: string;
}) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = v.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onAdd(t);
    setBusy(false);
    if (ok) setV("");
  };
  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === "Escape" && onCancel && (setV(""), onCancel())}
        className="text-[14.5px]"
      />
      {onCancel && !v && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="submit" className={cn("btn btn-sm", v.trim() ? "btn-primary" : "")} disabled={!v.trim() || busy || disabled}>
        {buttonLabel}
      </button>
    </form>
  );
}

// ---- Long text, folded to a few lines until asked for -----------------------------------------
export function Folded({ text, className, lines = 5, over = 340 }: { text: string; className?: string; lines?: number; over?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > over;
  return (
    <div>
      <p className={cn("whitespace-pre-wrap", className)} style={!open && long ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>
        {text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="tap hit mt-1 inline-flex min-h-[32px] items-center text-[13.5px] font-semibold text-accent hover:underline">
          {open ? "Show less" : "Read the rest"}
        </button>
      )}
    </div>
  );
}
