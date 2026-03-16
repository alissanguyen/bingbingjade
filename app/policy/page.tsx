const sections = [
  {
    title: "Purchasing",
    body: "All sales are final unless otherwise stated. By completing a purchase, you confirm that you have read, understood, and agreed to our shop terms prior to payment.",
  },
  {
    title: "Authenticity Guarantee",
    body: "All jade offered on this website is natural, untreated Jadeite (Type A) and guaranteed authentic. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.",
  },
  {
    title: "Certification",
    body: "Items priced above $200 include certification. For items priced under $200, certification is available upon request for an additional $20. Certificates may be issued by Vietnamese or Chinese gemological centers and will clearly state that the jade is Type A.",
  },
  {
    title: "Sizing Responsibility",
    body: "We are happy to offer sizing guidance whenever possible, but the final sizing decision remains the buyer’s responsibility. Please confirm your size carefully before purchasing, as items ordered in the wrong size are not eligible for refund.",
  },
  {
    title: "Natural Jade Variation",
    body: "Natural jade may appear different under varying lighting, camera settings, environments, and skin tones. We make every effort to present each piece as accurately as possible through multiple photos, videos, and lighting conditions. Slight differences in color, tone, glow, translucency, or texture are a natural characteristic of jade and do not constitute misrepresentation.",
  },
  {
    title: "Custom & Non-Refundable Items",
    body: "Customized, altered, resized, reshaped, or made-to-order items are final sale and non-refundable. This includes products made from raw materials, bangles adjusted to a requested size when possible, changes in shape or cut, custom orders, and any item marked as final sale or non-returnable. Examples include increasing a size 52 bangle to a size 53, or changing a D-type bangle to a round style and vice versa. Any item modified from its original form is considered final sale.",
  },
  {
    title: "Claims & Return Window",
    body: "Any issue, damage claim, or item-not-as-expected claim must be reported within 24 hours of confirmed delivery. Claims submitted after this 24-hour window will not be accepted.",
  },
  {
    title: "Unboxing Video Requirement",
    body: "A full, clear, and uncut unboxing video is required for any claim. The video must show the unopened package, shipping label, and complete unboxing in one continuous recording. Without this documentation, no claim, refund, or return request will be accepted.",
  },
  {
    title: "Item Not as Expected",
    body: "If you believe an item is materially different from what was represented, you must notify us within 24 hours of delivery. A refund will only be considered if the item is determined to be significantly different, at approximately 20% or more, from the listing, photos, or videos provided. Minor differences or natural variation do not qualify for refund.",
  },
  {
    title: "Refund Processing",
    body: "Any approved refund is subject to a $40 shipping and handling deduction, along with a 5% restocking fee based on the item price. Refunds are issued only after the returned item has been received and inspected.",
  },
  {
    title: "Shipping & Delivery",
    body: "Standard shipping is available for a flat rate of $20. Standard overseas shipping follows a monthly schedule. Orders paid on or before the 15th of the month are included in the overseas shipment on the 20th, arrive in the U.S. around the 22nd, and typically require an additional 2–4 days for final delivery. Orders paid after the 15th will be included in the following month’s shipment and are expected to arrive in the U.S. on or around the 20th of the next month. This process helps maintain a lower shipping cost while allowing time for customs clearance and jade certification.",
  },
  {
    title: "Expedited Shipping",
    body: "Expedited shipping is available for an additional $100. With expedited shipping, your jade is sent to the U.S. immediately rather than waiting for the monthly overseas shipment schedule. This option is recommended for high-value pieces, urgent orders, or special occasions.",
  },
  {
    title: "Shipping Insurance",
    body: "Optional shipping insurance is available for an additional 5% of the item price and must be requested before shipment. While shipping issues are rare, buyers who decline insurance accept responsibility for any loss, theft, or damage that may occur in transit once the package has been shipped.",
  },
  {
    title: "Sales Tax",
    body: "Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
  },
  {
    title: "Buyer Acknowledgment",
    body: "By completing payment, you acknowledge that you have reviewed the photos and videos provided, understand the natural characteristics and variation of jade, and agree to all shop terms and conditions.",
  },
];

export default function Returns() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
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
