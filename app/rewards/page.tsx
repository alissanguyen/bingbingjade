import { Suspense } from "react";
import { RewardsClient } from "./RewardsClient";
import Image from "next/image";

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

  // Dashboard mode (token in URL) — centered, no image
  if (token) {
    return (
      <Suspense>
        <div className="mx-auto max-w-2xl w-full px-4 py-16 sm:py-24">
          <RewardsClient token={token} sent={false} />
        </div>
      </Suspense>
    );
  }

  // Email form / sent confirmation — full-height split screen on desktop
  return (
    <Suspense>
      <div className="flex flex-col lg:flex-row lg:min-h-[calc(100vh-5rem)]">
        {/* Left: form — top-anchored, pushed toward the image */}
        <div className="w-full lg:w-1/2 flex items-start justify-center lg:justify-end px-6 lg:pl-10 lg:pr-14 xl:pr-20 pt-12 lg:pt-16 pb-10">
          <div className="w-full max-w-md">
            <RewardsClient token={null} sent={sent === "1"} />
          </div>
        </div>

        {/* Right: image — stacks below form on mobile, side panel on desktop */}
        <div className="relative w-full h-64 sm:h-80 lg:h-auto lg:w-1/2">
          <Image
            src="/gallery/IMG_6280.jpg"
            alt="BingBing Jade"
            fill
            className="object-cover object-center"
            priority
          />
        </div>
      </div>
    </Suspense>
  );
}
