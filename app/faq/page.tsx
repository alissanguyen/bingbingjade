const faqs = [
  {
    question: "What type of jade do you sell?",
    answer:
      "All products listed on this website are natural Jadeite. We specialize in Type A Jadeite from Myanmar (Burmese) and Guatemala. If a product name does not specifically indicate Guatemala, it is understood to be Myanmar jadeite.",
  },
  {
    question: "Do you sell nephrite or other stones?",
    answer:
      "All items currently listed on this website are Jadeite only. However, we do accept special sourcing requests for other materials such as nephrite, agate, and other stones upon request.",
  },
  {
    question: "Is your jade authentic and untreated?",
    answer:
      "Yes. All jade sold on this website is natural, untreated Jadeite (Type A) and guaranteed authentic. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.",
  },
  {
    question: "Does every piece come with certification?",
    answer:
      "Items priced above $200 include certification. For items priced under $200, certification is available upon request for an additional $20. Certificates may be issued by Vietnamese or Chinese gemological centers and will clearly state that the jade is Type A.",
  },
  {
    question: "Do you guarantee your jade is Type A?",
    answer:
      "Yes. All products are backed by a lifetime Type A Jadeite guarantee. If a client has a purchased item professionally tested and it is proven to be Type B, we will issue a full refund including shipping. This is the only circumstance in which shipping costs are refundable.",
  },
  {
    question: "Why doesn’t my jade look exactly the same in person?",
    answer:
      "Jade can appear different depending on lighting, camera settings, environment, and skin tone. We do our best to show each piece accurately through multiple photos, videos, and lighting conditions, but some variation in appearance is natural and expected with untreated jade.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept PayPal Goods & Services (subject to a 3% fee), PayPal Friends & Family, Zelle, and wire transfer. All orders are subjected to sales tax applicable to the delivery destination and in accordance with applicable law.",
  },
  {
    question: "How does standard shipping work?",
    answer:
      "Standard shipping is available for a flat rate of $20. Overseas shipments follow a monthly schedule. Orders paid on or before the 15th of the month are included in the shipment on the 20th, arrive in the U.S. around the 22nd, and typically take an additional 2–4 days for final delivery. Orders paid after the 15th will be included in the following month’s shipment and are expected to arrive in the U.S. on or around the 20th of the next month. This schedule helps keep shipping costs more affordable while allowing time for customs clearance and certification.",
  },
  {
    question: "Do you offer expedited shipping?",
    answer:
      "Yes. Expedited shipping is available for an additional $100. With this option, your jade is sent to the U.S. immediately rather than waiting for the monthly shipment schedule. This is recommended for high-value pieces, gifts, or time-sensitive purchases.",
  },
  {
    question: "Do you offer shipping insurance?",
    answer:
      "Yes. Optional shipping insurance is available for an additional 5% of the item price and must be requested before shipment. Shipping issues are rare, but if insurance is declined, the buyer accepts responsibility for any loss, theft, or transit damage once the package has been shipped.",
  },
  {
    question: "Can customized or resized items be returned?",
    answer:
      "No. Customized, resized, reshaped, or made-to-order items are final sale and non-refundable. This includes products made from raw materials and items altered from their original form, such as increasing a bangle size when possible or changing a D-type bangle to a round style and vice versa. Any custom modification requested by the buyer makes the item ineligible for return or refund.",
  },
  {
    question: "Is shipping refundable?",
    answer:
      "Shipping is non-refundable in all cases except one: if the jade is professionally tested by the client and confirmed to be Type B instead of Type A. In that case, both the product price and the shipping cost will be refunded in full. For all other situations, please refer to the Store Policy.",
  },
  {
    question: "How do I buy a piece?",
    answer: (
      <>
        To purchase, please visit the <a href='/contact' target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-black dark:hover:text-white">Contact</a> page and reach out through one of
        the available methods: <strong className="text-green-500">WhatsApp</strong>, <strong className="text-purple-500">Instagram</strong>,{" "}
        or email at <strong className="text-blue-500">bingbing.jade2@gmail.com</strong>.
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
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Everything you need to know about BingBing Jadeite.</p>
      <div className="mt-10 divide-y divide-gray-200 dark:divide-gray-800">
        {faqs.map((faq, i) => (
          <div key={i} className="py-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{faq.question}</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
