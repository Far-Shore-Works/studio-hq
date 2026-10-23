/** @type {import('tailwindcss').Config} */
// Same token contract as dashboard/app-v4: colors are RGB triplets in src/studio.css, so every utility
// follows light and dark and supports opacity modifiers (bg-accent/10).
const tok = (name) => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: tok("bg"),
        raised: tok("raised"),
        surface2: tok("surface-2"),
        sunk: tok("sunk"),
        hover: tok("hover"),
        line: tok("line"),
        line2: tok("line-2"),
        ink: tok("ink"),
        ink2: tok("ink-2"),
        muted: tok("muted"),
        faint: tok("faint"),
        faintText: tok("faint-text"),
        accent: tok("accent"),
        accentInk: tok("accent-ink"),
        accentSoft: tok("accent-soft"),
        ok: tok("ok"),
        late: tok("late"),
        bad: tok("bad"),
        gold: tok("gold"),
        sun: tok("sun"),
        navy: tok("navy"),
      },
      borderRadius: {
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        "2xl": "var(--r-2xl)",
        card: "var(--r-card)",
        field: "var(--r-field)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: { "2xs": ["11.5px", { lineHeight: "15px" }] },
      screens: { xs: "420px" },
    },
  },
  plugins: [],
};
