import { Children, isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "lucide-react";
import type { Doc } from "@/lib/model";

// Renders a doc's markdown as React elements. Nothing is injected as HTML, raw HTML in the text shows as
// plain text, only http(s), mailto and in-page links become links, and images are never loaded (they show
// their alt text), so a doc can't run script or phone home when a founder opens it.
// This file is loaded on demand (React.lazy in docs.tsx) so the rest of the page stays small.

const textOf = (n: ReactNode): string =>
  Children.toArray(n)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : ""))
    .join("");
export const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const base = (p: string) => p.split(/[?#]/)[0].split("/").pop()!.toLowerCase();

export default function Md({ text, docs, onOpen }: { text: string; docs: Doc[]; onOpen: (slug: string) => void }) {
  const heading = (Tag: "h3" | "h4" | "h5" | "h6"): Components["h1"] =>
    function H({ children }) {
      return (
        <Tag id={"h-" + slugify(textOf(children))} className="md-h">
          {children}
        </Tag>
      );
    };
  const components: Components = {
    h1: heading("h3"),
    h2: heading("h4"),
    h3: heading("h5"),
    h4: heading("h6"),
    h5: heading("h6"),
    h6: heading("h6"),
    a({ href, children }) {
      const h = href || "";
      if (h.startsWith("#")) {
        return (
          <a
            href={h}
            className="link"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("h-" + slugify(decodeURIComponent(h.slice(1))))?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {children}
          </a>
        );
      }
      if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) {
        return (
          <a href={h} target="_blank" rel="noopener noreferrer" className="link">
            {children}
            {/^https?:/i.test(h) && <ArrowUpRight size={12} className="ml-0.5 inline align-[-1px] text-faint" aria-hidden="true" />}
          </a>
        );
      }
      // A link to another file: open the doc made from it, when there is one.
      const target = /\.md([?#]|$)/i.test(h) ? docs.find((d) => (d.sourcePath && base(d.sourcePath) === base(h)) || d.slug === base(h).replace(/\.md$/, "")) : undefined;
      if (target)
        return (
          <a
            href={"#docs"}
            className="link"
            onClick={(e) => {
              e.preventDefault();
              onOpen(target.slug);
            }}
          >
            {children}
          </a>
        );
      return <span>{children}</span>;
    },
    img({ alt }) {
      return <span className="text-muted">[image{alt ? ": " + alt : ""}]</span>;
    },
    table({ children }) {
      return (
        <div className="md-table scroll-x">
          <table>{children}</table>
        </div>
      );
    },
    input({ checked }) {
      return <input type="checkbox" checked={!!checked} readOnly disabled className="mr-1.5 align-middle" aria-label={checked ? "Done" : "Not done"} />;
    },
  };
  return (
    <div className="md">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
