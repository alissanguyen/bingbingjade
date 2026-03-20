import Stripe from "stripe";

const isLive = process.env.NEXT_PUBLIC_CHECKOUT_MODE === "live";

export const stripe = new Stripe(
  isLive ? process.env.STRIPE_LIVE_SECRET_KEY! : process.env.STRIPE_SECRET_KEY!,
  { apiVersion: "2026-02-25.clover", typescript: true }
);

export const webhookSecret = isLive
  ? process.env.STRIPE_LIVE_WEBHOOK_SECRET!
  : process.env.STRIPE_WEBHOOK_SECRET!;
