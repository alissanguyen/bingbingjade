import type { Metadata } from "next";
import SourcingForm from "./SourcingForm";

export const metadata: Metadata = {
  title: "Custom Sourcing — BingBing Jade",
  description:
    "Tell us what you're looking for and we'll hand-source the perfect jadeite piece for you. Standard and premium sourcing available.",
  robots: { index: true, follow: true },
};

export default function CustomSourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  void searchParams; // consumed by client component via URL
  return <SourcingForm />;
}
