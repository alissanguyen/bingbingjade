import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_IMAGE_BUCKET } from "@/lib/storage";

// PATCH /api/admin/reviews/[id] — approve or reject (unapprove) a review
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { is_approved } = body;

  if (typeof is_approved !== "boolean") {
    return NextResponse.json({ error: "is_approved (boolean) is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update({ is_approved })
    .eq("id", id)
    .select("id, is_approved")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Review not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/reviews/[id] — delete review + remove images from storage
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch image paths before deleting (cascade will wipe the DB rows)
  const { data: images } = await supabaseAdmin
    .from("review_images")
    .select("image_path")
    .eq("review_id", id);

  // Delete the review (cascades to review_images rows)
  const { error } = await supabaseAdmin.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: remove files from storage
  if (images && images.length > 0) {
    const paths = images.map((i) => i.image_path);
    const { error: storageErr } = await supabaseAdmin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .remove(paths);
    if (storageErr) {
      console.warn("[reviews] storage cleanup partial failure:", storageErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}
