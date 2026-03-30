/**
 * POST /api/generate-product-copy
 *
 * Generates product title, description, and blemishes using Claude.
 * Called from the admin add-product form when the user clicks "Generate Copy".
 * The response prefills existing form fields — the user reviews and saves through
 * the normal createProduct flow. Nothing here touches the database.
 *
 * Auth: requires the admin_session cookie.
 *
 * Body (JSON):
 *   category    — product category (bracelet, bangle, ring, etc.)
 *   colors      — selected color names
 *   tiers       — selected quality tiers
 *   size        — primary size in mm
 *   origin      — origin country
 *   sourceNotes — optional raw vendor/source notes (may be in Vietnamese)
 *
 * Response: { title, description, blemishes }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isApproved } from "@/lib/approved-auth";
import { anthropic } from "@/lib/claude";

export const dynamic = "force-dynamic";

interface ImagePayload {
  data: string; // base64 JPEG, resized to ~1024px client-side
  mediaType: "image/jpeg";
}

interface GenerateRequest {
  category: string;
  colors: string[];
  tiers: string[];
  size: string;
  origin: string;
  sourceNotes?: string;
  images?: ImagePayload[]; // up to 3 product photos for vision analysis
}

function buildPrompt(data: GenerateRequest): string {
  const { category, colors, tiers, size, origin, sourceNotes, images } = data;
  const hasPhotos = (images?.length ?? 0) > 0;

  const colorStr = colors.length > 0 ? colors.join(", ") : "unspecified";
  const tierStr = tiers.length > 0 ? tiers.join(", ") : "unspecified";
  const sizeStr = size ? `${size}mm` : "unspecified";
  const notesStr = sourceNotes?.trim() || "(none provided)";

  return `You are an expert copywriter for a premium jade jewelry boutique. Generate product copy for a jadeite piece.
${hasPhotos ? "You have been provided with actual photos of the piece above. Base your copy primarily on what you observe in the photos — color, translucency, texture, inclusions, pattern, and overall visual impression. The structured facts below supplement the photos." : "No photos were provided. Base your copy on the structured facts below."}

PRODUCT FACTS:
- Type: ${category}
- Colors: ${colorStr}
- Transparency/Tier: ${tierStr}
- Size: ${sizeStr}
- Origin: ${origin}
- Source/vendor notes: ${notesStr}

Generate exactly these fields. Return STRICT JSON with no markdown, no code fences, no commentary:

{
  "title": "...",
  "description": "...",
  "blemishes": "...",
  "size": <number in mm, or null if not determinable>,
  "width": <number in mm, or null if not provided>,
  "thickness": <number in mm, or null if not provided>,
  "origin": <"Myanmar" | "Guatemala" | "Hetian" — default to "Myanmar" if not specified>,
  "imported_price_vnd": <integer in VND, or null if not mentioned — parse Vietnamese currency expressions like "5 triệu" = 5000000, "2.5tr" = 2500000>
}

TITLE RULES:
- Capture the visual soul of the piece: translucency, texture, color movement, pattern, mood
- Format: evocative phrase that reads like a premium listing title
- Include the product type and size when it feels natural (e.g. bangle 54mm), but do not force it
- Do NOT write generic titles like "Natural Jadeite Bangle 56mm - Blue and Purple" or "Green Jade Ring"
- Do NOT keyword-stuff
- Do NOT use cheesy mystical or fantasy language
- GOOD examples: "Soft Jelly Translucency with Moss Accents", "Icy Blue with Floating Emerald Bangle 52mm", "Deep Forest Floating Jadeite Bangle", "Spring Green-Emerald Jadeite Band"

DESCRIPTION RULES:
- Single paragraph only, 2–4 sentences
- Luxury tone — clear, trustworthy, and specific to this piece
- Describe texture, translucency, color, and overall visual impression
- Do NOT sound like a lab report or a mass-produced listing
- Do NOT mention certification or "Type A" unless the source notes explicitly state it
- Do NOT invent facts not present in the input

BLEMISHES RULES:
- Be accurate and gentle — this field supports buyer trust
- CRITICAL: If source notes indicate a highly perfected or very clean piece (e.g. "hoàn hảo", "hoàn hảo cao", "không sớ rạn cấn", "không khuyết điểm đáng kể", "rất hoàn mỹ", or equivalent English), use affirmative language:
  "Highly perfected piece.", "Very clean overall.", "Exceptionally refined presentation.", "No notable surface flaws observed.", "A highly selected piece with a very clean overall appearance."
- Do NOT add generic cautionary disclaimers ("natural inclusions may be present", "internal structures typical of jade") to a piece the vendor described as clean
- If a specific flaw is disclosed in the source notes, describe it gently and honestly
- If no flaw information is provided, write a neutral positive statement — do not invent problems
- Do NOT over-disclaim or falsely claim perfection if a flaw is given`;
}

export async function POST(req: NextRequest) {
  // Auth — admin or approved users can generate copy
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { category, colors, tiers, size, origin, sourceNotes, images } = body;
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  // claude-opus-4-6 pricing (per million tokens)
  const INPUT_COST_PER_MTOK = 15;
  const OUTPUT_COST_PER_MTOK = 75;
  const COST_LIMIT_USD = 0.20;

  try {
    // Build content array — images first so Claude sees them before the instructions
    const content: Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"] = [];

    for (const img of images ?? []) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      });
    }

    content.push({ type: "text", text: buildPrompt({ category, colors, tiers, size, origin, sourceNotes, images }) });

    // Pre-flight cost check — count input tokens before spending anything
    const { input_tokens } = await anthropic.messages.countTokens({
      model: "claude-opus-4-6",
      messages: [{ role: "user", content }],
    });
    const estimatedCost =
      (input_tokens / 1_000_000) * INPUT_COST_PER_MTOK +
      (1024 / 1_000_000) * OUTPUT_COST_PER_MTOK; // 1024 = max_tokens worst case

    if (estimatedCost > COST_LIMIT_USD) {
      return NextResponse.json(
        { error: `Request would cost ~$${estimatedCost.toFixed(3)}, which exceeds the $${COST_LIMIT_USD.toFixed(2)} limit. Try reducing the number of images or shortening the notes.` },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract the JSON object — defensive in case Claude adds surrounding text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[generate-product-copy] no JSON in response:", raw);
      return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (typeof parsed.title !== "string" || typeof parsed.description !== "string" || typeof parsed.blemishes !== "string") {
      console.error("[generate-product-copy] unexpected shape:", parsed);
      return NextResponse.json({ error: "AI response missing required fields" }, { status: 500 });
    }

    const toNum = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);

    return NextResponse.json({
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      blemishes: parsed.blemishes.trim(),
      size: toNum(parsed.size),
      width: toNum(parsed.width),
      thickness: toNum(parsed.thickness),
      origin: ["Myanmar", "Guatemala", "Hetian"].includes(parsed.origin) ? parsed.origin : "Myanmar",
      // Never return profit margin data to approved users
      imported_price_vnd: isApproved(session) ? null : toNum(parsed.imported_price_vnd),
    });
  } catch (err) {
    // Surface the real error message so it's visible in the UI during debugging
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-product-copy] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
