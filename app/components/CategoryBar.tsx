"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "bracelet", label: "Bracelets" },
  { value: "bangle", label: "Bangles" },
  { value: "ring", label: "Rings" },
  { value: "pendant", label: "Pendants" },
  { value: "necklace", label: "Necklaces" },
  { value: "set", label: "Sets" },
  { value: "earring", label: "Earrings" },
  { value: "raw_material", label: "Raw Material" },
];

const PRICE_TABS = [
  { key: "under700", label: "Under $700", params: { maxPrice: "699" } },
  { key: "most-loved", label: "Most Loved Pieces", params: { minPrice: "700", maxPrice: "3999" } },
  { key: "collector-picks", label: "Collector Picks", params: { minPrice: "4000", maxPrice: "9999" } },
  { key: "rare-investment", label: "Rare & Investment Jade", params: { minPrice: "10000" } }
];

function CategoryBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname.startsWith("/products")) return null;

  const activeCategory = searchParams.get("category") ?? "";
  const activeMax = searchParams.get("maxPrice");
  const activeMin = searchParams.get("minPrice");

  const linkClass = (isActive: boolean) =>
    `block px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
      ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
    }`;

  return (
    <div className="hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-6">
        <ul className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0">
          {CATEGORIES.map(({ value, label }) => {
            const isActive = activeCategory === value && !activeMax && !activeMin;
            const params = new URLSearchParams(searchParams.toString());
            if (value) params.set("category", value);
            else params.delete("category");
            // Clear price tabs when switching to a category tab
            params.delete("maxPrice");
            params.delete("minPrice");
            const href = params.size > 0 ? `/products?${params.toString()}` : "/products";

            return (
              <li key={value} className="shrink-0">
                <Link href={href} className={linkClass(isActive)}>{label}</Link>
              </li>
            );
          })}

          {/* Divider */}
          <li className="shrink-0 mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />

          {PRICE_TABS.map(({ key, label, params: tabParams }) => {
            const isActive =
              !activeCategory &&
              (tabParams.maxPrice ? activeMax === tabParams.maxPrice : !activeMax) &&
              (tabParams.minPrice ? activeMin === tabParams.minPrice : !activeMin);
            const params = new URLSearchParams();
            Object.entries(tabParams).forEach(([k, v]) => params.set(k, v));
            const href = `/products?${params.toString()}`;

            return (
              <li key={key} className="shrink-0">
                <Link href={href} className={linkClass(isActive)}>{label}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function CategoryBar() {
  return (
    <Suspense>
      <CategoryBarInner />
    </Suspense>
  );
}
