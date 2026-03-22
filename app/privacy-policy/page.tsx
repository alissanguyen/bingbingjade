import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BingBing Jade collects, uses, and protects your personal information.",
};

const SECTIONS = [
  {
    title: "Information We Collect",
    body: "When you make a purchase or contact us, we collect information you provide directly — such as your name, email address, shipping address, and payment details. Payment information is processed securely by Stripe and is never stored on our servers. We may also collect basic usage data (pages visited, browser type) through standard server logs.",
  },
  {
    title: "How We Use Your Information",
    body: "We use your information solely to process and fulfill your order, respond to your inquiries, send order confirmations and shipping updates, and comply with applicable legal obligations. We do not use your data for advertising or marketing without your consent.",
  },
  {
    title: "Sharing of Information",
    body: "We do not sell, rent, or trade your personal information to third parties. We share your data only with service providers directly involved in fulfilling your order — such as Stripe for payment processing and shipping carriers for delivery. These parties are bound by their own privacy policies and are only permitted to use your data for the purpose of providing their services.",
  },
  {
    title: "Payment Security",
    body: "All payments are processed by Stripe, a PCI-DSS Level 1 certified payment processor. Your card number and payment credentials are transmitted directly to Stripe using TLS encryption and are never stored on our systems.",
  },
  {
    title: "Cookies",
    body: "Our website uses only essential cookies necessary for the site to function — such as cart state stored in your browser's localStorage. We do not use advertising cookies, tracking pixels, or third-party analytics beyond what is necessary to operate the site.",
  },
  {
    title: "Data Retention",
    body: "We retain order records (name, email, items purchased, and transaction details) for accounting and legal purposes in accordance with applicable law. If you would like your personal data removed, please contact us and we will accommodate your request to the extent permitted by law.",
  },
  {
    title: "Your Rights",
    body: "You have the right to request access to, correction of, or deletion of any personal information we hold about you. To exercise any of these rights, please contact us via the Contact page. We will respond to all requests within a reasonable timeframe.",
  },
  {
    title: "Third-Party Links",
    body: "Our site may contain links to third-party platforms such as Instagram, Reddit, and WhatsApp. We are not responsible for the privacy practices of those platforms. We encourage you to review their respective privacy policies.",
  },
  {
    title: "Children's Privacy",
    body: "Our website is not directed to children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will promptly remove it.",
  },
  {
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of our website after changes are posted constitutes your acceptance of the updated policy.",
  },
  {
    title: "Contact",
    body: "If you have any questions about this Privacy Policy or how we handle your data, please reach out via our Contact page. We are happy to address any concerns.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Effective date: March 2025. This policy describes how BingBing Jade collects, uses, and protects your personal information.
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{s.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
