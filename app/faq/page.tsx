import { Accordion } from "@/app/components/Accordion";

const faqs = [
  {
    id: "jade-type",
    question: "What type of jade do you sell?",
    answer:
      "All jade offered on this website is natural Jadeite. We specialize in Type A jadeite sourced from Myanmar (Burmese) and Guatemala. Every piece is backed by our lifetime authenticity guarantee. Unless otherwise specified, pieces are Myanmar jadeite.",
  },
  {
    id: "authenticity",
    question: "Is your jade authentic and untreated?",
    answer: (
      <>
        Yes. All jade sold on this website is{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          natural Jadeite
        </strong>{" "}
        and{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          guaranteed authentic for life
        </strong>
        . BingBing Jade does not sell dyed jade. If a piece has any disclosed
        treatment, such as heat treatment, this will be clearly stated before
        purchase. We do not sell jade treated with dye, bleaching, polymer
        infusion, or undisclosed chemical enhancement.
      </>
    ),
  },
  {
    id: "certification",
    question: "Does every piece come with certification?",
    answer: (
      <>
        We offer certification from{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          trusted independent laboratories
        </strong>
        , and every piece is backed by our{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          lifetime authenticity guarantee
        </strong>
        .{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">GIA</strong>{" "}
        or{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">NGTC</strong>{" "}
        certification may also be requested at additional cost when available.
        Certification timelines may vary depending on the item, lab, and
        shipping route.
      </>
    ),
  },
  {
    id: "type-a-guarantee",
    question: "Do you guarantee your jade is Type A?",
    answer: (
      <>
        Yes. Pieces sold as Type A Jadeite are backed by a{" "}
        <strong className="text-emerald-700 dark:text-emerald-500 italic">
          lifetime Type A Jadeite guarantee
        </strong>
        . If a piece is professionally tested at any time and believed not to
        match our authenticity guarantee, it may be submitted to us for review,
        re-certification, and verification. If the final verified results
        confirm the item was not as guaranteed, an appropriate resolution or
        refund will be issued.
      </>
    ),
  },
  {
    id: "inventory-types",
    question: `What is the difference between "Ship Now" and "Sourced for You"?`,
    answer:
      "“Ship Now” pieces are held in our U.S. inventory and typically ship within 2–5 business days. “Sourced for You” pieces are curated special-order pieces made available through our trusted sourcing network. These pieces allow us to offer a wider range of jade beyond our U.S. inventory and typically have an estimated delivery timeframe of 2–4 weeks.",
  },
  {
    id: "natural-variation",
    question: "Why doesn't my jade look exactly the same in person?",
    answer:
      "Jade naturally appears different depending on lighting, camera settings, environment, and skin tone. We present each piece through multiple photos, videos, and lighting conditions whenever possible. Slight differences in color, tone, glow, translucency, cotton, crystal structure, stone lines, or natural minor inclusions are normal characteristics of jade and do not constitute damage or misrepresentation.",
  },
  {
    id: "payment-methods",
    question: "What payment methods do you accept?",
    answer:
      "We accept payment via Stripe through our website or through manual Stripe invoices, as well as Zelle and wire transfer when approved. Payments processed through our website may be subject to transaction or processing fees where applicable. Sales tax, if applicable, will be charged based on the delivery destination and in accordance with applicable law.",
  },
  {
    id: "standard-shipping",
    question: "How does shipping work?",
    answer:
      "Shipping time depends on the type of piece you select. Ship Now pieces are held in our U.S. inventory and typically ship within 2–5 business days. Sourced for You pieces are curated special-order pieces and typically have an estimated delivery timeframe of 2–4 weeks. Delivery estimates may vary due to sourcing timelines, certification, customs, carrier delays, or other circumstances outside our control.",
  },
  {
    id: "expedited-sourcing",
    question: "Priority Sourcing / Expedited Shipping: What is it and how does it work?",
    answer:
      "Expedited shipping is available for “Sourced for You” items for $100 (plus $10 per additional item). With this option, your piece is prioritized and dispatched without delay. This is recommended for time-sensitive orders, high-value pieces, or special occasions.",
  },
  {
    id: "shipping-insurance",
    question: "Do you offer shipping insurance?",
    answer:
      "Yes. Shipping insurance may be available for an additional fee and must be requested before shipment. For high-value pieces, we strongly recommend insured shipping and signature confirmation, as declined insurance may limit the remedies available in the event of carrier loss, theft, or transit damage.",
  },
  {
    id: "returns-exchanges",
    question: "Can I return or exchange an item if I change my mind?",
    answer:
      "Return eligibility depends on the order type. Eligible Ship Now pieces may be considered for return or exchange within 24–48 hours of confirmed delivery if they are unworn, unaltered, and in original condition. A restocking fee, original shipping, payment processing fees, and return shipping costs may apply. Sourced for You, custom, resized, altered, final sale, and specially requested pieces are not eligible for change-of-mind returns.",
  },
  {
    id: "sourced-for-you-returns",
    question: "Can I return a Sourced for You piece?",
    answer:
      "Sourced for You pieces are curated special-order pieces made available through our sourcing network. Once approved and processed, these pieces may be reserved, prepared, certified, or fulfilled specifically for that order. For this reason, they are not eligible for change-of-mind returns, cancellations, or exchanges. If the item arrives damaged, incorrect, or materially different from what was shown and approved, please contact us within 24 hours of delivery for review.",
  },
  {
    id: "custom-final-sale",
    question: "Can customized or resized items be returned?",
    answer:
      "Customized, resized, reshaped, altered, made-to-order, specially requested, or modified pieces are final sale and are not eligible for change-of-mind return, exchange, or refund. If a custom or altered piece arrives damaged, incorrect, or materially different from the approved details, please contact us within 24 hours of delivery for review.",
  },
  {
    id: "damaged-claims",
    question: "What if my item arrives damaged or seems different from what was shown?",
    answer:
      "Please contact us within 24 hours of confirmed delivery with clear photos of the item, packaging, and shipping label. An unboxing video is strongly recommended, especially for shipping damage or missing-item concerns. Each case is reviewed with care based on the available evidence.",
  },
  {
    id: "not-covered-damage",
    question: "What types of damage are not covered?",
    answer:
      "Damage that occurs after delivery is not covered. This includes impact, improper handling, wear, attempted resizing, alteration, third-party repair, or damage after the item has been received. Claims are reviewed using the available documentation from both the order record and the customer’s submitted evidence.",
  },
  {
    id: "refund-timeline",
    question: "How long do refunds take?",
    answer:
      "Refunds are issued only after the returned item has been received, inspected, and confirmed to qualify under our shop terms. In certain cases, additional verification or re-certification may be required to confirm authenticity, condition, and that the same piece has been returned.",
  },
  {
    id: "shipping-refundable",
    question: "Is shipping refundable?",
    answer:
      "Shipping charges, return shipping, payment processing fees, insurance fees, expedited service fees, certification fees, and priority handling fees are generally non-refundable unless otherwise determined as part of an approved claim review or required by law.",
  },
  {
    id: "high-value-orders",
    question: "Do high-value orders have special requirements?",
    answer:
      "Yes. For high-value orders, additional verification, insured shipping, signature confirmation, identity confirmation, wire transfer, or special handling may be required. BingBing Jade reserves the right to request additional documentation or decline a transaction when necessary to protect both the buyer and the business.",
  },
  {
    id: "how-to-buy",
    question: "How do I buy a piece?",
    answer: (
      <>
        You can purchase directly through our website for a seamless checkout
        experience via{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          Stripe
        </strong>
        . We also accept payment through{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          manual Stripe invoices
        </strong>
        ,{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          Zelle
        </strong>
        , and{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          Wire Transfer
        </strong>{" "}
        when approved. Payments processed through our website may be subject to
        transaction fees.
        <br />
        <br />
        To proceed, please visit the{" "}
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4 decoration-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          Contact
        </a>{" "}
        page and message us via WhatsApp, Instagram, or email.
      </>
    ),
  },
  {
    id: "custom-sourcing",
    question: "Can I ask you to source a specific piece for me?",
    answer: (
      <>
        Yes — we offer a dedicated custom sourcing service for clients seeking
        something truly specific or rare. Each request is handled with care
        through our trusted supplier network to find pieces that match your
        preferences, budget, sizing needs, and quality expectations.
        <br />
        <br />
        This is an intensive and selective process designed to deliver
        exceptional results. To begin, please submit your request here:{" "}
        <a
          href="/custom-sourcing"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4 decoration-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          Custom Sourcing Request
        </a>
        .
      </>
    ),
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-md">Everything you need to know about BingBing Jadeite.</p>
      <div className="mt-10">
        <Accordion items={faqs.map((f) => ({ id: f.id, heading: f.question, content: f.answer }))} />
      </div>
    </div>
  );
}
