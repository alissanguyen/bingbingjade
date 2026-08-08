import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable } from "../helpers/supabase-mock";

// Regression test: the queue used to render the bare storage path directly
// as an <img src>, which always 404s (draft-bucket images are private,
// public-bucket paths aren't real URLs either). The route must resolve a
// signed draft URL for anything not yet PUBLISHED, and a public URL once it is.

const fromMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) } }));

const resolveEmployeeDraftUrlMock = vi.fn();
const resolveImageUrlMock = vi.fn();
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    resolveEmployeeDraftUrl: (...args: unknown[]) => resolveEmployeeDraftUrlMock(...args),
    resolveImageUrl: (...args: unknown[]) => resolveImageUrlMock(...args),
  };
});

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { GET } = await import("@/app/api/admin/listing-approvals/route");

function makeReq() {
  return new NextRequest("http://localhost/api/admin/listing-approvals");
}

function productsRow(overrides: Record<string, unknown>) {
  return {
    id: "p1",
    name: "Test Bangle",
    category: "bangle",
    images: ["wm/abc.webp"],
    listing_status: "AWAITING_APPROVAL",
    current_submission_version: 1,
    created_by_employee_id: "emp1",
    price_display_usd: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  fromMock.mockReset();
  resolveEmployeeDraftUrlMock.mockReset();
  resolveImageUrlMock.mockReset();
  mockSession = { type: "admin" };
});

describe("GET /api/admin/listing-approvals — thumbnail resolution", () => {
  it("resolves a signed draft URL for a not-yet-published listing", async () => {
    resolveEmployeeDraftUrlMock.mockResolvedValue("https://signed.example/wm/abc.webp?token=x");
    fromMock
      .mockReturnValueOnce(chainable({ data: [productsRow({ listing_status: "AWAITING_APPROVAL" })], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null })) // employee_profiles
      .mockReturnValueOnce(chainable({ data: [], error: null })) // product_costs
      .mockReturnValueOnce(chainable({ data: [], error: null })); // listing_submissions

    const res = await GET(makeReq());
    const json = await res.json();

    expect(resolveEmployeeDraftUrlMock).toHaveBeenCalledWith("wm/abc.webp");
    expect(resolveImageUrlMock).not.toHaveBeenCalled();
    expect(json.queue[0].thumbnail).toBe("https://signed.example/wm/abc.webp?token=x");
  });

  it("resolves a public URL for a published listing", async () => {
    resolveImageUrlMock.mockResolvedValue("https://cdn.example/object/public/jade-images/wm/abc.webp");
    fromMock
      .mockReturnValueOnce(chainable({ data: [productsRow({ listing_status: "PUBLISHED" })], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }));

    const res = await GET(makeReq());
    const json = await res.json();

    expect(resolveImageUrlMock).toHaveBeenCalledWith("wm/abc.webp");
    expect(resolveEmployeeDraftUrlMock).not.toHaveBeenCalled();
    expect(json.queue[0].thumbnail).toBe("https://cdn.example/object/public/jade-images/wm/abc.webp");
  });

  it("returns null (not a broken path) when a listing has no images", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: [productsRow({ images: [] })], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }));

    const res = await GET(makeReq());
    const json = await res.json();

    expect(json.queue[0].thumbnail).toBeNull();
    expect(resolveEmployeeDraftUrlMock).not.toHaveBeenCalled();
    expect(resolveImageUrlMock).not.toHaveBeenCalled();
  });
});
