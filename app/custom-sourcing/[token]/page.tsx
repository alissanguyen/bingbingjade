import { notFound } from "next/navigation";
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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ purchased?: string }>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const data = await getSourcingRequestByToken(token);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <SourcingTracker token={token} data={data} purchaseSuccess={sp.purchased === "1"} />
      </div>
    </div>
  );
}
