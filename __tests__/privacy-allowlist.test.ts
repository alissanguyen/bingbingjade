import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for the "explicit field allowlist" requirement: these
 * tests read the actual source of the employee-facing data-fetching/writing
 * code and assert the forbidden admin-only columns never appear in the
 * specific SELECT/allowlist constants — not just "hidden in the UI". If a
 * future change accidentally widens one of these selects to `select("*")`
 * or adds a price column, these tests fail immediately.
 */

const FORBIDDEN_PRODUCT_COLUMNS = [
  "price_display_usd",
  "sale_price_usd",
  "imported_price_vnd",
];

const ROOT = join(__dirname, "..");

function extractConst(filePath: string, constName: string): string {
  const src = readFileSync(join(ROOT, filePath), "utf-8");
  const match = src.match(new RegExp(`const ${constName}\\s*=([\\s\\S]*?);`));
  if (!match) throw new Error(`${constName} not found in ${filePath} — did it get renamed?`);
  return match[1];
}

describe("employee-facing product SELECTs never include price/financial columns", () => {
  it("the employee edit-listing page's allowlisted SELECT excludes price columns", () => {
    const select = extractConst(
      "app/employee/[employeeId]/listings/[listingId]/edit/page.tsx",
      "EMPLOYEE_SAFE_SELECT"
    );
    for (const col of FORBIDDEN_PRODUCT_COLUMNS) {
      expect(select).not.toContain(col);
    }
    expect(select).not.toMatch(/select\("\*"\)|"\*"/);
  });

  it("extractConst actually finds real content (guards against a silently-broken regex hiding a false pass above)", () => {
    const select = extractConst(
      "app/employee/[employeeId]/listings/[listingId]/edit/page.tsx",
      "EMPLOYEE_SAFE_SELECT"
    );
    expect(select).toContain("created_by_employee_id");
    expect(select.length).toBeGreaterThan(50);
  });
});

describe("employee server actions never read forbidden fields from client FormData", () => {
  it("app/employee/actions.ts's field allowlist never calls formData.get for price/options keys", () => {
    const src = readFileSync(join(ROOT, "app/employee/actions.ts"), "utf-8");
    // vendor_id is intentionally NOT in this list — it's a per-employee
    // permission (employee_profiles.can_view_vendors), checked below.
    const forbiddenKeys = ["price_display_usd", "sale_price_usd", "imported_price_vnd", "options_json"];
    for (const key of forbiddenKeys) {
      expect(src).not.toMatch(new RegExp(`formData\\.get\\("${key}"\\)`));
    }
  });

  it("vendor_id is only ever written to the row when canViewVendors is true, never unconditionally", () => {
    const src = readFileSync(join(ROOT, "app/employee/actions.ts"), "utf-8");
    // fieldsToRow's row object must spread vendor_id behind a canViewVendors
    // conditional, not include it as a bare field like the other columns.
    expect(src).toMatch(/\.\.\.\(canViewVendors\s*\?\s*\{\s*vendor_id:/);
    // And every call site must pass a canViewVendors argument through, not
    // call fieldsToRow with only the fields object.
    const callSites = [...src.matchAll(/fieldsToRow\(([^)]*)\)/g)].map((m) => m[1]);
    expect(callSites.length).toBeGreaterThan(0);
    for (const args of callSites) {
      expect(args).toContain("canViewVendors");
    }
  });

  it("canViewVendors is re-derived server-side from employee_profiles, not trusted from the request", () => {
    const src = readFileSync(join(ROOT, "app/employee/actions.ts"), "utf-8");
    expect(src).toContain("getEmployeeCanViewVendors(employeeId)");
    // Must not be read directly off the client FormData anywhere.
    expect(src).not.toMatch(/formData\.get\("canViewVendors"\)/);
  });
});

describe("generate-product-copy never unconditionally returns cost data", () => {
  it("imported_price_vnd in the response is gated behind isPartnerOrEmployee, not returned unconditionally", () => {
    const src = readFileSync(join(ROOT, "app/api/generate-product-copy/route.ts"), "utf-8");
    expect(src).toMatch(/imported_price_vnd:\s*isPartnerOrEmployee\s*\?\s*null/);
  });
});
