"use client";

import { useState, useRef, useEffect } from "react";
import { adminLogout } from "@/app/admin-login/actions";
import { revalidateAll } from "@/app/admin-login/actions";

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function DropdownMenu({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
      >
        {label}
        <ChevronDown />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden py-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminBar({
  showUsersLink = true,
  profileHref,
}: {
  showUsersLink?: boolean;
  profileHref?: string;
}) {
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateMsg, setRevalidateMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRevalidate = async () => {
    setRevalidating(true);
    setRevalidateMsg(null);
    try {
      await revalidateAll();
      setRevalidateMsg("Cache cleared");
    } catch {
      setRevalidateMsg("Failed");
    } finally {
      setRevalidating(false);
      setTimeout(() => setRevalidateMsg(null), 3000);
    }
  };

  // Flat list for mobile dropdown
  const allLinks = [
    { href: "/products-admin", label: "Products" },
    { href: "/vendors", label: "Vendors" },
    { href: "/orders-admin", label: "Orders" },
    { href: "/customers-admin", label: "Customers" },
    { href: "/sourcing-admin", label: "Sourcing" },
    { href: "/item-origin-lookup", label: "Origin Lookup" },
    { href: "/accounting-admin", label: "Finance Snapshot" },
    { href: "/full-detailed-accounting", label: "Full Accounting" },
    ...(showUsersLink ? [
      { href: "/approved-users", label: "Users" },
      { href: "/coupons-admin", label: "Coupons" },
      { href: "/subscribers-admin", label: "Subscribers" },
      { href: "/custom-emails-admin", label: "Custom Emails" },
    ] : []),
    ...(profileHref ? [{ href: profileHref, label: "Profile" }] : []),
  ];

  const linkCls = "hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap";

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center justify-between py-2 gap-2">

          {/* Left: grouped links */}
          <div className="flex items-center gap-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-0 flex-wrap">

            {/* Group 1 — Catalog */}
            <a href="/products-admin" className={linkCls}>Products</a>
            <a href="/vendors" className={linkCls}>Vendors</a>

            <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

            {/* Group 2 — Sales & Ops */}
            <a href="/orders-admin" className={linkCls}>Orders</a>
            <a href="/customers-admin" className={linkCls}>Customers</a>
            <a href="/sourcing-admin" className={linkCls}>Sourcing</a>
            <a href="/item-origin-lookup" className={linkCls}>Origin Lookup</a>

            <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />

            {/* Group 3 — Finance (dropdown) */}
            <DropdownMenu
              label="Finance"
              links={[
                { href: "/accounting-admin", label: "Finance Snapshot" },
                { href: "/full-detailed-accounting", label: "Full Accounting Details" },
              ]}
            />

            {showUsersLink && (
              <>
                <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
                {/* Group 4 — Marketing & Users (dropdown) */}
                <DropdownMenu
                  label="More"
                  links={[
                    { href: "/approved-users", label: "Users" },
                    { href: "/coupons-admin", label: "Coupons" },
                    { href: "/subscribers-admin", label: "Subscribers" },
                    { href: "/custom-emails-admin", label: "Custom Emails" },
                    ...(profileHref ? [{ href: profileHref, label: "Profile" }] : []),
                  ]}
                />
              </>
            )}

            {!showUsersLink && profileHref && (
              <>
                <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
                <a href={profileHref} className={linkCls}>Profile</a>
              </>
            )}
          </div>

          {/* Right: utility actions */}
          <div className="flex items-center gap-3 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={handleRevalidate}
              disabled={revalidating}
              className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {revalidating ? "Clearing…" : revalidateMsg ?? "Clear Cache"}
            </button>
            <form action={adminLogout}>
              <button type="submit" className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                Log out
              </button>
            </form>
          </div>

        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
            Admin
          </button>
          <form action={adminLogout}>
            <button type="submit" className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
              Log out
            </button>
          </form>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden pb-3 space-y-0.5 border-t border-gray-100 dark:border-gray-800 pt-2">
            {allLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => { handleRevalidate(); setMenuOpen(false); }}
              disabled={revalidating}
              className="block w-full text-left px-2 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {revalidating ? "Clearing…" : revalidateMsg ?? "Clear Cache"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
