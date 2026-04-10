import { Accordion } from "@/app/components/Accordion";

const sections = [
  {
    id: "purchasing",
    title: "Purchasing",
    body: "Due to the nature of our pieces, all sales are considered final unless otherwise stated. By completing a purchase, you confirm that you have read, understood, and agreed to our shop terms prior to payment.",
  },
  {
    id: "authenticity-guarantee",
    title: "Authenticity Guarantee",
    body: "All jade offered on this website is natural, untreated Jadeite (Type A) and is backed by our lifetime authenticity guarantee. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.",
  },
  {
    id: "certification",
    title: "Certification",
    body: "We offer certification from trusted independent gemological laboratories, and every piece is backed by our lifetime authenticity guarantee. GIA or NGTC certification may also be requested at additional cost. Please contact us for more details.",
  },
  {
    id: "sizing-responsibility",
    title: "Sizing Responsibility",
    body: "We are happy to provide sizing guidance whenever possible, and a sizing guide is available in the footer as well as on individual bangle and ring product pages. Final size selection remains the buyer’s responsibility, and we recommend confirming your fit carefully before purchase.",
  },
  {
    id: "natural-variation",
    title: "Natural Variation",
    body: "Natural jade may appear different under varying lighting, camera settings, environments, and skin tones. We make every effort to present each piece as accurately as possible through multiple photos, videos, and lighting conditions. Slight differences in color, tone, glow, translucency, or texture are natural characteristics of jade and do not constitute misrepresentation.",
  },
  {
    id: "custom-altered-pieces",
    title: "Custom & Altered Pieces",
    body: "Customized, altered, resized, reshaped, or made-to-order pieces are final sale and are not eligible for return, exchange, or refund. This includes products made from raw materials, bangles adjusted to a requested size when possible, changes in shape or cut, and all custom orders. Any piece modified from its original form is considered final sale.",
  },
  {
    id: "returns-exchanges",
    title: "Returns & Exchanges",
    body: "Returns or exchanges may be considered for eligible pieces if requested within 24–48 hours of confirmed delivery. All requests are subject to review. Approved returns may be subject to a restocking fee, along with original and return shipping costs. Items must be returned in original, unworn condition.",
  },
  {
    id: "claims",
    title: "Claims",
    body: "Any issue involving damage, delivery condition, or an item believed to differ materially from what was presented must be reported within 24 hours of confirmed delivery. To be eligible for review, a full, clear, uncut unboxing video is required and must show the unopened package, shipping label, and complete unboxing in one continuous recording.",
  },
  {
    id: "item-representation",
    title: "Item Representation",
    body: "If you believe an item differs materially from what was shown, you must notify us within 24 hours of delivery. Minor differences and natural variation do not qualify for return or refund.",
  },
  {
    id: "refund-processing",
    title: "Refund Processing",
    body: "Refunds are issued only after the returned item has been received, re-examined, and confirmed to qualify under our shop terms. In certain cases, additional verification or re-certification may be required to confirm authenticity and ensure the same piece has been returned.",
  },
  {
    id: "lifetime-type-a-guarantee",
    title: "Lifetime Type A Guarantee",
    body: "All jade sold on this website is backed by a lifetime Type A Jadeite guarantee. If a client has a piece professionally tested at any time and believes it may not be Type A, they may contact us and submit the item for review, re-certification, and verification. If the returned results confirm otherwise, a refund will be issued.",
  },
  {
    id: "shipping-delivery",
    title: "Shipping & Delivery",
    body: "Items labeled “Available Now” are in our U.S. inventory and typically ship within 2–5 business days, offering a faster and more convenient delivery experience. Pieces labeled “Sourced for You” are carefully selected and prepared upon order, with an estimated delivery timeframe of 2–4 weeks. This allows for quality inspection, certification, and international handling when applicable. We prioritize care and accuracy at every step to ensure your piece arrives safely.",
  },
  {
    id: "expedited-shipping",
    title: "Expedited Sourcing & Shipping",
    body: "Expedited shipping is available for “Sourced for You” items for $100 (plus $10 per additional item). With this option, your piece is prioritized and dispatched without delay. This is recommended for time-sensitive orders, high-value pieces, or special occasions.",
  },
  {
    id: "shipping-insurance",
    title: "Shipping Insurance",
    body: "Optional shipping insurance is available for an additional fee and must be requested before shipment. While shipping issues are rare, buyers who decline insurance accept responsibility for any loss, theft, or damage that may occur in transit once the package has been shipped.",
  },
  {
    id: "payment-tax",
    title: "Payment & Tax",
    body: "We accept payment via Stripe through our website or through manual Stripe invoices, as well as Zelle and wire transfer. Payments processed through our website may be subject to transaction fees. No other payment methods are accepted. Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
  },
  {
    id: "buyer-acknowledgment",
    title: "Buyer Acknowledgment",
    body: "By completing payment, you acknowledge that you have reviewed the photos and videos provided, understand the natural characteristics and variation of jade, and agree to all shop terms and conditions.",
  },
];

export default function Returns() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Store Policy</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-md">
        Your satisfaction is our priority. Here&apos;s everything you need to know about our store policy.
      </p>
      <div className="mt-10">
        <Accordion items={sections.map((s) => ({ id: s.id, heading: s.title, content: s.body }))} />
      </div>
    </div>
  );
}
