import { describe, it, expect, vi, beforeEach } from "vitest";
import { chainable, storageMock } from "../helpers/supabase-mock";

const fromMock = vi.fn();
const storage = storageMock();
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args), storage } }));

const stripePaymentIntentsCapture = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn(), capture: (...args: unknown[]) => stripePaymentIntentsCapture(...args), cancel: vi.fn() },
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
  },
}));

vi.mock("@/lib/storage", () => ({
  SERVICE_REQUEST_BUCKET: "service-request-attachments",
  resolveServiceAttachmentUrl: vi.fn(() => Promise.resolve("https://signed.example/x")),
}));
vi.mock("@/lib/shipping", () => ({
  calculateStripeFee: () => 320,
  MANUAL_CAPTURE_WINDOW_DAYS: { card: 7 },
  ALLOWED_COUNTRIES: [{ code: "US", name: "United States" }],
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/service-emails", () => ({
  sendServiceRequestReceivedEmail: vi.fn(),
  sendAdminNewServiceRequestEmail: vi.fn(),
  sendShippingInstructionsEmail: vi.fn(),
  sendAuthorizationReleasedServiceEmail: vi.fn(),
}));

const {
  addAttachment,
  submitServiceRequest,
  captureServiceRequestPayment,
  ValidationError,
} = await import("@/lib/service-requests");

function makeFile(name: string, type: string, sizeBytes: number): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

const baseService = {
  id: "svc-1",
  slug: "polishing",
  workflow_mode: "authorization_hold",
  requires_image_review: true,
  min_images: 1,
  max_images: 5,
  additional_images_limit: 5,
  requires_customer_verification: false,
  base_price_cents: 10000,
  discounted_price_cents: 5000,
  currency: "usd",
};

beforeEach(() => {
  fromMock.mockReset();
  stripePaymentIntentsCapture.mockReset();
});

describe("addAttachment — client-independent validation", () => {
  it("rejects an unsupported file type before touching the database", async () => {
    const file = makeFile("photo.gif", "image/gif", 1000);
    await expect(addAttachment({ serviceRequestId: "sr-1", file })).rejects.toThrow(ValidationError);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before touching the database", async () => {
    const file = makeFile("photo.jpg", "image/jpeg", 21 * 1024 * 1024);
    await expect(addAttachment({ serviceRequestId: "sr-1", file })).rejects.toThrow(ValidationError);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("submitServiceRequest — image count boundary", () => {
  it("blocks submission with zero images when the service requires review", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "sr-1", status: "draft", service: baseService }, error: null })) // service_requests select
      .mockReturnValueOnce(chainable({ data: null, error: null, count: 0 })); // attachment count

    await expect(
      submitServiceRequest({ serviceRequestId: "sr-1", customerName: "A", customerEmail: "a@x.com", clientType: "new" })
    ).rejects.toThrow(/at least 1 photo/);
  });

  it("blocks submission with six images when the service max is five", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "sr-1", status: "draft", service: baseService }, error: null }))
      .mockReturnValueOnce(chainable({ data: null, error: null, count: 6 }));

    await expect(
      submitServiceRequest({ serviceRequestId: "sr-1", customerName: "A", customerEmail: "a@x.com", clientType: "new" })
    ).rejects.toThrow(/maximum 5 allowed/);
  });

  it("accepts one image, verifies storage, and transitions draft → pending_review", async () => {
    fromMock
      .mockReturnValueOnce(chainable({ data: { id: "sr-1", status: "draft", service: baseService }, error: null })) // select
      .mockReturnValueOnce(chainable({ data: null, error: null, count: 1 })) // count
      .mockReturnValueOnce(chainable({ data: [{ storage_key: "sr-1/a.webp" }], error: null })) // storage_key list
      .mockReturnValueOnce(
        chainable({ data: { id: "sr-1", status: "pending_review", service: baseService }, error: null }) // optimistic-lock update
      );

    const result = await submitServiceRequest({ serviceRequestId: "sr-1", customerName: "A", customerEmail: "a@x.com", clientType: "new" });
    expect(result.alreadySubmitted).toBe(false);
    expect(result.serviceRequest.status).toBe("pending_review");
  });

  it("is idempotent — resubmitting an already-submitted request never re-validates or duplicates", async () => {
    fromMock.mockReturnValueOnce(
      chainable({ data: { id: "sr-1", status: "pending_review", service: baseService }, error: null })
    );

    const result = await submitServiceRequest({ serviceRequestId: "sr-1", customerName: "A", customerEmail: "a@x.com", clientType: "new" });
    expect(result.alreadySubmitted).toBe(true);
    expect(fromMock).toHaveBeenCalledTimes(1); // only the initial lookup — no count/storage/update calls
  });
});

describe("captureServiceRequestPayment — races", () => {
  it("short-circuits when already captured, without calling Stripe again", async () => {
    fromMock.mockReturnValueOnce(
      chainable({ data: { id: "sr-1", capture_status: "captured", stripe_payment_intent_id: "pi_1", service: baseService }, error: null })
    );

    const result = await captureServiceRequestPayment("sr-1", "admin");
    expect(result.alreadyCaptured).toBe(true);
    expect(stripePaymentIntentsCapture).not.toHaveBeenCalled();
  });
});
