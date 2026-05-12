import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import type { BannerStyle } from "@/lib/banner-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("site_banners")
    .select("id, is_active, preset, messages, start_date, end_date, countdown_label, cta_text, cta_link, style")
    .eq("id", "main")
    .maybeSingle();

  return NextResponse.json(
    data ?? { id: "main", is_active: false, preset: "custom", messages: [], start_date: null, end_date: null, cta_text: null, cta_link: null, style: null }
  );
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? (body.messages as unknown[]).filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim())
    : [];

  const rawStyle = body.style as BannerStyle | null | undefined;
  const style: BannerStyle | null = rawStyle && typeof rawStyle === "object"
    ? {
        theme:           rawStyle.theme ?? "dark",
        backgroundColor: typeof rawStyle.backgroundColor === "string" ? rawStyle.backgroundColor : undefined,
        textColor:       typeof rawStyle.textColor       === "string" ? rawStyle.textColor       : undefined,
        accentColor:     typeof rawStyle.accentColor     === "string" ? rawStyle.accentColor     : undefined,
        borderColor:     typeof rawStyle.borderColor     === "string" ? rawStyle.borderColor     : undefined,
      }
    : null;

  const { error } = await supabaseAdmin
    .from("site_banners")
    .upsert(
      {
        id:         "main",
        is_active:  Boolean(body.is_active),
        preset:     typeof body.preset === "string" ? body.preset : "custom",
        messages,
        start_date: typeof body.start_date === "string" && body.start_date ? body.start_date : null,
        end_date:        typeof body.end_date        === "string" && body.end_date        ? body.end_date        : null,
        countdown_label: body.countdown_label === "Starting in" || body.countdown_label === "Ends in" ? body.countdown_label : null,
        cta_text:   typeof body.cta_text   === "string" && body.cta_text   ? body.cta_text.trim()  : null,
        cta_link:   typeof body.cta_link   === "string" && body.cta_link   ? body.cta_link.trim()  : null,
        style,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
