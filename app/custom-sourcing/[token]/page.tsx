import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSourcingRequestByToken } from "@/lib/sourcing-workflow";
import { SourcingTracker } from "./SourcingTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Sourcing Request — BingBing Jade",
  robots: { index: false, follow: false },
};

export default async function CustomerSourcingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getSourcingRequestByToken(token);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            BingBing Jade
          </Link>
          <span className="text-xs text-gray-400 dark:text-gray-500">Custom Sourcing Request</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <SourcingTracker token={token} data={data} />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>&copy; {new Date().getFullYear()} BingBing Jade</span>
          <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
