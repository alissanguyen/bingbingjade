/**
 * POST /api/image/process-background
 *
 * Replaces the background of a product image using OpenAI gpt-image-1.
 * Two background modes: "navy" (#061B35) or "beige" (#F3E8D3).
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

export const dynamic = "force-dynamic";
export const maxDuration = 120; // OpenAI image editing can be slow

// ── Feature flag ──────────────────────────────────────────────────────────────
// Set to false to disable the feature entirely (returns an error immediately).
const USE_AI_BACKGROUND = true;

// ── Prompts ───────────────────────────────────────────────────────────────────
const PROMPTS: Record<"navy" | "beige", string> = {
  navy: "Replace only the background with a smooth luxury dark navy blue studio background (#061B35). Keep the jade item exactly unchanged: color, translucency, texture, veining, cotton, blemishes, shape, polish, size, and reflections. Do not enhance, recolor, redraw, resize, or reinterpret the jade. Keep the hand/arm natural if present. Only remove and replace the background.",
  beige: "Replace only the background with a smooth warm beige studio background (#F3E8D3). Keep the jade item exactly unchanged: color, translucency, texture, veining, cotton, blemishes, shape, polish, size, and reflections. Do not enhance, recolor, redraw, resize, or reinterpret the jade. Keep the hand/arm natural if present. Only remove and replace the background.",
};

// ── Route handler ─────────────────────────────────────────────────────────────

interface RequestBody {
  imageBase64?: string; // data URL ("data:image/...;base64,...") or raw base64
  imageUrl?: string;   // full https:// URL — server will fetch it
  backgroundMode: "navy" | "beige";
}

export async function POST(req: NextRequest) {
  // Auth
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
      // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
      const raw = imageBase64.replace(/^data:[^;]+;base64,/, "");
      imageBytes = Buffer.from(raw, "base64");
    } else {
      const fetchRes = await fetch(imageUrl!);
      if (!fetchRes.ok) throw new Error(`Failed to fetch image: HTTP ${fetchRes.status}`);
      imageBytes = Buffer.from(await fetchRes.arrayBuffer());
    }

    // ── 2. Call OpenAI Images Edit API ────────────────────────────────────────
    const formData = new FormData();
    // gpt-image-1 accepts PNG; send as PNG regardless of original format
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

    // ── 3. Extract result ─────────────────────────────────────────────────────
    const resultItem = openaiJson.data?.[0];
    if (!resultItem) throw new Error("No result from OpenAI");

    // gpt-image-1 returns b64_json by default; fall back to fetching the URL
    let processedBase64: string;
    if (resultItem.b64_json) {
      processedBase64 = resultItem.b64_json;
    } else if (resultItem.url) {
      const imgRes = await fetch(resultItem.url);
      if (!imgRes.ok) throw new Error("Failed to download processed image");
      const buf = await imgRes.arrayBuffer();
      processedBase64 = Buffer.from(buf).toString("base64");
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
