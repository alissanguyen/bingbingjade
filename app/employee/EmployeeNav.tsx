"use client";

import { usePathname } from "next/navigation";
import { adminLogout } from "@/app/admin-login/actions";

/**
 * The employee portal's own navigation — deliberately not the admin
 * AdminBar/AdminBarServer component. Catalog contributors must never
 * receive the regular admin navigation (or the data it would imply access
 * to), so this is a fully separate, small component with only the links a
 * Catalog Contributor is allowed to reach.
 */
export function EmployeeNav({ employeeId, displayName }: { employeeId: string; displayName: string }) {
  const pathname = usePathname();
  const base = `/employee/${employeeId}`;

  const links = [
    { href: base, label: "Dashboard" },
    { href: `${base}/listings`, label: "My Listings" },
    { href: `${base}/add`, label: "Add Listing" },
    { href: `${base}/adjustments`, label: "Needs Adjustment" },
    { href: `${base}/pay`, label: "Payouts" },
    { href: `${base}/profile`, label: "Profile" },
  ];

  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">{displayName}</span>
            <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:inline" />
            <nav className="flex items-center gap-4 flex-wrap">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className={
                    isActive(l.href)
                      ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                      : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  }
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
          <form action={adminLogout}>
            <button type="submit" className="text-xs font-medium text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
              Log Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
