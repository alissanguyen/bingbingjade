"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV_CATEGORIES = [
  { value: "",          label: "All Products" },
  { value: "bracelet",  label: "Bracelets" },
  { value: "bangle",    label: "Bangles" },
  { value: "ring",      label: "Rings" },
  { value: "pendant",   label: "Pendants" },
  { value: "necklace",  label: "Necklaces" },
  { value: "other",     label: "Other" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="relative mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
      <Link href="/" onClick={() => setOpen(false)}>
        <Image src="/logo.svg" alt="BingBing Jade" width={400} height={100} priority />
      </Link>

      {/* Desktop links */}
      <ul className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-300">
        <li>
          <Link
            href="/"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Home
          </Link>
        </li>

        {/* Products with hover dropdown */}
        <li
          className="relative"
          onMouseEnter={() => setProductsOpen(true)}
          onMouseLeave={() => setProductsOpen(false)}
        >
          <Link
            href="/products"
            className={`flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/products") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Products
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${productsOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Link>

          {/* Dropdown */}
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 transition-all duration-150 ${
              productsOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
            }`}
          >
            <div className="w-44 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg overflow-hidden py-1">
              {NAV_CATEGORIES.map(({ value, label }) => (
                <Link
                  key={value}
                  href={value ? `/products?category=${value}` : "/products"}
                  onClick={() => setProductsOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </li>

        <li>
          <Link
            href="/contact"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/contact" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Contact
          </Link>
        </li>
        <li>
          <ThemeToggle />
        </li>
      </ul>

      {/* Mobile right side */}
      <div className="flex sm:hidden items-center gap-3">
        <ThemeToggle />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="p-1 text-gray-600 dark:text-gray-300"
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sm:hidden">
          <ul className="flex flex-col px-6 py-4 gap-1 text-sm font-medium text-gray-600 dark:text-gray-300">
            <li>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Home
              </Link>
            </li>

            {/* Products with sub-menu */}
            <li>
              <button
                type="button"
                onClick={() => setMobileProductsOpen((v) => !v)}
                className={`w-full flex items-center justify-between py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/products") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Products
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${mobileProductsOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {mobileProductsOpen && (
                <ul className="pl-4 pb-2 space-y-1 border-l-2 border-emerald-100 dark:border-emerald-900 ml-1">
                  {NAV_CATEGORIES.map(({ value, label }) => (
                    <li key={value}>
                      <Link
                        href={value ? `/products?category=${value}` : "/products"}
                        onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                        className="block py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/contact" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
