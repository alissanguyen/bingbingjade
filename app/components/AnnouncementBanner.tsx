"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BannerConfig, BannerStyle, TimeLeft } from "@/lib/banner-config";
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

// ── Message rotator hook ──────────────────────────────────────────────────────

function useMessageRotator(messages: string[], intervalMs = 4500) {
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (messages.length <= 1) { setCurrent(0); setExiting(null); return; }
    timer.current = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % messages.length;
        setExiting(prev);
        setTimeout(() => setExiting(null), 420);
        return next;
      });
    }, intervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [messages.length, intervalMs]);

  return { current, exiting };
}

// ── Countdown display ─────────────────────────────────────────────────────────

function SlideDigit({ digit, accentColor }: { digit: string; accentColor: string }) {
  const [cur, setCur]         = useState(digit);
  const [next, setNext]       = useState(digit);
  const [animating, setAnim]  = useState(false);
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

  useEffect(() => {
    setMounted(true);
    try { if (sessionStorage.getItem(DISMISS_KEY) === "1") { setDismissed(true); return; } } catch {}
    fetch("/api/banner")
      .then((r) => r.json())
      .then((data) => { if (data?.is_active) setConfig(data as BannerConfig); })
      .catch(() => {});
  }, []);

  const messages = Array.isArray(config?.messages) ? config!.messages.filter(Boolean) : [];
  const { current, exiting } = useMessageRotator(messages);

  const countdown = useCountdown(config?.start_date ?? null);
  const isCountdown = !!countdown; // start_date is in the future

  if (!mounted || !config || dismissed || messages.length === 0) return null;

  // Auto-hide if end_date has passed
  if (config.end_date && new Date(config.end_date) < new Date()) return null;

  const style = resolveStyle(config.style);

  const cssVars = {
    "--banner-bg":     style.backgroundColor,
    "--banner-text":   style.textColor,
    "--banner-accent": style.accentColor,
    "--banner-border": style.borderColor,
  } as React.CSSProperties;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="relative w-full select-none"
      style={{
        ...cssVars,
        backgroundColor: style.backgroundColor,
        borderBottom: `1px solid ${style.borderColor}`,
      }}
    >
      <div className="flex items-center justify-center gap-2 sm:gap-4 px-10 py-2.5 min-h-[2.5rem]">

        {/* Rotating messages */}
        <div className="relative overflow-hidden flex items-center justify-center" style={{ minHeight: "1.375rem" }}>
          {/* Invisible spacer — maintains container width/height without layout shift */}
          <span className="invisible pointer-events-none text-xs sm:text-[13px] font-medium tracking-[0.04em] whitespace-nowrap px-px">
            {messages[current]}
          </span>

          {/* Exiting message */}
          {exiting !== null && (
            <span
              key={`out-${exiting}`}
              className="banner-msg-out absolute inset-0 flex items-center justify-center text-xs sm:text-[13px] font-medium tracking-[0.04em] whitespace-nowrap"
              style={{ color: style.textColor }}
            >
              {messages[exiting]}
              {isCountdown && " —"}
            </span>
          )}

          {/* Current message */}
          <span
            key={`in-${current}`}
            className={`${messages.length > 1 ? "banner-msg-in" : ""} absolute inset-0 flex items-center justify-center text-xs sm:text-[13px] font-medium tracking-[0.04em] whitespace-nowrap`}
            style={{ color: style.textColor }}
          >
            {messages[current]}
            {isCountdown && " —"}
          </span>
        </div>

        {/* Countdown */}
        {isCountdown && countdown && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: style.accentColor }}>
              Starting in
            </span>
            {countdown.d > 0 && (
              <>
                <SlideUnit value={countdown.d} accentColor={style.accentColor} />
                <span className="text-xs font-bold" style={{ color: `${style.textColor}80` }}>d</span>
              </>
            )}
            {(countdown.d > 0 || countdown.h > 0) && (
              <>
                <SlideUnit value={countdown.h} accentColor={style.accentColor} />
                <span className="text-xs font-bold" style={{ color: `${style.textColor}80` }}>h</span>
              </>
            )}
            <SlideUnit value={countdown.m} accentColor={style.accentColor} />
            <span className="text-xs font-bold" style={{ color: `${style.textColor}80` }}>m</span>
            {countdown.d === 0 && (
              <>
                <SlideUnit value={countdown.s} accentColor={style.accentColor} />
                <span className="text-xs font-bold" style={{ color: `${style.textColor}80` }}>s</span>
              </>
            )}
          </div>
        )}

        {/* CTA */}
        {!isCountdown && config.cta_text && config.cta_link && (
          <Link
            href={config.cta_link}
            className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase border-b pb-px transition-opacity hover:opacity-70"
            style={{ color: style.accentColor, borderColor: `${style.accentColor}60` }}
          >
            {config.cta_text}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-base leading-none transition-opacity hover:opacity-60"
        style={{ color: style.textColor }}
      >
        ×
      </button>
    </div>
  );
}
