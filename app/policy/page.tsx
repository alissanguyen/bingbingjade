import { Accordion } from "@/app/components/Accordion";

const sections = [
  {
    id: "purchasing",
    title: "Purchasing",
    body: "Because jade is natural, limited, and often one-of-one, each purchase is subject to the shop terms below. By completing payment, you confirm that you have reviewed the item photos, videos, description, sizing details, pricing, order type, and estimated timeline before purchase.",
  },
  {
    id: "authenticity-guarantee",
    title: "Authenticity Guarantee",
    body: "All jade offered by BingBing Jade is natural Jadeite and backed by our lifetime authenticity guarantee. We do not sell dyed jade. If a piece has any disclosed treatment, such as heat treatment, it will be clearly stated before purchase. We do not sell jade treated with dye, bleaching, polymer infusion, or undisclosed chemical enhancement.",
  },
  {
    id: "certification",
    title: "Certification",
    body: "We offer certification from trusted independent gemological laboratories, and every piece is backed by our lifetime authenticity guarantee. GIA or NGTC certification may also be requested at additional cost when available. Pieces above $5,000 may include NGTC or GIA certification as part of the purchase. Certification timelines may vary depending on the piece and lab availability.",
  },
  {
    id: "ship-now-orders",
    title: "Ship Now Orders",
    body: "Items labeled “Ship Now” are held in our U.S. inventory and are ready for domestic fulfillment. Eligible Ship Now pieces may be considered for return or exchange if requested within 24–48 hours of confirmed delivery. Approved returns must be unworn, unaltered, and returned in the same condition received with all included packaging, certificates, and accessories. A restocking fee, original shipping, payment processing fees, and return shipping costs may apply.",
  },
  {
    id: "sourced-for-you-orders",
    title: "Sourced For You Orders",
    body: "Items labeled “Sourced for You” are curated special-order pieces made available through our trusted sourcing network. These pieces allow us to offer a wider and more selective range of jade beyond our U.S. inventory. Once a Sourced For You order is approved and processed, the piece may be reserved, prepared, certified, or fulfilled specifically for that order. For this reason, Sourced For You orders are not eligible for change-of-mind returns, cancellations, or exchanges. If a sourced item arrives damaged, incorrect, or materially different from what was shown and approved, please contact us within 24 hours of delivery for review.",
  },
  {
    id: "sizing-responsibility",
    title: "Sizing Responsibility",
    body: "We are happy to provide sizing guidance whenever possible, and sizing resources are available throughout the website. Final size selection remains the buyer’s responsibility. Fit preference, size regret, or incorrect size selection is not considered an item defect or misrepresentation.",
  },
  {
    id: "natural-variation",
    title: "Natural Variation",
    body: "Natural jade may appear different under varying lighting, camera settings, environments, and skin tones. We make every effort to present each piece accurately through photos, videos, and multiple lighting conditions when available. Slight differences in color, tone, glow, translucency, texture, cotton, crystal structure, stone lines, or natural inclusions are part of jade’s natural character and do not constitute damage or misrepresentation.",
  },
  {
    id: "custom-altered-pieces",
    title: "Custom, Resized & Altered Pieces",
    body: "Customized, resized, altered, specially requested, made-to-order, or modified pieces are final sale and are not eligible for change-of-mind return, exchange, or refund. If a custom or altered piece arrives damaged, incorrect, or materially different from the approved details, please contact us within 24 hours of delivery for review.",
  },
  {
    id: "returns-exchanges",
    title: "Returns & Exchanges",
    body: `Return eligibility depends on the order type. Ship Now pieces may be considered for return or exchange within 24–48 hours of confirmed delivery if they are unworn, unaltered, and in original condition. Sourced For You, custom, resized, altered, final sale, and specially requested pieces are not eligible for change-of-mind returns. If your order was damaged, or not as shown, please refer to our "Item Representation" section below. All requests are reviewed with care to ensure the process remains fair for both the client and BingBing Jade.`,
  },
  {
    id: "damage-claims",
    title: "Damage, Incorrect Item & Not-As-Described Claims",
    body: "If your item arrives damaged, incorrect, or materially different from what was shown and approved, please contact us within 24 hours of confirmed delivery. Clear photos of the item, packaging, and shipping label are required for review. An unboxing video is strongly recommended, especially for shipping damage or missing-item concerns, but each case is reviewed based on the available evidence.",
  },
  {
    id: "claim-review",
    title: "Claim Review Process",
    body: "All claims are reviewed carefully using the available order records, pre-shipment documentation, delivery details, and customer-provided evidence. Damage caused after delivery, including impact, improper handling, wear, alteration, attempted resizing, or third-party repair, is not covered.",
  },
  {
    id: "item-representation",
    title: "Item Representation",
    body: "If you believe an item differs materially from what was shown, please notify us within 24 hours of delivery. Material differences may include receiving the wrong item, undisclosed major damage, or a clear mismatch from the approved item details. Minor lighting differences, natural jade variation, personal preference, size regret, or expected natural inclusions do not qualify as misrepresentation.",
  },
  {
    id: "return-condition",
    title: "Return Condition",
    body: "Approved returns must be sent back unworn, unaltered, and in the same condition received, with all original packaging, certificates, accessories, and gifts included. Items returned damaged, worn, altered, incomplete, or inconsistent with the original shipped item may be rejected or subject to a partial refund.",
  },
  {
    id: "refund-processing",
    title: "Refund Processing",
    body: "Refunds are issued only after the returned item has been received, inspected, and confirmed to qualify under our shop terms. Additional verification or re-certification may be required for certain pieces. Original shipping, return shipping, payment processing fees, insurance fees, expedited service fees, certification fees, and restocking fees may be non-refundable unless otherwise required by law.",
  },
  {
    id: "lifetime-type-a-guarantee",
    title: "Lifetime Type A Guarantee",
    body: "All jade sold as Type A Jadeite on this website is backed by our lifetime Type A Jadeite guarantee. If a client has a piece professionally tested and believes it may not match our authenticity guarantee, they may contact us for review and verification. If final verified results confirm the item was not as guaranteed, an appropriate resolution or refund will be issued.",
  },
  {
    id: "shipping-delivery",
    title: "Shipping & Delivery",
    body: "Items labeled “Ship Now” are held in our U.S. inventory and typically ship within 2–5 business days. Pieces labeled “Sourced for You” are curated special-order pieces with an estimated delivery timeframe of 2–4 weeks. This allows time for sourcing coordination, review, certification when applicable, and fulfillment. Delivery estimates are not guaranteed and may vary due to customs, carrier delays, holidays, weather, supplier timelines, or other circumstances outside our control.",
  },
  {
    id: "expedited-shipping",
    title: "Expedited Sourcing & Shipping",
    body: "Expedited shipping is available for “Sourced for You” items for $100 (plus $10 per additional item). With this option, your piece is prioritized and dispatched without delay. This is recommended for time-sensitive orders, high-value pieces, or special occasions.",
  },
  {
    id: "shipping-insurance",
    title: "Shipping Insurance",
    body: "Shipping insurance may be available for an additional fee and must be requested before shipment. We carefully package and document each order before dispatch. For high-value pieces, we strongly recommend insured shipping and signature confirmation, as declined insurance may limit the remedies available in the event of carrier loss, theft, or transit damage.",
  },
  {
    id: "high-value-orders",
    title: "High-Value Orders",
    body: "For high-value orders, additional verification, insured shipping, signature confirmation, wire transfer, or special handling may be required. BingBing Jade reserves the right to request additional safeguards or decline a transaction when necessary to protect both the client and the business.",
  },
  {
    id: "payment-tax",
    title: "Payment & Tax",
    body: "We accept payment via Stripe through our website or manual Stripe invoice, as well as Zelle and wire transfer when approved. Payments may be subject to transaction or processing fees where applicable. Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
  },
  {
    id: "right-to-refuse-service",
    title: "Right to Refuse Service",
    body: "BingBing Jade is committed to providing a thoughtful, transparent, and respectful purchasing experience. To protect our clients, our team, and the integrity of our sourcing and fulfillment process, we reserve the right to decline, limit, cancel, or refund any order, sourcing request, custom request, inquiry, or transaction at our discretion. This may include situations involving incomplete or unverifiable information, repeated expectation mismatch, policy misuse, inappropriate or abusive communication, payment or fraud concerns, inventory limitations, sourcing limitations, or requests that fall outside the scope of what we can reasonably and confidently accommodate. If we are unable to accept or continue with an order or request, we may cancel the transaction and issue a refund where applicable.",
  },
  {
    id: "buyer-acknowledgment",
    title: "Buyer Acknowledgment",
    body: "By completing payment, you acknowledge that you have reviewed the item details, order type, estimated timeline, and shop terms. You understand that jade is a natural gemstone with natural variation, and you agree to contact us promptly within the stated timeframe if there is an issue with your order.",
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

      <p className="mt-2 text-xs italic text-gray-200 dark:text-gray-600">Last revised on 4/28/26.</p>
    </div>
  );
}
