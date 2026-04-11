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

/** Affirm wordmark — black paths use currentColor; blue swoosh stays branded. */
function AffirmLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 429 171"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Affirm"
      className={className}
    >
      {/* "a" letter */}
      <path fillRule="evenodd" clipRule="evenodd" d="M28.1 156.27C22.8 156.27 20.1 153.66 20.1 149.37C20.1 141.37 29.02 138.68 45.29 136.95C45.29 147.61 38.08 156.27 28.05 156.27H28.1ZM35.1 96.32C23.47 96.32 10.1 101.79 2.84 107.58L9.47 121.58C15.29 116.25 24.7 111.69 33.19 111.69C41.26 111.69 45.72 114.39 45.72 119.83C45.72 123.48 42.77 125.33 37.19 126.06C16.33 128.76-0.02 134.52-0.02 150.59C-0.02 163.33 9.05 171.04 23.22 171.04C33.34 171.04 42.34 165.42 46.62 158.04V169.04H65.48V122.95C65.48 103.95 52.29 96.28 35.11 96.28L35.1 96.32Z" fill="currentColor" />
      {/* "r" letter */}
      <path fillRule="evenodd" clipRule="evenodd" d="M224.39 98.39V168.95H244.57V134.95C244.57 118.8 254.35 114.05 261.16 114.05C264.226 114.026 267.229 114.914 269.79 116.6L273.48 97.95C270.62 96.806 267.559 96.251 264.48 96.32C254.11 96.32 247.59 100.91 243.29 110.25V98.39H224.39Z" fill="currentColor" />
      {/* "m" letter */}
      <path fillRule="evenodd" clipRule="evenodd" d="M367 96.32C356.33 96.32 348.35 102.62 344.2 108.7C340.35 100.85 332.2 96.32 322.4 96.32C311.74 96.32 304.35 102.24 300.94 109.06V98.39H281.48V168.95H301.68V132.62C301.68 119.62 308.51 113.33 314.88 113.33C320.65 113.33 325.95 117.06 325.95 126.69V168.95H346.11V132.62C346.11 119.43 352.77 113.33 359.44 113.33C364.78 113.33 370.44 117.21 370.44 126.55V168.95H390.6V120.17C390.6 104.32 379.93 96.32 367.04 96.32" fill="currentColor" />
      {/* "ff" ligature */}
      <path fillRule="evenodd" clipRule="evenodd" d="M175.28 98.39H157V91.22C157 81.88 162.33 79.22 166.92 79.22C170.054 79.261 173.135 80.031 175.92 81.47L182.14 67.24C182.14 67.24 175.83 63.12 164.36 63.12C151.47 63.12 136.8 70.39 136.8 93.2V98.39H106.25V91.22C106.25 81.88 111.57 79.22 116.17 79.22C119.309 79.22 122.4 79.993 125.17 81.47L131.39 67.24C127.68 65.07 121.71 63.12 113.62 63.12C100.73 63.12 86.06 70.39 86.06 93.2V98.39H74.38V113.95H86.09V168.95H106.25V113.95H136.84V168.95H157V113.95H175.28V98.39Z" fill="currentColor" />
      {/* "i" dot */}
      <path d="M207.46 98.39H187.32V168.92H207.46V98.39Z" fill="currentColor" />
      {/* Blue swoosh — brand color, stays in both modes */}
      <path fillRule="evenodd" clipRule="evenodd" d="M188.06 86.4H207.79C219.3 50.21 258.35 18.4 304.79 18.4C361.27 18.4 410.08 61.4 410.08 128.34C410.252 142.08 408.364 155.769 404.48 168.95H423.63L423.82 168.29C427.047 155.241 428.639 141.842 428.56 128.4C428.56 53.75 374.16 0.02 304.83 0.02C250.37 0.02 201.83 37.82 188.07 86.42L188.06 86.4Z" fill="#4A4AF4" />
    </svg>
  );
}

/** Afterpay pill badge — mint green background with dark logo. */
function AfterpayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1581.5 550.4"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Afterpay"
      className={className}
    >
      {/* Mint green pill background */}
      <path fill="#b2fce4" d="M1306.59,550.06H275.49C123.49,550.06.29,426.86.29,274.86H.29C.29,122.86,123.49-.34,275.49-.34h1031.1c152,0,275.2,123.2,275.2,275.2h0c.1,151.9-123.2,275.2-275.2,275.2Z" />
      {/* Logo mark and wordmark — dark on mint */}
      <path d="M1348.29,209.06l-34.6-19.8-35.1-20.1c-23.2-13.3-52.2,3.4-52.2,30.2v4.5c0,2.5,1.3,4.8,3.5,6l16.3,9.3c4.5,2.6,10.1-.7,10.1-5.9v-10.7c0-5.3,5.7-8.6,10.3-6l32,18.4,31.9,18.3c4.6,2.6,4.6,9.3,0,11.9l-31.9,18.3-32,18.4c-4.6,2.6-10.3-.7-10.3-6v-5.3c0-26.8-29-43.6-52.2-30.2l-35.1,20.1-34.6,19.8c-23.3,13.4-23.3,47.1,0,60.5l34.6,19.8,35.1,20.1c23.2,13.3,52.2-3.4,52.2-30.2v-4.5c0-2.5-1.3-4.8-3.5-6l-16.3-9.3c-4.5-2.6-10.1.7-10.1,5.9v10.7c0,5.3-5.7,8.6-10.3,6l-32-18.4-31.9-18.3c-4.6-2.6-4.6-9.3,0-11.9l31.9-18.3,32-18.4c4.6-2.6,10.3.7,10.3,6v5.3c0,26.8,29,43.6,52.2,30.2l35.1-20.1,34.6-19.8c23.3-13.5,23.3-47.1,0-60.5Z" />
      <path d="M1121.29,215.66l-81,167.3h-33.6l30.3-62.5-47.7-104.8h34.5l30.6,70.2,33.4-70.2h33.5Z" />
      <path d="M311.39,275.06c0-20-14.5-34-32.3-34s-32.3,14.3-32.3,34,14.5,34,32.3,34,32.3-14,32.3-34M311.69,334.46v-15.4c-8.8,10.7-21.9,17.3-37.5,17.3-32.6,0-57.3-26.1-57.3-61.3s25.7-61.5,58-61.5c15.2,0,28,6.7,36.8,17.1v-15h29.2v118.8h-29.2Z" />
      <path d="M482.89,308.06c-10.2,0-13.1-3.8-13.1-13.8v-52.7h18.8v-25.9h-18.8v-29h-29.9v29h-38.6v-11.8c0-10,3.8-13.8,14.3-13.8h6.6v-23h-14.4c-24.7,0-36.4,8.1-36.4,32.8v15.9h-16.6v25.8h16.6v92.9h29.9v-92.9h38.6v58.2c0,24.2,9.3,34.7,33.5,34.7h15.4v-26.4h-5.9Z" />
      <path d="M590.29,264.36c-2.1-15.4-14.7-24.7-29.5-24.7s-26.9,9-29.9,24.7h59.4ZM530.59,282.86c2.1,17.6,14.7,27.6,30.7,27.6,12.6,0,22.3-5.9,28-15.4h30.7c-7.1,25.2-29.7,41.3-59.4,41.3-35.9,0-61.1-25.2-61.1-61.1s26.6-61.8,61.8-61.8,61.1,26.1,61.1,61.8c0,2.6-.2,5.2-.7,7.6h-91.1Z" />
      <path d="M812.79,275.06c0-19.2-14.5-34-32.3-34s-32.3,14.3-32.3,34,14.5,34,32.3,34,32.3-14.7,32.3-34M718.69,382.96v-167.3h29.2v15.4c8.8-10.9,21.9-17.6,37.5-17.6,32.1,0,57.3,26.4,57.3,61.3s-25.7,61.5-58,61.5c-15,0-27.3-5.9-35.9-15.9v62.5h-30.1v.1Z" />
      <path d="M947.99,275.06c0-20-14.5-34-32.3-34s-32.3,14.3-32.3,34,14.5,34,32.3,34,32.3-14,32.3-34M948.29,334.46v-15.4c-8.8,10.7-21.9,17.3-37.5,17.3-32.6,0-57.3-26.1-57.3-61.3s25.7-61.5,58-61.5c15.2,0,28,6.7,36.8,17.1v-15h29.2v118.8h-29.2Z" />
      <path d="M665.99,227.26s7.4-13.8,25.7-13.8c7.8,0,12.8,2.7,12.8,2.7v30.3s-11-6.8-21.1-5.4-16.5,10.6-16.5,23v70.3h-30.2v-118.7h29.2v11.6h.1Z" />
    </svg>
  );
}

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
          <AfterpayLogo className="h-4 w-auto" />
          <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">or</span>
        </>
      )}

      {/* Affirm: currentColor paths go gray-900 in light, white in dark */}
      <AffirmLogo className="h-3 w-auto text-gray-900 dark:text-white" />

      <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
        · See if you qualify
      </span>
    </div>
  );
}
