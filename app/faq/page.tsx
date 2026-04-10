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
          natural, untreated Jadeite (Type A)
        </strong>{" "}
        and{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">
          guaranteed authentic for life
        </strong>
        . No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.
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
        <strong className="text-emerald-600 dark:text-emerald-500">GIA</strong> or{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">NGTC</strong>{" "}
        certification may also be requested at additional cost. Please contact us for more details.
      </>
    ),
  },
  {
    id: "type-a-guarantee",
    question: "Do you guarantee your jade is Type A?",
    answer: (
      <>
        Yes. All pieces are backed by a{" "}
        <strong className="text-emerald-700 dark:text-emerald-500 italic">
          lifetime Type A Jadeite guarantee
        </strong>
        . If a piece is professionally tested at any time and believed not to be Type A, it may be returned to us for review, re-certification, and verification. If the returned results confirm otherwise, a refund will be issued.
      </>
    ),
  },
  {
    id: "inventory-types",
    question: "What is the difference between “Available Now” and “Sourced for You”?",
    answer:
      "“Available Now” pieces are already in our U.S. inventory and typically ship within 2–5 business days. “Sourced for You” pieces are carefully selected and prepared upon order, with an estimated delivery timeframe of 2–4 weeks. This allows us to offer a wider range of unique and high-quality jade while maintaining strict quality control.",
  },
  {
    id: "natural-variation",
    question: "Why doesn't my jade look exactly the same in person?",
    answer:
      "Jade naturally appears different depending on lighting, environment, and skin tone. We present each piece through multiple photos, videos, and lighting conditions; however, slight variations in color, glow, and translucency are inherent to untreated jade and part of its unique character.",
  },
  {
    id: "payment-methods",
    question: "What payment methods do you accept?",
    answer:
      "We accept payment via Stripe through our website or through manual Stripe invoices, as well as Zelle and wire transfer. Payments processed through our website may be subject to transaction fees. No other payment methods are accepted. Applicable sales tax may apply based on the delivery destination.",
  },
  {
    id: "standard-shipping",
    question: "How does shipping work?",
    answer:
      "Shipping time depends on the type of piece you select. Items labeled “Available Now” are already in our U.S. inventory and typically ship within 2–5 business days. Pieces labeled “Sourced for You” are carefully prepared upon order and typically arrive within 2–4 weeks, allowing time for quality inspection, certification, and international handling.",
  },
  {
    id: "expedited-sourcing",
    question: "Priority Sourcing / Expedited Shipping: What is it and how does it work?",
    answer:
      "For pieces labeled “Sourced for You,” priority sourcing is available for $100 (plus $10 per additional item). With this option, your order is prioritized at every stage — including sourcing, preparation, and dispatch — to reduce overall processing time. This is recommended for time-sensitive orders or special occasions. Priority sourcing does not apply to items labeled “Available Now,” which are already ready for immediate shipment from our U.S. inventory.",
  },
  {
    id: "shipping-insurance",
    question: "Do you offer shipping insurance?",
    answer:
      "Yes. Optional shipping insurance is available for an additional fee and must be requested before shipment. If insurance is declined, the buyer accepts responsibility for any loss, theft, or damage in transit once the package has been shipped.",
  },
  {
    id: "returns-exchanges",
    question: "Can I return or exchange an item if I change my mind?",
    answer:
      "Returns or exchanges may be considered for eligible pieces if requested within 24–48 hours of confirmed delivery. All requests are subject to review. Approved returns may be subject to a restocking fee, along with original and return shipping costs.",
  },
  {
    id: "custom-final-sale",
    question: "Can customized or resized items be returned?",
    answer:
      "No. Customized, resized, reshaped, altered, or made-to-order pieces are final sale and not eligible for return, exchange, or refund.",
  },
  {
    id: "damaged-claims",
    question: "What if my item arrives damaged or seems different from what was shown?",
    answer:
      "Please notify us within 24 hours of confirmed delivery and provide a full, clear, uncut unboxing video showing the unopened package, shipping label, and complete unboxing in one continuous recording. This documentation allows us to properly review and assess any shipping or condition-related concerns.",
  },
  {
    id: "refund-timeline",
    question: "How long do refunds take?",
    answer:
      "Refunds are issued only after the returned item has been received, re-examined, and confirmed to qualify under our shop terms. In certain cases, additional verification or re-certification may be required.",
  },
  {
    id: "shipping-refundable",
    question: "Is shipping refundable?",
    answer:
      "Shipping charges are generally non-refundable unless otherwise determined as part of an approved claim review.",
  },
  {
    id: "how-to-buy",
    question: "How do I buy a piece?",
    answer: (
      <>
        You can purchase directly through our website for a seamless checkout experience via{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">Stripe</strong>.{" "}
        We also accept payment through{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">manual Stripe invoices</strong>,{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">Zelle</strong>, and{" "}
        <strong className="text-emerald-600 dark:text-emerald-500">Wire Transfer</strong>.{" "}
        Payments processed through our website may be subject to transaction fees.
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
        Yes — we offer a dedicated custom sourcing service for clients seeking something truly specific or rare. Each request is handled with care by our team, who search extensively across trusted networks to find pieces that meet your criteria.
        <br /><br />
        This is an intensive and selective process designed to deliver exceptional results. To begin, please submit your request here:{" "}
        <a
          href="/custom-sourcing"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4 decoration-emerald-500/60 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          Custom Sourcing Request
        </a>.
      </>
    ),
  }
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
