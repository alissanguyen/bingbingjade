/**
 * POST /api/create-upload-url
 *
 * Generates a signed upload URL so the client can upload a video directly
 * to the private jade-videos bucket without routing the file through the server.
 * This avoids serverless function body size limits for large video files.
 *
 * Auth: requires the admin_session cookie.
 *
 * Body: JSON { filename: string, contentType: string }
 *
 * Response: { signedUrl: string, path: string }
 *   signedUrl — PUT this URL with the file as the body
 *   path      — the storage path to save in the database after upload
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { VIDEO_BUCKET } from "@/lib/storage";
import { getSessionUser } from "@/lib/approved-auth";

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let filename: string;
  let contentType: string;
  try {
    ({ filename, contentType } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!filename) {
    return NextResponse.json({ error: "filename required" }, { status: 400 });
  }

  // ── Create signed upload URL ──────────────────────────────────────────────
  const ext = filename.split(".").pop()?.toLowerCase() ?? "mp4";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,           // save this path to the database after the upload completes
  });
}
