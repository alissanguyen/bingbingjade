"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

function pageHref(pathname: string, params: URLSearchParams, page: number) {
  const p = new URLSearchParams(params.toString());
  if (page === 1) p.delete("page");
  else p.set("page", String(page));
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  // Build page numbers to show: always first, last, current ±1, with ellipsis gaps
  const pages: (number | "…")[] = [];
  const add = new Set<number>();

  [1, totalPages, currentPage - 1, currentPage, currentPage + 1]
    .filter((p) => p >= 1 && p <= totalPages)
    .forEach((p) => add.add(p));

  const sorted = Array.from(add).sort((a, b) => a - b);
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push("…");
    pages.push(p);
  });

  const btnBase =
    "inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-lg text-sm font-medium transition-colors";

  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pagination">
      {/* Prev */}
      {currentPage > 1 ? (
        <Link
          href={pageHref(pathname, searchParams, currentPage - 1)}
          className={`${btnBase} border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400`}
          aria-label="Previous page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      ) : (
        <span className={`${btnBase} border border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-700 cursor-not-allowed`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </span>
      )}

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className={`${btnBase} text-gray-400 dark:text-gray-600`}>…</span>
        ) : p === currentPage ? (
          <span key={p} className={`${btnBase} bg-emerald-700 text-white`} aria-current="page">{p}</span>
        ) : (
          <Link
            key={p}
            href={pageHref(pathname, searchParams, p)}
            className={`${btnBase} border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400`}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={pageHref(pathname, searchParams, currentPage + 1)}
          className={`${btnBase} border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400`}
          aria-label="Next page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      ) : (
        <span className={`${btnBase} border border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-700 cursor-not-allowed`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </nav>
  );
}
