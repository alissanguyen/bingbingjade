"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const ALL_COLORS = [
  { value: "white",    label: "White",    swatch: "bg-white border border-gray-300" },
  { value: "green",    label: "Green",    swatch: "bg-green-500" },
  { value: "blue",     label: "Blue",     swatch: "bg-blue-500" },
  { value: "red",      label: "Red",      swatch: "bg-red-500" },
  { value: "pink",     label: "Pink",     swatch: "bg-pink-400" },
  { value: "purple",   label: "Purple",   swatch: "bg-purple-500" },
  { value: "orange",   label: "Orange",   swatch: "bg-orange-500" },
  { value: "yellow",   label: "Yellow",   swatch: "bg-yellow-400" },
  { value: "black",    label: "Black",    swatch: "bg-gray-900" },
  { value: "marbling", label: "Marbling", swatch: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300" },
];

export function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedColors = searchParams.get("colors")?.split(",").filter(Boolean) ?? [];
  const minSize = searchParams.get("minSize") ?? "";
  const maxSize = searchParams.get("maxSize") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === "") params.delete(key);
        else params.set(key, val);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function toggleColor(color: string) {
    const next = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    push({ colors: next.length > 0 ? next.join(",") : null });
  }

  const hasFilters =
    selectedColors.length > 0 || minSize || maxSize || minPrice || maxPrice;

  function clearAll() {
    router.push(pathname);
  }

  return (
    <aside className="hidden lg:block w-40 shrink-0">
      <div className="sticky top-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
            Filters
          </h2>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Color */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Color
          </p>
          <div className="space-y-1.5">
            {ALL_COLORS.map(({ value, label, swatch }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedColors.includes(value)}
                  onChange={() => toggleColor(value)}
                  className="sr-only"
                />
                <span
                  className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedColors.includes(value)
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  }`}
                >
                  {selectedColors.includes(value) && (
                    <svg className="w-2 h-2 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${swatch}`} />
                <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Size (mm)
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={minSize}
              onChange={(e) => push({ minSize: e.target.value })}
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-gray-400 text-xs shrink-0">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={maxSize}
              onChange={(e) => push({ maxSize: e.target.value })}
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Price */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Price (USD)
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={minPrice}
              onChange={(e) => push({ minPrice: e.target.value })}
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-gray-400 text-xs shrink-0">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => push({ maxPrice: e.target.value })}
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
