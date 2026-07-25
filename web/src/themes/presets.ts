import type { DashboardTheme, ThemeTypography, ThemeLayout } from "./types";

/**
 * Built-in dashboard themes.
 *
 * Each theme defines its own palette, typography, and layout so switching
 * themes produces visible changes beyond just color — fonts, density, and
 * corner-radius all shift to match the theme's personality.
 *
 * Theme names must stay in sync with the backend's
 * `_BUILTIN_DASHBOARD_THEMES` list in `zorin_cli/web_server.py`.
 */

// ---------------------------------------------------------------------------
// Shared typography / layout presets
// ---------------------------------------------------------------------------

/** Default system stack — neutral, safe fallback for every platform. */
const SYSTEM_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontSans: SYSTEM_SANS,
  fontMono: SYSTEM_MONO,
  baseSize: "15px",
  lineHeight: "1.55",
  letterSpacing: "0",
};

const DEFAULT_LAYOUT: ThemeLayout = {
  radius: "0.5rem",
  density: "comfortable",
};

const NPC_CYBER_TYPOGRAPHY: ThemeTypography = {
  ...DEFAULT_TYPOGRAPHY,
  fontSans: `"Inter Tight", "Inter", ${SYSTEM_SANS}`,
  fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
  fontUrl:
    "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
  letterSpacing: "-0.005em",
};

/**
 * The semantic layer that lets the existing dashboard adopt the NPC Cyber
 * palette without page-by-page color literals. It is injected only while the
 * default theme is active, so the other built-in and user themes stay intact.
 */
const NPC_CYBER_CUSTOM_CSS = `
:root {
  color-scheme: dark;
  --text-primary: #f5f7ff;
  --text-secondary: #b8bad4;
  --text-tertiary: #8a8db8;
  --text-disabled: #5c5e80;
}

/* Aurora backdrop — layered ambient glows (lime / violet / cyan) over a
   fine grid. Painted once on the app shell; no backdrop-filter involved. */
#root > [data-layout-variant] {
  background-image:
    radial-gradient(circle at 78% -12%, rgb(197 255 74 / 0.08), transparent 34rem),
    radial-gradient(circle at -8% 28%, rgb(139 92 246 / 0.07), transparent 30rem),
    radial-gradient(circle at 96% 86%, rgb(6 182 212 / 0.05), transparent 26rem),
    linear-gradient(rgb(245 247 255 / 0.016) 1px, transparent 1px),
    linear-gradient(90deg, rgb(245 247 255 / 0.016) 1px, transparent 1px);
  background-size: auto, auto, auto, 40px 40px, 40px 40px;
}

::selection {
  background: #c5ff4a;
  color: #050510;
}

/* Focus glow — every focusable in the dashboard gets the lime ring. */
#root :is(button, a, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid rgb(197 255 74 / 0.65);
  outline-offset: 2px;
  border-radius: inherit;
}

/* Cards glow softly on hover; explicit properties only, never 'all'. */
#root [style*="--component-card-background"] {
  transition: border-color 0.2s, box-shadow 0.3s;
}
#root [style*="--component-card-background"]:hover {
  border-color: rgb(197 255 74 / 0.28);
  box-shadow: 0 8px 24px rgb(197 255 74 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.07);
}

/* Shared dashboard material pass. The management pages are built from the
   same DS primitives, so these selectors modernize every route (including
   plugin pages) without changing component logic or page markup. */
#root [style*="--component-card-background"] {
  overflow: hidden;
  border-color: rgb(197 255 74 / 0.14);
  border-radius: 1.25rem;
}

#root [style*="--component-card-background"] > :first-child {
  background: linear-gradient(90deg, rgb(197 255 74 / 0.045), rgb(139 92 246 / 0.04));
}

#app-sidebar {
  border-color: rgb(197 255 74 / 0.12);
  box-shadow: 18px 0 50px rgb(0 0 0 / 0.24);
}

#app-sidebar nav a {
  margin: 0.125rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s, box-shadow 0.25s, transform 0.15s;
}

#app-sidebar nav a:hover {
  border-color: rgb(197 255 74 / 0.14);
  background: linear-gradient(135deg, rgb(197 255 74 / 0.08), rgb(139 92 246 / 0.06));
  transform: translateX(2px);
}

#app-sidebar nav a[aria-current="page"] {
  border-color: rgb(197 255 74 / 0.24);
  color: #c5ff4a;
  background: linear-gradient(135deg, rgb(197 255 74 / 0.13), rgb(139 92 246 / 0.08));
  box-shadow: inset 3px 0 #c5ff4a, 0 5px 16px rgb(197 255 74 / 0.08);
}

#root > [data-layout-variant] :is(input, textarea, select):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]) {
  border-color: rgb(197 255 74 / 0.15);
  border-radius: 0.75rem;
  background-color: rgb(15 15 30 / 0.82);
  transition: color 0.2s, border-color 0.2s, background-color 0.2s, box-shadow 0.25s;
}

#root > [data-layout-variant] :is(input, textarea, select):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus {
  border-color: rgb(197 255 74 / 0.42);
  box-shadow: 0 0 0 3px rgb(197 255 74 / 0.11), 0 8px 20px rgb(0 0 0 / 0.18);
}

#root > [data-layout-variant] button {
  border-radius: 0.75rem;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s, opacity 0.2s, box-shadow 0.25s, transform 0.15s;
}

#root > [data-layout-variant] button:not(:disabled):active {
  transform: scale(0.96);
}

#root > [data-layout-variant] button[class~="bg-midground"] {
  color: #050510;
  background: linear-gradient(135deg, #e8ff99, #c5ff4a 52%, #a8e62c);
  box-shadow: 0 5px 18px rgb(197 255 74 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

#root > [data-layout-variant] button[class~="bg-midground"]:not(:disabled):hover {
  box-shadow: 0 8px 24px rgb(197 255 74 / 0.34), inset 0 1px 0 rgb(255 255 255 / 0.34);
  transform: translateY(-1px);
}

#root > [data-layout-variant] :is([role="alert"], [data-slot="toast"]) {
  border-radius: 1rem;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.28);
}

#root > [data-layout-variant] table {
  overflow: hidden;
  border-radius: 1rem;
}

[data-slot="dialog-overlay"] {
  background: rgb(2 2 10 / 0.78);
  backdrop-filter: none;
}

[data-slot="dialog-content"] {
  overflow: hidden;
  border-color: rgb(197 255 74 / 0.18);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, rgb(20 15 35 / 0.98), rgb(8 8 22 / 0.99));
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(139 92 246 / 0.08);
}

#root > [data-layout-variant] :is(kbd, [class*="font-compressed"][class*="tracking"]) {
  border-radius: 999px;
}

@media (max-width: 768px) {
  #root [style*="--component-card-background"] {
    border-radius: 1rem;
  }

  #root button,
  #app-sidebar nav a {
    min-height: 44px;
    touch-action: manipulation;
  }

  #app-sidebar nav a:hover {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  #root *,
  #root *::before,
  #root *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export const defaultTheme: DashboardTheme = {
  name: "default",
  label: "NPC Cyber",
  description: "Deep blue-violet operations UI with the NPCAUTOMATORS lime accent",
  palette: {
    background: { hex: "#050510", alpha: 1 },
    midground: { hex: "#F5F7FF", alpha: 1 },
    foreground: { hex: "#C5FF4A", alpha: 1 },
    warmGlow: "rgba(197, 255, 74, 0.14)",
    noiseOpacity: 0.35,
  },
  typography: NPC_CYBER_TYPOGRAPHY,
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.75rem",
  },
  colorOverrides: {
    card: "#0F0F1E",
    cardForeground: "#F5F7FF",
    popover: "#121222",
    popoverForeground: "#F5F7FF",
    primary: "#C5FF4A",
    primaryForeground: "#050510",
    secondary: "#151530",
    secondaryForeground: "#F5F7FF",
    muted: "#151530",
    mutedForeground: "#8A8DB8",
    accent: "#C5FF4A",
    accentForeground: "#050510",
    success: "#84CC16",
    border: "#2A2A4A",
    input: "#2A2A4A",
    ring: "#C5FF4A",
  },
  componentStyles: {
    card: {
      background:
        "linear-gradient(135deg, rgb(20 15 35 / 0.6) 0%, rgb(15 10 30 / 0.72) 100%)",
      boxShadow:
        "0 4px 12px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.05)",
    },
    header: {
      background:
        "linear-gradient(180deg, rgb(10 8 22 / 0.96) 0%, rgb(5 5 16 / 0.98) 100%)",
    },
    sidebar: {
      background:
        "linear-gradient(180deg, rgb(8 6 18 / 0.97) 0%, rgb(5 4 14 / 0.99) 100%)",
    },
  },
  customCSS: NPC_CYBER_CUSTOM_CSS,
  terminalBackground: "#050510",
  terminalForeground: "#F5F7FF",
  seriesColors: {
    inputTokenAccent: "#C5FF4A",
    outputTokenAccent: "#84CC16",
  },
  swatchColors: ["#050510", "#C5FF4A", "#8B5CF6"],
};

export const midnightTheme: DashboardTheme = {
  name: "midnight",
  label: "Midnight",
  description: "Deep blue-violet with cool accents",
  palette: {
    background: { hex: "#0a0a1f", alpha: 1 },
    midground: { hex: "#d4c8ff", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(167, 139, 250, 0.32)",
    noiseOpacity: 0.8,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Inter", ${SYSTEM_SANS}`,
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
    letterSpacing: "-0.005em",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.75rem",
  },
};

export const emberTheme: DashboardTheme = {
  name: "ember",
  label: "Ember",
  description: "Warm crimson and bronze — forge vibes",
  palette: {
    background: { hex: "#1a0a06", alpha: 1 },
    midground: { hex: "#ffd8b0", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 115, 22, 0.38)",
    noiseOpacity: 1,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Spectral", Georgia, "Times New Roman", serif`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.25rem",
  },
  colorOverrides: {
    destructive: "#c92d0f",
    warning: "#f97316",
  },
};

export const monoTheme: DashboardTheme = {
  name: "mono",
  label: "Mono",
  description: "Clean grayscale — minimal and focused",
  palette: {
    background: { hex: "#0e0e0e", alpha: 1 },
    midground: { hex: "#eaeaea", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 255, 255, 0.1)",
    noiseOpacity: 0.6,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"IBM Plex Sans", ${SYSTEM_SANS}`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
};

export const cyberpunkTheme: DashboardTheme = {
  name: "cyberpunk",
  label: "Cyberpunk",
  description: "Neon green on black — matrix terminal",
  palette: {
    background: { hex: "#040608", alpha: 1 },
    midground: { hex: "#9bffcf", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(0, 255, 136, 0.22)",
    noiseOpacity: 1.2,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontMono: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=JetBrains+Mono:wght@400;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
  colorOverrides: {
    success: "#00ff88",
    warning: "#ffd700",
    destructive: "#ff0055",
  },
};

export const roseTheme: DashboardTheme = {
  name: "rose",
  label: "Rosé",
  description: "Soft pink and warm ivory — easy on the eyes",
  palette: {
    background: { hex: "#1a0f15", alpha: 1 },
    midground: { hex: "#ffd4e1", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 168, 212, 0.3)",
    noiseOpacity: 0.9,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Fraunces", Georgia, serif`,
    fontMono: `"DM Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "1rem",
  },
};

/** Light mode — vivid NpcAutomators-blue accents on a cream canvas. */
export const npcAutomatorsBlueTheme: DashboardTheme = {
  name: "npcautomators-blue",
  label: "NpcAutomators Blue",
  description: "Light mode — vivid NpcAutomators-blue accents on cream canvas",
  palette: {
    background: { hex: "#E8F2FD", alpha: 1 },
    midground: { hex: "#0053FD", alpha: 1 },
    foreground: { hex: "#170d02", alpha: 0 },
    warmGlow: "rgba(0, 83, 253, 0.12)",
    noiseOpacity: 0,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  terminalBackground: "#f5f8fc",
  terminalForeground: "#170d02",
  seriesColors: {
    inputTokenAccent: "#001934",
    outputTokenAccent: "#0053fd",
  },
  swatchColors: ["#170d02", "#0053FD", "#E8F2FD"],
};

/**
 * Same look as ``defaultTheme`` but with a larger root font size, looser
 * line-height, and ``spacious`` density so every rem-based size in the
 * dashboard scales up. For users who find the default 15px UI too dense.
 */
export const defaultLargeTheme: DashboardTheme = {
  name: "default-large",
  label: "NPC Cyber (Large)",
  description: "NPC Cyber with bigger fonts and roomier spacing",
  palette: defaultTheme.palette,
  typography: {
    ...NPC_CYBER_TYPOGRAPHY,
    baseSize: "18px",
    lineHeight: "1.65",
  },
  layout: {
    ...defaultTheme.layout,
    density: "spacious",
  },
  colorOverrides: defaultTheme.colorOverrides,
  componentStyles: defaultTheme.componentStyles,
  customCSS: defaultTheme.customCSS,
  terminalBackground: defaultTheme.terminalBackground,
  terminalForeground: defaultTheme.terminalForeground,
  seriesColors: defaultTheme.seriesColors,
  swatchColors: defaultTheme.swatchColors,
};

export const BUILTIN_THEMES: Record<string, DashboardTheme> = {
  default: defaultTheme,
  "default-large": defaultLargeTheme,
  "npcautomators-blue": npcAutomatorsBlueTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  cyberpunk: cyberpunkTheme,
  rose: roseTheme,
};
