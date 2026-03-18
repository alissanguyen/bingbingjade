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

  // Horizontal: right edge of watermark sits marginRightPercent * width from the right border
  const left = Math.max(0, width - wmarkW - Math.round(width * WATERMARK.marginRightPercent));
  // Vertical: centered at verticalPositionPercent of image height
  const top = Math.max(0, Math.round(height * WATERMARK.verticalPositionPercent - wmarkH / 2));

  return image
    .rotate() // auto-rotate based on EXIF so the image is correctly oriented first
    .composite([{ input: wmarkPng, left, top, blend: "over" }])
    .jpeg({ quality: WATERMARK.outputQuality })
    .toBuffer();
}
