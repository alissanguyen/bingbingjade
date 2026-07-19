import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin, approvedCreatedBy } from "@/lib/approved-auth";
import { adjustStoreCreditBalance, normalizeEmail } from "@/lib/store-credit";

function actorId(session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>): string {
  return session.type === "admin" ? "admin" : approvedCreatedBy(session.user.id);
}

// GET — full detail + reconciled transaction history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: storeCredit, error } = await supabaseAdmin
    .from("store_credits")
    .select("*, orders:source_order_id(order_number, customer_name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !storeCredit) {
    return NextResponse.json({ error: "Store credit not found." }, { status: 404 });
  }

  const { data: transactions } = await supabaseAdmin
    .from("store_credit_transactions")
    .select("*, orders:order_id(order_number)")
    .eq("store_credit_id", id)
    .order("created_at", { ascending: false });

  // Reconciliation: the ledger's running balance_after_cents on the most
  // recent row must match the cached remaining_amount_cents.
  const reconciled = (transactions ?? []).length === 0 || transactions![0].balance_after_cents === storeCredit.remaining_amount_cents;

  return NextResponse.json({ storeCredit, transactions: transactions ?? [], reconciled });
}

// PATCH — admin actions: extend/remove expiration, adjust balance, revoke, transfer
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    action?: "set_expiration" | "adjust_balance" | "revoke" | "transfer";
    expiresAt?: string | null;
    deltaCents?: number;
    reason?: string;
    newEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("store_credits")
    .select("id, status, remaining_amount_cents, customer_email, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Store credit not found." }, { status: 404 });

  switch (body.action) {
    case "set_expiration": {
      const { data: updated, error } = await supabaseAdmin
        .from("store_credits")
        .update({ expires_at: body.expiresAt ?? null })
        .eq("id", id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ storeCredit: updated });
    }

    case "adjust_balance": {
      if (!body.reason?.trim()) {
        return NextResponse.json({ error: "A reason is required for manual balance adjustments." }, { status: 400 });
      }
      if (!body.deltaCents || body.deltaCents === 0) {
        return NextResponse.json({ error: "A non-zero adjustment amount is required." }, { status: 400 });
      }
      const ok = await adjustStoreCreditBalance({
        storeCreditId: id,
        deltaCents: body.deltaCents,
        reason: body.reason.trim(),
        createdBy: actorId(session),
      });
      if (!ok) {
        return NextResponse.json({ error: "Adjustment would take the balance below zero." }, { status: 400 });
      }
      const { data: updated } = await supabaseAdmin.from("store_credits").select("*").eq("id", id).single();
      return NextResponse.json({ storeCredit: updated });
    }

    case "revoke": {
      if (existing.remaining_amount_cents <= 0) {
        return NextResponse.json({ error: "This credit has no remaining balance to revoke." }, { status: 400 });
      }
      // Check for a live reservation before allowing revocation.
      const { data: liveReservation } = await supabaseAdmin
        .from("store_credit_transactions")
        .select("id")
        .eq("store_credit_id", id)
        .eq("transaction_type", "reserved")
        .maybeSingle();
      if (liveReservation) {
        return NextResponse.json({ error: "This credit is currently reserved by an in-progress checkout. Try again shortly." }, { status: 409 });
      }

      const balanceBefore = existing.remaining_amount_cents;
      const { error: updateErr } = await supabaseAdmin
        .from("store_credits")
        .update({ status: "revoked", remaining_amount_cents: 0 })
        .eq("id", id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

      await supabaseAdmin.from("store_credit_transactions").insert({
        store_credit_id: id,
        transaction_type: "revoked",
        amount_cents: -balanceBefore,
        balance_before_cents: balanceBefore,
        balance_after_cents: 0,
        created_by: actorId(session),
        reason: body.reason?.trim() || "Revoked by admin",
      });

      const { data: updated } = await supabaseAdmin.from("store_credits").select("*").eq("id", id).single();
      return NextResponse.json({ storeCredit: updated });
    }

    case "transfer": {
      if (!body.reason?.trim()) {
        return NextResponse.json({ error: "A reason is required to transfer a credit to another email." }, { status: 400 });
      }
      if (!body.newEmail?.trim()) {
        return NextResponse.json({ error: "A new email address is required." }, { status: 400 });
      }
      const newEmail = normalizeEmail(body.newEmail);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
      }

      const { data: newCustomer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("customer_email", newEmail)
        .maybeSingle();

      const { data: updated, error } = await supabaseAdmin
        .from("store_credits")
        .update({ customer_email: newEmail, customer_id: newCustomer?.id ?? null })
        .eq("id", id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabaseAdmin.from("store_credit_transactions").insert({
        store_credit_id: id,
        transaction_type: "adjusted",
        amount_cents: 0,
        balance_before_cents: existing.remaining_amount_cents,
        balance_after_cents: existing.remaining_amount_cents,
        created_by: actorId(session),
        reason: body.reason.trim(),
        metadata: { transfer_from: existing.customer_email, transfer_to: newEmail },
      });

      return NextResponse.json({ storeCredit: updated });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
