import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const containsMock = vi.fn();
const fromMock = vi.fn((_table: string) => ({
  select: () => ({
    contains: containsMock,
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: (table: string) => fromMock(table) },
}));

vi.mock("@/lib/storage", () => ({
  resolveEmployeeDraftUrl: vi.fn().mockResolvedValue("https://signed.example/wm/x.webp"),
}));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { GET } = await import("@/app/api/employee/media/route");

function makeReq(path: string) {
  return new NextRequest(`http://localhost/api/employee/media?path=${encodeURIComponent(path)}`);
}

beforeEach(() => {
  containsMock.mockReset();
  mockSession = null;
});

describe("GET /api/employee/media — authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await GET(makeReq("wm/x.webp"));
    expect(res.status).toBe(401);
  });

  it("rejects a partner caller (this route is admin/employee only)", async () => {
    mockSession = { type: "approved", user: { id: "p1", role: "partner", email: "p@x.com", full_name: "P", access_level: "standard" } };
    const res = await GET(makeReq("wm/x.webp"));
    expect(res.status).toBe(401);
  });

  it("rejects a path with traversal characters before ever touching the DB", async () => {
    mockSession = { type: "admin" };
    const res = await GET(makeReq("../../etc/passwd"));
    expect(res.status).toBe(400);
    expect(containsMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/employee/media — ownership", () => {
  it("returns 404 when no product references the path", async () => {
    mockSession = { type: "approved", user: { id: "emp1", role: "catalog_contributor", email: "e@x.com", full_name: "E", access_level: "standard" } };
    containsMock.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: null, error: null }) });
    const res = await GET(makeReq("wm/orphan.webp"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the path belongs to a different employee's product", async () => {
    mockSession = { type: "approved", user: { id: "emp1", role: "catalog_contributor", email: "e@x.com", full_name: "E", access_level: "standard" } };
    containsMock.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { id: "prod1", created_by_employee_id: "someone-else" }, error: null }) });
    const res = await GET(makeReq("wm/not-mine.webp"));
    expect(res.status).toBe(403);
  });

  it("returns a signed URL when the employee owns the referencing product", async () => {
    mockSession = { type: "approved", user: { id: "emp1", role: "catalog_contributor", email: "e@x.com", full_name: "E", access_level: "standard" } };
    containsMock.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { id: "prod1", created_by_employee_id: "emp1" }, error: null }) });
    const res = await GET(makeReq("wm/mine.webp"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://signed.example/wm/x.webp");
  });

  it("admin can access any employee's draft media", async () => {
    mockSession = { type: "admin" };
    containsMock.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { id: "prod1", created_by_employee_id: "some-employee" }, error: null }) });
    const res = await GET(makeReq("wm/anyones.webp"));
    expect(res.status).toBe(200);
  });
});
