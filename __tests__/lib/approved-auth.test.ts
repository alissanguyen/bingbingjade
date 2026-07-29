import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// approved-auth.ts imports supabase-admin at module scope (for getSessionUser's
// DB lookup) — stub it out so this file doesn't need real Supabase env vars.
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: {} }));

import {
  hashPassword,
  verifyPassword,
  signApprovedUserId,
  verifyApprovedSessionValue,
  isAdmin,
  isApproved,
  isCatalogContributor,
  type SessionUser,
} from "@/lib/approved-auth";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});

describe("approved_session cookie signing", () => {
  const OLD_ENV = process.env.ADMIN_PASSWORD;
  beforeAll(() => { process.env.ADMIN_PASSWORD = "test-secret"; });
  afterAll(() => { process.env.ADMIN_PASSWORD = OLD_ENV; });

  const userId = "11111111-1111-1111-1111-111111111111";

  it("round-trips a valid partner cookie", () => {
    const cookie = signApprovedUserId(userId, "partner", 0);
    const verified = verifyApprovedSessionValue(cookie);
    expect(verified).toEqual({ userId, role: "partner", sessionVersion: 0 });
  });

  it("round-trips a valid catalog_contributor cookie", () => {
    const cookie = signApprovedUserId(userId, "catalog_contributor", 3);
    const verified = verifyApprovedSessionValue(cookie);
    expect(verified).toEqual({ userId, role: "catalog_contributor", sessionVersion: 3 });
  });

  it("rejects a tampered role (signature no longer matches)", () => {
    const cookie = signApprovedUserId(userId, "catalog_contributor", 0);
    const tampered = cookie.replace("catalog_contributor", "partner");
    expect(verifyApprovedSessionValue(tampered)).toBeNull();
  });

  it("rejects a bumped session_version (simulates a revoked session)", () => {
    const cookie = signApprovedUserId(userId, "catalog_contributor", 0);
    const [id, role, , sig] = cookie.split(".");
    // Attacker (or a stale browser tab) tries to replay with a newer version number
    const forged = `${id}.${role}.99.${sig}`;
    expect(verifyApprovedSessionValue(forged)).toBeNull();
  });

  it("rejects the legacy 2-part cookie format (pre-role-awareness)", () => {
    expect(verifyApprovedSessionValue(`${userId}.deadbeef`)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyApprovedSessionValue("")).toBeNull();
    expect(verifyApprovedSessionValue("not.even.close.to.valid")).toBeNull();
  });
});

describe("role predicates", () => {
  const admin: SessionUser = { type: "admin" };
  const partner: SessionUser = {
    type: "approved",
    user: { id: "u1", email: "p@x.com", full_name: "Partner", access_level: "standard", role: "partner" },
  };
  const employee: SessionUser = {
    type: "approved",
    user: { id: "u2", email: "e@x.com", full_name: "Employee", access_level: "standard", role: "catalog_contributor" },
  };

  it("isAdmin is true only for admin sessions", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(partner)).toBe(false);
    expect(isAdmin(employee)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("isApproved is true only for partner sessions — this is the choke point that locks catalog_contributor out of ~100 legacy admin routes", () => {
    expect(isApproved(partner)).toBe(true);
    expect(isApproved(employee)).toBe(false);
    expect(isApproved(admin)).toBe(false);
    expect(isApproved(null)).toBe(false);
  });

  it("isCatalogContributor is true only for catalog_contributor sessions", () => {
    expect(isCatalogContributor(employee)).toBe(true);
    expect(isCatalogContributor(partner)).toBe(false);
    expect(isCatalogContributor(admin)).toBe(false);
    expect(isCatalogContributor(null)).toBe(false);
  });

  it("no session is ever both isApproved and isCatalogContributor", () => {
    for (const s of [admin, partner, employee, null]) {
      expect(isApproved(s) && isCatalogContributor(s)).toBe(false);
    }
  });
});
