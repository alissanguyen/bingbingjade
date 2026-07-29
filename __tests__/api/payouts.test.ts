import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { rpc: (...args: unknown[]) => rpcMock(...args) } }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { POST } = await import("@/app/api/admin/payouts/route");
const { PATCH } = await import("@/app/api/admin/payouts/[payoutId]/route");

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/payouts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/payouts/pay1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const ctx = { params: Promise.resolve({ payoutId: "pay1" }) };

beforeEach(() => {
  rpcMock.mockReset();
  mockSession = null;
});

describe("payout endpoints — authorization", () => {
  it("POST rejects a catalog_contributor (employees can't create their own payouts)", async () => {
    mockSession = { type: "approved", user: { id: "emp1", role: "catalog_contributor", email: "e@x.com", full_name: "E", access_level: "standard" } };
    const res = await POST(postReq({ employeeId: "emp1", periodStart: "2026-01-01", periodEnd: "2026-01-15" }));
    expect(res.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("PATCH (mark paid / cancel) rejects a partner session too — admin-only", async () => {
    mockSession = { type: "approved", user: { id: "p1", role: "partner", email: "p@x.com", full_name: "P", access_level: "standard" } };
    const res = await PATCH(patchReq({ action: "mark_paid" }), ctx);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/payouts — validation", () => {
  beforeEach(() => { mockSession = { type: "admin" }; });

  it("requires employeeId/periodStart/periodEnd", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces an inverted-period RPC error as 400", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "invalid_period" } });
    const res = await POST(postReq({ employeeId: "emp1", periodStart: "2026-02-01", periodEnd: "2026-01-01" }));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/payouts/[payoutId] — paid-payout immutability", () => {
  beforeEach(() => { mockSession = { type: "admin" }; });

  it("marking an already-paid payout paid again is rejected, not silently re-applied", async () => {
    rpcMock.mockResolvedValue({ error: { message: "already_paid" } });
    const res = await PATCH(patchReq({ action: "mark_paid" }), ctx);
    expect(res.status).toBe(409);
  });

  it("cancelling a paid payout is rejected — corrections must be a new payout", async () => {
    rpcMock.mockResolvedValue({ error: { message: "cannot_cancel_paid_payout" } });
    const res = await PATCH(patchReq({ action: "cancel" }), ctx);
    expect(res.status).toBe(409);
  });

  it("rejects an unknown action", async () => {
    const res = await PATCH(patchReq({ action: "do_something_else" }), ctx);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
