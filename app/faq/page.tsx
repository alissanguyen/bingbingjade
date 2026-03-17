import { Accordion } from "@/app/components/Accordion";

const faqs = [
  {
    question: "What type of jade do you sell?",
    answer:
      "All products listed on this website are natural Jadeite. We specialize in Type A Jadeite from Myanmar (Burmese) and Guatemala. If a product name does not specifically indicate Guatemala, it is understood to be Myanmar jadeite.",
  },
  {
    question: "Is your jade authentic and untreated?",
    answer: (
      <>
        Yes. All jade sold on this website is
        <strong className="text-black dark:text-white"> natural, untreated Jadeite (Type A)</strong> and <strong className="text-black dark:text-white">guaranteed authentic</strong>. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.
      </>
    )
  },
  {
    question: "Does every piece come with certification?",
    answer:
      "Items priced above $200 include certification. For items priced under $200, certification is available upon request for an additional $20. Certificates may be issued by Vietnamese or Chinese gemological centers and will clearly state that the jade is Type A.",
  },
  {
    question: "Do you guarantee your jade is Type A?",
    answer: (
      <>Yes. All pieces are backed by a <strong className="text-emerald-700 dark:text-emerald-500 italic">lifetime Type A Jadeite guarantee</strong>. If a piece is professionally tested at any time and believed to be Type B, it may be returned to us for re-certification and verification. If the returned certification confirms it is Type B, a refund will be issued. This process may take approximately 3–4 weeks.
      </>
    )
  },
  {
    question: "Why doesn't my jade look exactly the same in person?",
    answer:
      "Jade can appear different depending on lighting, camera settings, environment, and skin tone. We do our best to show each piece accurately through multiple photos, videos, and lighting conditions, but some variation in appearance is natural and expected with untreated jade.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept PayPal Goods & Services (subject to a 3% fee), PayPal Friends & Family, Zelle, and wire transfer. Applicable sales tax may also apply based on the delivery destination.",
  },
  {
    question: "How does standard shipping work?",
    answer:
      "Standard shipping is available for a flat rate of $20. Orders paid on or before the 15th of the month are included in the overseas shipment on the 20th, arrive in the U.S. around the 22nd, and typically take an additional 2–4 days for final delivery. Orders paid after the 15th will be included in the following month's shipment and are expected to arrive in the U.S. on or around the 20th of the next month.",
  },
  {
    question: "Do you offer expedited shipping?",
    answer:
      "Yes. Expedited shipping is available for an additional $100 and allows your jade to be sent to the U.S. immediately rather than waiting for the monthly shipment schedule.",
  },
  {
    question: "Do you offer shipping insurance?",
    answer:
      "Yes. Optional shipping insurance is available for an additional 5% of the item price and must be requested before shipment. If insurance is declined, the buyer accepts responsibility for any loss, theft, or damage in transit once the package has been shipped.",
  },
  {
    question: "Can I return or exchange an item if I change my mind?",
    answer:
      "For non-custom, non-altered pieces only, a return or exchange request may be considered if you notify us within 24–48 hours of confirmed delivery. All such requests remain subject to approval. Approved returns or exchanges are subject to a 10% restocking fee, original shipping charges, and return shipping costs. Shipping charges in both directions are non-refundable.",
  },
  {
    question: "Can customized or resized items be returned?",
    answer:
      "No. Customized, resized, reshaped, altered, or made-to-order pieces are final sale and not eligible for return, exchange, or refund.",
  },
  {
    question: "What if my item arrives damaged or seems different from what was shown?",
    answer:
      "Please notify us within 24 hours of confirmed delivery and provide a full, clear, uncut unboxing video showing the unopened package, shipping label, and complete unboxing in one continuous recording. This documentation is required for us to review shipping-related or condition-related claims.",
  },
  {
    question: "How long do refunds take?",
    answer:
      "Refunds are not issued immediately. Returned items must first be received, re-verified, and inspected. In some cases, the piece may also be reviewed for certification again to confirm authenticity and ensure the same item has been returned. This process typically takes approximately 3–4 weeks.",
  },
  {
    question: "Is shipping refundable?",
    answer:
      "Shipping charges are non-refundable except in the case of a confirmed Type B authenticity result after return and re-certification. In that case, both the product price and shipping charges will be refunded in full.",
  },
  {
    question: "How do I buy a piece?",
    answer: (
      <>
        To purchase, please visit the{" "}
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-black dark:hover:text-white"
        >
          Contact
        </a>{" "}
        page and reach out through one of the available methods:{" "}
        <strong className="text-green-500">WhatsApp</strong>,{" "}
        <strong className="text-purple-500">Instagram</strong>, or email at{" "}
        <strong className="text-blue-500">bingbing.jade2@gmail.com</strong>.
      </>
    ),
  },
  {
    question: "Can I ask you to source a specific piece for me?",
    answer:
      "Yes. We do accept sourcing requests for specific pieces and may also help source other types of jade or stones upon request. Please contact us with details about what you are looking for.",
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Everything you need to know about BingBing Jadeite.</p>
      <div className="mt-10">
        <Accordion items={faqs.map((f) => ({ heading: f.question, content: f.answer }))} />
      </div>
    </div>
  );
}
