import { describe, it, expect } from "vitest";
import { eventKeyToOrderStatus, eventKeyToShipmentStatus } from "@/lib/shipment-status";

// Regression tests for two related bugs:
// 1. Advancing a "Sourced for You" shipment to "packing"/"arriving_at_studio"
//    left orders.order_status stuck on a stale value (unmapped keys).
// 2. The fix for #1 then broke "Ship Now" shipments — mapping their
//    "packing" event to "inbound_shipping" too, which is wrong: a Ship Now
//    item is already in our own stock, it was never inbound from anywhere.

const SOURCED_KEYS = ["confirmed", "quality_inspection", "certification", "arriving_at_studio", "packing", "shipped", "delivered"];
const AVAILABLE_NOW_KEYS = ["confirmed", "packing", "shipped", "delivered"];

describe("eventKeyToOrderStatus — sourced_for_you", () => {
  it("maps every event_key used by the Sourced for You template to a non-null order_status", () => {
    for (const key of SOURCED_KEYS) {
      expect(eventKeyToOrderStatus(key, "sourced_for_you"), `"${key}" must map to a real order_status`).not.toBeNull();
    }
  });

  it("packing maps to inbound_shipping (follows an actual inbound-from-vendor leg)", () => {
    expect(eventKeyToOrderStatus("packing", "sourced_for_you")).toBe("inbound_shipping");
  });

  it("arriving_at_studio maps to inbound_shipping (previously broken — only \"arriving\" matched)", () => {
    expect(eventKeyToOrderStatus("arriving_at_studio", "sourced_for_you")).toBe("inbound_shipping");
  });
});

describe("eventKeyToOrderStatus — available_now (Ship Now)", () => {
  it("packing does NOT map to inbound_shipping — the item was never inbound from anywhere", () => {
    expect(eventKeyToOrderStatus("packing", "available_now")).not.toBe("inbound_shipping");
  });

  it("packing returns null (no order_status change) for Ship Now", () => {
    expect(eventKeyToOrderStatus("packing", "available_now")).toBeNull();
  });

  it("confirmed/shipped/delivered still map correctly for Ship Now", () => {
    expect(eventKeyToOrderStatus("confirmed", "available_now")).toBe("order_confirmed");
    expect(eventKeyToOrderStatus("shipped", "available_now")).toBe("outbound_shipping");
    expect(eventKeyToOrderStatus("delivered", "available_now")).toBe("delivered");
  });

  it("every event_key used by the Ship Now template resolves without throwing", () => {
    for (const key of AVAILABLE_NOW_KEYS) {
      expect(() => eventKeyToOrderStatus(key, "available_now")).not.toThrow();
    }
  });
});

describe("eventKeyToOrderStatus — shared", () => {
  it("shipped maps to outbound_shipping, delivered maps to delivered, regardless of fulfillment type", () => {
    for (const type of ["available_now", "sourced_for_you"] as const) {
      expect(eventKeyToOrderStatus("shipped", type)).toBe("outbound_shipping");
      expect(eventKeyToOrderStatus("delivered", type)).toBe("delivered");
    }
  });

  it("an unrecognized key returns null rather than guessing", () => {
    expect(eventKeyToOrderStatus("not_a_real_key", "sourced_for_you")).toBeNull();
    expect(eventKeyToOrderStatus("not_a_real_key", "available_now")).toBeNull();
  });
});

describe("eventKeyToShipmentStatus", () => {
  it("maps shipped/delivered/confirmed directly, everything else falls back to processing", () => {
    expect(eventKeyToShipmentStatus("shipped")).toBe("shipped");
    expect(eventKeyToShipmentStatus("delivered")).toBe("delivered");
    expect(eventKeyToShipmentStatus("confirmed")).toBe("confirmed");
    expect(eventKeyToShipmentStatus("packing")).toBe("processing");
    expect(eventKeyToShipmentStatus("arriving_at_studio")).toBe("processing");
  });
});
