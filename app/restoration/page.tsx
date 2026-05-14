import type { Metadata } from "next";
import { ComingSoonPage } from "@/app/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Restoration & Preservation — BingBing Jade",
};

export default function RestorationPage() {
  return (
    <ComingSoonPage
      title="Restoration & Preservation"
      subtitle="Expert care and restoration services for your jade pieces. More details coming soon."
    />
  );
}
