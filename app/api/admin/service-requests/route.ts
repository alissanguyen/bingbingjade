import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { resolveServiceAttachmentUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const status = searchParams.get("status") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const from = (page - 1) * limit;

  let query = supabaseAdmin
    .from("service_requests")
    .select(
      "id, request_number, status, capture_status, customer_name, customer_email, price_cents, created_at, service:services(name, slug)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq("status", status);
  if (search) {
    query = query.or(`request_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const ids = rows.map((r) => r.id);

  // Thumbnail + count of customer-submitted images, per row.
  const thumbByRequest = new Map<string, { count: number; thumbKey: string | null }>();
  if (ids.length > 0) {
    const { data: attachments } = await supabaseAdmin
      .from("service_request_attachments")
      .select("service_request_id, storage_key, sort_order")
      .in("service_request_id", ids)
      .eq("attachment_type", "customer_submission")
      .is("deleted_at", null)
      .order("sort_order");

    for (const a of attachments ?? []) {
      const existing = thumbByRequest.get(a.service_request_id);
      if (!existing) {
        thumbByRequest.set(a.service_request_id, { count: 1, thumbKey: a.storage_key });
      } else {
        existing.count += 1;
      }
    }
  }

  const requests = await Promise.all(
    rows.map(async (r) => {
      const thumb = thumbByRequest.get(r.id);
      return {
        ...r,
        imageCount: thumb?.count ?? 0,
        thumbnailUrl: thumb?.thumbKey ? await resolveServiceAttachmentUrl(thumb.thumbKey) : null,
      };
    })
  );

  return NextResponse.json({ requests, total: count ?? 0, page, limit });
}
