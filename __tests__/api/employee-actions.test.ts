import { describe, it, expect, vi, beforeEach } from "vitest";

// A tiny in-memory "products" table so requireEditableOwnedDraft / insert /
// update behave like the real thing without a live DB. Only the columns
// these actions actually touch are modeled.
type Row = { id: string; created_by_employee_id: string; listing_status: string; name?: string; vendor_id?: string; imported_price_vnd?: number; size_detailed?: (number | null)[] | null };
let products: Row[] = [];
let canViewVendors = false;

const rpcMock = vi.fn();

function fromProducts() {
  return {
    select: (_cols: string) => ({
      eq: (_col: string, val: string) => ({
        maybeSingle: () => Promise.resolve({ data: products.find((p) => p.id === val) ?? null, error: null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (_col: string, val: string) => {
        const row = products.find((p) => p.id === val);
        if (row) Object.assign(row, patch);
        return Promise.resolve({ error: null });
      },
    }),
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: () => {
          const id = `p${products.length + 1}`;
          products.push({ id, created_by_employee_id: row.created_by_employee_id as string, listing_status: row.listing_status as string, name: row.name as string });
          return Promise.resolve({ data: { id }, error: null });
        },
      }),
    }),
  };
}

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "products") return fromProducts();
      // product_costs upsert — no-op stub
      return { upsert: () => Promise.resolve({ error: null }) };
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/employee-permissions", () => ({
  getEmployeeCanViewVendors: () => Promise.resolve(canViewVendors),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Mirrors real Next.js: redirect() throws an error tagged with a digest;
// unstable_rethrow only rethrows errors carrying that tag, otherwise no-ops —
// so actions.ts's try/catch can tell "this is a redirect" apart from "this
// is a real error that should become a returned { error } instead of throwing."
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`REDIRECT:${url}`) as Error & { digest: string };
    err.digest = "NEXT_REDIRECT";
    throw err;
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && (err as Error & { digest?: string }).digest === "NEXT_REDIRECT") throw err;
  },
}));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { saveEmployeeDraft, submitEmployeeListing } = await import("@/app/employee/actions");

function fd(entries: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.append(k, v);
  }
  return f;
}

const EMP_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EMP_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  products = [];
  canViewVendors = false;
  rpcMock.mockReset();
  mockSession = { type: "approved", user: { id: EMP_A, role: "catalog_contributor", email: "a@x.com", full_name: "A", access_level: "standard" } };
});

describe("employee actions — authorization", () => {
  it("rejects a non-employee session (admin) from saveEmployeeDraft", async () => {
    mockSession = { type: "admin" };
    const res = await saveEmployeeDraft(fd({ name: "Test" }));
    expect(res?.error).toMatch(/Unauthorized/);
  });

  it("rejects a partner session from saveEmployeeDraft", async () => {
    mockSession = { type: "approved", user: { id: "p1", role: "partner", email: "p@x.com", full_name: "P", access_level: "standard" } };
    const res = await saveEmployeeDraft(fd({ name: "Test" }));
    expect(res?.error).toMatch(/Unauthorized/);
  });
});

describe("employee actions — ownership", () => {
  it("an employee cannot edit another employee's listing by guessing its productId", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_B, listing_status: "EMPLOYEE_DRAFT" });
    const res = await saveEmployeeDraft(fd({ productId: "p1", name: "Hijacked" }));
    expect(res?.error).toMatch(/Listing not found/);
    // The other employee's row must be untouched.
    expect(products[0].name).toBeUndefined();
  });

  it("gives the same error for a nonexistent listing as for someone else's (no existence signal)", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_B, listing_status: "EMPLOYEE_DRAFT" });
    const ownRes = await saveEmployeeDraft(fd({ productId: "p1", name: "X" }));
    const missingRes = await saveEmployeeDraft(fd({ productId: "does-not-exist", name: "X" }));
    expect(ownRes?.error).toBe(missingRes?.error);
  });
});

describe("employee actions — status locking", () => {
  it("cannot edit a listing that is AWAITING_APPROVAL", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "AWAITING_APPROVAL" });
    const res = await saveEmployeeDraft(fd({ productId: "p1", name: "X" }));
    expect(res?.error).toMatch(/can no longer be edited/);
  });

  it("cannot edit a PUBLISHED listing", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "PUBLISHED" });
    const res = await saveEmployeeDraft(fd({ productId: "p1", name: "X" }));
    expect(res?.error).toMatch(/can no longer be edited/);
  });

  it("CAN edit a listing in NEEDS_ADJUSTMENT", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "NEEDS_ADJUSTMENT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated" }));
    expect(products[0].name).toBe("Updated");
  });
});

describe("employee actions — per-employee vendor visibility", () => {
  it("drops a forged vendor_id when the employee's can_view_vendors is false", async () => {
    canViewVendors = false;
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", vendor_id: "some-vendor-uuid" }));
    expect(products[0].vendor_id).toBeUndefined();
  });

  it("applies vendor_id when the employee's can_view_vendors is true", async () => {
    canViewVendors = true;
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", vendor_id: "some-vendor-uuid" }));
    expect(products[0].vendor_id).toBe("some-vendor-uuid");
  });

  it("also gates vendor_id on first-time creation via submitEmployeeListing", async () => {
    canViewVendors = false;
    rpcMock.mockResolvedValue({ error: null });
    await expect(
      submitEmployeeListing(fd({ name: "New", imageUrls: ["wm/a.webp"], vendor_id: "some-vendor-uuid" }))
    ).rejects.toThrow("REDIRECT:");
    expect(products[0].vendor_id).toBeUndefined();
  });
});

describe("employee actions — contributor cost currency", () => {
  it("stores a VND cost amount directly as imported_price_vnd", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", costCurrency: "VND", costAmount: "1500000" }));
    expect(products[0].imported_price_vnd).toBe(1500000);
  });

  it("converts a Yuan cost amount to VND via amount * 3950 * 1.1", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", costCurrency: "CNY", costAmount: "500" }));
    // 500 * 3950 * 1.1 = 2,172,500
    expect(products[0].imported_price_vnd).toBe(2172500);
  });

  it("leaves imported_price_vnd untouched when no cost amount is provided", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old", imported_price_vnd: 999 });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated" }));
    expect(products[0].imported_price_vnd).toBe(999);
  });
});

describe("employee actions — detailed dimensions", () => {
  it("saves size_detailed_0/1/2 (size/width/thickness) sent by the form", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", size_detailed_0: "57", size_detailed_1: "16", size_detailed_2: "9" }));
    expect(products[0].size_detailed).toEqual([57, 16, 9]);
  });

  it("keeps a partially-filled dimension as null rather than coercing to 0", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated", size_detailed_0: "57" }));
    expect(products[0].size_detailed).toEqual([57, null, null]);
  });

  it("saves null when no detailed dimensions are provided at all", async () => {
    products.push({ id: "p1", created_by_employee_id: EMP_A, listing_status: "EMPLOYEE_DRAFT", name: "Old" });
    await saveEmployeeDraft(fd({ productId: "p1", name: "Updated" }));
    expect(products[0].size_detailed).toBeNull();
  });
});

describe("employee actions — submit", () => {
  it("requires at least one photo", async () => {
    const res = await submitEmployeeListing(fd({ name: "No Photos" }));
    expect(res?.error).toMatch(/At least one photo/);
  });

  it("calls fn_submit_listing with the caller's own employeeId, never a client-supplied one", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await expect(
      submitEmployeeListing(fd({ name: "New Listing", imageUrls: ["wm/a.webp"] }))
    ).rejects.toThrow("REDIRECT:");
    expect(rpcMock).toHaveBeenCalledWith(
      "fn_submit_listing",
      expect.objectContaining({ p_employee_id: EMP_A })
    );
  });
});
