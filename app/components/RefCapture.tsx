"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Reads ?ref=CODE from the URL and stores it in localStorage for checkout pre-fill. */
export function RefCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && /^[A-Z0-9]{4,12}$/i.test(ref.trim())) {
      localStorage.setItem("bingbing_ref", ref.trim().toUpperCase());
    }
  }, [searchParams]);
  return null;
}
