import type { Metadata } from "next";
import { BangleSizeGuideStandalone } from "@/app/components/BangleSizeGuide";

export const metadata: Metadata = {
  title: "Bangle Size Guide — BingBing Jade",
  description: "Find your perfect bangle size using our calculator and size chart. Measure your palm width or hand circumference to get the right fit.",
};

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Bangle Size Guide</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find your perfect fit using our size calculator or reference chart.
          </p>
        </div>
        <BangleSizeGuideStandalone />
      </div>
    </div>
  );
}
