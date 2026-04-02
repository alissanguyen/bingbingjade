"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const SORT_OPTIONS = [
  { value: "",           label: "Default" },
  { value: "price_asc",  label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "size_asc",   label: "Size: Small to Big" },
  { value: "size_desc",  label: "Size: Big to Small" },
];

function SortSelectSync({ onSync }: { onSync: (sort: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onSync(searchParams.get("sort") ?? "");
  }, [searchParams, onSync]);
  return null;
}

export function SortSelect({ initialSort = "" }: { initialSort?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState(initialSort);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setCurrent(val);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (val) params.set("sort", val);
    else params.delete("sort");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <Suspense>
        <SortSelectSync onSync={setCurrent} />
      </Suspense>
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
    </>
  );
}
