"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const CATEGORIES = [
  { value: "",          label: "All" },
  { value: "bracelet",  label: "Bracelets" },
  { value: "bangle",    label: "Bangles" },
  { value: "ring",      label: "Rings" },
  { value: "pendant",   label: "Pendants" },
  { value: "necklace",  label: "Necklaces" },
  { value: "set",       label: "Sets" },
  { value: "earring",      label: "Earrings" },
  { value: "raw_material", label: "Raw Material" }
];

function CategoryBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname.startsWith("/products")) return null;

  const active = searchParams.get("category") ?? "";

  return (
    <div className="hidden sm:block border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-6">
        <ul className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0">
          {CATEGORIES.map(({ value, label }) => {
            const isActive = active === value;
            // Build href preserving other params, but replacing category
            const params = new URLSearchParams(searchParams.toString());
            if (value) params.set("category", value);
            else params.delete("category");
            const href = params.size > 0 ? `/products?${params.toString()}` : "/products";

            return (
              <li key={value} className="shrink-0">
                <Link
                  href={href}
                  className={`block px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {label}
                </Link>
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
