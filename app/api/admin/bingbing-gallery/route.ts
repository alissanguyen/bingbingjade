import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { bingbingGalleryPublicUrl } from "@/lib/storage";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const images = (data ?? []).map((row) => ({ ...row, url: bingbingGalleryPublicUrl(row.storage_path) }));
  return NextResponse.json({ images });
}
