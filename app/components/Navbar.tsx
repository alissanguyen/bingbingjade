"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
      <Link href="/" onClick={() => setOpen(false)}>
        <Image src="/logo.svg" alt="BingBing Jade" width={124} height={44} priority />
      </Link>

      {/* Desktop links */}
      <ul className="hidden sm:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-300">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${
                pathname === l.href ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
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
            // X icon
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Burger icon
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute top-[57px] left-0 right-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sm:hidden">
          <ul className="flex flex-col px-6 py-4 gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block py-1 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors ${
                    pathname === l.href ? "text-emerald-700 dark:text-emerald-400 font-semibold" : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
