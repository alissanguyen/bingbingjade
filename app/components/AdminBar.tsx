"use client";

import { useState } from "react";
import { adminLogout } from "@/app/admin-login/actions";
import { revalidateAll } from "@/app/admin-login/actions";

export function AdminBar({ showUsersLink = true }: { showUsersLink?: boolean }) {
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateMsg, setRevalidateMsg] = useState<string | null>(null);

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

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-5xl px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
          <a href="/products-admin" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Products</a>
          <a href="/vendors" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Vendors</a>
          <a href="/orders-admin" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Orders</a>
          <a href="/customers-admin" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Customers</a>
          {showUsersLink && (
            <a href="/approved-users" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Users</a>
          )}
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
          <button type="submit" className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
