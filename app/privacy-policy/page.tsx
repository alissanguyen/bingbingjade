import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BingBing Jade collects, uses, and protects your personal information.",
};

const SECTIONS = [
  {
    title: "Information We Collect",
    body: "When you make a purchase or contact us, we collect information you provide directly, including your name, email address, shipping address, and order details. Payment information is processed securely by Stripe and is never stored on our servers. We may also collect limited technical data (such as browser type and pages visited) through standard server logs to maintain the functionality, security, and performance of our website.",
  },
  {
    title: "How We Use Your Information",
    body: "Your information is used solely to process and fulfill orders, provide customer support, send order confirmations and shipping updates, and comply with applicable legal, tax, and accounting obligations. We do not sell your data or use it for unsolicited marketing or advertising.",
  },
  {
    title: "Sharing of Information",
    body: "We do not sell, rent, or trade your personal information. Your data is shared only with trusted service providers necessary to operate our business, such as Stripe for payment processing and shipping carriers for delivery. These providers are authorized to use your information only as necessary to perform their services on our behalf.",
  },
  {
    title: "Payment Security",
    body: "All payments are processed securely through Stripe, a PCI-DSS Level 1 certified payment provider. Payment data is encrypted and transmitted using industry-standard TLS encryption. We do not store or have access to your full payment credentials at any time.",
  },
  {
    title: "Cookies & Site Functionality",
    body: "We use only essential technologies required for the proper operation of the website, such as maintaining cart and session data. We do not use advertising cookies, behavioral tracking, or unnecessary third-party analytics.",
  },
  {
    title: "Data Retention",
    body: "We retain order and transaction records as necessary for legitimate business purposes, including accounting, tax compliance, fraud prevention, and legal obligations. Where legally permissible, you may request deletion of your personal data, and we will process such requests in accordance with applicable law.",
  },
  {
    title: "Your Rights",
    body: "Depending on your location, you may have the right to request access to, correction of, or deletion of your personal information. Requests may be submitted through our Contact page, and we will respond within a reasonable timeframe in accordance with applicable laws.",
  },
  {
    title: "Third-Party Services",
    body: "Our website may include links or integrations with third-party platforms such as Instagram, WhatsApp, or payment providers. We are not responsible for the privacy practices or content of these third-party services. We encourage you to review their respective privacy policies before engaging with them.",
  },
  {
    title: "Children’s Privacy",
    body: "Our website is not intended for individuals under the age of 13, and we do not knowingly collect personal information from children. If such information is identified, we will take steps to delete it promptly.",
  },
  {
    title: "Data Security",
    body: "We take reasonable administrative, technical, and organizational measures to protect your personal information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
  },
  {
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Updates will be posted on this page with a revised effective date. Continued use of the website constitutes acceptance of any changes.",
  },
  {
    title: "Contact",
    body: "If you have any questions or concerns regarding this Privacy Policy or how your information is handled, please contact us through our Contact page. We are committed to providing clarity, transparency, and support.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm italic leading-relaxed">
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
