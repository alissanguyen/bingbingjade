// ── Types ─────────────────────────────────────────────────────────────────────

export interface BannerStyle {
  theme: "light" | "dark" | "auto";
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  borderColor?: string;
}

export interface BannerPreset {
  id: string;
  name: string;
  emoji: string;
  defaultMessages: string[];
  defaultCtaText?: string;
  defaultCtaLink?: string;
  defaultStyle: BannerStyle;
}

export interface BannerConfig {
  is_active: boolean;
  preset: string | null;
  messages: string[];
  start_date: string | null;
  end_date: string | null;
  countdown_label: "Starting in" | "Ends in" | null;
  cta_text: string | null;
  cta_link: string | null;
  style: BannerStyle | null;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_DARK_STYLE: Required<BannerStyle> = {
  theme: "dark",
  backgroundColor: "#052e2b",
  textColor: "#f0fdf9",
  accentColor: "#d4af37",
  borderColor: "#0f766e",
};

export const DEFAULT_LIGHT_STYLE: Required<BannerStyle> = {
  theme: "light",
  backgroundColor: "#fdf8f0",
  textColor: "#134e35",
  accentColor: "#b8860b",
  borderColor: "#c9a84c",
};

export function resolveStyle(style: BannerStyle | null | undefined): Required<BannerStyle> {
  const base = style?.theme === "light" ? DEFAULT_LIGHT_STYLE : DEFAULT_DARK_STYLE;
  return {
    theme:           style?.theme           ?? "dark",
    backgroundColor: style?.backgroundColor ?? base.backgroundColor,
    textColor:       style?.textColor       ?? base.textColor,
    accentColor:     style?.accentColor     ?? base.accentColor,
    borderColor:     style?.borderColor     ?? base.borderColor,
  };
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const BANNER_PRESETS: BannerPreset[] = [
  {
    id: "new_drops",
    name: "New Drops",
    emoji: "✨",
    defaultMessages: [
      "New natural jadeite arrivals — one of a kind.",
      "Freshly curated pieces, now live.",
      "Shop the latest drops before they're gone.",
    ],
    defaultCtaText: "Shop New Arrivals",
    defaultCtaLink: "/products",
    defaultStyle: {
      theme: "dark",
      backgroundColor: "#052e2b",
      textColor: "#f0fdf9",
      accentColor: "#d4af37",
      borderColor: "#0f766e",
    },
  },
  {
    id: "mothers_day",
    name: "Mother's Day",
    emoji: "💐",
    defaultMessages: [
      "Celebrate Mom with natural jadeite — timeless, one of a kind.",
      "Give her something she'll treasure for a lifetime.",
      "Mother's Day gifts, now available.",
    ],
    defaultCtaText: "Shop Mother's Day Gifts",
    defaultCtaLink: "/products",
    defaultStyle: {
      theme: "dark",
      backgroundColor: "#3d1f35",
      textColor: "#fdf4f9",
      accentColor: "#d4af37",
      borderColor: "#6d3d5e",
    },
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    emoji: "💝",
    defaultMessages: [
      "Express love with a piece that lasts forever.",
      "Natural jadeite — the most meaningful Valentine's gift.",
      "Valentine's Day collection, now available.",
    ],
    defaultCtaText: "Shop Valentine's Day",
    defaultCtaLink: "/products",
    defaultStyle: {
      theme: "dark",
      backgroundColor: "#4a0d2a",
      textColor: "#fff0f5",
      accentColor: "#d4af37",
      borderColor: "#8b1a4a",
    },
  },
  {
    id: "black_friday",
    name: "Black Friday",
    emoji: "🛍",
    defaultMessages: [
      "Black Friday — rare jadeite at exceptional value.",
      "Limited selection. Shop before it's gone.",
      "Our biggest sale of the year, now live.",
    ],
    defaultCtaText: "Shop the Sale",
    defaultCtaLink: "/products",
    defaultStyle: {
      theme: "dark",
      backgroundColor: "#0a0a0a",
      textColor: "#f5f5f5",
      accentColor: "#d4af37",
      borderColor: "#2a2a2a",
    },
  },
  {
    id: "custom",
    name: "Custom",
    emoji: "✏️",
    defaultMessages: [
      "US-based natural jadeite, no surprise import fees.",
      "Every piece comes with certification and lifetime authenticity guarantee.",
    ],
    defaultStyle: DEFAULT_DARK_STYLE,
  },
];

export function getPreset(id: string | null | undefined): BannerPreset {
  return BANNER_PRESETS.find((p) => p.id === id) ?? BANNER_PRESETS[BANNER_PRESETS.length - 1];
}

// ── Countdown helper ──────────────────────────────────────────────────────────

export interface TimeLeft {
  d: number; h: number; m: number; s: number;
  totalSeconds: number;
}

export function getTimeLeft(isoDate: string | null): TimeLeft | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1_000),
    totalSeconds: Math.floor(diff / 1000),
  };
}
