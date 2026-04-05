import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSourcingRequestByToken } from "@/lib/sourcing-workflow";
import { SourcingTracker } from "./SourcingTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Custom Sourcing Request — BingBing Jade",
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
    <div className="min-h-screen  ">
      {/* Top bar */}
      <h1 className="text-2xl mx-auto max-w-3xl sm:px-6 pt-10 font-bold text-gray-900 dark:text-gray-100 mt-6">Your Custom Sourcing Request</h1>

      <div className="mx-auto max-w-3xl px-4 py-10">
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
