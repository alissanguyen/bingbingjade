import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable, storageMock } from "../helpers/supabase-mock";

// Regression test: the route used to 404 the instant product_original_images
// was empty, even when a product with that SKU actually existed -- which is
// exactly the state of every Catalog Contributor listing submitted before
// original-image tracking was wired up for that flow (their raw pre-watermark
// files were never preserved, so there's nothing to backfill into that table).
// The product/vendor/sourcing info should still be visible in that case.

const fromMock = vi.fn();
const storage = storageMock();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args), storage } }));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { GET } = await import("@/app/api/admin/item-origin-lookup/route");

function makeReq(sku: string) {
  return new NextRequest(`http://localhost/api/admin/item-origin-lookup?sku=${sku}`);
}

beforeEach(() => {
  fromMock.mockReset();
  mockSession = { type: "admin" };
});

describe("GET /api/admin/item-origin-lookup", () => {
  it("returns the product info even when zero original images were ever recorded", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: null, error: null })) // product_originals — no vendor snapshot
      .mockReturnValueOnce(chainable({ data: [], error: null })) // product_original_images — none recorded
      .mockReturnValueOnce(chainable({ data: { id: "prod1", name: "Icy Jelly Bangle", public_id: "abc123" }, error: null })); // products

    const res = await GET(makeReq("00012345"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.product?.name).toBe("Icy Jelly Bangle");
    expect(json.images).toEqual([]);
  });

  it("still 404s when neither a product nor any originals exist for the SKU", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: null, error: null }))
      .mockReturnValueOnce(chainable({ data: [], error: null }))
      .mockReturnValueOnce(chainable({ data: null, error: null }));

    const res = await GET(makeReq("00000000"));
    expect(res.status).toBe(404);
  });
});
