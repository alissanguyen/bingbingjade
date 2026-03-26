"use client";

import { usePathname } from "next/navigation";
import { CategoryBar } from "./CategoryBar";

export function ConditionalCategoryBar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/orders-admin") ||
    pathname.startsWith("/customers-admin") ||
    pathname.startsWith("/edit") ||
    pathname.startsWith("/admin");
  if (isAdmin) return null;
  return <CategoryBar />;
}
