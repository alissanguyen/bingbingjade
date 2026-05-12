"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BannerConfig, TimeLeft } from "@/lib/banner-config";
import { resolveStyle, getTimeLeft } from "@/lib/banner-config";

const DISMISS_KEY = "bbj_banner_dismissed_v2";

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(startDate: string | null): TimeLeft | null {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  useEffect(() => {
    setTimeLeft(getTimeLeft(startDate));
    const id = setInterval(() => setTimeLeft(getTimeLeft(startDate)), 1000);
    return () => clearInterval(id);
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

// ── Main Component ────────────────────────────────────────────────────────────

export function AnnouncementBanner() {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { }
    try { if (sessionStorage.getItem(DISMISS_KEY) === "1") { setDismissed(true); return; } } catch { }
    fetch("/api/banner")
      .then((r) => r.json())
      .then((data) => { if (data?.is_active) setConfig(data as BannerConfig); })
      .catch(() => { });
  }, []);

  const messages = Array.isArray(config?.messages) ? config!.messages.filter(Boolean) : [];
  const countdown = useCountdown(config?.start_date ?? null);
  const isCountdown = !!countdown;

  if (!mounted || !config || dismissed || messages.length === 0) return null;
  if (config.end_date && new Date(config.end_date) < new Date()) return null;

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
      className="shrink-0 w-5 h-5 flex items-center justify-center text-base leading-none transition-opacity hover:opacity-50"
      style={{ color: style.textColor }}
    >
      ×
    </button>
  );

  // ── Countdown — static centered layout ───────────────────────────────────
  if (isCountdown) {
    return (
      <div className="relative w-full select-none" style={bannerStyle}>
        <div className="flex items-center justify-center flex-col sm:flex-row gap-2 sm:gap-3 px-10 py-2.5 min-h-10">
          <span className="text-xs sm:text-[13px] font-medium tracking-[0.04em]" style={{ color: style.textColor }}>
            {messages[0]}
          </span>
          <span className="text-[10px] tracking-widest hidden sm:block" style={{ color: `${style.accentColor}90` }}>·</span>
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
          {hasCta && (
            <Link href={config.cta_link!}
              className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider border-b pb-px hover:opacity-70 transition-opacity"
              style={{ color: style.accentColor, borderColor: `${style.accentColor}50` }}>
              {config.cta_text}
            </Link>
          )}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{dismissBtn}</div>
      </div>
    );
  }

  // ── Reduced motion — first message static ────────────────────────────────
  if (reducedMotion) {
    return (
      <div className="relative w-full select-none" style={bannerStyle}>
        <div className="flex items-center justify-center gap-3 sm:gap-5 px-10 py-2.5 min-h-10">
          <span className="text-xs sm:text-[13px] font-medium tracking-[0.04em] text-center" style={{ color: style.textColor }}>
            {messages[0]}
          </span>
          {hasCta && (
            <Link href={config.cta_link!}
              className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider border-b pb-px hover:opacity-70 transition-opacity"
              style={{ color: style.accentColor, borderColor: `${style.accentColor}50` }}>
              {config.cta_text}
            </Link>
          )}
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{dismissBtn}</div>
      </div>
    );
  }

  // ── Ticker — continuous right-to-left flow ────────────────────────────────
  //
  // Strategy: inline-flex track containing messages × 2 (doubled for seamless loop).
  // CSS animation: translateX(0) → translateX(-50%) linear infinite.
  // -50% of the doubled track = exactly one copy's width → perfectly seamless.
  //
  // Duration: estimated at ~7.5px per character, scrolling at 75px/s.
  // Minimum 14s to ensure even very short banners feel deliberate, not frantic.

  const singleText = messages.join("◆") + (config.cta_text ?? "");
  const estimatedPx = singleText.length * 7.5 + messages.length * 96; // chars + separator gaps
  const duration = Math.max(14, estimatedPx / 75);

  // One complete pass of all messages with separators
  const tickerPassContent = (
    <div className="inline-flex items-center shrink-0">
      {messages.map((m, i) => (
        <span key={i} className="inline-flex items-center">
          <span
            className="text-xs sm:text-[13px] font-medium tracking-[0.04em] whitespace-nowrap"
            style={{ color: style.textColor }}
          >
            {m}
          </span>
          {/* Separator gem — also wraps CTA after the last message */}
          {i === messages.length - 1 && hasCta ? (
            <Link
              href={config.cta_link!}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 ml-8 sm:ml-10 mr-8 sm:mr-10 text-[11px] font-semibold uppercase tracking-wider border-b pb-px hover:opacity-70 transition-opacity whitespace-nowrap"
              style={{ color: style.accentColor, borderColor: `${style.accentColor}50` }}
            >
              {config.cta_text}
              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          ) : (
            <span
              className="inline-block mx-8 sm:mx-10 text-[8px] leading-none shrink-0"
              style={{ color: style.accentColor }}
              aria-hidden="true"
            >
              ◆
            </span>
          )}
        </span>
      ))}
    </div>
  );

  return (
    <div className="w-full select-none" style={bannerStyle}>
      <div className="flex items-center">
        {/* Ticker area — clips the scrolling track */}
        <div className="flex-1 overflow-hidden relative min-w-0" style={{ height: "2.5rem" }}>
          {/* Scrolling track: two identical passes for seamless loop */}
          <div
            className="banner-ticker-track inline-flex items-center h-full"
            style={{ animationDuration: `${duration}s` }}
          >
            {tickerPassContent}
            <div aria-hidden className="inline-flex items-center shrink-0">{tickerPassContent}</div>
          </div>
          {/* Right-edge fade so text doesn't hard-cut at the dismiss button */}
          <div
            className="absolute inset-y-0 right-0 w-10 pointer-events-none"
            style={{ background: `linear-gradient(to right, transparent, ${style.backgroundColor})` }}
          />
        </div>

        {/* Dismiss — outside the overflow container so it's always visible */}
        <div className="shrink-0 px-3 flex items-center h-10" style={{ backgroundColor: style.backgroundColor }}>
          {dismissBtn}
        </div>
      </div>
    </div>
  );
}
