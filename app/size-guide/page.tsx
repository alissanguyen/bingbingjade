import type { Metadata } from "next";
import { BangleSizeGuideStandalone } from "@/app/components/BangleSizeGuide";
import { RingSizeGuideStandalone } from "@/app/components/RingSizeGuide";

export const metadata: Metadata = {
  title: "Size Guide — BingBing Jade",
  description: "Find your perfect bangle or ring size using our calculators and size charts.",
};

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-12">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Size Guide</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find your perfect fit using our size calculators or reference charts.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Bangles</h2>
          <BangleSizeGuideStandalone />
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Rings</h2>
          <RingSizeGuideStandalone />
        </section>
      </div>
    </div>
  );
}
