import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Confirmed — BingBing Jade",
  robots: { index: false, follow: false },
};

export default async function SourcingOfferSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          {/* Green header */}
          <div className="bg-emerald-700 px-8 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-[0.15em] mb-1">Payment Received</p>
            <h1 className="text-2xl font-bold text-white">Order Confirmed</h1>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center space-y-4">
            <p className="text-base text-gray-700 dark:text-gray-300">
              Thank you! Your payment has been received and your order is confirmed.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We'll be in touch with shipping and tracking details. Your jade piece will be carefully packaged and shipped to you.
            </p>

            <div className="pt-2 space-y-2">
              <Link
                href={`/custom-sourcing/${token}`}
                className="block w-full px-4 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-center"
              >
                View My Request
              </Link>
              <Link
                href="/"
                className="block w-full px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-center"
              >
                Return to BingBing Jade
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Questions? <Link href="/contact" className="text-emerald-600 dark:text-emerald-400 hover:underline">Contact us</Link>
        </p>
      </div>
    </div>
  );
}
