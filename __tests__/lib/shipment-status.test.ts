import { describe, it, expect } from "vitest";
import { eventKeyToOrderStatus, eventKeyToShipmentStatus } from "@/lib/shipment-status";

// Regression test for the bug where advancing a "Sourced for You" shipment
// to "packing" left orders.order_status stuck on a stale value — every key
// actually used in EVENTS_AVAILABLE_NOW / EVENTS_SOURCED
// (app/api/admin/orders/[id]/shipments/route.ts) must map to a non-null
// order_status, not just fall through to null.

const ALL_EVENT_KEYS_IN_USE = [
  "confirmed",
  "quality_inspection",
  "certification",
  "arriving_at_studio",
  "packing",
  "shipped",
  "delivered",
];

describe("eventKeyToOrderStatus", () => {
  it("maps every event_key actually used by the shipment templates to a non-null order_status", () => {
    for (const key of ALL_EVENT_KEYS_IN_USE) {
      expect(eventKeyToOrderStatus(key), `event_key "${key}" must map to a real order_status`).not.toBeNull();
    }
  });

  it("packing maps to inbound_shipping (the piece is still with us, not yet shipped)", () => {
    expect(eventKeyToOrderStatus("packing")).toBe("inbound_shipping");
  });

  it("arriving_at_studio maps to inbound_shipping (previously broken — only \"arriving\" matched)", () => {
    expect(eventKeyToOrderStatus("arriving_at_studio")).toBe("inbound_shipping");
  });

  it("shipped maps to outbound_shipping, delivered maps to delivered", () => {
    expect(eventKeyToOrderStatus("shipped")).toBe("outbound_shipping");
    expect(eventKeyToOrderStatus("delivered")).toBe("delivered");
  });

  it("an unrecognized key returns null rather than guessing", () => {
    expect(eventKeyToOrderStatus("not_a_real_key")).toBeNull();
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
