import Link from "next/link";

export const metadata = {
  title: "Checkout Cancelled",
};

export default function CheckoutCancelPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="relative mb-6 select-none">
        <span className="text-7xl">🪨</span>
        <span className="absolute -bottom-1 -right-2 text-3xl leading-none">✕</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        Checkout Cancelled
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        No worries — your cart is still saved. You can go back and complete your purchase whenever you&apos;re ready.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/products"
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Back to Shop
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
