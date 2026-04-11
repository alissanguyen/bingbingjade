type MessagingResult = {
  text: string;
  monthly: number;
};

/**
 * Returns BNPL payment messaging for a given price, or null if not applicable.
 * Monthly estimate uses a 5% buffer rounded up to the nearest dollar.
 * Month counts are internal only — never displayed to the user.
 */
export function getPaymentMessaging(price: number): MessagingResult | null {
  if (typeof price !== "number" || !isFinite(price) || price < 50) return null;

  if (price < 500) {
    const monthly = Math.ceil((price * 1.05) / 4);
    return {
      text: `Flexible payments with Afterpay or Affirm — from $${monthly}/mo`,
      monthly,
    };
  }
  if (price < 2000) {
    const monthly = Math.ceil((price * 1.05) / 12);
    return { text: `From $${monthly}/mo with Affirm`, monthly };
  }
  const monthly = Math.ceil((price * 1.05) / 24);
  return {
    text: `From $${monthly}/mo with Affirm (extended plans available)`,
    monthly,
  };
}

/**
 * Renders subtle BNPL payment messaging below a price.
 * Returns null if price is < $50, null/undefined, or not a finite number.
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
    <div className={className}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{info.text}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Subject to eligibility.</p>
    </div>
  );
}
