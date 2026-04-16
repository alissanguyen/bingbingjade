"use client";

import { useEffect, useState } from "react";

interface BannerConfig {
  is_active: boolean;
  template: string;
  target_date: string | null;
  background: "black" | "white";
}

const DISMISS_KEY = "bbj_banner_dismissed_v1";

export const BANNER_TEMPLATES: {
  value: string;
  label: string;
  text: string;
  hasDate: boolean;
}[] = [
  { value: "restock",        label: "Next Restock",              text: "Next Restock Drops",                   hasDate: true  },
  { value: "releasing_soon", label: "New Pieces Releasing Soon", text: "New Pieces Releasing Soon",            hasDate: true  },
  { value: "next_favorite",  label: "Your Next Favorite Piece",  text: "Your Next Favorite Piece Drops",       hasDate: true  },
  { value: "black_friday",   label: "Black Friday Sale",         text: "🛍 Black Friday Sale Starting",        hasDate: true  },
  { value: "christmas",      label: "Christmas Sale",            text: "🎄 Christmas Deals Starting",          hasDate: true  },
  { value: "new_year",       label: "New Year Sale",             text: "🎊 New Year Sale Starting",            hasDate: true  },
  { value: "valentines",     label: "Valentine's Day",           text: "💝 Valentine's Day Special Starting",  hasDate: true  },
  { value: "mothers_day",    label: "Mother's Day",              text: "💐 Mother's Day Sale Starting",        hasDate: true  },
  { value: "lunar_new_year", label: "Lunar New Year",            text: "🧧 Lunar New Year Sale Starting",      hasDate: true  },
];

function useCountdown(targetDate: string | null) {
  const getRemaining = () => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
      d: Math.floor(diff / 86_400_000),
      h: Math.floor((diff % 86_400_000) / 3_600_000),
      m: Math.floor((diff % 3_600_000) / 60_000),
      s: Math.floor((diff % 60_000) / 1_000),
    };
  };

  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getRemaining>>(null);

  useEffect(() => {
    setTimeLeft(getRemaining());
    const id = setInterval(() => setTimeLeft(getRemaining()), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  return timeLeft;
}

// ── Flip card components ──────────────────────────────────────────────────────

function FlipDigit({ digit, dark }: { digit: string; dark: boolean }) {
  const [current, setCurrent] = useState(digit);
  const [next, setNext]       = useState(digit);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (digit === current) return;
    setNext(digit);
    setAnimating(true);
    const t = setTimeout(() => {
      setCurrent(digit);
      setAnimating(false);
    }, 550);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

  const topBg = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  const botBg = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const color = dark ? "#34d399" : "#059669";

  return (
    <div className={`fc-card${animating ? " animating" : ""}`}>
      {/* bottom — shows next digit, bottom half visible */}
      <span className="fc-bottom" style={{ background: botBg }}>
        <span style={{ color }}>{next}</span>
      </span>
      {/* bottom-back — top half of next digit, behind fc-top while it folds */}
      <span className="fc-bottom-back" style={{ background: topBg }}>
        <span style={{ color }}>{next}</span>
      </span>
      {/* top — top half of current digit, folds away */}
      <span className="fc-top" style={{ background: topBg }}>
        <span style={{ color }}>{current}</span>
      </span>
      {/* top-back — bottom half area, rotates in showing next digit */}
      <span className="fc-top-back" style={{ background: botBg }}>
        <span style={{ color }}>{next}</span>
      </span>
    </div>
  );
}

function FlipUnit({ value, label, dark }: { value: number; label: string; dark: boolean }) {
  const s = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-[3px]">
      <div className="flex gap-[3px]">
        <FlipDigit digit={s[0]} dark={dark} />
        <FlipDigit digit={s[1]} dark={dark} />
      </div>
      <span
        className="text-[8px] uppercase tracking-widest font-medium"
        style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}
      >
        {label}
      </span>
    </div>
  );
}

function FlipSep({ dark }: { dark: boolean }) {
  return (
    <span
      className="font-bold text-sm self-center mb-[12px]"
      style={{ color: dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)" }}
    >
      :
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AnnouncementBanner() {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timeLeft = useCountdown(config?.target_date ?? null);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {}
    fetch("/api/banner")
      .then((r) => r.json())
      .then((data) => { if (data?.is_active) setConfig(data); })
      .catch(() => {});
  }, []);

  if (!mounted || !config || dismissed) return null;

  // Hide once date has passed
  if (config.target_date && new Date(config.target_date) < new Date() && !timeLeft) return null;

  const tpl = BANNER_TEMPLATES.find((t) => t.value === config.template);
  const text = tpl?.text ?? config.template;
  const hasDate = tpl?.hasDate ?? false;

  const formattedDate = config.target_date
    ? new Date(config.target_date).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short",
      })
    : null;

  const isBlack = config.background !== "white";

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={`relative flex items-center justify-center gap-3 px-10 py-2 select-none ${
        isBlack
          ? "bg-gray-950 text-white"
          : "bg-white text-gray-900 border-b border-gray-200 dark:border-gray-800"
      }`}
    >
      {/* Message */}
      <span className="text-xs sm:text-sm font-medium tracking-wide text-center leading-snug">
        {text}
        {hasDate && !timeLeft && formattedDate ? ` on ${formattedDate}` : ""}
        {hasDate && timeLeft ? " in" : ""}
      </span>

      {/* Flip countdown */}
      {timeLeft && (
        <div className="flex items-end gap-1.5">
          {timeLeft.d > 0 && (
            <>
              <FlipUnit value={timeLeft.d} label="days" dark={isBlack} />
              <FlipSep dark={isBlack} />
            </>
          )}
          <FlipUnit value={timeLeft.h} label="hrs"  dark={isBlack} />
          <FlipSep dark={isBlack} />
          <FlipUnit value={timeLeft.m} label="min"  dark={isBlack} />
          <FlipSep dark={isBlack} />
          <FlipUnit value={timeLeft.s} label="sec"  dark={isBlack} />
        </div>
      )}

      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-base leading-none transition-colors ${
          isBlack ? "text-gray-600 hover:text-white" : "text-gray-400 hover:text-gray-700"
        }`}
      >
        ×
      </button>
    </div>
  );
}
