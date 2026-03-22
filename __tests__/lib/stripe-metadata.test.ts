import { describe, it, expect } from "vitest";
import {
  encodeCheckoutItems,
  decodeCheckoutItems,
  METADATA_CHUNK_SIZE,
  type MetaItem,
} from "@/lib/stripe-metadata";

const UUID_A = "550e8400-e29b-41d4-a716-446655440000"; // 36 chars
const UUID_B = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // 36 chars

// ── encodeCheckoutItems ───────────────────────────────────────────────────────

describe("encodeCheckoutItems", () => {
  it("encodes a single item without optionId", () => {
    const meta = encodeCheckoutItems([{ productId: UUID_A, optionId: null, price: 99.99 }]);
    expect(meta.items_0).toBeDefined();
    const parsed = JSON.parse(meta.items_0);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ p: UUID_A, $: 99.99 });
    expect(parsed[0].o).toBeUndefined(); // omitted when null
  });

  it("includes optionId when present", () => {
    const meta = encodeCheckoutItems([{ productId: UUID_A, optionId: UUID_B, price: 50 }]);
    const parsed = JSON.parse(meta.items_0);
    expect(parsed[0].o).toBe(UUID_B);
  });

  it(`chunks at ${METADATA_CHUNK_SIZE} items per key`, () => {
    const items: MetaItem[] = Array.from({ length: 5 }, (_, i) => ({
      productId: UUID_A,
      optionId: null,
      price: i + 1,
    }));
    const meta = encodeCheckoutItems(items);
    expect(meta.items_0).toBeDefined();
    expect(meta.items_1).toBeDefined();
    expect(meta.items_2).toBeUndefined();
    expect(JSON.parse(meta.items_0)).toHaveLength(METADATA_CHUNK_SIZE);
    expect(JSON.parse(meta.items_1)).toHaveLength(1);
  });

  it("every chunk stays under Stripe's 500-char limit (worst case: 4 items with 2 UUIDs each)", () => {
    const worst: MetaItem[] = Array.from({ length: METADATA_CHUNK_SIZE }, () => ({
      productId: UUID_A,
      optionId: UUID_B,
      price: 9999.99,
    }));
    const meta = encodeCheckoutItems(worst);
    Object.values(meta).forEach((v) => {
      expect(v.length).toBeLessThan(500);
    });
  });

  it("handles 10 items (max cart size) without any chunk exceeding 500 chars", () => {
    const items: MetaItem[] = Array.from({ length: 10 }, (_, i) => ({
      productId: UUID_A,
      optionId: UUID_B,
      price: i * 100 + 0.99,
    }));
    const meta = encodeCheckoutItems(items);
    // 10 items / 4 per chunk = 3 keys
    expect(Object.keys(meta)).toHaveLength(3);
    Object.values(meta).forEach((v) => {
      expect(v.length).toBeLessThan(500);
    });
  });

  it("returns empty object for empty cart", () => {
    expect(encodeCheckoutItems([])).toEqual({});
  });
});

// ── decodeCheckoutItems ───────────────────────────────────────────────────────

describe("decodeCheckoutItems", () => {
  it("round-trips a single item", () => {
    const original: MetaItem[] = [{ productId: UUID_A, optionId: UUID_B, price: 99.99 }];
    expect(decodeCheckoutItems(encodeCheckoutItems(original))).toEqual(original);
  });

  it("round-trips 10 items across multiple chunks", () => {
    const original: MetaItem[] = Array.from({ length: 10 }, (_, i) => ({
      productId: UUID_A,
      optionId: i % 2 === 0 ? UUID_B : null,
      price: i * 10 + 1.5,
    }));
    const decoded = decodeCheckoutItems(encodeCheckoutItems(original));
    expect(decoded).toEqual(original);
  });

  it("decodes the legacy format (full objects in single 'items' key)", () => {
    const legacy = {
      items: JSON.stringify([
        {
          productId: UUID_A,
          optionId: null,
          productName: "Icy Bangle",
          optionLabel: null,
          price: 150,
        },
      ]),
    };
    const result = decodeCheckoutItems(legacy);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ productId: UUID_A, optionId: null, price: 150 });
  });

  it("returns [] for null metadata", () => {
    expect(decodeCheckoutItems(null)).toEqual([]);
  });

  it("returns [] for undefined metadata", () => {
    expect(decodeCheckoutItems(undefined)).toEqual([]);
  });

  it("returns [] for metadata with no items keys", () => {
    expect(decodeCheckoutItems({ source: "whatsapp" })).toEqual([]);
  });

  it("preserves null optionId through encode/decode", () => {
    const items: MetaItem[] = [{ productId: UUID_A, optionId: null, price: 200 }];
    const decoded = decodeCheckoutItems(encodeCheckoutItems(items));
    expect(decoded[0].optionId).toBeNull();
  });
});
