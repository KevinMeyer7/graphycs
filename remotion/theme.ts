export const theme = {
  colors: {
    background: "#05070d",
    card: "rgba(255,255,255,0.96)",
    cardMuted: "rgba(255,255,255,0.82)",
    primary: "#10b981",
    primarySoft: "rgba(16,185,129,0.18)",
    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,0.15)",
    text: "#0f172a",
    textMuted: "#475569",
  },
  fonts: {
    display: `var(--font-display, "Space Grotesk", "Inter", sans-serif)`,
    body: `var(--font-body, "Inter", "SF Pro Display", sans-serif)`,
  },
  radii: {
    lg: 32,
    md: 24,
    sm: 12,
  },
  shadows: {
    floating: "0 30px 120px rgba(15, 23, 42, 0.35)",
    glow: "0 0 70px rgba(16, 185, 129, 0.3)",
  },
  easing: {
    smooth: [0.4, 0, 0.2, 1],
  },
};

export type Theme = typeof theme;
