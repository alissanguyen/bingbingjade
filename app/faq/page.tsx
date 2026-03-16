const faqs = [
  {
    question: "What type of jade do you sell?",
    answer: "All products listed on this website are natural Jadeite. We specialize in Type A Jadeite from Myanmar (Burmese) and Guatemala. If a product name does not specifically say Guatemala, it is automatically Myanmar jadeite.",
  },
  {
    question: "Do you sell nephrite or other stones?",
    answer: "All items currently listed on this website are Jadeite only. However, we do accept special sourcing requests for other materials such as nephrite, agate, and other stones upon request.",
  },
  {
    question: "Is your jade authentic and untreated?",
    answer: "Yes. All jade sold on this website is natural, untreated Type A Jadeite. No dye, bleaching, polymer infusion, or chemical treatment is used in the production process.",
  },
  {
    question: "Does the jade come with certification?",
    answer: "Yes. All jade comes with certification confirming it is Type A Jadeite. Certificates may be issued by Vietnamese or Chinese gemological centers, and the certification will clearly state the jade is Type A.",
  },
  {
    question: "Do you guarantee your jade is Type A?",
    answer: "Yes. All products are backed by a lifetime Type A Jadeite guarantee. If a client has a purchased item professionally tested and it is proven to be Type B, we will issue a full refund including shipping. This is the only case in which shipping is refundable.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept PayPal Goods & Services (subject to a 3% fee), PayPal Friends & Family, Zelle, and wire transfer.",
  },
  {
    question: "Why doesn’t my jade look exactly the same in person?",
    answer: "Jade can appear different depending on lighting, camera settings, environment, and skin tone. We do our best to show each piece accurately through multiple photos, videos, and lighting conditions, but some variation in appearance is normal with natural jade.",
  },
  {
    question: "How does standard shipping work?",
    answer: "Standard overseas shipping follows a monthly schedule. Orders paid on or before the 15th of the month are shipped in the overseas batch on the 20th, arrive in the U.S. around the 22nd, and typically take an additional 2–4 days for final delivery. Orders paid after the 15th will be included in the next month’s shipment and arrive in the U.S. on or around the 20th of the following month. This process helps keep shipping costs lower while allowing time for customs clearance and jade certification.",
  },
  {
    question: "Do you offer expedited shipping?",
    answer: "Yes. Expedited shipping is available for an additional $100. With expedited shipping, your jade is sent to the U.S. immediately instead of waiting for the monthly overseas shipment schedule. This option is recommended for high-value pieces or time-sensitive purchases such as gifts and special events.",
  },
  {
    question: "Do you offer shipping insurance?",
    answer: "Yes. Optional shipping insurance is available for an additional 5% of the item price and must be requested by the buyer before shipment. Shipping loss or transit damage is very rare, but if insurance is declined, the buyer accepts that shipping-related risk according to store policy.",
  },
  {
    question: "Can customized or resized items be returned?",
    answer:
      "No. Customized, resized, reshaped, or made-to-order items are non-refundable. This includes products made from raw materials and items altered from their original form, such as increasing a bangle size when possible or changing a D-type bangle to a round style and vice versa. Any custom modification requested by the buyer makes the item final sale.",
  },
  {
    question: "Is shipping refundable?",
    answer: "Shipping is non-refundable in all cases except one: if the jade is professionally tested by the client and confirmed to be Type B instead of Type A. In that case, we will refund both the product price and the shipping cost in full. For all other situations, please refer to the Store Policy.",
  },
  {
    question: "How do I buy a piece?",
    answer: (
      <>
        To purchase, please visit the Contact page and reach out through one of
        the available methods: <strong className="text-cyan-600">WhatsApp</strong>, <strong className="text-cyan-600">Instagram</strong>,
        {" "}or email at <strong className="text-cyan-600 italic">bingbing.jade2@gmail.com</strong>.
      </>
    ),
  },
  {
    question: "Can I ask you to source a specific piece for me?",
    answer: "Yes. We do accept sourcing requests for specific pieces and may also help source other types of jade or stones by request. Please contact us with details about what you are looking for.",
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
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
