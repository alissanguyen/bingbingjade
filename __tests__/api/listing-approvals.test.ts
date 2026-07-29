import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/storage", () => ({ promoteProductDraftMedia: vi.fn().mockResolvedValue({ failedImages: [], failedVideos: [] }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

// Imported after the mocks above so the route picks them up.
const { PATCH } = await import("@/app/api/admin/listing-approvals/[listingId]/route");

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/listing-approvals/p1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ctx = { params: Promise.resolve({ listingId: "p1" }) };

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  mockSession = null;
});

describe("PATCH /api/admin/listing-approvals/[listingId] — authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects a catalog_contributor caller — employees can never call admin-only review APIs", async () => {
    mockSession = { type: "approved", user: { id: "emp1", role: "catalog_contributor", email: "e@x.com", full_name: "E", access_level: "standard" } };
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects a partner caller — this endpoint is admin-only, not just non-employee", async () => {
    mockSession = { type: "approved", user: { id: "p1", role: "partner", email: "p@x.com", full_name: "P", access_level: "standard" } };
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/listing-approvals/[listingId] — validation", () => {
  beforeEach(() => { mockSession = { type: "admin" }; });

  it("rejects an invalid decision value", async () => {
    const res = await PATCH(makeReq({ decision: "not_a_real_decision" }), ctx);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires employeeVisibleFeedback for reject", async () => {
    const res = await PATCH(makeReq({ decision: "reject" }), ctx);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires employeeVisibleFeedback for request_adjustment", async () => {
    const res = await PATCH(makeReq({ decision: "request_adjustment" }), ctx);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not require feedback for approve", async () => {
    rpcMock.mockReturnValue({ single: () => Promise.resolve({ data: { new_status: "APPROVED_UNPUBLISHED", credit_created: true }, error: null }) });
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith(
      "fn_review_listing",
      expect.objectContaining({ p_product_id: "p1", p_admin_id: "admin", p_decision: "approve" })
    );
  });
});

describe("PATCH /api/admin/listing-approvals/[listingId] — RPC error mapping", () => {
  beforeEach(() => { mockSession = { type: "admin" }; });

  it("maps invalid_status to 409 (someone else already reviewed it)", async () => {
    rpcMock.mockReturnValue({ single: () => Promise.resolve({ data: null, error: { message: "invalid_status:PUBLISHED" } }) });
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(409);
  });

  it("maps product_not_found to 404", async () => {
    rpcMock.mockReturnValue({ single: () => Promise.resolve({ data: null, error: { message: "product_not_found" } }) });
    const res = await PATCH(makeReq({ decision: "approve" }), ctx);
    expect(res.status).toBe(404);
  });
});
