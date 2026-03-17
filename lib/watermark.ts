/**
 * Watermark utility — applies the logo-credit.svg as a semi-transparent
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
  sizePercent: 0.22,
  /** Pixels from the corner edge. */
  margin: 20,
  /** Quality for the output JPEG (0–100). */
  outputQuality: 90,
};
// ─────────────────────────────────────────────────────────────────────────────

// Cache the raw SVG buffer after first read so we don't hit disk on every upload.
let _svgBuffer: Buffer | null = null;

function getSvgBuffer(): Buffer {
  if (_svgBuffer) return _svgBuffer;
  const svgPath = join(process.cwd(), "public", "logo-credit.svg");
  _svgBuffer = readFileSync(svgPath);
  return _svgBuffer;
}

/**
 * Applies the logo watermark to an image buffer.
 * Returns a JPEG buffer with the watermark composited in the bottom-right corner.
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const { width = 800, height = 800 } = await image.metadata();

  const wmarkW = Math.max(60, Math.round(width * WATERMARK.sizePercent));

  // Rasterize SVG to PNG at the target width.
  // Sharp uses librsvg for SVG → the SVG's own opacity/blur styling is preserved.
  const wmarkPng = await sharp(getSvgBuffer())
    .resize(wmarkW, null, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const { height: wmarkH = wmarkW } = await sharp(wmarkPng).metadata();

  // Position: bottom-right with margin
  const left = Math.max(0, width - wmarkW - WATERMARK.margin);
  const top = Math.max(0, height - wmarkH - WATERMARK.margin);

  return image
    .rotate() // auto-rotate based on EXIF so the image is correctly oriented first
    .composite([{ input: wmarkPng, left, top, blend: "over" }])
    .jpeg({ quality: WATERMARK.outputQuality })
    .toBuffer();
}
