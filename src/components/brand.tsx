// The Far Shore Works brand bits shared by the app and the sign-in screen.

export const BRAND = "Far Shore Works";

export function Mark({ size = 26 }: { size?: number }) {
  // The Far Shore Works horizon mark (brand-kit/avatar.png): a low sun over the far shore and the water.
  // Brand colors are fixed so the mark matches the site, the org avatar and the social banners.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="7.5" fill="#14213D" />
      <circle cx="21" cy="12" r="4.2" fill="#F2C46D" />
      <path d="M4.5 20.5h23" stroke="#E9ECE6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.5 25h15" stroke="#7E9BC9" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function BrandBand() {
  // A slim horizon above the page: sky, a low sun, three shore layers and a strip of water with the sun's glint.
  return (
    <div className="brand-band" aria-hidden="true">
      <div className="bb-glow" />
      <div className="bb-sun" />
      <svg className="bb-ridge" style={{ bottom: 12, height: 30, fill: "rgb(var(--b-far))" }} viewBox="0 0 1440 96" preserveAspectRatio="none">
        <path d="M0 58 C90 48 170 30 260 34 C350 38 410 58 500 54 C590 50 650 22 750 26 C840 30 890 56 950 64 C990 69 1020 66 1060 58 C1130 44 1200 30 1290 36 C1360 40 1400 34 1440 30 L1440 96 L0 96 Z" />
      </svg>
      <svg className="bb-ridge" style={{ bottom: 12, height: 18, fill: "rgb(var(--b-mid))" }} viewBox="0 0 1440 58" preserveAspectRatio="none">
        <path d="M0 34 C120 30 200 18 300 22 C400 26 470 38 560 36 C660 34 720 24 820 28 C900 31 940 40 990 41 C1060 42 1120 30 1210 26 C1300 22 1380 28 1440 26 L1440 58 L0 58 Z" />
      </svg>
      <svg className="bb-ridge" style={{ bottom: 12, height: 8, fill: "rgb(var(--b-shore))" }} viewBox="0 0 1440 26" preserveAspectRatio="none">
        <path d="M0 14 C120 12 180 6 260 8 C340 10 380 4 470 5 C560 6 600 12 700 11 L760 11 C840 10 900 5 980 6 C1060 7 1120 12 1220 11 C1300 10 1370 6 1440 7 L1440 26 L0 26 Z" />
      </svg>
      <div className="bb-water" />
      <div className="bb-glint">
        <i style={{ width: "100%", opacity: 0.85 }} />
        <i style={{ width: "62%", opacity: 0.5 }} />
        <i style={{ width: "30%", opacity: 0.3 }} />
      </div>
    </div>
  );
}
