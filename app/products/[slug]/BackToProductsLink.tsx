"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "products_back_url";

export function BackToProductsLink() {
  const [href, setHref] = useState("/products");
  const [label, setLabel] = useState("Back to products");

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setHref(stored);
      const hasFilters = stored.includes("?") && stored !== "/products";
      if (hasFilters) setLabel("Back to results");
    }
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </Link>
  );
}
