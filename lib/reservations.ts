import { supabaseAdmin } from "@/lib/supabase-admin";

export interface ReservationDepositPayment {
  id: string;
  amountUsd: number;
  paidAt: string;
  stripePaymentIntentId: string | null;
}

/**
 * Sum of all deposit payments collected so far for a reservation, in cents.
 * Single source of truth — used by checkout (to compute the credit) and the
 * admin UI (to show the running total). Never trust a client-supplied figure
 * for this; always re-derive it here.
 */
export async function getDepositTotalCents(reservationId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("reservation_deposit_payments")
    .select("amount_usd")
    .eq("reservation_id", reservationId);

  const totalUsd = (data ?? []).reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
  return Math.round(totalUsd * 100);
}

/** Full deposit payment history for a reservation, oldest first. */
export async function getDepositPayments(reservationId: string): Promise<ReservationDepositPayment[]> {
  const { data } = await supabaseAdmin
    .from("reservation_deposit_payments")
    .select("id, amount_usd, paid_at, stripe_payment_intent_id")
    .eq("reservation_id", reservationId)
    .order("paid_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amountUsd: Number(row.amount_usd),
    paidAt: row.paid_at as string,
    stripePaymentIntentId: row.stripe_payment_intent_id as string | null,
  }));
}
