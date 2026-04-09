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
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Size Guide
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find your perfect fit using our size calculators or reference charts.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <section className="min-w-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Bangles
            </h2>
            <BangleSizeGuideStandalone />
          </section>

          <section className="min-w-0">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Rings
            </h2>
            <RingSizeGuideStandalone />
          </section>
        </div>
      </div>
    </div>
  );
}