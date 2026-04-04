import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sourcing Request Confirmed — BingBing Jade",
  robots: { index: false, follow: false },
};

export default async function SourcingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const isBot = session_id === "bot";

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0d0d0d] flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">
            Deposit Received
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {isBot ? "Request received." : "Your sourcing request is confirmed!"}
          </h1>
          {!isBot && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Thank you for your deposit. We&apos;ll review your preferences and begin sourcing candidates. Expect to hear from us within <strong>3–5 business days</strong>.
            </p>
          )}
        </div>

        {!isBot && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 text-left space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">What happens next</h2>
            <ol className="space-y-2.5">
              {[
                "We review your preferences and strictness requirements.",
                "We source 1–3 candidate pieces that match your criteria.",
                "We send you photos, videos, and certification details via email.",
                "You choose your favourite — your deposit applies as credit.",
                "If nothing fits, your deposit remains as store credit (valid 1 year).",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="rounded-xl border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>Save your email address</strong> — we&apos;ll reference it when you&apos;re ready to apply your credit at checkout. Your sourcing request ID was sent to your email.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/products"
            className="rounded-full border border-gray-200 dark:border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            Browse Products
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-emerald-300 dark:border-emerald-700 px-6 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
