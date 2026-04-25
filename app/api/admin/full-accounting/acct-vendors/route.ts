import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("acct_vendors")
    .select("*")
    .order("vendor_code");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vendor_code, vendor_display_name, real_name, country, contact_info, notes } = body as {
    vendor_code: string;
    vendor_display_name?: string;
    real_name?: string;
    country?: string;
    contact_info?: string;
    notes?: string;
  };

  if (!vendor_code?.trim()) {
    return NextResponse.json({ error: "vendor_code is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("acct_vendors")
    .insert({
      vendor_code:          vendor_code.trim().toUpperCase(),
      vendor_display_name:  vendor_display_name?.trim() || null,
      real_name:            real_name?.trim() || null,
      country:              country?.trim() || null,
      contact_info:         contact_info?.trim() || null,
      notes:                notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendor: data });
}
