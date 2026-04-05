"use client";

import { useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

type RingSizeRow = {
  size: number;
  diameterMm: number;
  circumferenceMinMm: number;
  circumferenceMaxMm: number;
};

const RING_SIZE_ROWS: RingSizeRow[] = [
  { size: 5,  diameterMm: 14.7, circumferenceMinMm: 45,   circumferenceMaxMm: 45   },
  { size: 6,  diameterMm: 14.8, circumferenceMinMm: 46,   circumferenceMaxMm: 46   },
  { size: 7,  diameterMm: 15.0, circumferenceMinMm: 47,   circumferenceMaxMm: 48   },
  { size: 8,  diameterMm: 15.3, circumferenceMinMm: 49,   circumferenceMaxMm: 49   },
  { size: 9,  diameterMm: 15.8, circumferenceMinMm: 49.6, circumferenceMaxMm: 49.6 },
  { size: 10, diameterMm: 15.9, circumferenceMinMm: 51,   circumferenceMaxMm: 51   },
  { size: 11, diameterMm: 16.1, circumferenceMinMm: 52,   circumferenceMaxMm: 52   },
  { size: 12, diameterMm: 16.5, circumferenceMinMm: 53,   circumferenceMaxMm: 53   },
  { size: 13, diameterMm: 16.7, circumferenceMinMm: 54,   circumferenceMaxMm: 54   },
  { size: 14, diameterMm: 16.9, circumferenceMinMm: 55,   circumferenceMaxMm: 55   },
  { size: 15, diameterMm: 17.3, circumferenceMinMm: 56,   circumferenceMaxMm: 56   },
  { size: 16, diameterMm: 17.9, circumferenceMinMm: 57,   circumferenceMaxMm: 57   },
  { size: 17, diameterMm: 18.0, circumferenceMinMm: 58,   circumferenceMaxMm: 58   },
  { size: 18, diameterMm: 18.2, circumferenceMinMm: 59,   circumferenceMaxMm: 59   },
  { size: 19, diameterMm: 19.1, circumferenceMinMm: 60,   circumferenceMaxMm: 60   },
  { size: 20, diameterMm: 19.4, circumferenceMinMm: 62,   circumferenceMaxMm: 62   },
  { size: 21, diameterMm: 19.8, circumferenceMinMm: 62.2, circumferenceMaxMm: 62.2 },
  { size: 22, diameterMm: 20.2, circumferenceMinMm: 63,   circumferenceMaxMm: 63   },
  { size: 23, diameterMm: 20.3, circumferenceMinMm: 63.8, circumferenceMaxMm: 63.8 },
  { size: 24, diameterMm: 20.6, circumferenceMinMm: 65,   circumferenceMaxMm: 65   },
  { size: 25, diameterMm: 21.0, circumferenceMinMm: 66,   circumferenceMaxMm: 66   },
  { size: 26, diameterMm: 21.4, circumferenceMinMm: 67,   circumferenceMaxMm: 67   },
  { size: 27, diameterMm: 21.6, circumferenceMinMm: 67.9, circumferenceMaxMm: 67.9 },
  { size: 28, diameterMm: 22.0, circumferenceMinMm: 68.8, circumferenceMaxMm: 68.8 },
  { size: 29, diameterMm: 22.3, circumferenceMinMm: 70.1, circumferenceMaxMm: 70.1 },
];

// ─── Recommendation logic (exported for tests) ────────────────────────────────

export type RingRecommendation =
  | { status: "ok";       size: number; source: "diameter" | "circumference" | "both_agree" }
  | { status: "conflict"; size: number; sizeDiam: number; sizeCirc: number }
  | { status: "below" | "above" }
  | { status: "empty" };

/** Find the best ring size from an inside diameter (mm) measurement. */
function findByDiameter(diamMm: number): number | "below" | "above" {
  const first = RING_SIZE_ROWS[0];
  const last  = RING_SIZE_ROWS[RING_SIZE_ROWS.length - 1];
  if (diamMm < first.diameterMm - 1) return "below";
  if (diamMm > last.diameterMm  + 1) return "above";

  let bestIdx  = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < RING_SIZE_ROWS.length; i++) {
    const diff = Math.abs(RING_SIZE_ROWS[i].diameterMm - diamMm);
    // On a tie, prefer the larger size (higher index) for comfort
    if (diff < bestDiff || (diff === bestDiff)) {
      bestDiff = diff;
      bestIdx  = i;
    }
  }
  return RING_SIZE_ROWS[bestIdx].size;
}

/** Find the best ring size from a finger circumference (mm) measurement. */
function findByCircumference(circMm: number): number | "below" | "above" {
  const first = RING_SIZE_ROWS[0];
  const last  = RING_SIZE_ROWS[RING_SIZE_ROWS.length - 1];
  if (circMm < first.circumferenceMinMm - 1) return "below";
  if (circMm > last.circumferenceMaxMm  + 1) return "above";

  // Exact range match
  for (const row of RING_SIZE_ROWS) {
    if (circMm >= row.circumferenceMinMm && circMm <= row.circumferenceMaxMm) {
      return row.size;
    }
  }

  // Between ranges — find nearest, prefer larger on tie
  let bestIdx  = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < RING_SIZE_ROWS.length; i++) {
    const row  = RING_SIZE_ROWS[i];
    const diff = Math.min(
      Math.abs(circMm - row.circumferenceMinMm),
      Math.abs(circMm - row.circumferenceMaxMm),
    );
    if (diff < bestDiff || diff === bestDiff) {
      bestDiff = diff;
      bestIdx  = i;
    }
  }
  return RING_SIZE_ROWS[bestIdx].size;
}

export function recommendRingSize(diamMm?: number, circMm?: number): RingRecommendation {
  const hasDiam = diamMm != null && !isNaN(diamMm);
  const hasCirc = circMm != null && !isNaN(circMm);

  if (!hasDiam && !hasCirc) return { status: "empty" };

  const fromDiam = hasDiam ? findByDiameter(diamMm!) : null;
  const fromCirc = hasCirc ? findByCircumference(circMm!) : null;

  // Out-of-range cases
  if (fromDiam === "below" && fromCirc === "below") return { status: "below" };
  if (fromDiam === "above" && fromCirc === "above") return { status: "above" };
  if (fromDiam === "below" && fromCirc === null)    return { status: "below" };
  if (fromDiam === "above" && fromCirc === null)    return { status: "above" };
  if (fromDiam === null    && fromCirc === "below") return { status: "below" };
  if (fromDiam === null    && fromCirc === "above") return { status: "above" };

  // Single input
  if (fromDiam !== null && fromDiam !== "below" && fromDiam !== "above" && !hasCirc) {
    return { status: "ok", size: fromDiam, source: "diameter" };
  }
  if (fromCirc !== null && fromCirc !== "below" && fromCirc !== "above" && !hasDiam) {
    return { status: "ok", size: fromCirc, source: "circumference" };
  }

  // Both inputs — get valid sizes (ignore out-of-range signals when the other is valid)
  const sizeDiam = typeof fromDiam === "number" ? fromDiam : null;
  const sizeCirc = typeof fromCirc === "number" ? fromCirc : null;

  if (sizeDiam === null && sizeCirc !== null) return { status: "ok", size: sizeCirc, source: "circumference" };
  if (sizeCirc === null && sizeDiam !== null) return { status: "ok", size: sizeDiam, source: "diameter" };
  if (sizeDiam === null || sizeCirc === null) return { status: "empty" };

  if (sizeDiam === sizeCirc) {
    return { status: "ok", size: sizeDiam, source: "both_agree" };
  }

  // Conflict — recommend the larger size for comfort
  const recommended = Math.max(sizeDiam, sizeCirc);
  return { status: "conflict", size: recommended, sizeDiam, sizeCirc };
}

// ─── Size table ───────────────────────────────────────────────────────────────

function RingSizeTable({ highlightSize }: { highlightSize?: number }) {
  return (
    <table className="w-full text-xs sm:text-sm text-center">
      <thead>
        <tr className="bg-emerald-700 text-white">
          <th className="px-3 py-2.5 font-semibold">Size</th>
          <th className="px-3 py-2.5 font-semibold"><div>Diameter</div><div>(mm)</div></th>
          <th className="px-3 py-2.5 font-semibold"><div>Circumference</div><div>(mm)</div></th>
        </tr>
      </thead>
      <tbody>
        {RING_SIZE_ROWS.map((row, i) => {
          const isHighlighted = row.size === highlightSize;
          const isEven = i % 2 === 0;
          return (
            <tr
              key={row.size}
              className={
                isHighlighted
                  ? "bg-emerald-50 dark:bg-emerald-950/40"
                  : isEven
                  ? "bg-white dark:bg-gray-900"
                  : "bg-gray-50 dark:bg-gray-800/60"
              }
            >
              <td className={`px-3 py-2 font-semibold ${isHighlighted ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}`}>
                {row.size}
                {isHighlighted && (
                  <span className="ml-1.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                    this item
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.diameterMm}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                {row.circumferenceMinMm === row.circumferenceMaxMm
                  ? row.circumferenceMinMm
                  : `${row.circumferenceMinMm}–${row.circumferenceMaxMm}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Shared inner content ─────────────────────────────────────────────────────

function RingSizeGuideContent({ productSize }: { productSize?: number }) {
  const [diam, setDiam] = useState("");
  const [circ, setCirc] = useState("");
  const [activeTab, setActiveTab] = useState<"calculator" | "chart">("calculator");

  const diamVal = diam.trim() !== "" ? parseFloat(diam) : undefined;
  const circVal = circ.trim() !== "" ? parseFloat(circ) : undefined;
  const result  = recommendRingSize(diamVal, circVal);

  const inputBase =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";

  return (
    <>
      {/* Measuring image */}
      <img
        src="/ring-sizing.png"
        alt="How to measure your ring size — method 1: inside diameter, method 2: finger circumference"
        className="w-full object-contain"
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {(["calculator", "chart"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            {tab === "calculator" ? "Size Calculator" : "Size Chart"}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="px-5 py-5 space-y-5">
        {activeTab === "calculator" ? (
          <>
            {/* Temperature note */}
            <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2 leading-relaxed">
              Best measured at room temperature. Fingers may swell in heat and shrink in cold.
            </p>

            {/* Method 1 — Diameter */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Method 1 — Inside Diameter <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">(mm)</span>
              </p>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                placeholder="e.g. 16.5"
                value={diam}
                onChange={(e) => setDiam(e.target.value)}
                className={inputBase}
              />
              <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                Measure the inside diameter of a ring that fits, excluding the band thickness.
              </p>
            </div>

            {/* Method 2 — Circumference */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Method 2 — Finger Circumference <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">(mm)</span>
              </p>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                placeholder="e.g. 53"
                value={circ}
                onChange={(e) => setCirc(e.target.value)}
                className={inputBase}
              />
              <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                Wrap a strip of paper snugly around your finger, mark the overlap, then measure the length in mm.
              </p>
            </div>

            {/* Result */}
            {result && result.status !== "empty" && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-4 py-4 space-y-2">
                {result.status === "below" && (
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Your measurement is below our smallest size (5).
                  </p>
                )}
                {result.status === "above" && (
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Your measurement is above our largest size (29).
                  </p>
                )}
                {(result.status === "ok" || result.status === "conflict") && (
                  <>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Recommended size
                      </p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {result.size}
                      </p>
                    </div>

                    {result.status === "ok" && result.source === "diameter" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Based on inside diameter.</p>
                    )}
                    {result.status === "ok" && result.source === "circumference" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Based on finger circumference.</p>
                    )}
                    {result.status === "ok" && result.source === "both_agree" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Both methods agree — high confidence.
                      </p>
                    )}
                    {result.status === "conflict" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        The two methods suggest slightly different sizes ({result.sizeDiam} vs {result.sizeCirc}). We recommend the larger size for comfort.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Between sizes note */}
            {result && result.status !== "empty" && result.status !== "below" && result.status !== "above" && (
              <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 text-center">
                Between sizes? Always choose the larger size for comfort.{" "}
                <a href="/contact" className="underline underline-offset-2 text-black dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Ask us
                </a>{" "}
                if unsure.
              </p>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] sm:text-[11px] text-gray-300 dark:text-gray-600 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4">
              This ring size guide is provided as a general recommendation only. Finger shape, knuckle size, temperature, time of day, and personal fit preference can all affect the best size for you. If your measurements fall between two sizes, we generally recommend choosing the larger size for comfort. Final size selection remains the customer&apos;s responsibility.
            </p>
          </>
        ) : (
          <RingSizeTable highlightSize={productSize} />
        )}
      </div>
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function RingSizeGuide({ productSize }: { productSize?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
      >
        Ring size guide
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Ring size guide"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Ring Sizing</p>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">Find Your Size</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto">
              <RingSizeGuideContent productSize={productSize} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Standalone ───────────────────────────────────────────────────────────────

export function RingSizeGuideStandalone() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Ring Sizing</p>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">Find Your Size</h2>
      </div>
      <RingSizeGuideContent />
    </div>
  );
}
