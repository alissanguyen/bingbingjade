"use client";

import { useRouter, usePathname } from "next/navigation";

export function BlogCategoryFilter({
  categories,
  selected,
}: {
  categories: { title: string; slug: string }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function select(slug: string) {
    if (slug) {
      router.push(`${pathname}?category=${encodeURIComponent(slug)}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        onClick={() => select("")}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          !selected
            ? "bg-emerald-700 dark:bg-emerald-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => select(cat.slug)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selected === cat.slug
              ? "bg-emerald-700 dark:bg-emerald-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {cat.title}
        </button>
      ))}
    </div>
  );
}
