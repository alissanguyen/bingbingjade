export const metadata = { title: "Invalid Link — BingBing Jade" };

export default function CheckoutInvalidPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Checkout Link</h1>
        <p className="text-sm text-gray-500 mb-6">
          This link doesn't match any active checkout. Please check your DM for the correct link or contact us for help.
        </p>
        <a
          href="/"
          className="inline-block px-5 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Shop
        </a>
      </div>
    </div>
  );
}
