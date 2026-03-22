import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BingBing Jade collects, uses, and protects your personal information.",
};

const SECTIONS = [
  {
    title: "Information We Collect",
    body: "When you make a purchase or contact us, we collect the information you provide directly, such as your name, email address, shipping address, and order details. Payment information is processed securely by Stripe and is never stored on our servers. We may also collect limited technical data (such as browser type and pages visited) through standard server logs to ensure the site functions properly.",
  },
  {
    title: "How We Use Your Information",
    body: "Your information is used solely to process and fulfill orders, provide customer support, send order confirmations and shipping updates, and comply with applicable legal and accounting obligations. We do not use your information for unsolicited marketing or advertising.",
  },
  {
    title: "Sharing of Information",
    body: "We do not sell, rent, or trade your personal information. Your data is shared only with trusted service providers necessary to complete your order, such as Stripe for payment processing and shipping carriers for delivery. These providers are authorized to use your information only for the services they perform on our behalf.",
  },
  {
    title: "Payment Security",
    body: "All payments are processed securely by Stripe, a PCI-DSS Level 1 certified payment provider. Your payment details are encrypted and transmitted directly to Stripe using industry-standard TLS encryption. We do not store or have access to your full payment credentials.",
  },
  {
    title: "Cookies",
    body: "We use only essential technologies required for the website to function, such as storing cart or session data in your browser. We do not use advertising cookies, behavioral tracking, or unnecessary third-party analytics.",
  },
  {
    title: "Data Retention",
    body: "We retain order and transaction records as required for legitimate business, accounting, and legal purposes. If you request deletion of your personal data, we will honor your request where legally permissible.",
  },
  {
    title: "Your Rights",
    body: "You may request access to, correction of, or deletion of your personal information at any time. Requests can be submitted through our Contact page, and we will respond within a reasonable timeframe in accordance with applicable laws.",
  },
  {
    title: "Third-Party Links",
    body: "Our website may include links to third-party platforms such as Instagram, Reddit, or WhatsApp. We are not responsible for the privacy practices or content of those external services. We encourage you to review their policies before engaging with them.",
  },
  {
    title: "Children's Privacy",
    body: "Our website is not intended for individuals under the age of 13, and we do not knowingly collect personal information from children. If such information is identified, it will be promptly removed.",
  },
  {
    title: "Changes to This Policy",
    body: "We reserve the right to update this Privacy Policy as needed. Any updates will be reflected on this page with a revised effective date. Continued use of the website constitutes acceptance of any updates.",
  },
  {
    title: "Contact",
    body: "For any questions or concerns regarding this Privacy Policy or how your information is handled, please contact us through our Contact page. We are committed to providing clarity and support.",
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
