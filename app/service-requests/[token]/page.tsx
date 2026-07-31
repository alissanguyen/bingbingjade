import type { Metadata } from "next";
import { ServiceRequestTrackerClient } from "./ServiceRequestTrackerClient";

export const metadata: Metadata = {
  title: "Track Your Service Request — BingBing Jade",
  robots: { index: false, follow: false },
};

export default async function ServiceRequestTrackerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ServiceRequestTrackerClient token={token} />;
}
