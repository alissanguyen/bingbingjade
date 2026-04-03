import type { Metadata } from "next";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Review Your Order — BingBing Jade",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
