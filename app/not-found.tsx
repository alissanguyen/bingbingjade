import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      {/* Jade stone illustration */}
      <div className="relative mb-8 select-none">
        <span className="text-[96px] leading-none">🪨</span>
        <span className="absolute -bottom-1 -right-2 text-4xl leading-none">404</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        This piece is gone
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist — it may have been sold, moved, or never listed.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Back to home
        </Link>
        <Link
          href="/products"
          className="rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Browse collection
        </Link>
      </div>
    </div>
  );
}
