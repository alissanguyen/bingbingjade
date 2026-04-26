/**
 * POST /api/image/process-background
 *
 * Replaces the background of a product image using OpenAI gpt-image-1.
 * Two background modes: "navy" (#061B35) or "beige" (#F3E8D3).
 *
 * LOGO HANDLING:
 *   When imageUrl points to a wm/ (watermarked) Supabase path, we fetch the
 *   original unwatermarked file from originals/ instead. The returned base64
 *   has no logo — it re-enters the upload queue as a new file, and the normal
 *   /api/upload-image route re-applies the watermark at save time.
 *
 * This is an OPTIONAL, ISOLATED feature. It does not affect any existing
 * upload, product creation, or database logic. If it fails, nothing breaks.
 *
 * Auth: requires the admin_session cookie.
 *
 * Body (JSON):
 *   imageBase64?   — data URL or raw base64 of the image (for local files)
 *   imageUrl?      — full HTTPS URL of the image (for existing Supabase images)
 *   backgroundMode — "navy" | "beige"
 *
 * Response:
 *   { success: true,  processedBase64: string }   — raw base64 PNG (no data: prefix)
 *   { success: false, error: string }
 *
 * Requires: OPENAI_API_KEY in environment
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { IMAGE_BUCKET, toStoragePath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── Feature flag ──────────────────────────────────────────────────────────────
const USE_AI_BACKGROUND = true;

// ── Prompts ───────────────────────────────────────────────────────────────────
const PROMPTS: Record<"navy" | "beige", string> = {
  navy: [
    "TASK: Replace ONLY the background pixels with a smooth luxury dark navy blue studio background color #061B35.",
    "STRICT RULES — violating any of these is a failure:",
    "- Do NOT touch, redraw, re-render, recolor, or alter any pixel of the jade bangle or jewelry item.",
    "- Do NOT change the jade's color, translucency, texture, veining, inclusions, polish, shape, or size.",
    "- Do NOT enhance or beautify the jade in any way.",
    "- Do NOT remove or alter any hand or arm holding the piece.",
    "- Do NOT add any reflections, shadows, or effects to the jade that were not in the original.",
    "- The jade must look IDENTICAL to the input image — only the background changes.",
    "OUTPUT: The subject (jade item and hand if present) is unchanged. The background is solid navy #061B35.",
  ].join(" "),
  beige: [
    "TASK: Replace ONLY the background pixels with a smooth warm beige studio background color #F3E8D3.",
    "STRICT RULES — violating any of these is a failure:",
    "- Do NOT touch, redraw, re-render, recolor, or alter any pixel of the jade bangle or jewelry item.",
    "- Do NOT change the jade's color, translucency, texture, veining, inclusions, polish, shape, or size.",
    "- Do NOT enhance or beautify the jade in any way.",
    "- Do NOT remove or alter any hand or arm holding the piece.",
    "- Do NOT add any reflections, shadows, or effects to the jade that were not in the original.",
    "- The jade must look IDENTICAL to the input image — only the background changes.",
    "OUTPUT: The subject (jade item and hand if present) is unchanged. The background is solid warm beige #F3E8D3.",
  ].join(" "),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a wm/ storage path (e.g. "wm/1234-abc.jpg"), derive the originals/ path.
 * Upload route stores: originals/${id}  and  wm/${id}.jpg
 * So: "wm/1234-abc.jpg" → "originals/1234-abc"
 */
function wmPathToOriginalPath(wmPath: string): string {
  const file = wmPath.replace(/^wm\//, "");       // "1234-abc.jpg"
  const stem = file.replace(/\.[^.]+$/, "");       // "1234-abc"
  return `originals/${stem}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface RequestBody {
  imageBase64?: string;
  imageUrl?: string;
  backgroundMode: "navy" | "beige";
}

export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!USE_AI_BACKGROUND) {
    return NextResponse.json({ success: false, error: "AI background feature is disabled" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "OPENAI_API_KEY not configured" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageBase64, imageUrl, backgroundMode } = body;

  if (!backgroundMode || !PROMPTS[backgroundMode]) {
    return NextResponse.json({ success: false, error: "backgroundMode must be 'navy' or 'beige'" }, { status: 400 });
  }
  if (!imageBase64 && !imageUrl) {
    return NextResponse.json({ success: false, error: "imageBase64 or imageUrl is required" }, { status: 400 });
  }

  try {
    // ── 1. Get image bytes ────────────────────────────────────────────────────
    let imageBytes: Buffer;

    if (imageBase64) {
      // Local file from /add — no watermark yet, use as-is
      const raw = imageBase64.replace(/^data:[^;]+;base64,/, "");
      imageBytes = Buffer.from(raw, "base64");
    } else {
      // Existing Supabase image from /edit — imageUrl is the public wm/ URL.
      // Fetch the original (unwatermarked) file from originals/ instead so
      // OpenAI never sees the logo and the returned image re-enters the upload
      // queue cleanly (watermark is re-applied by /api/upload-image on save).
      const storagePath = toStoragePath(imageUrl!); // e.g. "wm/1234-abc.jpg"

      if (storagePath.startsWith("wm/")) {
        const originalPath = wmPathToOriginalPath(storagePath);
        const { data, error } = await supabaseAdmin.storage
          .from(IMAGE_BUCKET)
          .download(originalPath);
        if (error || !data) {
          // Original not found (e.g. old product uploaded before originals were stored)
          // Fall back to fetching the watermarked URL — better than failing entirely
          console.warn("[process-background] originals/ not found, falling back to wm/ URL:", originalPath);
          const fetchRes = await fetch(imageUrl!);
          if (!fetchRes.ok) throw new Error(`Failed to fetch image: HTTP ${fetchRes.status}`);
          imageBytes = Buffer.from(await fetchRes.arrayBuffer());
        } else {
          imageBytes = Buffer.from(await data.arrayBuffer());
        }
      } else {
        // Legacy public URL or non-wm path — fetch directly
        const fetchRes = await fetch(imageUrl!);
        if (!fetchRes.ok) throw new Error(`Failed to fetch image: HTTP ${fetchRes.status}`);
        imageBytes = Buffer.from(await fetchRes.arrayBuffer());
      }
    }

    // ── 2. Call OpenAI Images Edit API ────────────────────────────────────────
    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(imageBytes)], { type: "image/png" });
    formData.append("image[]", imageBlob, "image.png");
    formData.append("model", "gpt-image-1");
    formData.append("prompt", PROMPTS[backgroundMode]);
    formData.append("n", "1");
    formData.append("size", "1024x1024");

    const openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    const openaiJson = await openaiRes.json().catch(() => ({})) as {
      data?: { b64_json?: string; url?: string }[];
      error?: { message: string };
    };

    if (!openaiRes.ok) {
      throw new Error(openaiJson.error?.message ?? `OpenAI error ${openaiRes.status}`);
    }

    const resultItem = openaiJson.data?.[0];
    if (!resultItem) throw new Error("No result from OpenAI");

    let processedBase64: string;
    if (resultItem.b64_json) {
      processedBase64 = resultItem.b64_json;
    } else if (resultItem.url) {
      const imgRes = await fetch(resultItem.url);
      if (!imgRes.ok) throw new Error("Failed to download processed image");
      processedBase64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
    } else {
      throw new Error("OpenAI returned no image data");
    }

    return NextResponse.json({ success: true, processedBase64 });

  } catch (err) {
    console.error("[process-background] error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Processing failed",
    });
  }
}
