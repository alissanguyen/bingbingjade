import { describe, it, expect } from "vitest";
import { slugify, productSlug, publicIdFromSlug } from "@/lib/slug";

// ── slugify ───────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases text", () => {
    expect(slugify("GREEN JADE BANGLE")).toBe("green-jade-bangle");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("icy green jade bangle")).toBe("icy-green-jade-bangle");
  });

  it("removes special characters", () => {
    expect(slugify("Fine Jade (55mm)")).toBe("fine-jade-55mm");
  });

  it("collapses multiple separators into one hyphen", () => {
    expect(slugify("jade  --  bangle")).toBe("jade-bangle");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--jade--")).toBe("jade");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(slugify("56mm Type A")).toBe("56mm-type-a");
  });

  it("handles unicode characters by stripping them", () => {
    // Chinese characters are non-ASCII, so they get replaced
    expect(slugify("翡翠 jade")).toBe("jade");
  });
});

// ── productSlug ───────────────────────────────────────────────────────────────

describe("productSlug", () => {
  it("combines slug and public_id with a hyphen", () => {
    expect(productSlug({ slug: "icy-green-bangle", public_id: "a1b2c3d4" })).toBe(
      "icy-green-bangle-a1b2c3d4"
    );
  });

  it("works with empty slug", () => {
    expect(productSlug({ slug: "", public_id: "a1b2c3d4" })).toBe("-a1b2c3d4");
  });
});

// ── publicIdFromSlug ──────────────────────────────────────────────────────────

describe("publicIdFromSlug", () => {
  it("extracts the last segment as the public_id", () => {
    expect(publicIdFromSlug("icy-green-bangle-a1b2c3d4")).toBe("a1b2c3d4");
  });

  it("handles single-segment slug (no hyphen) — returns the whole string", () => {
    expect(publicIdFromSlug("a1b2c3d4")).toBe("a1b2c3d4");
  });

  it("handles deeply nested names", () => {
    expect(publicIdFromSlug("very-long-product-name-with-many-parts-a1b2c3d4")).toBe("a1b2c3d4");
  });

  it("returns null for empty string", () => {
    expect(publicIdFromSlug("")).toBeNull();
  });

  it("is inverse of productSlug (round-trip)", () => {
    const publicId = "a1b2c3d4";
    const slug = productSlug({ slug: "icy-green-bangle", public_id: publicId });
    expect(publicIdFromSlug(slug)).toBe(publicId);
  });
});
