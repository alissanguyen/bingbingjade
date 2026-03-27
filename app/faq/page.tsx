import { Accordion } from "@/app/components/Accordion";

const faqs = [
  {
    id: "jade-type",
    question: "What type of jade do you sell?",
    answer:
      "All jade offered on this website is natural Jadeite. We specialize in Type A jadeite sourced from Myanmar (Burmese) and Guatemala. Every piece comes with certification of authenticity to give you confidence when purchasing with us. Unless otherwise specified, pieces are Myanmar jadeite.",
  },
  {
    id: "authenticity",
    question: "Is your jade authentic and untreated?",
    answer: (
      <>
        Yes. All jade sold on this website is
        <strong className="text-black dark:text-white"> natural, untreated Jadeite (Type A)</strong> and <strong className="text-black dark:text-white">guaranteed authentic</strong>. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.
      </>
    )
  },
  {
    id: "certification",
    question: "Does every piece come with certification?",
    answer:
      "Yes — every piece includes certification. Each item is authenticated and verified as natural Type A jadeite, untreated and genuine. Certificates may be issued by recognized Vietnamese or Chinese gemological centers, ensuring full transparency and confidence in your purchase.",
  },
  {
    id: "type-a-guarantee",
    question: "Do you guarantee your jade is Type A?",
    answer: (
      <>Yes. All pieces are backed by a <strong className="text-emerald-700 dark:text-emerald-500 italic">lifetime Type A Jadeite guarantee</strong>. If a piece is professionally tested at any time and believed to be Type B, it may be returned to us for re-certification and verification. If the returned certification confirms it is Type B, a refund will be issued. This is the only circumstance in which shipping charges are refundable in full.
      </>
    )
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
     "We accept PayPal Goods & Services (a 3% processing fee applies), PayPal Friends & Family, Zelle, and wire transfer. Applicable sales tax may apply based on the delivery destination.",
  },
  {
    id: "standard-shipping",
    question: "How does standard shipping work?",
    answer:
      "Orders are carefully prepared and shipped within an estimated timeframe of 2–4 weeks. This allows for quality inspection, certification, and international handling where applicable. Once dispatched, your order will continue to its final destination.",
  },
  {
    id: "expedited-shipping",
    question: "Do you offer expedited shipping?",
    answer:
      "Yes. Expedited shipping is available for $100 and prioritizes your piece for immediate processing and dispatch. This option is recommended for time-sensitive orders or special occasions.",
  },
  {
    id: "shipping-insurance",
    question: "Do you offer shipping insurance?",
    answer:
      "Yes. Optional shipping insurance is available for an additional 5% of the item price and must be requested before shipment. If insurance is declined, the buyer accepts responsibility for any loss, theft, or damage in transit once the package has been shipped.",
  },
  {
    id: "returns-exchanges",
    question: "Can I return or exchange an item if I change my mind?",
    answer:
      "Returns or exchanges may be considered for eligible pieces if requested within 24–48 hours of confirmed delivery. All requests are subject to review. Approved returns may be subject to a 10% restocking fee, along with original and return shipping costs.",
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
      "Refunds are processed after the returned item has been received, re-verified, and inspected. In some cases, re-certification may be required to confirm authenticity. This process typically takes approximately 2–4 weeks.",
  },
  {
    id: "shipping-refundable",
    question: "Is shipping refundable?",
    answer:
      "Shipping charges are non-refundable except in the case of a confirmed Type B authenticity result after return and re-certification. In that case, both the product price and shipping charges will be refunded in full.",
  },
  {
    id: "how-to-buy",
    question: "How do I buy a piece?",
    answer: (
      <>
        You can purchase directly through our website for a seamless checkout experience (a 3% processing fee applies).{" "}
        Alternatively, you may reach out to us for payment via{" "}
        <strong className="text-green-500">Zelle</strong> or{" "}
        <strong className="text-blue-500">Wire Transfer</strong>.{" "}
        <br /><br />
        To proceed, please visit the{" "}
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-black dark:hover:text-white"
        >
          Contact
        </a>{" "}
        page and message us via{" "}
        <strong className="text-green-500">WhatsApp</strong>,{" "}
        <strong className="text-purple-500">Instagram</strong>, or email at{" "}
        <strong className="text-blue-500">bingbing.jade2@gmail.com</strong>.
      </>
    ),
  },
  {
    id: "custom-sourcing",
    question: "Can I ask you to source a specific piece for me?",
    answer:
      "Yes. We accept sourcing requests for specific pieces and may assist in sourcing other jade or stones upon request. Please contact us with details of what you are looking for.",
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Everything you need to know about BingBing Jadeite.</p>
      <div className="mt-10">
        <Accordion items={faqs.map((f) => ({ id: f.id, heading: f.question, content: f.answer }))} />
      </div>
    </div>
  );
}
