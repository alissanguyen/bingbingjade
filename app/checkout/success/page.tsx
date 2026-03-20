import Link from "next/link";
import { ClearCartOnSuccess } from "./ClearCartOnSuccess";

export const metadata = {
  title: "Order Confirmed",
};

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <ClearCartOnSuccess />

      <div className="w-full max-w-lg text-center">
        {/* Checkmark icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600 dark:text-emerald-400"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500 mb-3">
          Order Confirmed
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-snug">
          Thank you for your purchase.
        </h1>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-12 bg-emerald-200 dark:bg-emerald-800" />
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400 dark:text-emerald-600">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div className="h-px w-12 bg-emerald-200 dark:bg-emerald-800" />
        </div>

        {/* Body */}
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
          We&apos;ll reach out within 24–48 hours to arrange shipping and confirm your order details.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed mb-10">
          A receipt has been sent to your email by Stripe. If you have any questions in the meantime, please don&apos;t hesitate to reach out.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/products"
            className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-7 py-3 text-sm font-medium transition-colors"
          >
            Continue Browsing
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
