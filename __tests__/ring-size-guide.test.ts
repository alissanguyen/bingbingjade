import { describe, it, expect } from "vitest";
import { recommendRingSize } from "@/app/components/RingSizeGuide";

describe("recommendRingSize", () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it("returns empty when no inputs are provided", () => {
    expect(recommendRingSize()).toEqual({ status: "empty" });
    expect(recommendRingSize(undefined, undefined)).toEqual({ status: "empty" });
  });

  it("returns empty for NaN inputs", () => {
    expect(recommendRingSize(NaN, NaN)).toEqual({ status: "empty" });
  });

  // ── Diameter only ──────────────────────────────────────────────────────────

  it("recommends a size from diameter only", () => {
    const result = recommendRingSize(16.5);
    expect(result).toEqual({ status: "ok", size: 12, source: "diameter" });
  });

  it("recommends nearest size for a diameter that falls between two sizes", () => {
    // 15.05 is between size 7 (15.0) and size 8 (15.3) — closer to 7, but ties go to larger
    const result = recommendRingSize(15.15);
    // 15.15 - 15.0 = 0.15, 15.3 - 15.15 = 0.15 → equidistant, picks larger (8)
    expect(result).toEqual({ status: "ok", size: 8, source: "diameter" });
  });

  it("recommends size 7 for diameter 15.0", () => {
    expect(recommendRingSize(15.0)).toEqual({ status: "ok", size: 7, source: "diameter" });
  });

  it("handles decimal diameter input", () => {
    const result = recommendRingSize(16.7);
    expect(result).toEqual({ status: "ok", size: 13, source: "diameter" });
  });

  // ── Circumference only ─────────────────────────────────────────────────────

  it("recommends a size from circumference only", () => {
    const result = recommendRingSize(undefined, 52);
    expect(result).toEqual({ status: "ok", size: 11, source: "circumference" });
  });

  it("matches a circumference range (size 7 spans 47–48 mm)", () => {
    expect(recommendRingSize(undefined, 47)).toEqual({ status: "ok", size: 7, source: "circumference" });
    expect(recommendRingSize(undefined, 48)).toEqual({ status: "ok", size: 7, source: "circumference" });
    expect(recommendRingSize(undefined, 47.5)).toEqual({ status: "ok", size: 7, source: "circumference" });
  });

  it("handles circumference that falls between two rows", () => {
    // 50 falls between size 9 (49.6) and size 10 (51) — closer to 9 (0.4) vs 10 (1.0) → picks 9
    const result = recommendRingSize(undefined, 50);
    expect(result).toEqual({ status: "ok", size: 9, source: "circumference" });
  });

  it("handles decimal circumference input", () => {
    const result = recommendRingSize(undefined, 49.6);
    expect(result).toEqual({ status: "ok", size: 9, source: "circumference" });
  });

  // ── Both inputs — matching ─────────────────────────────────────────────────

  it("returns both_agree when diameter and circumference point to the same size", () => {
    // Size 12: 16.5 mm diameter, 53 mm circumference
    const result = recommendRingSize(16.5, 53);
    expect(result).toEqual({ status: "ok", size: 12, source: "both_agree" });
  });

  // ── Both inputs — conflicting ──────────────────────────────────────────────

  it("returns conflict and recommends the larger size when methods disagree", () => {
    // Size 11: diam 16.1, circ 52 → size 11
    // Size 12: diam 16.5, circ 53 → size 12
    // Feed diam=16.1 (→11) and circ=53 (→12) — conflict, recommends 12
    const result = recommendRingSize(16.1, 53);
    expect(result).toMatchObject({ status: "conflict", size: 12, sizeDiam: 11, sizeCirc: 12 });
  });

  it("conflict always returns the larger of the two sizes", () => {
    // diam=16.5 (→12) and circ=52 (→11) — conflict, recommends 12
    const result = recommendRingSize(16.5, 52);
    expect(result).toMatchObject({ status: "conflict", size: 12, sizeDiam: 12, sizeCirc: 11 });
  });

  // ── Below minimum ──────────────────────────────────────────────────────────

  it("returns below when diameter is too small", () => {
    expect(recommendRingSize(10)).toEqual({ status: "below" });
  });

  it("returns below when circumference is too small", () => {
    expect(recommendRingSize(undefined, 30)).toEqual({ status: "below" });
  });

  it("returns below when both inputs are below the minimum", () => {
    expect(recommendRingSize(10, 30)).toEqual({ status: "below" });
  });

  // ── Above maximum ──────────────────────────────────────────────────────────

  it("returns above when diameter is too large", () => {
    expect(recommendRingSize(30)).toEqual({ status: "above" });
  });

  it("returns above when circumference is too large", () => {
    expect(recommendRingSize(undefined, 90)).toEqual({ status: "above" });
  });

  it("returns above when both inputs are above the maximum", () => {
    expect(recommendRingSize(30, 90)).toEqual({ status: "above" });
  });

  // ── Edge / boundary cases ──────────────────────────────────────────────────

  it("handles the smallest size (5) correctly", () => {
    expect(recommendRingSize(14.7)).toEqual({ status: "ok", size: 5, source: "diameter" });
    expect(recommendRingSize(undefined, 45)).toEqual({ status: "ok", size: 5, source: "circumference" });
  });

  it("handles the largest size (29) correctly", () => {
    expect(recommendRingSize(22.3)).toEqual({ status: "ok", size: 29, source: "diameter" });
    expect(recommendRingSize(undefined, 70.1)).toEqual({ status: "ok", size: 29, source: "circumference" });
  });
});
