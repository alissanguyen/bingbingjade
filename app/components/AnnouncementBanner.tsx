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

// ── Slide countdown cards ─────────────────────────────────────────────────────

function SlideDigit({ digit, cardBg, digitClr }: { digit: string; cardBg: string; digitClr: string }) {
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
    }, 280);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

  return (
    <div className="fc-card" style={{ background: cardBg }}>
      <span className={`fc-digit ${animating ? "fc-digit-out" : ""}`} style={{ color: digitClr }}>
        {current}
      </span>
      {animating && (
        <span className="fc-digit fc-digit-in" style={{ color: digitClr }}>
          {next}
        </span>
      )}
    </div>
  );
}

function SlideUnit({ value, cardBg, digitClr }: { value: number; cardBg: string; digitClr: string }) {
  const s = String(value).padStart(2, "0");
  return (
    <div className="flex gap-[2px]">
      <SlideDigit digit={s[0]} cardBg={cardBg} digitClr={digitClr} />
      <SlideDigit digit={s[1]} cardBg={cardBg} digitClr={digitClr} />
    </div>
  );
}

function SlideSep({ color }: { color: string }) {
  return (
    <span className="font-bold text-xs self-center" style={{ color }}>:</span>
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

  // Emerald dark: bg-emerald-800, white text, dark card bg, white digits
  // Light: bg-white, gray-900 text, light card bg, emerald-600 digits
  const bannerCls = isBlack
    ? "bg-emerald-800 text-white"
    : "bg-white text-gray-900 border-b border-gray-200 dark:border-gray-800";
  const cardBg    = isBlack ? "rgba(0,0,0,0.25)"          : "rgba(0,0,0,0.07)";
  const digitClr  = isBlack ? "#ffffff"                    : "#059669";
  const sepClr    = isBlack ? "rgba(255,255,255,0.35)"     : "rgba(0,0,0,0.25)";
  const dismissCls = isBlack
    ? "text-emerald-300 hover:text-white"
    : "text-gray-400 hover:text-gray-700";

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 px-10 py-2 select-none ${bannerCls}`}>
      {/* Message */}
      <span className="text-xs sm:text-sm font-medium tracking-wide text-center leading-snug">
        {text}
        {hasDate && !timeLeft && formattedDate ? ` on ${formattedDate}` : ""}
        {hasDate && timeLeft ? " in" : ""}
      </span>

      {/* Slide countdown */}
      {timeLeft && (
        <div className="flex items-center gap-1">
          {timeLeft.d > 0 && (
            <>
              <SlideUnit value={timeLeft.d} cardBg={cardBg} digitClr={digitClr} />
              <SlideSep color={sepClr} />
            </>
          )}
          <SlideUnit value={timeLeft.h} cardBg={cardBg} digitClr={digitClr} />
          <SlideSep color={sepClr} />
          <SlideUnit value={timeLeft.m} cardBg={cardBg} digitClr={digitClr} />
          <SlideSep color={sepClr} />
          <SlideUnit value={timeLeft.s} cardBg={cardBg} digitClr={digitClr} />
        </div>
      )}

      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-base leading-none transition-colors ${dismissCls}`}
      >
        ×
      </button>
    </div>
  );
}
