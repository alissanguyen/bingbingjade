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

  const links = [
    { href: "/products-admin", label: "Products" },
    { href: "/vendors", label: "Vendors" },
    { href: "/orders-admin", label: "Orders" },
    { href: "/accounting-admin", label: "Accounting" },
    { href: "/customers-admin", label: "Customers" },
    { href: "/sourcing-admin", label: "Custom Sourcing" },
    ...(showUsersLink ? [
      { href: "/approved-users", label: "Users" },
      { href: "/coupons-admin", label: "Coupons" },
      { href: "/subscribers-admin", label: "Subscribers" },
      { href: "/product-email-admin", label: "Product Email" },
    ] : []),
    ...(profileHref ? [{ href: profileHref, label: "Profile" }] : []),
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center justify-between py-2">
          <div className="flex items-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleRevalidate}
              disabled={revalidating}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {revalidating ? "Clearing…" : revalidateMsg ?? "Clear Cache"}
            </button>
          </div>
          <form action={adminLogout}>
            <button type="submit" className="text-sm text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
              Log out
            </button>
          </form>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-[12px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
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
            <button type="submit" className="text-[12px] sm:text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
              Log out
            </button>
          </form>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden pb-3 space-y-0.5 border-t border-gray-100 dark:border-gray-800 pt-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2 text-[12px] sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => { handleRevalidate(); setMenuOpen(false); }}
              disabled={revalidating}
              className="block w-full text-left px-2 py-2 text-[12px] sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {revalidating ? "Clearing…" : revalidateMsg ?? "Clear Cache"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
