import { describe, it, expect } from "vitest";
import { resolveWatermarkPosition } from "@/lib/watermark";

describe("resolveWatermarkPosition", () => {
  it("centers the watermark on an explicit position, unaffected by category", () => {
    const { left, top } = resolveWatermarkPosition({
      width: 1000,
      height: 800,
      wmarkW: 200,
      wmarkH: 100,
      category: "bangle", // should be ignored once `position` is supplied
      position: { xPercent: 50, yPercent: 50 },
    });
    expect(left).toBe(400); // 50% of 1000 - 200/2
    expect(top).toBe(350); // 50% of 800 - 100/2
  });

  it("clamps an explicit position so the watermark never runs off the top-left edge", () => {
    const { left, top } = resolveWatermarkPosition({
      width: 1000,
      height: 800,
      wmarkW: 200,
      wmarkH: 100,
      position: { xPercent: 0, yPercent: 0 },
    });
    expect(left).toBe(0);
    expect(top).toBe(0);
  });

  it("clamps an explicit position so the watermark never runs off the bottom-right edge", () => {
    const { left, top } = resolveWatermarkPosition({
      width: 1000,
      height: 800,
      wmarkW: 200,
      wmarkH: 100,
      position: { xPercent: 100, yPercent: 100 },
    });
    expect(left).toBe(800); // width - wmarkW
    expect(top).toBe(700); // height - wmarkH
  });

  it("falls back to center-right placement for bangle/necklace when no position is given", () => {
    const { left, top } = resolveWatermarkPosition({
      width: 1000,
      height: 800,
      wmarkW: 200,
      wmarkH: 100,
      category: "necklace",
    });
    expect(left).toBe(500); // 1000 - 200 - 300 (30% margin)
    expect(top).toBe(350); // 50% vertical - half height
  });

  it("falls back to bottom-left placement for every other category when no position is given", () => {
    const { left, top } = resolveWatermarkPosition({
      width: 1000,
      height: 800,
      wmarkW: 200,
      wmarkH: 100,
      category: "ring",
    });
    expect(left).toBe(100); // 10% of width
    expect(top).toBe(620); // height - wmarkH - 10% of height
  });
});
