import Link from "next/link";

export const metadata = {
  title: "Checkout Cancelled",
};

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400 dark:text-gray-500"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3">
          Checkout Cancelled
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-snug">
          Your cart is still waiting.
        </h1>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-12 bg-gray-200 dark:bg-gray-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="h-px w-12 bg-gray-200 dark:bg-gray-800" />
        </div>

        <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-10">
          No payment was made. You can return to your cart whenever you&apos;re ready, or browse more pieces from our collection.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/products"
            className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-7 py-3 text-sm font-medium transition-colors"
          >
            Back to Shop
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 text-gray-700 dark:text-gray-300 px-7 py-3 text-sm font-medium transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
