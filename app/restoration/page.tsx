import type { Metadata } from "next";
import { RestorationClient } from "./RestorationClient";

export const metadata: Metadata = {
  title: "Jade Bangle Preservation Services — BingBing Jade",
  description:
    "Professional jade bangle polishing and protective silver or gold metal wrapping. Thoughtful preservation for pieces worth keeping.",
};

export default async function RestorationPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  return <RestorationClient checkoutSuccess={checkout === "success"} />;
}
