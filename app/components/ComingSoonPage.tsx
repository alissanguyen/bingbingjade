import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
}

export function ComingSoonPage({ title, subtitle }: Props) {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center bg-white dark:bg-gray-950">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-5">
        Coming Soon
      </p>

      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 max-w-xl">
        {title}
      </h1>

      {subtitle && (
        <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-10">
          {subtitle}
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors"
        >
          ← Back to Home
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 text-sm font-medium transition-colors"
        >
          Shop All Pieces
        </Link>
      </div>
    </main>
  );
}
