/**
 * Customer restriction system — server-side only.
 *
 * Exposes:
 *  - Normalization helpers (email, phone, name, address)
 *  - checkCustomerRestriction() — returns whether a checkout attempt should be blocked
 *  - logBlockedAttempt() — records the blocked attempt for admin review
 *
 * Matching rules:
 *  STRONG (any single match blocks): customer_id, normalized_email, normalized_phone, full_address
 *  COMBINATION (two-signal threshold): name+address_line1 | name+postal+city | address_line1+postal
 *  NOT sufficient alone: name, city, postal, state, country
 */

import { supabaseAdmin } from "./supabase-admin";

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeEmailRestriction(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeAddressLine(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/[.,#\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePostal(postal: string): string {
  return postal.trim().toLowerCase().replace(/\s+/g, "");
}

export function normalizeGeo(val: string): string {
  return val.trim().toLowerCase();
}

/**
 * Canonical full-address fingerprint: line1|city|postal|country
 * Used for exact full-address matches on the restriction record.
 */
export function buildNormalizedAddress(
  line1: string,
  city: string,
  postal: string,
  country: string
): string {
  return [
    normalizeAddressLine(line1),
    normalizeGeo(city),
    normalizePostal(postal),
    normalizeGeo(country),
  ].join("|");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RestrictionCheckParams {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  shippingAddress?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    postal?: string | null;
    country?: string | null;
  } | null;
  customerId?: string | null;
}

export interface RestrictionCheckResult {
  blocked: boolean;
  restrictionId?: string;
  matchedSignals?: string[];
  severity?: string;
}

// ── Check ─────────────────────────────────────────────────────────────────────

export async function checkCustomerRestriction(
  params: RestrictionCheckParams
): Promise<RestrictionCheckResult> {
  const normEmail  = params.email ? normalizeEmailRestriction(params.email) : null;
  const normPhone  = params.phone ? normalizePhone(params.phone) : null;
  const normName   = params.name  ? normalizeName(params.name)  : null;
  const addr       = params.shippingAddress;

  const normAddrFull =
    addr?.line1 && addr?.city && addr?.postal && addr?.country
      ? buildNormalizedAddress(addr.line1, addr.city, addr.postal, addr.country)
      : null;

  const normLine1  = addr?.line1  ? normalizeAddressLine(addr.line1) : null;
  const normPostal = addr?.postal ? normalizePostal(addr.postal)      : null;
  const normCity   = addr?.city   ? normalizeGeo(addr.city)           : null;

  const { data: restrictions } = await supabaseAdmin
    .from("customer_restrictions")
    .select(
      "id, customer_id, normalized_email, normalized_phone, normalized_address, name, address_line1, city, postal_code, severity"
    )
    .eq("status", "active");

  if (!restrictions || restrictions.length === 0) return { blocked: false };

  for (const r of restrictions) {
    // ── Strong singles ────────────────────────────────────────────────────
    if (params.customerId && r.customer_id && params.customerId === r.customer_id) {
      return { blocked: true, restrictionId: r.id, matchedSignals: ["customer_id"], severity: r.severity };
    }

    if (normEmail && r.normalized_email && normEmail === r.normalized_email) {
      return { blocked: true, restrictionId: r.id, matchedSignals: ["email"], severity: r.severity };
    }

    if (normPhone && r.normalized_phone && normPhone === r.normalized_phone) {
      return { blocked: true, restrictionId: r.id, matchedSignals: ["phone"], severity: r.severity };
    }

    if (normAddrFull && r.normalized_address && normAddrFull === r.normalized_address) {
      return { blocked: true, restrictionId: r.id, matchedSignals: ["full_address"], severity: r.severity };
    }

    // ── Two-signal combinations ───────────────────────────────────────────
    const rLine1   = r.address_line1 ? normalizeAddressLine(r.address_line1) : null;
    const rPostal  = r.postal_code   ? normalizePostal(r.postal_code)         : null;
    const rCity    = r.city          ? normalizeGeo(r.city)                    : null;
    const rName    = r.name          ? normalizeName(r.name)                   : null;
    const signals: string[] = [];

    if (normName && rName && normName === rName) {
      if (normLine1 && rLine1 && normLine1 === rLine1) {
        signals.push("name", "address_line1");
      } else if (normPostal && rPostal && normPostal === rPostal &&
                 normCity   && rCity   && normCity   === rCity) {
        signals.push("name", "postal_code", "city");
      }
    }

    if (signals.length === 0 &&
        normLine1 && rLine1 && normLine1 === rLine1 &&
        normPostal && rPostal && normPostal === rPostal) {
      signals.push("address_line1", "postal_code");
    }

    if (signals.length > 0) {
      return {
        blocked: true,
        restrictionId: r.id,
        matchedSignals: [...new Set(signals)],
        severity: r.severity,
      };
    }
  }

  return { blocked: false };
}

// ── Logging ───────────────────────────────────────────────────────────────────

export async function logBlockedAttempt({
  restrictionId,
  matchedSignals,
  attemptedCustomer,
  cartSnapshot,
}: {
  restrictionId: string;
  matchedSignals: string[];
  attemptedCustomer: Record<string, unknown>;
  cartSnapshot: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("blocked_checkout_attempts").insert({
    restriction_id: restrictionId,
    matched_signals: matchedSignals,
    attempted_customer: attemptedCustomer,
    cart_snapshot: cartSnapshot,
  });
}
