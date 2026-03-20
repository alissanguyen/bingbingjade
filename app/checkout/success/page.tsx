import Link from "next/link";
import { ClearCartOnSuccess } from "./ClearCartOnSuccess";

export const metadata = {
  title: "Order Confirmed",
};

export default function CheckoutSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <ClearCartOnSuccess />

      <div className="relative mb-6 select-none">
        <span className="text-7xl">🪨</span>
        <span className="absolute -bottom-1 -right-2 text-3xl leading-none">✓</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        Order Confirmed!
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-3">
        Thank you for your purchase. We&apos;ll reach out within 24–48 hours to arrange shipping and confirm your order details.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mb-8">
        A confirmation email will be sent by Stripe. If you have questions, feel free to contact us via WhatsApp or the contact form.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/products"
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Continue Browsing
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
