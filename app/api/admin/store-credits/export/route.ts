import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function escapeCSV(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function toRow(fields: unknown[]): string {
  return fields.map(escapeCSV).join(",");
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "credits";

  if (type === "transactions") {
    const { data: rows } = await supabaseAdmin
      .from("store_credit_transactions")
      .select("id, store_credit_id, order_id, checkout_reference, transaction_type, amount_cents, balance_before_cents, balance_after_cents, reason, created_by, created_at, store_credits:store_credit_id(code, customer_email)")
      .order("created_at", { ascending: false });

    const headers = ["Transaction ID", "Credit Code", "Customer Email", "Order ID", "Type", "Amount (USD)", "Balance Before", "Balance After", "Reason", "Created By", "Created At"];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const sc = r.store_credits as unknown as { code: string; customer_email: string } | null;
      lines.push(toRow([
        r.id, sc?.code ?? "", sc?.customer_email ?? "", r.order_id ?? "", r.transaction_type,
        (r.amount_cents / 100).toFixed(2), (r.balance_before_cents / 100).toFixed(2), (r.balance_after_cents / 100).toFixed(2),
        r.reason ?? "", r.created_by ?? "", r.created_at,
      ]));
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="store_credit_transactions.csv"`,
      },
    });
  }

  const { data: rows } = await supabaseAdmin
    .from("store_credits")
    .select("id, code, customer_email, source_order_id, original_amount_cents, remaining_amount_cents, status, reason, usage_mode, issued_at, issued_by, expires_at, orders:source_order_id(order_number)")
    .order("issued_at", { ascending: false });

  const headers = ["Credit ID", "Code", "Customer Email", "Source Order", "Original Amount (USD)", "Remaining Amount (USD)", "Status", "Reason", "Usage Mode", "Issued At", "Issued By", "Expires At"];
  const lines = [headers.join(",")];
  for (const r of rows ?? []) {
    const order = r.orders as unknown as { order_number: string } | null;
    lines.push(toRow([
      r.id, r.code, r.customer_email, order?.order_number ?? "",
      (r.original_amount_cents / 100).toFixed(2), (r.remaining_amount_cents / 100).toFixed(2),
      r.status, r.reason, r.usage_mode, r.issued_at, r.issued_by, r.expires_at ?? "",
    ]));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="store_credits.csv"`,
    },
  });
}
