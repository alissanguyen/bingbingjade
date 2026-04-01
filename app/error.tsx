"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="relative mb-8 select-none">
        <span className="text-[96px] leading-none">🪨</span>
        <span className="absolute -bottom-1 -right-3 text-3xl leading-none">!</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        Something went wrong
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        An unexpected error occurred. You can try again or head back to browse the collection.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
