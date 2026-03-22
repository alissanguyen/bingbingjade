import { describe, it, expect, beforeAll } from "vitest";

// Set env vars before the module is imported (module reads them at load time)
beforeAll(() => {
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "1234567890";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.bingbingjade.com";
});

// Dynamic import so the module picks up the env vars set above
const getModule = () => import("@/lib/whatsapp");

describe("buildWhatsAppLink", () => {
  it("returns a valid wa.me link", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([]);
    expect(link).toMatch(/^https:\/\/wa\.me\//);
    expect(link).toContain("text=");
  });

  it("generic inquiry for empty product list", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([]);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toContain("inquire");
  });

  it("single product — includes name and product ID", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([
      { name: "Icy Green Bangle", public_id: "a1b2c3d4", slug: "icy-green-bangle" },
    ]);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toContain("Icy Green Bangle");
    expect(text).toContain("a1b2c3d4");
    expect(text).toContain("bingbingjade.com");
  });

  it("single product — URL contains slug-public_id", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([
      { name: "Bangle", public_id: "a1b2c3d4", slug: "icy-bangle" },
    ]);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toContain("icy-bangle-a1b2c3d4");
  });

  it("multiple products — includes all product names", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([
      { name: "Bangle A", public_id: "aaaa1111", slug: "bangle-a" },
      { name: "Ring B", public_id: "bbbb2222", slug: "ring-b" },
      { name: "Necklace C", public_id: "cccc3333", slug: "necklace-c" },
    ]);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toContain("Bangle A");
    expect(text).toContain("Ring B");
    expect(text).toContain("Necklace C");
  });

  it("multiple products — does NOT include individual URLs (keeps message short)", async () => {
    const { buildWhatsAppLink } = await getModule();
    const link = buildWhatsAppLink([
      { name: "Bangle A", public_id: "aaaa1111", slug: "bangle-a" },
      { name: "Ring B", public_id: "bbbb2222", slug: "ring-b" },
    ]);
    const text = decodeURIComponent(link.split("text=")[1]);
    // multi-product message lists names, not individual product URLs
    expect(text).not.toContain("/products/bangle-a-aaaa1111");
  });
});
