"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface ProductStub {
  id: string;
  name: string;
  category: string;
  images: string[];
}

export function ProductSearch({ products }: { products: ProductStub[] }) {
  const [query, setQuery] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name…"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
      />

      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-gray-400 dark:text-gray-600">No products match your search.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <Link
              key={product.id}
              href={`/edit/${product.id}`}
              className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all"
            >
              <div className="aspect-square w-full bg-emerald-50 dark:bg-emerald-950 overflow-hidden relative">
                {product.images?.[0] ? (
                  <Image src={product.images[0]} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="200px" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🪨</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{product.category}</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{product.name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
