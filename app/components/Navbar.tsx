"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useCart } from "./CartContext";

const NAV_CATEGORIES = [
  { value: "", label: "All Products" },
  { value: "bracelet", label: "Bracelets" },
  { value: "bangle", label: "Bangles" },
  { value: "ring", label: "Rings" },
  { value: "pendant", label: "Pendants" },
  { value: "necklace", label: "Necklaces" },
  { value: "set", label: "Sets" },
  { value: "custom_order", label: "Custom Orders" },
  { value: "other", label: "Other" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const pathname = usePathname();
  const { count, openDrawer, closeDrawer } = useCart();


  return (
    <nav className="relative mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
      <Link href="/" onClick={() => setOpen(false)}>
        <svg viewBox="60 30 750 260" preserveAspectRatio="xMinYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg" className="translate-x-[-10px] sm:translate-x-0 h-17 sm:h-40 w-auto text-[#23443D] dark:text-[#9ED9CB]">
          <defs>
            <radialGradient id="jadeBase" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
              gradientTransform="translate(126 118) rotate(35) scale(115 115)">
              <stop offset="0%" stopColor="#F2FFFB" />
              <stop offset="18%" stopColor="#DDF7EF" />
              <stop offset="42%" stopColor="#A7DED0" />
              <stop offset="68%" stopColor="#6EB9A8" />
              <stop offset="100%" stopColor="#3F8E7E" />
            </radialGradient>

            <radialGradient id="jadeInnerGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
              gradientTransform="translate(110 90) rotate(25) scale(58 44)">
              <stop offset="0%" stopColor="white" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#E7FFF8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#E7FFF8" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="jadeDepth" x1="56" y1="52" x2="210" y2="206" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F5FFFC" stopOpacity="0.8" />
              <stop offset="22%" stopColor="#BDE8DB" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#6FB8A8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#245E53" stopOpacity="0.42" />
            </linearGradient>

            <linearGradient id="jadeRim" x1="68" y1="60" x2="196" y2="196" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="20%" stopColor="#EAFFF8" stopOpacity="0.45" />
              <stop offset="48%" stopColor="#8ED3C2" stopOpacity="0.15" />
              <stop offset="75%" stopColor="#2E7A6A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#163F37" stopOpacity="0.65" />
            </linearGradient>

            <mask id="ringMask">
              <rect width="100%" height="100%" fill="black" />
              <circle cx="170" cy="160" r="92" fill="white" />
              <circle cx="170" cy="160" r="58" fill="black" />
            </mask>

            <filter id="blur8" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" />
            </filter>

            <filter id="blur4" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>

            <filter id="shadowSoft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#224B42" floodOpacity="0.18" />
            </filter>

            <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#264A42" />
              <stop offset="100%" stopColor="#19332E" />
            </linearGradient>

            <linearGradient id="cnGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7ACAB8" />
              <stop offset="100%" stopColor="#3E8F7E" />
            </linearGradient>
          </defs>

          <g filter="url(#shadowSoft)">
            <g mask="url(#ringMask)">
              <rect x="58" y="48" width="224" height="224" fill="url(#jadeBase)" />
              <rect x="58" y="48" width="224" height="224" fill="url(#jadeDepth)" />

              <ellipse cx="122" cy="101" rx="50" ry="32" transform="rotate(-24 122 101)"
                fill="url(#jadeInnerGlow)" filter="url(#blur4)" />
              <ellipse cx="195" cy="198" rx="36" ry="18" transform="rotate(-24 195 198)"
                fill="#D9FFF5" fillOpacity="0.12" filter="url(#blur8)" />

              <ellipse cx="205" cy="96" rx="20" ry="11" transform="rotate(18 205 96)"
                fill="#F3FFF9" fillOpacity="0.16" filter="url(#blur8)" />
              <ellipse cx="94" cy="186" rx="23" ry="13" transform="rotate(-12 94 186)"
                fill="#FFFFFF" fillOpacity="0.09" filter="url(#blur8)" />
              <path d="M85 144C105 130 125 131 143 143C154 151 164 151 180 143C198 134 220 136 241 152"
                stroke="#F2FFF9" strokeOpacity="0.12" strokeWidth="9" strokeLinecap="round" filter="url(#blur4)" />
            </g>

            <circle cx="170" cy="160" r="92" stroke="url(#jadeRim)" strokeWidth="20" fill="none" />
            <circle cx="170" cy="160" r="58" stroke="#F6FFFC" strokeOpacity="0.18" strokeWidth="2" fill="none" />

            <ellipse cx="121" cy="96" rx="28" ry="9" transform="rotate(-24 121 96)"
              fill="white" fillOpacity="0.68" />
            <ellipse cx="147" cy="83" rx="12" ry="4" transform="rotate(-24 147 83)"
              fill="white" fillOpacity="0.52" />
            <ellipse cx="215" cy="208" rx="20" ry="5" transform="rotate(-24 215 208)"
              fill="white" fillOpacity="0.16" />
          </g>

          <g transform="translate(118,108)">
            <text x="0" y="42"
              fontSize="46"
              fontFamily="Noto Serif SC, Songti SC, STSong, serif"
              fontWeight="600"
              fill="url(#cnGrad)"
              fillOpacity="0.95">冰</text>
            <text x="36" y="80"
              fontSize="46"
              fontFamily="Noto Serif SC, Songti SC, STSong, serif"
              fontWeight="600"
              fill="url(#cnGrad)"
              fillOpacity="0.72">冰</text>
          </g>

          <g transform="translate(315,92)">
            <text
              x="0"
              y="52"
              fontSize="56"
              fontFamily="Cormorant Garamond, Georgia, serif"
              fontWeight="600"
              letterSpacing="1.2"
              fill="currentColor"
            >
              BingBing Jade
            </text>

            <line x1="2" y1="76" x2="355" y2="76" stroke="#9ED9CB" strokeWidth="1.4" strokeOpacity="0.82" />

            <text
              x="0"
              y="116"
              fontSize="22"
              fontFamily="Inter, Helvetica, Arial, sans-serif"
              letterSpacing="4"
              fill="currentColor"
              opacity="0.7"
            >
              NATURAL JADEITE
            </text>

            <text
              x="0"
              y="154"
              fontSize="20"
              fontFamily="Noto Serif SC, Songti SC, STSong, serif"
              letterSpacing="2"
              fill="currentColor"
              opacity="0.55"
            >
              冰韵清鸣
            </text>
          </g>
        </svg>
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
            className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 transition-all duration-150 ${productsOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
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
            href="/custom-sourcing"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/custom-sourcing") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Custom Sourcing
          </Link>
        </li>
        <li>
          <Link
            href="/blog"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/blog") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Journal
          </Link>
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
        <li>
          <button
            onClick={() => { setOpen(false); setMobileProductsOpen(false); openDrawer(); }}
            aria-label={`Open cart (${count} items)`}
            className="relative p-1.5 text-gray-600 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none px-1">
                {count}
              </span>
            )}
          </button>
        </li>
      </ul>

      {/* Mobile right side */}
      <div className="flex sm:hidden items-center gap-3">
        <ThemeToggle />
        <button
          onClick={() => { setOpen(false); setMobileProductsOpen(false); openDrawer(); }}
          aria-label={`Open cart (${count} items)`}
          className="relative p-1 text-gray-600 dark:text-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none px-1">
              {count}
            </span>
          )}
        </button>
        <button
          onClick={() => { setOpen((o) => { if (!o) closeDrawer(); return !o; }); }}
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
                href="/custom-sourcing"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/custom-sourcing") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Custom Sourcing
              </Link>
            </li>
            <li>
              <Link
                href="/blog"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/blog") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Journal
              </Link>
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
