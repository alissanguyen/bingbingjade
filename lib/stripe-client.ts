import { loadStripe } from "@stripe/stripe-js";

const isLive = process.env.NEXT_PUBLIC_CHECKOUT_MODE === "live";

export const stripePromise = loadStripe(
  isLive
    ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY!
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);
