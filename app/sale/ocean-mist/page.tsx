import type { Metadata } from "next";
import { ComingSoonPage } from "@/app/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Ocean Mist Collection — BingBing Jade",
};

export default function OceanMistPage() {
  return (
    <ComingSoonPage
      title="Ocean Mist Collection"
      subtitle="Soft, translucent jadeite with the serene clarity of morning mist over water. Coming soon."
    />
  );
}
