import { Suspense } from "react";
import { RewardsClient } from "./RewardsClient";

export const metadata = {
  title: "Client Rewards — BingBing Jade",
  description: "Look up your referral credit and private client benefits.",
};

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { token, sent } = await searchParams;
  return (
    <Suspense>
      <RewardsClient token={token ?? null} sent={sent === "1"} />
    </Suspense>
  );
}
