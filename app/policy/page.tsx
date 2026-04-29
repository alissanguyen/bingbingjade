import { Accordion } from "@/app/components/Accordion";

const sections = [
  {
    id: "purchasing",
    title: "Purchasing",
    body: "Because jade is natural, limited, and often one-of-one, each purchase is subject to the shop terms below. By completing payment, you confirm that you have reviewed the item photos, videos, description, sizing details, pricing, and applicable order type before purchase.",
  },
  {
    id: "authenticity-guarantee",
    title: "Authenticity Guarantee",
    body: "All jade offered on this website is natural Jadeite and is backed by our lifetime authenticity guarantee. BingBing Jade does not sell dyed jade. If a piece has any disclosed treatment, such as heat treatment, this will be clearly stated before purchase. We do not sell jade treated with dye, bleaching, polymer infusion, or undisclosed chemical enhancement.",
  },
  {
    id: "certification",
    title: "Certification",
    body: "We offer certification from trusted independent gemological laboratories, and every piece is backed by our lifetime authenticity guarantee. GIA or NGTC certification may also be requested at additional cost when available. Pieces above $5,000 include NGTC or GIA certificate as a complimentary. Certification timelines may vary depending on the item, lab, and shipping route.",
  },
  {
    id: "ship-now-orders",
    title: "Ship Now Orders",
    body: "Items labeled “Ship Now” are pieces we currently have in our U.S. inventory and are ready to ship. Eligible Ship Now pieces may be considered for return or exchange if requested within 24–48 hours of confirmed delivery. Approved returns must be unworn, unaltered, and returned in the same condition received with all included packaging, certificates, and accessories. A restocking fee, original shipping, payment processing fees, and return shipping costs may apply.",
  },
  {
    id: "sourced-for-you-orders",
    title: "Sourced For You Orders",
    body: "Items labeled “Sourced for You” are curated special-order pieces from our trusted supplier network. These pieces may be listed because BingBing Jade believes they meet our standards for quality, value, beauty, uniqueness, or market availability, but they may not be held in our U.S. inventory at the time of purchase. Sourced For You pieces may require additional time for availability confirmation, vendor coordination, quality review, certification when applicable, international handling, and final fulfillment. Once approved and processed, the item may be reserved, purchased, inspected, certified, or prepared specifically for that order. For this reason, Sourced For You orders are not eligible for change-of-mind returns, cancellations, or exchanges. However, if a sourced item arrives damaged, incorrect, or materially different from what was shown and approved, please contact us within 24 hours of delivery so we can review the concern."
  },
  {
    id: "sizing-responsibility",
    title: "Sizing Responsibility",
    body: "We are happy to provide sizing guidance whenever possible, and a sizing guide is available in the footer as well as on individual bangle and ring product pages. Final size selection remains the buyer’s responsibility. Wrong-size purchases, fit preferences, or changes of mind related to sizing are not considered item defects or misrepresentation.",
  },
  {
    id: "natural-variation",
    title: "Natural Variation",
    body: "Natural jade may appear different under varying lighting, camera settings, environments, and skin tones. We make every effort to present each piece as accurately as possible through multiple photos, videos, and lighting conditions. Slight differences in color, tone, glow, translucency, texture, cotton, crystal structure, stone lines, or natural minor inclusions are normal characteristics of jade and do not constitute damage or misrepresentation.",
  },
  {
    id: "custom-altered-pieces",
    title: "Custom, Resized & Altered Pieces",
    body: "Customized, altered, resized, reshaped, made-to-order, specially requested, or modified pieces are final sale and are not eligible for change-of-mind return, exchange, or refund. This includes products made from raw materials, bangles adjusted to a requested size when possible, changes in shape or cut, and all custom orders. If a custom or altered piece arrives damaged, incorrect, or materially different from the approved details, please contact us within 24 hours of delivery for review.",
  },
  {
    id: "returns-exchanges",
    title: "Returns & Exchanges",
    body: "Return eligibility depends on the order type. Ship Now pieces may be considered for return or exchange within 24–48 hours of confirmed delivery if they are unworn, unaltered, and in original condition. Sourced For You, custom, resized, altered, final sale, and specially requested pieces are not eligible for change-of-mind returns. All return requests are reviewed on a case by case basis to protect our buyers and make sure we handle issues accordingly.",
  },
  {
    id: "damage-claims",
    title: "Damage, Incorrect Item & Not-As-Described Claims",
    body: "If your item arrives damaged, incorrect, or materially different from what was shown and approved, please contact us within 24 hours of confirmed delivery. Please include clear photos of the item, inner and outer packaging, shipping label, and any visible package damage. An unboxing video is strongly recommended because it helps us review shipping damage, missing items, or packaging concerns faster, but each case is reviewed fairly based on all available evidence.",
  },
  {
    id: "claim-review",
    title: "Claim Review Process",
    body: "All pieces are documented before shipment. Claims may be reviewed against our pre-shipment photos/videos, item records, packaging records, certificate details, carrier scans, and any customer-provided photos or videos. Damage caused after delivery, including dropping, impact, improper handling, wear, storage issues, attempted resizing, alteration, or third-party repair, is not covered unless shipping insurance was added for your order at checkout.",
  },
  {
    id: "item-representation",
    title: "Item Representation",
    body: "If you believe an item differs materially from what was shown, please notify us within 24 hours of delivery. Material differences may include receiving the wrong item, undisclosed major damage, or a clear mismatch from the approved item details. Minor lighting differences, natural jade variation, personal preference, size regret, or expected natural crystal structure or inclusions do not qualify as misrepresentation.",
  },
  {
    id: "return-condition",
    title: "Return Condition",
    body: "Approved returns must be shipped back in the same condition received, unworn and unaltered, with all original packaging, certificates, accessories, and gifts included. Items returned damaged, worn, altered, missing components, or different from the original shipped item may be rejected or subject to a partial refund at our discretion.",
  },
  {
    id: "refund-processing",
    title: "Refund Processing",
    body: "Refunds are issued only after the returned item has been received, inspected, and confirmed to qualify under our shop terms. In certain cases, additional verification or re-certification may be required to confirm authenticity, condition, and that the same piece has been returned. Original shipping, return shipping, payment processing fees, insurance fees, expedited service fees, certification fees, and restocking fees may be non-refundable unless otherwise required by law.",
  },
  {
    id: "lifetime-type-a-guarantee",
    title: "Lifetime Type A Guarantee",
    body: "All jade sold as Type A Jadeite on this website is backed by a lifetime Type A Jadeite guarantee. If a client has a piece professionally tested at any time and believes it may not match our authenticity guarantee, they may contact us and submit the item for review, re-certification, and verification. If the final verified results confirm the item was not as guaranteed, an appropriate resolution or refund will be issued.",
  },
  {
    id: "shipping-delivery",
    title: "Shipping & Delivery",
    body: "Items labeled “Ship Now” are in our U.S. inventory and typically ship within 2–5 business days. Pieces labeled “Sourced for You” are special-order pieces sourced through our supplier network and typically have an estimated delivery timeframe of 2–4 weeks. This timeline allows for logistic coordination, quality review, certification when applicable, international handling, and final fulfillment. Some sourced pieces may ship through our fulfillment partners rather than directly from our U.S. inventory. Delivery estimates are not guaranteed and may vary due to customs, carrier delays, holidays, weather, supplier timelines, or circumstances outside our control."
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
    id: "high-value-orders",
    title: "High-Value Orders",
    body: "For high-value orders, additional verification, insured shipping, signature confirmation, identity confirmation, wire transfer, or special handling may be required. BingBing Jade reserves the right to require additional documentation or decline a transaction when necessary to protect both the buyer and the business.",
  },
  {
    id: "payment-tax",
    title: "Payment & Tax",
    body: "We accept payment via Stripe through our website or through manual Stripe invoices, as well as Zelle and wire transfer. Payments processed through our website may be subject to transaction fees. No other payment methods are accepted. Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
  },
  {
    id: "buyer-acknowledgment",
    title: "Buyer Acknowledgment",
    body: "By completing payment, you acknowledge that you have reviewed the item photos, videos, description, size details, order type, estimated timeline, and shop terms. You understand that jade is a natural gemstone with natural variation, and you agree to contact us promptly within the stated timeframe if there is an issue with your order.",
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
