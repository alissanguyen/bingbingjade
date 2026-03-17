"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const SORT_OPTIONS = [
  { value: "",           label: "Default" },
  { value: "price_asc",  label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "size_asc",   label: "Size: Small to Big" },
  { value: "size_desc",  label: "Size: Big to Small" },
];

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("sort", e.target.value);
    else params.delete("sort");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 shrink-0">Sort by</span>
      <select
        value={current}
        onChange={onChange}
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
