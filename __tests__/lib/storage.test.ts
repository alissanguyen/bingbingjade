import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase-admin before importing storage so the module never tries to
// initialise a real Supabase client (which would need env vars).
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: null }, error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
  },
}));

import { isStoragePath, toStoragePath, resolveImageUrl, resolveImageUrls } from "@/lib/storage";

const PROJECT = "cszryoixzqtzikvgeksh";
const BASE = `https://${PROJECT}.supabase.co/storage/v1/object`;

// ── isStoragePath ─────────────────────────────────────────────────────────────

describe("isStoragePath", () => {
  it("returns true for bare wm/ paths", () => {
    expect(isStoragePath("wm/abc.jpg")).toBe(true);
  });

  it("returns true for originals/ paths", () => {
    expect(isStoragePath("originals/123-abc")).toBe(true);
  });

  it("returns false for https:// URLs", () => {
    expect(isStoragePath("https://example.com/image.jpg")).toBe(false);
  });

  it("returns false for http:// URLs", () => {
    expect(isStoragePath("http://example.com/image.jpg")).toBe(false);
  });
});

// ── toStoragePath ─────────────────────────────────────────────────────────────

describe("toStoragePath", () => {
  it("leaves a bare path unchanged", () => {
    expect(toStoragePath("wm/abc.jpg")).toBe("wm/abc.jpg");
  });

  it("strips a signed jade-images URL back to path", () => {
    const signed = `${BASE}/sign/jade-images/wm/1773879480796-lsa7h3.jpg?token=eyJhbGciOiJIUzI1NiJ9.xyz`;
    expect(toStoragePath(signed)).toBe("wm/1773879480796-lsa7h3.jpg");
  });

  it("strips a public jade-images URL back to path", () => {
    const pub = `${BASE}/public/jade-images/wm/1773879083053-on65sj.jpg`;
    expect(toStoragePath(pub)).toBe("wm/1773879083053-on65sj.jpg");
  });

  it("strips a signed jade-videos URL back to path", () => {
    const signed = `${BASE}/sign/jade-videos/vid/abc.mp4?token=xyz`;
    expect(toStoragePath(signed)).toBe("vid/abc.mp4");
  });

  it("preserves legacy product-images bucket URLs (different bucket)", () => {
    const legacy = `${BASE}/public/product-images/legacy-photo.jpg`;
    expect(toStoragePath(legacy)).toBe(legacy);
  });

  it("handles paths with sub-folders", () => {
    const pub = `${BASE}/public/jade-images/wm/subfolder/deep/image.jpg`;
    expect(toStoragePath(pub)).toBe("wm/subfolder/deep/image.jpg");
  });

  it("handles the exact real-world failing URL from production", () => {
    const realUrl =
      `https://cszryoixzqtzikvgeksh.supabase.co/storage/v1/object/sign/jade-images/` +
      `wm/1773879480796-lsa7h3.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mYzYxNDM2Zi` +
      `04OTQyLTQ4MGYtYmU1MS01MWQ3YTlmMWUyNDYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJqYWRlLWltYWdlcy` +
      `93bS8xNzczODc5NDgwNzk2LWxzYTdoMy5qcGciLCJpYXQiOjE3NzM5ODE5MTIsImV4cCI6MTc3NDA2ODMxMn0`;
    expect(toStoragePath(realUrl)).toBe("wm/1773879480796-lsa7h3.jpg");
  });
});

// ── resolveImageUrl ───────────────────────────────────────────────────────────

describe("resolveImageUrl", () => {
  it("converts a bare path to a public URL", async () => {
    const result = await resolveImageUrl("wm/abc.jpg");
    expect(result).toBe("https://proj.supabase.co/storage/v1/object/public/jade-images/wm/abc.jpg");
  });

  it("normalises an expired signed URL to a public URL", async () => {
    const signed = `${BASE}/sign/jade-images/wm/abc.jpg?token=expired`;
    const result = await resolveImageUrl(signed);
    expect(result).toContain("/object/public/jade-images/wm/abc.jpg");
    expect(result).not.toContain("token=");
  });

  it("preserves a legacy public-bucket URL as-is", async () => {
    const legacy = `${BASE}/public/product-images/old.jpg`;
    expect(await resolveImageUrl(legacy)).toBe(legacy);
  });
});

// ── resolveImageUrls (batch) ──────────────────────────────────────────────────

describe("resolveImageUrls", () => {
  it("returns empty array for empty input", async () => {
    expect(await resolveImageUrls([])).toEqual([]);
  });

  it("converts storage paths to public URLs", async () => {
    const result = await resolveImageUrls(["wm/abc.jpg", "wm/def.jpg"]);
    expect(result[0]).toContain("wm/abc.jpg");
    expect(result[1]).toContain("wm/def.jpg");
    result.forEach((u) => expect(u).toMatch(/\/object\/public\//));
  });

  it("normalises expired signed URLs in place — the production bug", async () => {
    // This is the exact scenario that caused 400 errors: signed URLs stored
    // in the database (from a product save in the edit form) expired after 24h.
    const inputs = [
      `${BASE}/sign/jade-images/wm/good.jpg?token=valid`,
      `${BASE}/sign/jade-images/wm/bad.jpg?token=expired`,
    ];
    const result = await resolveImageUrls(inputs);
    result.forEach((u) => {
      expect(u).toMatch(/\/object\/public\/jade-images\/wm\//);
      expect(u).not.toContain("token=");
    });
  });

  it("handles mixed array (paths + public URLs + legacy URLs)", async () => {
    const legacy = `${BASE}/public/product-images/old.jpg`;
    const inputs = ["wm/new.jpg", legacy];
    const result = await resolveImageUrls(inputs);
    expect(result[0]).toContain("/object/public/jade-images/wm/new.jpg");
    expect(result[1]).toBe(legacy); // legacy URL untouched
  });
});
