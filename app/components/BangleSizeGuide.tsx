"use client";

import { useState, useEffect, useCallback } from "react";

// ── Size chart ────────────────────────────────────────────────────────────────
// Each row: [palm_mm_min, palm_mm_max, circ_cm_min, circ_cm_max, size_min, size_max]
const SIZE_ROWS = [
  { palmMin: 60, palmMax: 64, circMin: 16, circMax: 17, sizeMin: 50, sizeMax: 52 },
  { palmMin: 64, palmMax: 68, circMin: 17, circMax: 18, sizeMin: 52, sizeMax: 54 },
  { palmMin: 68, palmMax: 72, circMin: 18, circMax: 19, sizeMin: 54, sizeMax: 56 },
  { palmMin: 72, palmMax: 76, circMin: 19, circMax: 20, sizeMin: 56, sizeMax: 58 },
  { palmMin: 76, palmMax: 80, circMin: 20, circMax: 21, sizeMin: 58, sizeMax: 60 },
];

type Unit = "metric" | "imperial";

interface SizeResult {
  sizeMin: number;
  sizeMax: number;
  status: "match" | "upsized" | "below" | "above" | "partial";
  source: "palm" | "circ" | "both";
}

function mmToInch(mm: number) { return mm / 25.4; }
function cmToInch(cm: number) { return cm / 2.54; }
function inchToMm(inch: number) { return inch * 25.4; }
function inchToCm(inch: number) { return inch * 2.54; }

function lookupPalm(mm: number): { row: typeof SIZE_ROWS[0] | null; status: "ok" | "below" | "above" } {
  if (mm < SIZE_ROWS[0].palmMin) return { row: null, status: "below" };
  if (mm > SIZE_ROWS[SIZE_ROWS.length - 1].palmMax) return { row: null, status: "above" };
  const row = SIZE_ROWS.find((r) => mm >= r.palmMin && mm <= r.palmMax);
  return { row: row ?? SIZE_ROWS[SIZE_ROWS.length - 1], status: "ok" };
}

function lookupCirc(cm: number): { row: typeof SIZE_ROWS[0] | null; status: "ok" | "below" | "above" } {
  if (cm < SIZE_ROWS[0].circMin) return { row: null, status: "below" };
  if (cm > SIZE_ROWS[SIZE_ROWS.length - 1].circMax) return { row: null, status: "above" };
  const row = SIZE_ROWS.find((r) => cm >= r.circMin && cm <= r.circMax);
  return { row: row ?? SIZE_ROWS[SIZE_ROWS.length - 1], status: "ok" };
}

function compute(palmRaw: string, circRaw: string, unit: Unit): SizeResult | null {
  const palmVal = parseFloat(palmRaw);
  const circVal = parseFloat(circRaw);
  const hasPalm = !isNaN(palmVal) && palmVal > 0;
  const hasCirc = !isNaN(circVal) && circVal > 0;
  if (!hasPalm && !hasCirc) return null;

  // Convert to metric
  const palmMm = hasPalm ? (unit === "imperial" ? inchToMm(palmVal) : palmVal) : null;
  const circCm = hasCirc ? (unit === "imperial" ? inchToCm(circVal) : circVal) : null;

  const palmResult = palmMm !== null ? lookupPalm(palmMm) : null;
  const circResult = circCm !== null ? lookupCirc(circCm) : null;

  // Only palm filled
  if (hasPalm && !hasCirc) {
    if (palmResult!.status === "below") return { sizeMin: 0, sizeMax: 0, status: "below", source: "palm" };
    if (palmResult!.status === "above") return { sizeMin: 0, sizeMax: 0, status: "above", source: "palm" };
    const r = palmResult!.row!;
    return { sizeMin: r.sizeMin, sizeMax: r.sizeMax, status: "partial", source: "palm" };
  }

  // Only circ filled
  if (!hasPalm && hasCirc) {
    if (circResult!.status === "below") return { sizeMin: 0, sizeMax: 0, status: "below", source: "circ" };
    if (circResult!.status === "above") return { sizeMin: 0, sizeMax: 0, status: "above", source: "circ" };
    const r = circResult!.row!;
    return { sizeMin: r.sizeMin, sizeMax: r.sizeMax, status: "partial", source: "circ" };
  }

  // Both filled
  if (palmResult!.status === "below" || circResult!.status === "below") {
    return { sizeMin: 0, sizeMax: 0, status: "below", source: "both" };
  }
  if (palmResult!.status === "above" || circResult!.status === "above") {
    return { sizeMin: 0, sizeMax: 0, status: "above", source: "both" };
  }

  const pr = palmResult!.row!;
  const cr = circResult!.row!;
  if (pr.sizeMin === cr.sizeMin) {
    return { sizeMin: pr.sizeMin, sizeMax: pr.sizeMax, status: "match", source: "both" };
  }
  // Recommend larger
  const bigger = pr.sizeMin > cr.sizeMin ? pr : cr;
  return { sizeMin: bigger.sizeMin, sizeMax: bigger.sizeMax, status: "upsized", source: "both" };
}

// ── Table ─────────────────────────────────────────────────────────────────────
function SizeTable({ unit }: { unit: Unit }) {
  const fmt = (palmMin: number, palmMax: number, circMin: number, circMax: number) => {
    if (unit === "imperial") {
      return {
        palm: `${mmToInch(palmMin).toFixed(2)}–${mmToInch(palmMax).toFixed(2)} in`,
        circ: `${cmToInch(circMin).toFixed(2)}–${cmToInch(circMax).toFixed(2)} in`,
      };
    }
    return {
      palm: `${palmMin}–${palmMax} mm`,
      circ: `${circMin}–${circMax} cm`,
    };
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs sm:text-sm text-center">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="px-3 py-2.5 font-semibold">Method 1 — Palm Width</th>
            <th className="px-3 py-2.5 font-semibold">Method 2 — Circumference</th>
            <th className="px-3 py-2.5 font-semibold">Bangle Size</th>
          </tr>
        </thead>
        <tbody>
          {SIZE_ROWS.map((row, i) => {
            const { palm, circ } = fmt(row.palmMin, row.palmMax, row.circMin, row.circMax);
            return (
              <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/60"}>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{palm}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{circ}</td>
                <td className="px-3 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">{row.sizeMin}–{row.sizeMax}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared inner content ───────────────────────────────────────────────────────
function BangleSizeGuideContent({ productSize }: { productSize?: number }) {
  const [unit, setUnit] = useState<Unit>("metric");
  const [palm, setPalm] = useState("");
  const [circ, setCirc] = useState("");
  const [activeTab, setActiveTab] = useState<"calculator" | "table">("calculator");

  const result = compute(palm, circ, unit);

  const palmPlaceholder = unit === "metric" ? "e.g. 70" : "e.g. 2.76";
  const circPlaceholder = unit === "metric" ? "e.g. 18.5" : "e.g. 7.28";
  const palmUnit = unit === "metric" ? "mm" : "in";
  const circUnit = unit === "metric" ? "cm" : "in";

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0">
        {(["calculator", "table"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab
                ? "text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            {tab === "calculator" ? "Size Calculator" : "Size Chart"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-5">

        {/* Unit toggle */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Units:</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => { setUnit(u); setPalm(""); setCirc(""); }}
                className={`px-3 py-1.5 transition-colors ${
                  unit === u
                    ? "bg-emerald-700 text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {u === "metric" ? "mm / cm" : "inches"}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "calculator" ? (
          <>
            {/* Measurement illustration */}
            <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bangle-size-guide.jpg"
                alt="How to measure for bangle size — palm width and hand circumference"
                className="w-full object-contain max-h-48"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 text-center border-t border-gray-100 dark:border-gray-800">
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-0.5">Method 1</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Palm width (widest part, no thumb)</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-0.5">Method 2</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Loose fist — around widest part</p>
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1.5">
                  Method 1 — Palm Width <span className="text-gray-400">({palmUnit})</span>
                </label>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
                  Measure the widest horizontal part of your palm, excluding the thumb.
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  value={palm}
                  onChange={(e) => setPalm(e.target.value)}
                  placeholder={palmPlaceholder}
                  min={0}
                  step={0.1}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1.5">
                  Method 2 — Hand Circumference <span className="text-gray-400">({circUnit})</span>
                </label>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
                  Make a loose fist and measure around the widest part of your hand.
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  value={circ}
                  onChange={(e) => setCirc(e.target.value)}
                  placeholder={circPlaceholder}
                  min={0}
                  step={0.1}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Product size context */}
            {productSize != null && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  This bangle is <strong>size {productSize}</strong> — compare to your result below.
                </p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`rounded-xl border px-4 py-4 space-y-2 ${
                result.status === "below" || result.status === "above"
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                  : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
              }`}>
                {(result.status === "below" || result.status === "above") ? (
                  <>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-[0.12em]">Out of Range</p>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {result.status === "below"
                        ? "Your measurement falls below this guide's listed range."
                        : "Your measurement falls above this guide's listed range."}
                      {" "}Please <a href="/contact" className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors">contact us</a> for personalised sizing help.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.12em]">
                      {result.status === "partial" ? `Result from ${result.source === "palm" ? "Method 1" : "Method 2"}` : "Your Recommended Size"}
                    </p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {result.sizeMin}–{result.sizeMax}
                    </p>
                    {result.status === "upsized" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Your two methods suggested different sizes — we recommend the larger range for easier fit.
                      </p>
                    )}
                    {result.status === "partial" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Enter both measurements for a more confident result.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900 px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-0.5">Snug fit</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.sizeMin}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900 px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-0.5">Easier fit</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{result.sizeMax}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-500 pt-0.5">
                      For fuller hands or pronounced knuckles, sizing up ({result.sizeMax}) may be more comfortable.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Between sizes note */}
            {result && result.status !== "below" && result.status !== "above" && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                I&apos;m between sizes? We recommend the larger size. <a href="/contact" className="underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Ask us</a> if unsure.
              </p>
            )}
          </>
        ) : (
          /* Size chart tab */
          <SizeTable unit={unit} />
        )}

        {/* Disclaimer */}
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Size Guide Disclaimer</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            This guide is a general recommendation only. Hand shape, knuckle width, softness of the hand, and personal fit preference can all affect the best size. If your measurements fall between sizes, or if both methods suggest different results, we generally recommend the larger size. Final size selection remains the customer&apos;s responsibility.
          </p>
        </div>

      </div>
    </>
  );
}

// ── Modal trigger component ────────────────────────────────────────────────────
export function BangleSizeGuide({
  productSize,
  trigger,
}: {
  productSize?: number;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Trigger */}
      {trigger ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Bangle size guide
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-0.5">Bangle Sizing</p>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Find Your Size</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <BangleSizeGuideContent productSize={productSize} />
          </div>
        </div>
      )}
    </>
  );
}

// ── Standalone (inline) component for the /size-guide page ────────────────────
export function BangleSizeGuideStandalone() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-0.5">Bangle Sizing</p>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Find Your Size</h2>
      </div>
      <BangleSizeGuideContent />
    </div>
  );
}
