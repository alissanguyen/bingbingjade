/**
 * Watermark utility — applies the watermark.svg as a semi-transparent
 * overlay onto product images at upload time.
 *
 * NOTE: This is deterrence / branding, not DRM. A determined person can still
 * remove a watermark. The goal is to make casual copying less useful.
 *
 * Requires: npm install sharp
 * Works in Node.js API routes. Requires librsvg for SVG rasterization (available
 * on Vercel's Node.js runtime via the Sharp native bundle).
 */

import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// ── Tweak these to adjust watermark appearance ───────────────────────────────
export const WATERMARK = {
  /** Watermark width as a fraction of the image width (0–1). */
  sizePercent: 0.44,
  /** Gap between the RIGHT edge of the watermark and the RIGHT border of the image,
   *  expressed as a fraction of image width. 0.30 = 30% in from the right edge,
   *  making it hard to crop out with a simple edge crop. */
  marginRightPercent: 0.30,
  /** Vertical position as a fraction of image height (0 = top, 1 = bottom).
   *  0.5 = vertically centered. */
  verticalPositionPercent: 0.50,
  /** Quality for the output JPEG (0–100). */
  outputQuality: 90,
};
// ─────────────────────────────────────────────────────────────────────────────

// Cache the raw SVG buffer after first read so we don't hit disk on every upload.
let _svgBuffer: Buffer | null = null;

function getSvgBuffer(): Buffer {
  if (_svgBuffer) return _svgBuffer;
  const svgPath = join(process.cwd(), "public", "watermark.svg");
  _svgBuffer = readFileSync(svgPath);
  return _svgBuffer;
}

/**
 * Categories where the subject fills the center (bangle hole, pendant drop) —
 * watermark goes center-right so it sits in the empty space.
 * Everything else (ring, bracelet, etc.) gets bottom-left so it doesn't obscure
 * the main subject sitting in the middle of the frame.
 */
const CENTER_CATEGORIES = new Set(["bangle", "necklace"]);

/**
 * Applies the logo watermark to an image buffer.
 * Position depends on category:
 *   bangle / necklace  → center-right (30% inset from right, vertically centered)
 *   everything else    → bottom-left  (10% from left, 10% from bottom)
 */
export async function applyWatermark(input: Buffer, category = ""): Promise<Buffer> {
  // Compute post-resize dimensions without encoding an intermediate JPEG.
  // Sharp's fit:"inside" with withoutEnlargement scales by min(2000/w, 2000/h, 1).
  const { width: origW = 800, height: origH = 800 } = await sharp(input).metadata();
  const scale = Math.min(1, 2000 / Math.max(origW, origH));
  const width = Math.round(origW * scale);
  const height = Math.round(origH * scale);

  const wmarkW = Math.max(60, Math.round(width * WATERMARK.sizePercent));

  // Rasterize SVG to PNG at the target width.
  // Sharp uses librsvg for SVG → the SVG's own opacity/blur styling is preserved.
  const wmarkPng = await sharp(getSvgBuffer())
    .resize(wmarkW, null, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const { height: wmarkH = wmarkW } = await sharp(wmarkPng).metadata();

  let left: number;
  let top: number;

  if (CENTER_CATEGORIES.has(category)) {
    // Center-right: right edge 30% inset from right, vertically centered
    left = Math.max(0, width - wmarkW - Math.round(width * WATERMARK.marginRightPercent));
    top = Math.max(0, Math.round(height * WATERMARK.verticalPositionPercent - wmarkH / 2));
  } else {
    // Bottom-left: 10% from left edge, 10% from bottom edge
    left = Math.round(width * 0.10);
    top = Math.max(0, height - wmarkH - Math.round(height * 0.10));
  }

  // Single pipeline: rotate → resize → composite → JPEG. No intermediate encoding.
  return sharp(input)
    .rotate()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .composite([{ input: wmarkPng, left, top, blend: "over" }])
    .jpeg({ quality: WATERMARK.outputQuality })
    .toBuffer();
}
