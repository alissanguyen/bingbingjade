import type { Metadata } from "next";
import { ComingSoonPage } from "@/app/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Emerald Seafoam Collection — BingBing Jade",
};

export default function EmeraldSeafoamPage() {
  return (
    <ComingSoonPage
      title="Emerald Seafoam Collection"
      subtitle="A curated selection of vivid emerald-green jadeite pieces inspired by the colors of the sea. Check back soon."
    />
  );
}
