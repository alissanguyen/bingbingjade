import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { chainable, storageMock } from "../../helpers/supabase-mock";

const fromMock = vi.fn();
const storage = storageMock();
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args), storage },
}));

const applyWatermarkMock = vi.fn((..._args: unknown[]) => Promise.resolve(Buffer.from("fake-webp-bytes")));
vi.mock("@/lib/watermark", () => ({ applyWatermark: (...args: unknown[]) => applyWatermarkMock(...args) }));

let mockSession: unknown = null;
vi.mock("@/lib/approved-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approved-auth")>();
  return { ...actual, getSessionUser: () => Promise.resolve(mockSession) };
});

const { POST } = await import("@/app/api/admin/bingbing-gallery/upload/route");

function makeReq(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  return new NextRequest("http://localhost/api/admin/bingbing-gallery/upload", {
    method: "POST",
    body: formData,
  });
}

function makeImageFile(name = "photo.jpg", type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  fromMock.mockReset();
  applyWatermarkMock.mockClear();
  mockSession = null;
});

describe("POST /api/admin/bingbing-gallery/upload", () => {
  it("rejects a non-admin session", async () => {
    mockSession = null;
    const res = await POST(makeReq({ image: makeImageFile(), xPercent: "50", yPercent: "50" }));
    expect(res.status).toBe(401);
    expect(applyWatermarkMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file type", async () => {
    mockSession = { type: "admin" };
    const res = await POST(makeReq({ image: makeImageFile("f.gif", "image/gif"), xPercent: "50", yPercent: "50" }));
    expect(res.status).toBe(422);
    expect(applyWatermarkMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range position", async () => {
    mockSession = { type: "admin" };
    const res = await POST(makeReq({ image: makeImageFile(), xPercent: "150", yPercent: "50" }));
    expect(res.status).toBe(400);
    expect(applyWatermarkMock).not.toHaveBeenCalled();
  });

  it("watermarks at the posted position, uploads, and inserts a row", async () => {
    mockSession = { type: "admin" };
    fromMock
      .mockReturnValueOnce(chainable({ data: { sort_order: 2 }, error: null })) // max sort_order lookup
      .mockReturnValueOnce(
        chainable({
          data: { id: "img-1", storage_path: "abc.webp", logo_x: 30, logo_y: 70, sort_order: 3, published: true },
          error: null,
        })
      ); // insert

    const res = await POST(makeReq({ image: makeImageFile(), xPercent: "30", yPercent: "70" }));

    expect(applyWatermarkMock).toHaveBeenCalledWith(expect.any(Buffer), "", { xPercent: 30, yPercent: 70 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.image.storage_path).toBe("abc.webp");
    expect(body.image.sort_order).toBe(3);
  });
});
