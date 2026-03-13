const faqs = [
  {
    question: "What types of jade do you sell?",
    answer: "We sell both nephrite and jadeite jade. Each product listing specifies the type, origin, and quality grade so you can make an informed purchase.",
  },
  {
    question: "How do I know the jade is authentic?",
    answer: "Every piece comes with a certificate of authenticity. We source directly from trusted suppliers and conduct quality checks before listing any item.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and Apple Pay. All transactions are secured with SSL encryption.",
  },
  {
    question: "How long does shipping take?",
    answer: "Standard shipping takes 5–7 business days. Expedited shipping (2–3 business days) is available at checkout for an additional fee.",
  },
  {
    question: "Can I return a product?",
    answer: "Yes. We offer a 30-day return window on most items. Please visit our Returns & Refunds page for full details.",
  },
  {
    question: "Do you ship internationally?",
    answer: "Yes, we ship worldwide. International orders typically arrive within 10–14 business days, depending on customs and local delivery.",
  },
];

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Everything you need to know about Jade Shop.</p>
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
