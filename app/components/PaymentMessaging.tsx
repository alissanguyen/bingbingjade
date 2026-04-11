type MessagingResult = {
  monthly: number;
  showAfterpay: boolean;
};

/**
 * Returns BNPL payment estimate for a given price, or null if not applicable.
 * Monthly estimate uses a 5% buffer rounded up to the nearest dollar.
 * Month counts are internal only — never exposed to users.
 */
export function getPaymentMessaging(price: number): MessagingResult | null {
  if (typeof price !== "number" || !isFinite(price) || price < 50) return null;

  if (price < 500) {
    return { monthly: Math.ceil((price * 1.05) / 4), showAfterpay: true };
  }
  if (price < 2000) {
    return { monthly: Math.ceil((price * 1.05) / 12), showAfterpay: false };
  }
  return { monthly: Math.ceil((price * 1.05) / 24), showAfterpay: false };
}

/**
 * One-line BNPL payment messaging with inline provider logo(s).
 * Returns null for sold items, inquiry-required prices, and prices under $50.
 */
export function PaymentMessaging({
  price,
  className,
}: {
  price: number | null | undefined;
  className?: string;
}) {
  if (price == null || !isFinite(price)) return null;
  const info = getPaymentMessaging(price);
  if (!info) return null;

  return (
    <div className={`flex items-center flex-wrap gap-x-1.5 gap-y-0.5 ${className ?? ""}`}>
      <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
        From ${info.monthly}/mo with
      </span>

      {info.showAfterpay && (
        <>
          {/* Afterpay badge — has its own background, works in both modes */}
          <img
            src="/afterpay.svg"
            alt="Afterpay"
            className="h-4 w-auto inline-block"
          />
          <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">or</span>
        </>
      )}

      {/* Affirm wordmark — black SVG, inverted in dark mode */}
      <img
        src="/affirm.svg"
        alt="Affirm"
        className="h-3 w-auto inline-block dark:invert"
      />

      <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
        · See if you qualify
      </span>
    </div>
  );
}
