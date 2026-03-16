"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

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

const ALL_STATUSES = [
  { value: "available", label: "Available", dot: "bg-emerald-500" },
  { value: "on_sale",   label: "On Sale",   dot: "bg-amber-400" },
  { value: "sold",      label: "Sold",      dot: "bg-red-500" },
];

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? "border-emerald-600 bg-emerald-600"
            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
        }`}
      >
        {checked && (
          <svg className="w-2 h-2 text-white" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  );
}

export function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedColors   = searchParams.get("colors")?.split(",").filter(Boolean) ?? [];
  const selectedStatuses = searchParams.get("status")?.split(",").filter(Boolean) ?? [];
  const minSize  = searchParams.get("minSize")  ?? "";
  const maxSize  = searchParams.get("maxSize")  ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  const activeCount =
    selectedColors.length +
    selectedStatuses.length +
    (minSize  ? 1 : 0) +
    (maxSize  ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

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

  function toggleStatus(status: string) {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    push({ status: next.length > 0 ? next.join(",") : null });
  }

  function clearAll() {
    router.push(pathname);
  }

  const filterControls = (
    <div className="space-y-5">
      {/* Status */}
      <div>
        <SectionLabel>Status</SectionLabel>
        <div className="space-y-1.5">
          {ALL_STATUSES.map(({ value, label, dot }) => (
            <CheckRow key={value} checked={selectedStatuses.includes(value)} onChange={() => toggleStatus(value)}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {label}
              </span>
            </CheckRow>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <SectionLabel>Color</SectionLabel>
        <div className="space-y-1.5">
          {ALL_COLORS.map(({ value, label, swatch }) => (
            <CheckRow key={value} checked={selectedColors.includes(value)} onChange={() => toggleColor(value)}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${swatch}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {label}
              </span>
            </CheckRow>
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <SectionLabel>Size (mm)</SectionLabel>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={0} placeholder="Min" value={minSize}
            onChange={(e) => push({ minSize: e.target.value })}
            className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <span className="text-gray-400 text-xs shrink-0">–</span>
          <input
            type="number" min={0} placeholder="Max" value={maxSize}
            onChange={(e) => push({ maxSize: e.target.value })}
            className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Price */}
      <div>
        <SectionLabel>Price (USD)</SectionLabel>
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={0} placeholder="Min" value={minPrice}
            onChange={(e) => push({ minPrice: e.target.value })}
            className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <span className="text-gray-400 text-xs shrink-0">–</span>
          <input
            type="number" min={0} placeholder="Max" value={maxPrice}
            onChange={(e) => push({ maxPrice: e.target.value })}
            className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:block w-40 shrink-0">
        <div className="sticky top-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              Filters
            </h2>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                Clear
              </button>
            )}
          </div>
          {filterControls}
        </div>
      </aside>

      {/* ── Mobile: floating pill button ── */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 text-sm font-medium shadow-lg hover:bg-gray-700 dark:hover:bg-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="16" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="16" y2="18" />
          <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="18" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Mobile: bottom drawer ── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Sheet */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white dark:bg-gray-950 shadow-2xl transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
          <div className="flex items-center gap-4">
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                Clear all
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable filter content */}
        <div className="overflow-y-auto max-h-[65vh] px-5 py-4">
          {/* Make the controls full-width on mobile */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {/* Status */}
            <div>
              <SectionLabel>Status</SectionLabel>
              <div className="space-y-2">
                {ALL_STATUSES.map(({ value, label, dot }) => (
                  <CheckRow key={value} checked={selectedStatuses.includes(value)} onChange={() => toggleStatus(value)}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                  </CheckRow>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <SectionLabel>Size (mm)</SectionLabel>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} placeholder="Min" value={minSize}
                  onChange={(e) => push({ minSize: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <input
                  type="number" min={0} placeholder="Max" value={maxSize}
                  onChange={(e) => push({ maxSize: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <SectionLabel>Price (USD)</SectionLabel>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} placeholder="Min" value={minPrice}
                  onChange={(e) => push({ minPrice: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-gray-400 text-xs shrink-0">–</span>
                <input
                  type="number" min={0} placeholder="Max" value={maxPrice}
                  onChange={(e) => push({ maxPrice: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Color */}
            <div className="col-span-2">
              <SectionLabel>Color</SectionLabel>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {ALL_COLORS.map(({ value, label, swatch }) => (
                  <CheckRow key={value} checked={selectedColors.includes(value)} onChange={() => toggleColor(value)}>
                    <span className={`w-3 h-3 rounded-full shrink-0 ${swatch}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                  </CheckRow>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Done button */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 text-sm font-medium transition-colors"
          >
            Show results
          </button>
        </div>
      </div>
    </>
  );
}
