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
  --text-primary: #fafafa;
  --text-secondary: #b8b8b8;
  --text-tertiary: #8a8a8a;
  --text-disabled: #5f5f5f;
}

#root > [data-layout-variant] {
  background-image:
    radial-gradient(circle at 72% -12%, rgb(197 255 74 / 0.07), transparent 32rem),
    linear-gradient(rgb(250 250 250 / 0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgb(250 250 250 / 0.018) 1px, transparent 1px);
  background-size: auto, 40px 40px, 40px 40px;
}

::selection {
  background: #c5ff4a;
  color: #0a0a0a;
}
`;

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export const defaultTheme: DashboardTheme = {
  name: "default",
  label: "NPC Cyber",
  description: "Near-black operations UI with the NPCAUTOMATORS lime accent",
  palette: {
    background: { hex: "#0A0A0A", alpha: 1 },
    midground: { hex: "#FAFAFA", alpha: 1 },
    foreground: { hex: "#C5FF4A", alpha: 1 },
    warmGlow: "rgba(197, 255, 74, 0.14)",
    noiseOpacity: 0.35,
  },
  typography: NPC_CYBER_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  colorOverrides: {
    card: "#141414",
    cardForeground: "#FAFAFA",
    popover: "#141414",
    popoverForeground: "#FAFAFA",
    primary: "#C5FF4A",
    primaryForeground: "#0A0A0A",
    secondary: "#1A1A1A",
    secondaryForeground: "#FAFAFA",
    muted: "#1A1A1A",
    mutedForeground: "#8A8A8A",
    accent: "#C5FF4A",
    accentForeground: "#0A0A0A",
    success: "#84CC16",
    border: "#262626",
    input: "#262626",
    ring: "#C5FF4A",
  },
  customCSS: NPC_CYBER_CUSTOM_CSS,
  terminalBackground: "#0A0A0A",
  terminalForeground: "#FAFAFA",
  seriesColors: {
    inputTokenAccent: "#C5FF4A",
    outputTokenAccent: "#84CC16",
  },
  swatchColors: ["#0A0A0A", "#C5FF4A", "#141414"],
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
    ...DEFAULT_LAYOUT,
    density: "spacious",
  },
  colorOverrides: defaultTheme.colorOverrides,
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
