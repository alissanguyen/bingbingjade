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
    body: "All jade offered on this website is natural, untreated Jadeite (Type A) and guaranteed authentic. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.",
  },
  {
    id: "certification",
    title: "Certification",
    body: "Every piece includes certification, verifying that your jade is natural Type A jadeite — untreated and genuine. Certificates are issued by recognized Vietnamese or Chinese gemological centers, providing full transparency and confidence in your purchase.",
  },
  {
    id: "sizing-responsibility",
    title: "Sizing Responsibility",
    body: "We are happy to offer sizing guidance whenever possible, but the final sizing decision remains the buyer's responsibility. Please confirm your size carefully before purchasing, as pieces selected in the wrong size are not eligible for return or refund.",
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
    body: "Returns or exchanges may be considered for eligible pieces if requested within 24–48 hours of confirmed delivery. All requests are subject to review. Approved returns may be subject to a 10% restocking fee, along with original and return shipping costs. Items must be returned in original, unworn condition.",
  },
  {
    id: "claims",
    title: "Claims",
    body: "Any issue involving damage, delivery condition, or an item believed to differ materially from what was presented must be reported within 24 hours of confirmed delivery. To be eligible for review, a full, clear, uncut unboxing video is required and must show the unopened package, shipping label, and complete unboxing in one continuous recording.",
  },
  {
    id: "item-representation",
    title: "Item Representation",
    body: "If you believe an item differs materially from what was shown, you must notify us within 24 hours of delivery. A refund will only be considered if the item is determined to be significantly different, at approximately 20% or more, from the listing, photos, or videos provided. Minor differences and natural variation do not qualify for refund.",
  },
  {
    id: "refund-processing",
    title: "Refund Processing",
    body: "Refunds are issued only after the returned item has been received, re-verified, and inspected. Returned items may be reviewed for certification again to confirm authenticity and ensure the same piece has been returned. This process may take approximately 2–4 weeks. For approved non-custom returns or exchanges, a 10% restocking fee, original shipping charges, and return shipping costs apply. Shipping charges in both directions are non-refundable.",
  },
  {
    id: "lifetime-type-a-guarantee",
    title: "Lifetime Type A Guarantee",
    body: "All jade sold on this website is backed by a lifetime Type A Jadeite guarantee. If a client has a piece professionally tested at any time and believes it may be Type B, they may submit a claim and return the item for re-certification and verification. If the returned certification confirms the piece is Type B, a refund will be issued. This process may take approximately 3–4 weeks. This is the only circumstance in which shipping charges are refundable in full.",
  },
  {
    id: "shipping-delivery",
    title: "Shipping & Delivery",
    body: "Orders are carefully prepared, processed, and shipped within an estimated timeframe of 2–4 weeks. This includes quality inspection, certification, and international handling when applicable. Once dispatched, your order will continue to its final destination. We prioritize care and accuracy at every step to ensure your piece arrives safely.",
  },
  {
    id: "expedited-shipping",
    title: "Expedited Shipping",
    body: "Expedited shipping is available for an additional $100. With this option, your piece is prioritized and dispatched without delay. This is recommended for time-sensitive orders, high-value pieces, or special occasions.",
  },
  {
    id: "shipping-insurance",
    title: "Shipping Insurance",
    body: "Optional shipping insurance is available for an additional 5% of the item price and must be requested before shipment. While shipping issues are rare, buyers who decline insurance accept responsibility for any loss, theft, or damage that may occur in transit once the package has been shipped.",
  },
  {
    id: "payment-tax",
    title: "Payment & Tax",
    body: "We accept payment via our website or PayPal Goods & Services (a 3.5% processing fee applies), as well as PayPal Friends & Family, Zelle, Venmo, and wire transfer. Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Store Policy</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Your satisfaction is our priority. Here&apos;s everything you need to know about our store policy.
      </p>
      <div className="mt-10">
        <Accordion items={sections.map((s) => ({ id: s.id, heading: s.title, content: s.body }))} />
      </div>
    </div>
  );
}
