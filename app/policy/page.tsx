const sections = [
  {
    title: "Purchasing",
    body: "All sales are final unless otherwise stated. By purchasing, you confirm that you have read, understood, and agreed to our shop terms before payment.",
  },
  {
    title: "Sizing Responsibility",
    body: "We may offer guidance on sizing, but the final sizing decision is the buyer’s responsibility. Please confirm your size carefully before purchasing, as incorrect sizing choices are not eligible for refund.",
  },
  {
    title: "Natural Jade Variation",
    body: "Jade may appear different under different lighting, cameras, environments, and skin tones. We do our best to show each piece as accurately as possible through multiple photos, videos, and lighting conditions. Slight differences in color, tone, glow, or texture are normal and do not count as misrepresentation.",
  },
  {
    title: "Non-Returnable Items",
    body: "Customized, altered, or made-to-order items are non-refundable. This includes bangles widened or resized to your requested fit, changes in shape or cut, products made from raw materials, custom orders, and any item marked as final sale or non-returnable. Examples include resizing a size 52 bangle into a size 53, or reshaping a D-type bangle into a round bangle and vice versa. Any item modified from its original form is considered final sale.",
  },
  {
    title: "Claims & Return Window",
    body: "Any issue, damage claim, or item-not-as-expected claim must be reported within 24 hours of confirmed delivery. No claims, returns, or refunds will be accepted after 24 hours.",
  },
  {
    title: "Unboxing Video Required",
    body: "A full, clear, uncut unboxing video is required for any claim. The video must show the unopened package, shipping label, and full unboxing in one continuous recording. Without this video, no claim, refund, or return will be accepted.",
  },
  {
    title: "Item Not as Expected",
    body: "If you believe your item is materially different from what was shown, you must notify us within 24 hours of delivery. Refunds will only be considered if the item is determined to be significantly different, at approximately 20% or more, from the listing, photos, or videos. Differences below that threshold do not qualify for refund.",
  },
  {
    title: "Refund Processing",
    body: "Any approved refund is subject to a $40 shipping/handling deduction plus a 5% restocking fee based on the item price. Refunds are only issued after the item is returned and inspected.",
  },
  {
    title: "Shipping & Delivery",
    body: "Shipping time is estimated at 10–14 business days after payment is received, excluding weekends, holidays, customs delays, weather delays, carrier delays, or other circumstances outside our control.",
  },
  {
    title: "Shipping Insurance",
    body: "Optional shipping insurance is available for an additional 5% of the item price. If insurance is declined, the buyer accepts full responsibility for any loss, theft, or damage in transit once the package has been shipped.",
  },
  {
    title: "Sales Tax",
    body: "Sales tax, if applicable, will be charged based on the delivery destination and according to applicable law.",
  },
  {
    title: "Buyer Acknowledgment",
    body: "By completing payment, you acknowledge that you have reviewed the photos and videos provided, understand that natural jade may vary in appearance, and agree to all shop terms and conditions.",
  },
];

export default function Returns() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Store Policy</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Your satisfaction is our priority. Here&apos;s everything you need to know about our store policy.
      </p>
      <div className="mt-10 space-y-8">
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{section.title}</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
