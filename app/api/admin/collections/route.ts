import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("collections")
    .select("id, slug, name, subtitle, status, sort_order, hero_image, created_at")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    slug: string;
    subtitle?: string | null;
    description?: string | null;
    status?: "draft" | "published";
    sort_order?: number;
  };

  if (!body.name?.trim() || !body.slug?.trim())
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("collections")
    .insert({
      name: body.name.trim(),
      slug: body.slug.trim(),
      subtitle: body.subtitle ?? null,
      description: body.description ?? null,
      status: body.status ?? "draft",
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
