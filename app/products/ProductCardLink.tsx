"use client";

import Link from "next/link";

const STORAGE_KEY = "products_back_url";

export function ProductCardLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  function handleClick() {
    sessionStorage.setItem(STORAGE_KEY, window.location.pathname + window.location.search);
  }

  return (
    <Link href={href} className={className} style={style} onClick={handleClick}>
      {children}
    </Link>
  );
}
