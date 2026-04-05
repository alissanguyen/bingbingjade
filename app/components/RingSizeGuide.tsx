"use client";

import Image from "next/image";
import { useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

type RingSizeRow = {
  ukSize: string;
  usSize: number;
  diameterMm: number;
  circumferenceMm: number;
};

const RING_SIZE_ROWS: RingSizeRow[] = [
  { ukSize: "G 1/2", usSize: 3.75, diameterMm: 14.7, circumferenceMm: 46.1 },
  { ukSize: "H", usSize: 4, diameterMm: 14.9, circumferenceMm: 46.8 },
  { ukSize: "H 1/2", usSize: 4.25, diameterMm: 15.1, circumferenceMm: 47.4 },
  { ukSize: "I", usSize: 4.5, diameterMm: 15.3, circumferenceMm: 48.0 },
  { ukSize: "J", usSize: 4.75, diameterMm: 15.5, circumferenceMm: 48.7 },
  { ukSize: "J 1/2", usSize: 5, diameterMm: 15.7, circumferenceMm: 49.3 },
  { ukSize: "K", usSize: 5.25, diameterMm: 15.9, circumferenceMm: 50.0 },
  { ukSize: "K 1/2", usSize: 5.5, diameterMm: 16.1, circumferenceMm: 50.6 },
  { ukSize: "L", usSize: 5.75, diameterMm: 16.3, circumferenceMm: 51.2 },
  { ukSize: "L 1/2", usSize: 6, diameterMm: 16.5, circumferenceMm: 51.9 },
  { ukSize: "M", usSize: 6.25, diameterMm: 16.7, circumferenceMm: 52.5 },
  { ukSize: "M 1/2", usSize: 6.5, diameterMm: 16.9, circumferenceMm: 53.1 },
  { ukSize: "N", usSize: 6.75, diameterMm: 17.1, circumferenceMm: 53.8 },
  { ukSize: "N 1/2", usSize: 7, diameterMm: 17.3, circumferenceMm: 54.4 },
  { ukSize: "O", usSize: 7.25, diameterMm: 17.5, circumferenceMm: 55.1 },
  { ukSize: "O 1/2", usSize: 7.5, diameterMm: 17.7, circumferenceMm: 55.7 },
  { ukSize: "P", usSize: 7.75, diameterMm: 17.9, circumferenceMm: 56.3 },
  { ukSize: "P 1/2", usSize: 8, diameterMm: 18.2, circumferenceMm: 57.0 },
  { ukSize: "Q", usSize: 8.25, diameterMm: 18.3, circumferenceMm: 57.6 },
  { ukSize: "Q 1/2", usSize: 8.5, diameterMm: 18.6, circumferenceMm: 58.3 },
  { ukSize: "R", usSize: 8.75, diameterMm: 18.8, circumferenceMm: 58.9 },
  { ukSize: "R 1/2", usSize: 9, diameterMm: 18.9, circumferenceMm: 59.5 },
  { ukSize: "S", usSize: 9.25, diameterMm: 19.2, circumferenceMm: 60.2 },
  { ukSize: "S 1/2", usSize: 9.5, diameterMm: 19.4, circumferenceMm: 60.8 },
  { ukSize: "T", usSize: 9.75, diameterMm: 19.6, circumferenceMm: 61.4 },
  { ukSize: "T 1/2", usSize: 10, diameterMm: 19.8, circumferenceMm: 62.1 },
  { ukSize: "U", usSize: 10.25, diameterMm: 20.0, circumferenceMm: 62.7 },
  { ukSize: "U 1/2", usSize: 10.5, diameterMm: 20.2, circumferenceMm: 63.4 },
  { ukSize: "V", usSize: 10.75, diameterMm: 20.4, circumferenceMm: 64.0 },
  { ukSize: "V 1/2", usSize: 11, diameterMm: 20.6, circumferenceMm: 64.6 },
  { ukSize: "W", usSize: 11.25, diameterMm: 20.8, circumferenceMm: 65.3 },
  { ukSize: "W 1/2", usSize: 11.5, diameterMm: 21.0, circumferenceMm: 65.9 },
  { ukSize: "X", usSize: 11.75, diameterMm: 21.2, circumferenceMm: 66.6 },
  { ukSize: "X 1/2", usSize: 12, diameterMm: 21.4, circumferenceMm: 67.2 },
  { ukSize: "Y", usSize: 12.25, diameterMm: 21.7, circumferenceMm: 68.1 },
  { ukSize: "Z", usSize: 12.5, diameterMm: 21.8, circumferenceMm: 68.5 },
  { ukSize: "Z 1/2", usSize: 12.75, diameterMm: 22.0, circumferenceMm: 69.1 },
  { ukSize: "---", usSize: 13, diameterMm: 22.2, circumferenceMm: 69.7 },
];

// ─── Recommendation logic (exported for tests) ────────────────────────────────

export type RingRecommendation =
  | {
      status: "ok";
      size: number;
      source: "diameter" | "circumference" | "both_agree";
    }
  | {
      status: "conflict";
      size: number;
      sizeDiam: number;
      sizeCirc: number;
    }
  | { status: "below" | "above" }
  | { status: "empty" };

/** Find the best ring size from an inside diameter (mm) measurement. */
function findByDiameter(diamMm: number): number | "below" | "above" {
  const first = RING_SIZE_ROWS[0];
  const last = RING_SIZE_ROWS[RING_SIZE_ROWS.length - 1];

  if (diamMm < first.diameterMm - 1) return "below";
  if (diamMm > last.diameterMm + 1) return "above";

  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < RING_SIZE_ROWS.length; i++) {
    const diff = Math.abs(RING_SIZE_ROWS[i].diameterMm - diamMm);

    // On tie, prefer larger size for comfort
    if (diff < bestDiff || diff === bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return RING_SIZE_ROWS[bestIdx].usSize;
}

/** Find the best ring size from a finger circumference (mm) measurement. */
function findByCircumference(circMm: number): number | "below" | "above" {
  const first = RING_SIZE_ROWS[0];
  const last = RING_SIZE_ROWS[RING_SIZE_ROWS.length - 1];

  if (circMm < first.circumferenceMm - 1) return "below";
  if (circMm > last.circumferenceMm + 1) return "above";

  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < RING_SIZE_ROWS.length; i++) {
    const diff = Math.abs(RING_SIZE_ROWS[i].circumferenceMm - circMm);

    // On tie, prefer larger size for comfort
    if (diff < bestDiff || diff === bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return RING_SIZE_ROWS[bestIdx].usSize;
}

export function recommendRingSize(
  diamMm?: number,
  circMm?: number,
): RingRecommendation {
  const hasDiam = diamMm != null && !Number.isNaN(diamMm);
  const hasCirc = circMm != null && !Number.isNaN(circMm);

  if (!hasDiam && !hasCirc) return { status: "empty" };

  const fromDiam = hasDiam ? findByDiameter(diamMm!) : null;
  const fromCirc = hasCirc ? findByCircumference(circMm!) : null;

  // Out-of-range cases
  if (fromDiam === "below" && fromCirc === "below") return { status: "below" };
  if (fromDiam === "above" && fromCirc === "above") return { status: "above" };
  if (fromDiam === "below" && fromCirc === null) return { status: "below" };
  if (fromDiam === "above" && fromCirc === null) return { status: "above" };
  if (fromDiam === null && fromCirc === "below") return { status: "below" };
  if (fromDiam === null && fromCirc === "above") return { status: "above" };

  // Single input
  if (fromDiam !== null && fromDiam !== "below" && fromDiam !== "above" && !hasCirc) {
    return { status: "ok", size: fromDiam, source: "diameter" };
  }

  if (fromCirc !== null && fromCirc !== "below" && fromCirc !== "above" && !hasDiam) {
    return { status: "ok", size: fromCirc, source: "circumference" };
  }

  // Both inputs — ignore out-of-range signal if the other one is valid
  const sizeDiam = typeof fromDiam === "number" ? fromDiam : null;
  const sizeCirc = typeof fromCirc === "number" ? fromCirc : null;

  if (sizeDiam === null && sizeCirc !== null) {
    return { status: "ok", size: sizeCirc, source: "circumference" };
  }

  if (sizeCirc === null && sizeDiam !== null) {
    return { status: "ok", size: sizeDiam, source: "diameter" };
  }

  if (sizeDiam === null || sizeCirc === null) {
    return { status: "empty" };
  }

  if (sizeDiam === sizeCirc) {
    return { status: "ok", size: sizeDiam, source: "both_agree" };
  }

  // Conflict — recommend larger size for comfort
  return {
    status: "conflict",
    size: Math.max(sizeDiam, sizeCirc),
    sizeDiam,
    sizeCirc,
  };
}

// ─── Size table ───────────────────────────────────────────────────────────────

function RingSizeTable({ highlightSize }: { highlightSize?: number }) {
  return (
    <table className="w-full text-[11px] sm:text-sm text-center">
      <thead>
        <tr className="bg-emerald-700 text-white">
          <th className="px-3 py-2.5 font-semibold">
            <div>UK</div>
            <div>Size</div>
          </th>
          <th className="px-3 py-2.5 font-semibold">
            <div>US</div>
            <div>Size</div>
          </th>
          <th className="px-3 py-2.5 font-semibold">
            <div>Inner Diameter</div>
            <div>(mm)</div>
          </th>
          <th className="px-3 py-2.5 font-semibold">
            <div>Inner Circumference</div>
            <div>(mm)</div>
          </th>
        </tr>
      </thead>
      <tbody className="text-[11px] sm:text-sm">
        {RING_SIZE_ROWS.map((row, i) => {
          const isHighlighted = row.usSize === highlightSize;
          const isEven = i % 2 === 0;

          return (
            <tr
              key={`${row.ukSize}-${row.usSize}`}
              className={
                isHighlighted
                  ? "bg-emerald-50 dark:bg-emerald-950/40"
                  : isEven
                    ? "bg-white dark:bg-gray-900"
                    : "bg-gray-50 dark:bg-gray-800/60"
              }
            >
              <td
                className={`px-3 py-2 font-semibold ${
                  isHighlighted
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {row.ukSize}
              </td>

              <td
                className={`px-3 py-2 font-semibold ${
                  isHighlighted
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {row.usSize}
                {isHighlighted && (
                  <span className="ml-1.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                    this item
                  </span>
                )}
              </td>

              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                {row.diameterMm}
              </td>

              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                {row.circumferenceMm}
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
  const result = recommendRingSize(diamVal, circVal);

  const inputBase =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";

  const smallestSize = RING_SIZE_ROWS[0].usSize;
  const largestSize = RING_SIZE_ROWS[RING_SIZE_ROWS.length - 1].usSize;

  return (
    <>
      <Image
        src="/ring-sizing.png"
        alt="How to measure your ring size — method 1: inside diameter, method 2: finger circumference"
        className="w-full object-contain"
        width={800}
        height={600}
      />

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

      <div className="px-5 py-5 space-y-5">
        {activeTab === "calculator" ? (
          <>
            <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2 leading-relaxed">
              Best measured at room temperature. Fingers may swell in heat and shrink in cold.
            </p>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Method 1 — Inside Diameter{" "}
                <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">
                  (mm)
                </span>
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

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Method 2 — Finger Circumference{" "}
                <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">
                  (mm)
                </span>
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
                Wrap a strip of paper snugly around your finger, mark the overlap, then measure the
                length in mm.
              </p>
            </div>

            {result.status !== "empty" && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-4 py-4 space-y-2">
                {result.status === "below" && (
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Your measurement is below our smallest size ({smallestSize} US).
                  </p>
                )}

                {result.status === "above" && (
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Your measurement is above our largest size ({largestSize} US).
                  </p>
                )}

                {(result.status === "ok" || result.status === "conflict") && (
                  <>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Recommended US size
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300">
                        {result.size}
                      </p>
                    </div>

                    {result.status === "ok" && result.source === "diameter" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Based on inside diameter.
                      </p>
                    )}

                    {result.status === "ok" && result.source === "circumference" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Based on finger circumference.
                      </p>
                    )}

                    {result.status === "ok" && result.source === "both_agree" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Both methods agree — high confidence.
                      </p>
                    )}

                    {result.status === "conflict" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        The two methods suggest slightly different sizes ({result.sizeDiam} vs{" "}
                        {result.sizeCirc}). We recommend the larger size for comfort.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {result.status !== "empty" &&
              result.status !== "below" &&
              result.status !== "above" && (
                <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 text-center">
                  Between sizes? Always choose the larger size for comfort.{" "}
                  <a
                    href="/contact"
                    className="underline underline-offset-2 text-black dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    Ask us
                  </a>{" "}
                  if unsure.
                </p>
              )}

            <p className="text-[10px] sm:text-[11px] text-gray-300 dark:text-gray-600 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4">
              This ring size guide is provided as a general recommendation only. Finger shape,
              knuckle size, temperature, time of day, and personal fit preference can all affect the
              best size for you. If your measurements fall between two sizes, we generally recommend
              choosing the larger size for comfort. Final size selection remains the customer&apos;s
              responsibility.
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
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 w-full sm:max-w-xl bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Ring Sizing
                </p>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                  Find Your Size
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

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
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Ring Sizing
        </p>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
          Find Your Size
        </h2>
      </div>
      <RingSizeGuideContent />
    </div>
  );
}