"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useCart } from "./CartContext";
import { getCategoryLabel } from "@/app/products/categories";
import Image from "next/image";
import { productMicroUrl } from "@/lib/storage";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number | null;
  image: string | null;
  onSale: boolean;
  sold: boolean;
}

const NAV_COLLECTIONS = [
  { label: "Emerald Seafoam Collection", href: "/collections/emerald-seafoam" },
  { label: "Ocean Mist Collection", href: "/collections/ocean-mist" },
];

const NAV_ALL_PIECES = [
  { href: "/products", label: "All Products" },
  { href: "/products?category=bangle", label: "Bangles" },
  { href: "/products?category=bracelet", label: "Bracelets" },
  { href: "/products?category=ring", label: "Rings & Earrings" },
  { href: "/products?category=pendant", label: "Pendants & Necklaces" },
  { href: "/products?category=set", label: "Sets" },
  { href: "/products?category=raw_material", label: "Raw Materials" },
];

const NAV_SELECTIONS = [
  { label: "Everyday Jade", href: "/products?maxPrice=699" },
  { label: "Most Loved Pieces", href: "/products?minPrice=700&maxPrice=3999" },
  { label: "Collector's Picks", href: "/products?minPrice=4000&maxPrice=9999" },
  { label: "Rare & Investment Jade", href: "/products?minPrice=10000" },
];

const NAV_SERVICES = [
  { label: "Custom Sourcing", href: "/custom-sourcing" },
  { label: "Restoration & Preservation", href: "/restoration" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { count, openDrawer, closeDrawer } = useCart();

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const fetchResults = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setSearchResults(json.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  }, []);

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    fetchResults(val);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    closeSearch();
    setOpen(false);
    router.push(`/products?search=${encodeURIComponent(q)}`);
  }

  function handleResultClick() {
    closeSearch();
    setOpen(false);
  }


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
      <ul className="hidden sm:flex items-center gap-7 text-[16px] font-medium text-gray-600 dark:text-gray-300">
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
            className={`flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/products") || pathname.startsWith("/custom-sourcing") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Shop
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
            className={`absolute top-full left-0 pt-3 z-50 transition-all duration-150 ${productsOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"
              }`}
          >
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg overflow-hidden py-3 flex items-start">
              {/* Col 1 — Featured */}
              <div className="px-2 min-w-52.5">
                <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-widest text-gray-400">Featured</p>
                <Link
                  href="/products?shipping=ship_now"
                  onClick={() => setProductsOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Ready to Ship - US 
                </Link>
                <p className="px-3 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-widest text-gray-400">The BingBing Collections</p>
                {NAV_COLLECTIONS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setProductsOpen(false)}
                    className="block ml-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-350 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="w-px bg-gray-100 dark:bg-gray-800 mx-1 self-stretch" />
              {/* Col 2 — Shop All Pieces */}
              <div className="px-2 min-w-50">
                <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-widest text-gray-400">Shop All Pieces</p>
                {NAV_ALL_PIECES.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setProductsOpen(false)}
                    className="block ml-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-350 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="w-px bg-gray-100 dark:bg-gray-800 mx-1 self-stretch" />
              {/* Col 3 — Selections + Service */}
              <div className="px-2 min-w-50">
                <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-widest text-gray-400">Selections</p>
                {NAV_SELECTIONS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setProductsOpen(false)}
                    className="block ml-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-350 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    {label}
                  </Link>
                ))}
                <div className="my-2 h-px bg-gray-100 dark:bg-gray-800 mx-3" />
                <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-widest text-gray-400">Service</p>
                {NAV_SERVICES.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setProductsOpen(false)}
                    className="block ml-2 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-250 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </li>

        <li>
          <Link
            href="/blog"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/blog") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Jade Blog
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
          <Link
            href="/rewards"
            className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/rewards" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
          >
            Rewards
          </Link>
        </li>
        <li>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search products"
            className={`p-1.5 transition-colors ${searchOpen ? "text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
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
        <button
          onClick={() => { setSearchOpen((v) => !v); setOpen(false); }}
          aria-label="Search products"
          className={`p-1 transition-colors ${searchOpen ? "text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-300"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
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

      {/* Search overlay */}
      {searchOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-xl mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            />
            {searchLoading && (
              <svg className="animate-spin text-gray-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            <button
              type="button"
              onClick={closeSearch}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </form>

          {/* Live results dropdown */}
          {searchResults.length > 0 && (
            <div className="max-w-xl mx-auto mt-2 border-t border-gray-100 dark:border-gray-800">
              {searchResults.map((r) => (
                <Link
                  key={r.id}
                  href={`/products/${r.slug}`}
                  onClick={handleResultClick}
                  className={`flex items-center gap-3 py-2.5 transition-colors rounded-lg px-1 -mx-1 ${r.sold ? "opacity-50" : "hover:bg-gray-50 dark:hover:bg-gray-900/60"}`}
                >
                  <div className="w-10 h-10 overflow-hidden bg-emerald-50 dark:bg-emerald-950 shrink-0 relative">
                    {r.image ? (
                      <Image src={productMicroUrl(r.image)} alt="" unoptimized className={`w-full h-full object-cover ${r.sold ? "grayscale" : ""}`} width={50} height={50} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🪨</div>
                    )}
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.name}</p>
                  {r.sold && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">Sold</span>
                  )}
                </Link>
              ))}
              {searchQuery.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => { const q = searchQuery.trim(); closeSearch(); setOpen(false); router.push(`/products?search=${encodeURIComponent(q)}`); }}
                  className="w-full text-left py-2 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  See all results for &quot;{searchQuery.trim()}&quot; →
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
                className={`w-full flex items-center justify-between py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/products") || pathname.startsWith("/custom-sourcing") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Shop
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
                <div className="pl-4 pb-2 border-l-2 border-emerald-100 dark:border-emerald-900 ml-1">
                  {/* Featured */}
                  <p className="pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Featured</p>
                  <Link
                    href="/products?shipping=ship_now"
                    onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                    className="flex items-center gap-2 pl-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Ready to Ship
                  </Link>
                  <p className="pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">The BingBing Collections</p>
                  <ul className="space-y-0.5 mb-2">
                    {NAV_COLLECTIONS.map(({ label, href }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                          className="block pl-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* Shop All Pieces */}
                  <p className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Shop All Pieces</p>
                  <ul className="space-y-0.5 mb-2">
                    {NAV_ALL_PIECES.map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                          className="block pl-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* Selections */}
                  <p className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Selections</p>
                  <ul className="space-y-0.5 mb-2">
                    {NAV_SELECTIONS.map(({ label, href }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                          className="block pl-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* Service */}
                  <p className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Service</p>
                  <ul className="space-y-0.5">
                    {NAV_SERVICES.map(({ label, href }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => { setOpen(false); setMobileProductsOpen(false); }}
                          className="block pl-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>

            <li>
              <Link
                href="/blog"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname.startsWith("/blog") ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Jade Blog
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
            <li>
              <Link
                href="/rewards"
                onClick={() => setOpen(false)}
                className={`block py-2 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${pathname === "/rewards" ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""}`}
              >
                Rewards
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
