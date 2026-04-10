"use client";

import { useState } from "react";
import { adminLogout } from "@/app/admin-login/actions";
import { revalidateAll } from "@/app/admin-login/actions";

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

  // Flat list used for mobile dropdown only
  const allLinks = [
    { href: "/products-admin", label: "Products" },
    { href: "/vendors", label: "Vendors" },
    { href: "/orders-admin", label: "Orders" },
    { href: "/accounting-admin", label: "Accounting" },
    { href: "/customers-admin", label: "Customers" },
    { href: "/sourcing-admin", label: "Sourcing" },
    ...(showUsersLink ? [
      { href: "/approved-users", label: "Users" },
      { href: "/coupons-admin", label: "Coupons" },
      { href: "/subscribers-admin", label: "Subscribers" },
      { href: "/product-email-admin", label: "Product Email" },
    ] : []),
    ...(profileHref ? [{ href: profileHref, label: "Profile" }] : []),
  ];

  const linkCls = "hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap";
  const divider = <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center justify-between py-2 gap-3">

          {/* Left: grouped links */}
          <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-0 flex-wrap">

            {/* Group 1 — Catalog & Operations */}
            <a href="/products-admin" className={linkCls}>Products</a>
            <a href="/vendors" className={linkCls}>Vendors</a>
            <a href="/orders-admin" className={linkCls}>Orders</a>
            <a href="/accounting-admin" className={linkCls}>Accounting</a>
            <a href="/customers-admin" className={linkCls}>Customers</a>
            <a href="/sourcing-admin" className={linkCls}>Sourcing</a>

            {showUsersLink && (
              <>
                {divider}
                {/* Group 2 — Marketing & Users */}
                <a href="/approved-users" className={linkCls}>Users</a>
                <a href="/coupons-admin" className={linkCls}>Coupons</a>
                <a href="/subscribers-admin" className={linkCls}>Subscribers</a>
                <a href="/product-email-admin" className={linkCls}>Product Email</a>
              </>
            )}

            {profileHref && (
              <>
                {divider}
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
