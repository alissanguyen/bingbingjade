"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BannerConfig, BannerStyle, TimeLeft } from "@/lib/banner-config";
import { resolveStyle, getTimeLeft } from "@/lib/banner-config";

const DISMISS_KEY = "bbj_banner_dismissed_v2";
const ROTATION_MS = 3000;
const SLIDE_MS = 420;

// ── Validation helpers ────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDateString(value: string | null | undefined): value is string {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function isFutureDateString(value: string | null | undefined): value is string {
  return isValidDateString(value) && new Date(value).getTime() > Date.now();
}

function normalizeBannerStyle(raw: unknown): BannerStyle | null {
  if (!isPlainObject(raw)) return null;
  const style: BannerStyle = {
    theme: raw.theme === "light" || raw.theme === "auto" || raw.theme === "dark" ? raw.theme : "dark",
  };
  if (typeof raw.backgroundColor === "string") style.backgroundColor = raw.backgroundColor;
  if (typeof raw.textColor === "string") style.textColor = raw.textColor;
  if (typeof raw.accentColor === "string") style.accentColor = raw.accentColor;
  if (typeof raw.borderColor === "string") style.borderColor = raw.borderColor;
  return style;
}

function normalizeBannerConfig(raw: unknown): BannerConfig | null {
  if (!isPlainObject(raw) || raw.is_active !== true) return null;

  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .filter((m): m is string => typeof m === "string")
        .map((m) => m.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (messages.length === 0) return null;

  if (
    typeof raw.end_date === "string" &&
    isValidDateString(raw.end_date) &&
    new Date(raw.end_date).getTime() < Date.now()
  ) {
    return null;
  }

  const countdownLabel =
    raw.countdown_label === "Starting in" || raw.countdown_label === "Ends in"
      ? raw.countdown_label
      : null;

  return {
    is_active: true,
    preset: typeof raw.preset === "string" ? raw.preset : null,
    messages,
    start_date:
      typeof raw.start_date === "string" && isValidDateString(raw.start_date)
        ? raw.start_date
        : null,
    end_date:
      typeof raw.end_date === "string" && isValidDateString(raw.end_date)
        ? raw.end_date
        : null,
    countdown_label: countdownLabel,
    cta_text:
      typeof raw.cta_text === "string" && raw.cta_text.trim()
        ? raw.cta_text.trim()
        : null,
    cta_link:
      typeof raw.cta_link === "string" && raw.cta_link.trim()
        ? raw.cta_link.trim()
        : null,
    style: normalizeBannerStyle(raw.style),
  };
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(startDate: string | null): TimeLeft | null {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  useEffect(() => {
    if (!isFutureDateString(startDate)) {
      const id = window.setTimeout(() => setTimeLeft(null), 0);
      return () => clearTimeout(id);
    }
    const tick = () => setTimeLeft(getTimeLeft(startDate));
    const initialId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      clearTimeout(initialId);
      clearInterval(intervalId);
    };
  }, [startDate]);
  return timeLeft;
}

// ── Countdown flip digits ─────────────────────────────────────────────────────

function SlideDigit({ digit, accentColor }: { digit: string; accentColor: string }) {
  const [cur, setCur] = useState(digit);
  const [next, setNext] = useState(digit);
  const [animating, setAnim] = useState(false);
  useEffect(() => {
    if (digit === cur) return;
    setNext(digit);
    setAnim(true);
    const t = setTimeout(() => { setCur(digit); setAnim(false); }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);
  return (
    <div className="fc-card" style={{ background: "rgba(0,0,0,0.22)" }}>
      <span className={`fc-digit ${animating ? "fc-digit-out" : ""}`} style={{ color: accentColor }}>{cur}</span>
      {animating && <span className="fc-digit fc-digit-in" style={{ color: accentColor }}>{next}</span>}
    </div>
  );
}

function SlideUnit({ value, accentColor }: { value: number; accentColor: string }) {
  const s = String(value).padStart(2, "0");
  return (
    <div className="flex gap-[2px]">
      <SlideDigit digit={s[0]} accentColor={accentColor} />
      <SlideDigit digit={s[1]} accentColor={accentColor} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnnouncementBanner() {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [idx, setIdx] = useState(0);
  const [outgoing, setOutgoing] = useState<{ idx: number; key: number; rev: boolean } | null>(null);
  const [slideKey, setSlideKey] = useState(0); // increments every rotation to force element recreation
  const [slideRev, setSlideRev] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    let alive = true;
    const initId = window.setTimeout(() => {
      if (!alive) return;
      setMounted(true);
      try { setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { }
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === "1") {
          setDismissed(true);
          return;
        }
      } catch { }
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), 1500);
      fetch("/api/banner", { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (alive) setConfig(normalizeBannerConfig(data)); })
        .catch((err) => { if (err?.name !== "AbortError") console.error("[AnnouncementBanner] fetch failed:", err); })
        .finally(() => { clearTimeout(timeoutId); });
    }, 0);
    return () => { alive = false; clearTimeout(initId); };
  }, []);

  const messages = config?.messages ?? [];

  // Rotate messages — only when there are multiple and motion is allowed
  useEffect(() => {
    if (messages.length <= 1 || reducedMotion) return;
    let clearId: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      const tick = Date.now();
      setIdx((cur) => {
        const wrapping = cur === messages.length - 1;
        setOutgoing({ idx: cur, key: tick, rev: wrapping });
        setSlideRev(wrapping);
        return (cur + 1) % messages.length;
      });
      setSlideKey((k) => k + 1);
      clearId = setTimeout(() => setOutgoing(null), SLIDE_MS + 50);
    }, ROTATION_MS);
    return () => {
      clearInterval(interval);
      if (clearId) clearTimeout(clearId);
    };
  }, [messages.length, reducedMotion]);

  const countdown = useCountdown(config?.start_date ?? null);
  const isCountdown = !!countdown;

  if (!mounted || !config || dismissed || messages.length === 0) return null;

  const style = resolveStyle(config.style);
  const hasCta = !!(config.cta_text && config.cta_link);

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { }
    setDismissed(true);
  };

  const bannerStyle: React.CSSProperties = {
    backgroundColor: style.backgroundColor,
    borderBottom: `1px solid ${style.borderColor}`,
  };

  const dismissBtn = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Dismiss banner"
      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-base leading-none transition-opacity hover:opacity-50"
      style={{ color: style.textColor }}
    >
      ×
    </button>
  );

  // Small luxury pill CTA — shown beside the message when set
  const ctaPill = hasCta ? (
    <Link
      href={config.cta_link!}
      className="shrink-0 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold tracking-wider px-2.5 sm:px-3 py-0.5 rounded-full border transition-opacity hover:opacity-70 whitespace-nowrap"
      style={{ color: style.accentColor, borderColor: `${style.accentColor}55` }}
    >
      {config.cta_text}
      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  ) : null;

  // ── Countdown — static layout, no rotation ────────────────────────────────
  if (isCountdown) {
    return (
      <div className="relative w-full select-none" style={bannerStyle}>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-10 py-2.5 min-h-10">
          <span className="text-[10px] sm:text-[13px] font-medium tracking-[0.04em]" style={{ color: style.textColor }}>
            {messages[0]}
          </span>
          <span className="text-[8px] tracking-widest hidden sm:block" style={{ color: `${style.accentColor}90` }} aria-hidden>·</span>
          <div className="flex flex-row gap-2 sm:gap-3 items-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: style.accentColor }}>
              {config.countdown_label ?? "Starting in"}
            </span>
            <div className="flex items-center gap-1.5">
              {countdown.d > 0 && (
                <><SlideUnit value={countdown.d} accentColor={style.accentColor} /><span className="text-[10px] font-medium" style={{ color: `${style.textColor}60` }}>d</span></>
              )}
              {(countdown.d > 0 || countdown.h > 0) && (
                <><SlideUnit value={countdown.h} accentColor={style.accentColor} /><span className="text-[10px] font-medium" style={{ color: `${style.textColor}60` }}>h</span></>
              )}
              <SlideUnit value={countdown.m} accentColor={style.accentColor} />
              <span className="text-[10px] font-medium" style={{ color: `${style.textColor}60` }}>m</span>
              {countdown.d === 0 && (
                <><SlideUnit value={countdown.s} accentColor={style.accentColor} /><span className="text-[10px] font-medium" style={{ color: `${style.textColor}60` }}>s</span></>
              )}
            </div>
          </div>
          {ctaPill}
        </div>
        {dismissBtn}
      </div>
    );
  }

  // ── Rotating single-message layout ───────────────────────────────────────
  return (
    <div className="relative w-full select-none" style={bannerStyle}>
      <div className="relative flex items-center justify-center min-h-10 py-1 sm:py-2 overflow-hidden">
        {reducedMotion ? (
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 sm:gap-x-3.5 px-10">
            <span
              className="text-[10px] sm:text-[14px] font-medium tracking-[0.04em] text-center"
              style={{ color: style.textColor }}
            >
              {messages[0]}
            </span>
            {ctaPill}
          </div>
        ) : (
          <>
            {outgoing && (
              <div key={outgoing.key} className={`absolute inset-0 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 sm:gap-x-3.5 px-10 ${outgoing.rev ? "banner-slide-out-rev" : "banner-slide-out"}`}>
                <span className="text-[10px] sm:text-[14px] font-medium tracking-[0.04em] text-center" style={{ color: style.textColor }}>
                  {messages[outgoing.idx]}
                </span>
                {ctaPill}
              </div>
            )}
            <div key={slideKey} className={`absolute inset-0 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 sm:gap-x-3.5 px-10${slideKey > 0 ? (slideRev ? " banner-slide-in-rev" : " banner-slide-in") : ""}`}>
              <span className="text-[10px] sm:text-[14px] font-medium tracking-[0.04em] text-center" style={{ color: style.textColor }}>
                {messages[idx]}
              </span>
              {ctaPill}
            </div>
          </>
        )}
      </div>
      {dismissBtn}
    </div>
  );
}
