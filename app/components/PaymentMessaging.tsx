import Image from "next/image";

type MessagingResult = {
  monthly: number;
  showAfterpay: boolean;
};

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
 * Affirm wordmark.
 * Black letter-paths use currentColor so dark mode just needs text-white.
 * Blue swoosh (#4A4AF4) is hardcoded — brand color, stays in both modes.
 * viewBox trimmed slightly on top to reduce whitespace above the arc.
 */
function AffirmLogo() {
  return (
    <Image
      src="/affirm.svg"
      alt="Affirm"
      width={80} // adjust as needed
      height={20}
      className="h-3 mb-[7.9px] sm:mb-2 sm:h-4 w-auto shrink-0 self-end"
    />
  );
}

/**
 * Afterpay pill badge.
 * viewBox is cropped inward to remove excess internal padding from the
 * brand badge, making it look tight when used inline with text.
 */
function AfterpayLogo() {
  return (
    <Image
      src="/afterpay.svg"
      alt="Afterpay"
      width={80} // adjust as needed
      height={20}
      className="h-5 sm:h-6 w-auto shrink-0 self-end"
    />
  );
}

/**
 * BNPL payment messaging component.
 *
 * compact=true  → one-line text only: "From $XX/mo if qualify"  (product cards)
 * compact=false → full line with logos: "From $XX/mo with [logo(s)] · See if you qualify"
 */
export function PaymentMessaging({
  price,
  compact = false,
  className,
}: {
  price: number | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (price == null || !isFinite(price)) return null;
  const info = getPaymentMessaging(price);
  if (!info) return null;

  const amount = (
    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
      ${info.monthly}<span className="text-gray-400 dark:text-gray-500">/mo</span>
    </span>
  );

  if (compact) {
    return (
      <p className={`text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ${className ?? ""}`}>
        From {amount} if qualify
      </p>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center mt-2 whitespace-nowrap text-[13px] sm:text-[16px] ${className ?? ""}`}>
      <div className="flex flex-row items-center">
        <span className=" text-gray-400 dark:text-gray-500 mr-1">From
          <span className="text-gray-400 dark:text-gray-500 ml-1 mr-0.5">{amount}</span>with</span>
        {info.showAfterpay && (
          <>
            <AfterpayLogo />
            <span className="text-gray-400 dark:text-gray-500 mx-1">or</span>
          </>
        )}
        <AffirmLogo />
      </div>
      <span className="text-gray-400 italic dark:text-gray-500 sm:ml-1 flex text-[13px] sm:text-[16px]"><span className="hidden sm:flex mr-1">· </span>Checkout to see if you qualify</span>
    </div>
  );
}
