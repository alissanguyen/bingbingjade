"use client";

import Link from "next/link";

const STORAGE_KEY = "products_back_url";

export function ProductCardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleClick() {
    sessionStorage.setItem(STORAGE_KEY, window.location.pathname + window.location.search);
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
