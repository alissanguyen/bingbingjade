// lib/claims.ts
//
// Core service layer for the Delivered Order Claims / Returns / Issue
// Resolution workflow (supabase/migration_123.sql). Mirrors the discipline
// already established by lib/store-credit.ts and lib/orders.ts:
//   - financial mutations go through append-only ledger inserts, never
//     UPDATE-in-place of a historical amount;
//   - double-issuance is prevented with the same "atomic conditional
//     UPDATE ... WHERE <not-yet-done>" idiom used by capture-payment/
//     release-authorization (app/api/admin/orders/[id]/capture-payment);
//   - store/exchange credit reuses lib/store-credit.ts's issueStoreCredit()
//     rather than a parallel ledger.
//
// SERVER-ONLY.

import { supabaseAdmin } from "./supabase-admin";
import { stripe } from "./stripe";
import { issueStoreCredit } from "./store-credit";
import type Stripe from "stripe";

// ── Types ──────────────────────────────────────────────────────────────────

export type ClaimType = "missing_package" | "damaged_item" | "not_as_described" | "doesnt_fit";
export type ClaimSubtype = "lost_in_transit" | "marked_delivered_not_located";
export type FitIssue = "too_small" | "too_large" | "other";

export type Responsibility =
  | "bbj_action_required" | "customer_action_required" | "waiting_on_carrier"
  | "waiting_on_insurer" | "waiting_on_vendor" | "return_in_transit"
  | "inspecting" | "resolution_pending" | "closed";

export type EligibilityResult = "eligible" | "ineligible" | "requires_admin_review";

export type ResolutionType =
  | "full_cash_refund" | "partial_cash_refund" | "store_credit" | "exchange_credit"
  | "replacement_merchandise" | "repair_restoration" | "combination" | "denied" | "other";

export type FinancialEventType =
  | "merchandise_amount" | "tax" | "outbound_shipping" | "outbound_shipping_insurance_premium"
  | "return_shipping_label_cost" | "return_shipping_insurance_premium"
  | "restocking_fee" | "restocking_fee_waived" | "transaction_fee_retained"
  | "other_deduction" | "cash_refund" | "store_credit_issued" | "exchange_credit_issued"
  | "replacement_cogs" | "replacement_shipping" | "replacement_insurance"
  | "carrier_reimbursement" | "insurance_reimbursement" | "vendor_reimbursement" | "other_adjustment";

export type EvidenceCategory =
  | "item_photo" | "packaging_outer_photo" | "packaging_inner_photo" | "video"
  | "written_statement" | "dropoff_receipt" | "qc_photo" | "qc_video" | "packing_video"
  | "certificate" | "order_snapshot" | "shipping_label" | "proof_of_delivery"
  | "carrier_correspondence" | "insurance_correspondence" | "return_inspection_photo"
  | "return_inspection_video" | "vendor_correspondence" | "refund_proof" | "reimbursement_proof" | "other";

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  missing_package: "My package is missing",
  damaged_item: "My item arrived damaged",
  not_as_described: "My item is not as described",
  doesnt_fit: "My item doesn't fit",
};

// Per-type ordered internal status keys, taken directly from spec §3–§6.
// Free text in the DB (see migration_123.sql comment) — this is the
// TypeScript-side source of truth, same convention as OrderStatus.
export const CLAIM_STATUS_FLOW: Record<ClaimType, string[]> = {
  missing_package: [
    "received", "initial_review", "carrier_investigation_opened", "carrier_contacted",
    "insurance_claim_filed", "awaiting_carrier_decision", "additional_evidence_requested",
    "approved", "denied", "package_located", "resolution_issued", "closed",
  ],
  damaged_item: [
    "received", "evidence_received", "bbj_reviewing", "carrier_contacted",
    "carrier_insurance_claim_filed", "awaiting_claim_decision", "additional_evidence_requested",
    "resolution_offered", "customer_accepted_resolution", "return_in_progress",
    "resolution_completed", "closed",
  ],
  not_as_described: [
    "received", "evidence_uploaded", "bbj_reviewing", "return_approved", "return_denied",
    "label_issued", "awaiting_dropoff", "dropoff_reported", "carrier_acceptance_confirmed",
    "return_in_transit", "return_delivered", "inspecting", "resolution_approved",
    "resolution_issued", "closed",
  ],
  doesnt_fit: [
    "received", "eligibility_confirmed", "awaiting_customer_choice", "label_issued",
    "awaiting_dropoff", "dropoff_reported", "carrier_acceptance_confirmed", "return_in_transit",
    "return_received", "inspecting", "resolution_issued", "closed",
  ],
};

// Additional cross-cutting / exception statuses (§32) any claim can enter
// regardless of type.
export const CLAIM_EXCEPTION_STATUSES = [
  "customer_withdrew", "customer_unresponsive", "return_label_expired", "return_never_shipped",
  "return_deadline_passed_review", "denied", "return_rejected", "resolved_outside_portal",
  "administrative_closure", "duplicate_claim", "fraud_suspected", "reopened",
] as const;

// Friendly, deliberately non-committal customer-facing copy per internal
// status. Falls back to a generic "we're working on it" line for any status
// not explicitly mapped (never crashes on an unrecognized status).
const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  received: "We've received your claim",
  initial_review: "Under initial review",
  evidence_received: "Evidence received — reviewing",
  evidence_uploaded: "Evidence received — reviewing",
  bbj_reviewing: "Our team is reviewing your claim",
  carrier_investigation_opened: "Carrier investigation opened",
  carrier_contacted: "We've contacted the carrier",
  insurance_claim_filed: "Insurance claim filed",
  carrier_insurance_claim_filed: "Carrier/insurance claim filed",
  awaiting_carrier_decision: "Waiting on the carrier's decision",
  awaiting_claim_decision: "Waiting on a claim decision",
  additional_evidence_requested: "Action required — additional evidence requested",
  approved: "Claim approved",
  return_approved: "Return approved",
  denied: "Claim denied",
  return_denied: "Return denied",
  package_located: "Good news — your package was located",
  resolution_offered: "We've offered a resolution",
  customer_accepted_resolution: "Resolution accepted",
  resolution_approved: "Resolution approved",
  label_issued: "Return label ready",
  awaiting_dropoff: "Action required — drop off your return",
  dropoff_reported: "Drop-off reported — awaiting carrier scan",
  carrier_acceptance_confirmed: "Carrier has your return",
  return_in_transit: "Return in transit",
  return_in_progress: "Return in progress",
  return_delivered: "Return delivered to us",
  return_received: "Return received",
  inspecting: "Inspecting your return",
  resolution_issued: "Resolution issued",
  resolution_completed: "Resolution completed",
  eligibility_confirmed: "Eligibility confirmed",
  awaiting_customer_choice: "Action required — choose refund or exchange",
  closed: "Closed",
  customer_withdrew: "Withdrawn",
  customer_unresponsive: "Awaiting your response",
  return_label_expired: "Return label expired",
  return_never_shipped: "Return not shipped",
  return_deadline_passed_review: "Return deadline passed — under review",
  return_rejected: "Return not accepted",
  resolved_outside_portal: "Resolved",
  administrative_closure: "Closed",
  reopened: "Reopened",
};

export function customerFacingStatus(internalStatus: string): string {
  return CUSTOMER_STATUS_LABELS[internalStatus] ?? "In progress";
}

// ── Configuration lookups (§8, §31) — DB-backed with safe in-code fallback ──

export interface EvidenceRequirement {
  photosRequired: boolean;
  minPhotos: number;
  maxPhotos: number;
  videoRequired: boolean;
  videoOptional: boolean;
  packagingPhotosRequired: boolean;
  writtenExplanationRequired: boolean;
  originalPackagingRequired: boolean;
}

const DEFAULT_EVIDENCE_REQUIREMENTS: Record<ClaimType, EvidenceRequirement> = {
  missing_package: { photosRequired: false, minPhotos: 0, maxPhotos: 10, videoRequired: false, videoOptional: true, packagingPhotosRequired: false, writtenExplanationRequired: false, originalPackagingRequired: false },
  damaged_item: { photosRequired: true, minPhotos: 1, maxPhotos: 10, videoRequired: false, videoOptional: true, packagingPhotosRequired: true, writtenExplanationRequired: true, originalPackagingRequired: true },
  not_as_described: { photosRequired: true, minPhotos: 1, maxPhotos: 10, videoRequired: false, videoOptional: true, packagingPhotosRequired: false, writtenExplanationRequired: true, originalPackagingRequired: true },
  doesnt_fit: { photosRequired: false, minPhotos: 0, maxPhotos: 10, videoRequired: false, videoOptional: true, packagingPhotosRequired: false, writtenExplanationRequired: false, originalPackagingRequired: true },
};

export async function getEvidenceRequirement(claimType: ClaimType): Promise<EvidenceRequirement> {
  const { data } = await supabaseAdmin
    .from("claim_evidence_requirements")
    .select("*")
    .eq("claim_type", claimType)
    .maybeSingle();
  if (!data) return DEFAULT_EVIDENCE_REQUIREMENTS[claimType];
  return {
    photosRequired: data.photos_required,
    minPhotos: data.min_photos,
    maxPhotos: data.max_photos,
    videoRequired: data.video_required,
    videoOptional: data.video_optional,
    packagingPhotosRequired: data.packaging_photos_required,
    writtenExplanationRequired: data.written_explanation_required,
    originalPackagingRequired: data.original_packaging_required,
  };
}

type WindowKey =
  | "damage_reporting_days" | "missing_package_reporting_days" | "ship_now_return_days"
  | "sizing_return_days" | "return_dropoff_days" | "return_label_expiration_days"
  | "customer_response_days" | "insurance_evidence_days";

const DEFAULT_WINDOWS: Record<WindowKey, number> = {
  damage_reporting_days: 14,
  missing_package_reporting_days: 30,
  ship_now_return_days: 14,
  sizing_return_days: 14,
  return_dropoff_days: 10,
  return_label_expiration_days: 14,
  customer_response_days: 7,
  insurance_evidence_days: 10,
};

export async function getClaimWindows(): Promise<Record<WindowKey, number>> {
  const { data } = await supabaseAdmin.from("claim_windows").select("window_key, days");
  const out = { ...DEFAULT_WINDOWS };
  for (const row of data ?? []) {
    if (row.window_key in out) out[row.window_key as WindowKey] = row.days;
  }
  return out;
}

// ── Insurance messaging (§3) — never implies guaranteed payout ─────────────

export function insuranceMessage(params: { insurancePurchased: boolean | null; insuredValueUsd: number | null }): string {
  if (params.insurancePurchased) {
    const amount = params.insuredValueUsd != null ? `$${params.insuredValueUsd.toFixed(2)}` : "the full insured value of your order";
    return `Your shipment was protected for up to ${amount}. We will submit the claim to the shipping insurer and keep you updated here.`;
  }
  return "This shipment was not purchased with additional shipping protection. Carrier liability may be limited to a maximum of $100. We will still open an investigation with the carrier and pursue any available reimbursement on your behalf.";
}

export const PACKAGING_RETENTION_NOTICE =
  "Please keep the item, certificate, original shipping box, inner packaging, protective materials, and all other packaging until the carrier/insurance claim has been fully resolved. The carrier or insurer may request photographs or inspection of the original packaging.";

export const PACKAGING_ACK_TEXT =
  "I confirm that I will keep the original packaging while the shipping/insurance claim is under review.";

export const RETURN_PACKAGING_NOTICE =
  "Please keep the original packaging, protective materials, certificate, and included accessories. If your return is approved, the item must be packaged securely using the original packaging/protective materials whenever possible.";

// ── Eligibility engine (§30) ─────────────────────────────────────────────────

export interface EligibilityInput {
  orderStatus: string;
  deliveredAt: string | null; // shipment.delivered_at
  claimType: ClaimType;
  fitIssue?: FitIssue | null;
  inventoryTypes: string[]; // distinct order_items.inventory_type values for the affected items
  priorClaimExists: boolean;
}

export interface EligibilityOutcome {
  result: EligibilityResult;
  reason: string;
}

export async function evaluateClaimEligibility(input: EligibilityInput): Promise<EligibilityOutcome> {
  if (input.orderStatus !== "delivered") {
    return { result: "ineligible", reason: "order not delivered" };
  }

  if (input.claimType === "doesnt_fit") {
    if (input.inventoryTypes.includes("sourced_for_you")) {
      return {
        result: "ineligible",
        reason: "Sourced for You pieces are acquired specifically for your order and are not eligible for sizing-related returns.",
      };
    }
  }

  if (input.priorClaimExists) {
    return { result: "requires_admin_review", reason: "prior claim exists for one or more of these items" };
  }

  const windows = await getClaimWindows();
  if (input.deliveredAt) {
    const daysSinceDelivery = (Date.now() - new Date(input.deliveredAt).getTime()) / 86_400_000;
    const windowDays =
      input.claimType === "damaged_item" ? windows.damage_reporting_days :
      input.claimType === "missing_package" ? windows.missing_package_reporting_days :
      input.claimType === "doesnt_fit" ? windows.sizing_return_days :
      input.claimType === "not_as_described" ? windows.ship_now_return_days :
      null;
    if (windowDays != null && daysSinceDelivery > windowDays) {
      return { result: "requires_admin_review", reason: `reporting window (${windowDays} days) has passed — manual exception required` };
    }
  }

  return { result: "eligible", reason: `${claimTypeEligibilityReasonKey(input.claimType, input.inventoryTypes)} return window open` };
}

function claimTypeEligibilityReasonKey(claimType: ClaimType, inventoryTypes: string[]): string {
  if (claimType === "doesnt_fit") return "Ship Now sizing";
  if (inventoryTypes.includes("sourced_for_you")) return "Sourced for You";
  return "Ship Now";
}

// ── Claim creation ───────────────────────────────────────────────────────────

export interface CreateClaimParams {
  orderId: string;
  customerEmail: string;
  customerId: string | null;
  claimType: ClaimType;
  claimSubtype?: ClaimSubtype | null;
  fitIssue?: FitIssue | null;
  description: string | null;
  orderItemIds: string[];
  eligibility: EligibilityOutcome;
}

export async function createClaim(params: CreateClaimParams) {
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id, product_name, price_usd")
    .in("id", params.orderItemIds);
  if (itemsErr || !items || items.length === 0) throw new Error("No valid order items for claim");

  const skus = await supabaseAdmin.from("products").select("id, sku").in("id", items.map((i) => i.product_id).filter(Boolean));
  const skuMap = new Map((skus.data ?? []).map((p) => [p.id, p.sku as string | null]));

  const snapshot = await snapshotOutboundShipment(params.orderId);

  const { data: claim, error } = await supabaseAdmin
    .from("claims")
    .insert({
      order_id: params.orderId,
      customer_id: params.customerId,
      customer_email: params.customerEmail.toLowerCase().trim(),
      claim_type: params.claimType,
      claim_subtype: params.claimSubtype ?? null,
      fit_issue: params.fitIssue ?? null,
      description: params.description,
      eligibility_result: params.eligibility.result,
      eligibility_reason: params.eligibility.reason,
      status: "received",
      responsibility: "bbj_action_required",
      original_shipment_snapshot: snapshot,
    })
    .select("*")
    .single();
  if (error || !claim) throw new Error(`createClaim failed: ${error?.message}`);

  const claimItemRows = items.map((i) => ({
    claim_id: claim.id,
    order_item_id: i.id,
    product_id: i.product_id,
    sku: i.product_id ? (skuMap.get(i.product_id) ?? null) : null,
    product_name: i.product_name,
    item_price_usd: i.price_usd,
  }));
  await supabaseAdmin.from("claim_items").insert(claimItemRows);

  await appendTimelineEvent({
    claimId: claim.id,
    actorType: "customer",
    actor: params.customerEmail,
    action: "claim_submitted",
    newStatus: "received",
    customerNote: `Claim submitted: ${CLAIM_TYPE_LABELS[params.claimType]}.`,
  });

  return claim;
}

async function snapshotOutboundShipment(orderId: string): Promise<Record<string, unknown> | null> {
  const [{ data: order }, { data: shipments }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("fee_breakdown, shipping_insurance_accepted, merchandise_subtotal_cents, amount_total")
      .eq("id", orderId)
      .maybeSingle(),
    supabaseAdmin
      .from("shipments")
      .select("carrier, tracking_number, shipping_method, shipping_cost, insurance_selected, shipped_at, delivered_at, estimated_delivery_start, estimated_delivery_end")
      .eq("order_id", orderId),
  ]);
  if (!order && (!shipments || shipments.length === 0)) return null;

  const insurancePremium = (order?.fee_breakdown as Record<string, number> | null)?.insurance ?? null;
  const insuredValueUsd = order?.shipping_insurance_accepted
    ? (order.merchandise_subtotal_cents ?? order.amount_total ?? 0) / 100
    : null;

  return {
    shipments: shipments ?? [],
    insurance_purchased: order?.shipping_insurance_accepted ?? null,
    insurance_premium_usd: insurancePremium,
    insured_value_usd: insuredValueUsd,
    snapshotted_at: new Date().toISOString(),
  };
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export async function addClaimEvidence(params: {
  claimId: string;
  claimItemId?: string | null;
  uploadedByType: "customer" | "admin";
  uploadedBy: string;
  category: EvidenceCategory;
  storagePath: string;
  fileName?: string | null;
  contentType?: string | null;
  caption?: string | null;
  customerVisible?: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from("claim_evidence")
    .insert({
      claim_id: params.claimId,
      claim_item_id: params.claimItemId ?? null,
      uploaded_by_type: params.uploadedByType,
      uploaded_by: params.uploadedBy,
      category: params.category,
      storage_path: params.storagePath,
      file_name: params.fileName ?? null,
      content_type: params.contentType ?? null,
      caption: params.caption ?? null,
      customer_visible: params.customerVisible ?? params.uploadedByType === "customer",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`addClaimEvidence failed: ${error?.message}`);

  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: params.uploadedByType,
    actor: params.uploadedBy,
    action: "evidence_uploaded",
    customerNote: params.uploadedByType === "customer" ? `Uploaded ${params.category.replace(/_/g, " ")}.` : null,
    internalNote: params.uploadedByType === "admin" ? `Admin uploaded ${params.category.replace(/_/g, " ")}.` : null,
    relatedObjectType: "claim_evidence",
    relatedObjectId: data.id,
  });

  return data;
}

// ── Timeline (§25, §26) ───────────────────────────────────────────────────────

export async function appendTimelineEvent(params: {
  claimId: string;
  actorType: "customer" | "admin" | "system";
  actor: string;
  action: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  customerNote?: string | null;
  internalNote?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await supabaseAdmin.from("claim_timeline_events").insert({
    claim_id: params.claimId,
    actor_type: params.actorType,
    actor: params.actor,
    action: params.action,
    old_status: params.oldStatus ?? null,
    new_status: params.newStatus ?? null,
    customer_note: params.customerNote ?? null,
    internal_note: params.internalNote ?? null,
    related_object_type: params.relatedObjectType ?? null,
    related_object_id: params.relatedObjectId ?? null,
    metadata: params.metadata ?? null,
  });
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function updateClaimStatus(params: {
  claimId: string;
  newStatus: string;
  responsibility?: Responsibility;
  actorType: "admin" | "system";
  actor: string;
  customerNote?: string | null;
  internalNote?: string | null;
  assignedAdmin?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
}) {
  const { data: current } = await supabaseAdmin.from("claims").select("status").eq("id", params.claimId).single();

  const update: Record<string, unknown> = { status: params.newStatus };
  if (params.responsibility) update.responsibility = params.responsibility;
  if (params.assignedAdmin !== undefined) update.assigned_admin = params.assignedAdmin;
  if (params.nextAction !== undefined) update.next_action = params.nextAction;
  if (params.nextActionDueAt !== undefined) update.next_action_due_at = params.nextActionDueAt;
  if (params.newStatus === "closed") update.closed_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from("claims").update(update).eq("id", params.claimId).select("*").single();
  if (error || !data) throw new Error(`updateClaimStatus failed: ${error?.message}`);

  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: params.actorType,
    actor: params.actor,
    action: "status_changed",
    oldStatus: current?.status ?? null,
    newStatus: params.newStatus,
    customerNote: params.customerNote ?? null,
    internalNote: params.internalNote ?? null,
  });

  return data;
}

export async function packagingAcknowledge(params: { claimId: string; customerEmail: string; policyText: string }) {
  const { data, error } = await supabaseAdmin
    .from("claims")
    .update({ packaging_ack_at: new Date().toISOString(), packaging_ack_policy_text: params.policyText })
    .eq("id", params.claimId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`packagingAcknowledge failed: ${error?.message}`);

  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: "customer",
    actor: params.customerEmail,
    action: "packaging_acknowledged",
    customerNote: "Confirmed original packaging will be retained.",
  });

  return data;
}

// ── Sizing refund/exchange calculator (§7) ────────────────────────────────────

export interface SizingDeductionBreakdown {
  itemAmountCents: number;
  restockingFeeCents: number;
  restockingFeeWaived: boolean;
  returnLabelCostCents: number;
  transactionFeeCents: number;
  estimatedRefundCents: number;
}

const RESTOCKING_FEE_RATE = 0.10;

export function calculateSizingRefund(params: {
  itemAmountCents: number;
  returnLabelCostCents: number;
  transactionFeeCents: number;
  waiveRestockingFee?: boolean; // true for exchanges
}): SizingDeductionBreakdown {
  const restockingFeeCents = params.waiveRestockingFee ? 0 : Math.round(params.itemAmountCents * RESTOCKING_FEE_RATE);
  const estimatedRefundCents = params.itemAmountCents - restockingFeeCents - params.returnLabelCostCents - params.transactionFeeCents;
  return {
    itemAmountCents: params.itemAmountCents,
    restockingFeeCents,
    restockingFeeWaived: !!params.waiveRestockingFee,
    returnLabelCostCents: params.returnLabelCostCents,
    transactionFeeCents: params.transactionFeeCents,
    estimatedRefundCents: Math.max(0, estimatedRefundCents),
  };
}

// ── Returns (§10–§14) ──────────────────────────────────────────────────────────

export async function createReturn(params: {
  claimId: string;
  orderId: string;
  returnType: "damage_insurance_return" | "not_as_described" | "sizing_refund" | "sizing_exchange";
  expectedComponents: Array<{ component: string; required: boolean; customerAllowedToKeep: boolean }>;
  dropoffDeadlineAt?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("returns")
    .insert({
      claim_id: params.claimId,
      order_id: params.orderId,
      return_type: params.returnType,
      status: "requested",
      dropoff_deadline_at: params.dropoffDeadlineAt ?? null,
      dropoff_deadline_original_at: params.dropoffDeadlineAt ?? null,
      expected_components: params.expectedComponents.map((c) => ({
        component: c.component, required: c.required, customer_allowed_to_keep: c.customerAllowedToKeep, outcome: null,
      })),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createReturn failed: ${error?.message}`);
  return data;
}

export async function setReturnDeadline(params: { returnId: string; claimId: string; newDeadline: string; admin: string; reason?: string | null }) {
  const { data: current } = await supabaseAdmin.from("returns").select("dropoff_deadline_at").eq("id", params.returnId).single();
  await supabaseAdmin.from("returns").update({ dropoff_deadline_at: params.newDeadline, status: "awaiting_dropoff" }).eq("id", params.returnId);
  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: "admin",
    actor: params.admin,
    action: "return_deadline_extended",
    relatedObjectType: "return",
    relatedObjectId: params.returnId,
    internalNote: params.reason ?? null,
    metadata: { old_deadline: current?.dropoff_deadline_at ?? null, new_deadline: params.newDeadline },
  });
}

export async function recordReturnLabel(params: {
  returnId: string;
  claimId: string;
  admin: string;
  carrier: string;
  serviceLevel?: string | null;
  trackingNumber?: string | null;
  labelStoragePath?: string | null;
  labelExternalUrl?: string | null;
  labelExpiresAt?: string | null;
  quotedLabelCostCents: number;
  insurancePurchased?: boolean;
  insuredValueUsd?: number | null;
  insurancePremiumUsd?: number | null;
  costBorneBy?: "bbj" | "customer";
  deductFromRefund?: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from("return_shipments")
    .insert({
      return_id: params.returnId,
      carrier: params.carrier,
      service_level: params.serviceLevel ?? null,
      tracking_number: params.trackingNumber ?? null,
      label_storage_path: params.labelStoragePath ?? null,
      label_file_url_external: params.labelExternalUrl ?? null,
      label_created_at: new Date().toISOString(),
      label_expires_at: params.labelExpiresAt ?? null,
      quoted_label_cost_usd: params.quotedLabelCostCents / 100,
      insurance_purchased: params.insurancePurchased ?? false,
      insured_value_usd: params.insuredValueUsd ?? null,
      insurance_premium_usd: params.insurancePremiumUsd ?? null,
      cost_borne_by: params.costBorneBy ?? "bbj",
      deduct_from_refund: params.deductFromRefund ?? false,
      label_status: "created",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`recordReturnLabel failed: ${error?.message}`);

  await supabaseAdmin.from("returns").update({ status: "label_issued" }).eq("id", params.returnId);
  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: "admin",
    actor: params.admin,
    action: "return_label_issued",
    newStatus: "label_issued",
    customerNote: "Your prepaid return label is ready.",
    relatedObjectType: "return_shipment",
    relatedObjectId: data.id,
  });
  return data;
}

export async function reportCustomerDropoff(params: { returnShipmentId: string; returnId: string; claimId: string; customerEmail: string }) {
  await supabaseAdmin
    .from("return_shipments")
    .update({ customer_dropoff_reported_at: new Date().toISOString() })
    .eq("id", params.returnShipmentId);
  await supabaseAdmin.from("returns").update({ status: "dropoff_reported" }).eq("id", params.returnId);
  await appendTimelineEvent({
    claimId: params.claimId,
    actorType: "customer",
    actor: params.customerEmail,
    action: "customer_reported_dropoff",
    newStatus: "dropoff_reported",
    customerNote: "You reported dropping off your return. We'll update this once the carrier scans it in.",
    internalNote: "Customer-reported drop-off — NOT objective proof of carrier possession. Awaiting carrier_acceptance_scan_at.",
    relatedObjectType: "return_shipment",
    relatedObjectId: params.returnShipmentId,
  });
}

export async function recordCarrierAcceptance(params: { returnShipmentId: string; returnId: string; claimId: string; admin: string; scanAt?: string }) {
  const scanAt = params.scanAt ?? new Date().toISOString();
  await supabaseAdmin.from("return_shipments").update({ carrier_acceptance_scan_at: scanAt, in_transit_status: "in_transit" }).eq("id", params.returnShipmentId);
  await supabaseAdmin.from("returns").update({ status: "in_transit" }).eq("id", params.returnId);
  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.admin, action: "carrier_acceptance_confirmed",
    newStatus: "in_transit", customerNote: "Your return is in transit to us.",
    relatedObjectType: "return_shipment", relatedObjectId: params.returnShipmentId,
  });
}

export async function recordReturnInspection(params: {
  returnId: string; claimId: string; admin: string;
  correctItemReturned?: boolean; skuMatches?: boolean; orderItemMatches?: boolean;
  certificateNumberMatches?: boolean; certificateReturned?: boolean; originalPackagingReturned?: boolean;
  accessoriesReturned?: boolean; newScratches?: boolean; chips?: boolean; cracks?: boolean;
  damageFound?: boolean; alteration?: boolean; wear?: boolean; conditionNotes?: string | null;
  restockable?: boolean;
  result: "approved_as_received" | "approved_with_deduction" | "needs_further_review" | "incorrect_item_returned" | "item_materially_damaged" | "missing_required_components" | "rejected" | "admin_override";
  deductionAmountUsd?: number | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("return_inspections")
    .insert({
      return_id: params.returnId,
      received_at: new Date().toISOString(),
      inspected_by: params.admin,
      inspected_at: new Date().toISOString(),
      correct_item_returned: params.correctItemReturned ?? null,
      sku_matches: params.skuMatches ?? null,
      order_item_matches: params.orderItemMatches ?? null,
      certificate_number_matches: params.certificateNumberMatches ?? null,
      certificate_returned: params.certificateReturned ?? null,
      original_packaging_returned: params.originalPackagingReturned ?? null,
      accessories_returned: params.accessoriesReturned ?? null,
      new_scratches: params.newScratches ?? null,
      chips: params.chips ?? null,
      cracks: params.cracks ?? null,
      damage_found: params.damageFound ?? null,
      alteration: params.alteration ?? null,
      wear: params.wear ?? null,
      condition_notes: params.conditionNotes ?? null,
      restockable: params.restockable ?? null,
      result: params.result,
      deduction_amount_usd: params.deductionAmountUsd ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`recordReturnInspection failed: ${error?.message}`);

  await supabaseAdmin.from("returns").update({ status: "inspecting_complete" }).eq("id", params.returnId);
  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.admin, action: "return_inspected",
    internalNote: `Inspection result: ${params.result}.`,
    customerNote: "Your return has been received and inspected.",
    relatedObjectType: "return_inspection", relatedObjectId: data.id,
  });
  // Deliberately NOT restocking inventory here — restocking only happens on
  // explicit admin action after inspection approval (§37: "do not
  // automatically restock before inspection approval").
  return data;
}

/** Explicit, separate step — never automatic — per §37. */
export async function restockInspectedItem(params: { productId: string; admin: string; claimId: string }) {
  await supabaseAdmin.from("products").update({ status: "available" }).eq("id", params.productId);
  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.admin, action: "item_restocked",
    internalNote: `Product ${params.productId} marked available again after passing return inspection.`,
  });
}

// ── Resolutions + financial ledger (§15–§24) ──────────────────────────────────

export async function createClaimResolution(params: {
  claimId: string;
  resolutionType: ResolutionType;
  decidedBy: string;
  customerSummary?: string | null;
  internalNotes?: string | null;
}) {
  const { data: resolution, error } = await supabaseAdmin
    .from("claim_resolutions")
    .insert({
      claim_id: params.claimId,
      resolution_type: params.resolutionType,
      decided_by: params.decidedBy,
      customer_summary: params.customerSummary ?? null,
      internal_notes: params.internalNotes ?? null,
    })
    .select("*")
    .single();
  if (error || !resolution) throw new Error(`createClaimResolution failed: ${error?.message}`);

  // Atomic conditional update — same idiom as capture-payment's race guard.
  // Prevents a second resolution ever being attached to the same claim.
  const { data: locked } = await supabaseAdmin
    .from("claims")
    .update({ resolution_id: resolution.id, responsibility: "resolution_pending" })
    .eq("id", params.claimId)
    .is("resolution_id", null)
    .select("id")
    .maybeSingle();

  if (!locked) {
    // Someone beat us to it — roll back the orphaned resolution row.
    await supabaseAdmin.from("claim_resolutions").delete().eq("id", resolution.id);
    throw new Error("This claim already has a resolution attached.");
  }

  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.decidedBy, action: "resolution_created",
    customerNote: params.customerSummary ?? null,
    relatedObjectType: "claim_resolution", relatedObjectId: resolution.id,
  });

  return resolution;
}

async function recordFinancialEvent(params: {
  claimId: string; orderId: string; resolutionId?: string | null;
  eventType: FinancialEventType; amountUsd: number; method?: string | null;
  externalReference?: string | null; waived?: boolean; waiverReason?: string | null;
  createdBy: string; notes?: string | null; metadata?: Record<string, unknown> | null;
}) {
  await supabaseAdmin.from("claim_financial_events").insert({
    claim_id: params.claimId,
    order_id: params.orderId,
    resolution_id: params.resolutionId ?? null,
    event_type: params.eventType,
    amount_usd: params.amountUsd,
    method: params.method ?? null,
    external_reference: params.externalReference ?? null,
    waived: params.waived ?? false,
    waiver_reason: params.waiverReason ?? null,
    created_by: params.createdBy,
    notes: params.notes ?? null,
    metadata: params.metadata ?? null,
  });
}

/**
 * Cash refund via Stripe, reusing the same refund call shape as
 * app/api/admin/orders/[id]/refund/route.ts. Idempotent: refuses if this
 * resolution already has a succeeded claim_refunds row.
 */
export async function issueClaimCashRefund(params: {
  claimId: string; orderId: string; resolutionId: string;
  amountCents: number; method: "stripe" | "zelle" | "ach" | "wire" | "check" | "cash" | "other";
  stripePaymentIntentId?: string | null;
  referenceNumber?: string | null; proofStoragePath?: string | null;
  initiatedBy: string; adminNotes?: string | null;
}) {
  const { data: existing } = await supabaseAdmin
    .from("claim_refunds")
    .select("id")
    .eq("resolution_id", params.resolutionId)
    .eq("status", "succeeded")
    .maybeSingle();
  if (existing) throw new Error("A refund has already been issued for this resolution.");

  let stripeRefundId: string | null = null;
  let stripeChargeId: string | null = null;
  let status: "pending" | "succeeded" | "failed" = "succeeded";

  if (params.method === "stripe") {
    if (!params.stripePaymentIntentId) throw new Error("stripePaymentIntentId required for a Stripe refund");
    const refund: Stripe.Refund = await stripe.refunds.create({
      payment_intent: params.stripePaymentIntentId,
      amount: params.amountCents,
      idempotencyKey: `claim_refund_${params.resolutionId}`,
    });
    stripeRefundId = refund.id;
    stripeChargeId = typeof refund.charge === "string" ? refund.charge : (refund.charge?.id ?? null);
    status = refund.status === "failed" ? "failed" : "succeeded";
  }

  const { data: refundRow, error } = await supabaseAdmin
    .from("claim_refunds")
    .insert({
      claim_id: params.claimId,
      resolution_id: params.resolutionId,
      order_id: params.orderId,
      method: params.method,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      stripe_charge_id: stripeChargeId,
      stripe_refund_id: stripeRefundId,
      amount_usd: params.amountCents / 100,
      status,
      reference_number: params.referenceNumber ?? null,
      proof_storage_path: params.proofStoragePath ?? null,
      initiated_by: params.initiatedBy,
      admin_notes: params.adminNotes ?? null,
    })
    .select("*")
    .single();
  if (error || !refundRow) throw new Error(`issueClaimCashRefund failed: ${error?.message}`);

  await recordFinancialEvent({
    claimId: params.claimId, orderId: params.orderId, resolutionId: params.resolutionId,
    eventType: "cash_refund", amountUsd: -(params.amountCents / 100), method: params.method,
    externalReference: stripeRefundId ?? params.referenceNumber ?? null, createdBy: params.initiatedBy,
  });

  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.initiatedBy, action: "refund_issued",
    customerNote: `A refund of $${(params.amountCents / 100).toFixed(2)} has been issued.`,
    relatedObjectType: "claim_refund", relatedObjectId: refundRow.id,
  });

  return refundRow;
}

/** Store credit ("goodwill"/refund-equivalent) or Exchange Credit issuance. */
export async function issueClaimCredit(params: {
  claimId: string; orderId: string; resolutionId: string;
  customerEmail: string; customerId: string | null;
  amountCents: number; kind: "store_credit" | "exchange_credit";
  issuedBy: string; customerMessage?: string | null;
}) {
  const { data: existing } = await supabaseAdmin
    .from("claim_financial_events")
    .select("id")
    .eq("resolution_id", params.resolutionId)
    .in("event_type", ["store_credit_issued", "exchange_credit_issued"])
    .maybeSingle();
  if (existing) throw new Error("Credit has already been issued for this resolution.");

  const credit = await issueStoreCredit({
    amountCents: params.amountCents,
    customerEmail: params.customerEmail,
    customerId: params.customerId,
    sourceOrderId: params.orderId,
    claimId: params.claimId,
    reason: params.kind === "exchange_credit" ? "exchange_credit" : "claim_resolution",
    customerMessage: params.customerMessage ?? null,
    issuedBy: params.issuedBy,
  });

  await recordFinancialEvent({
    claimId: params.claimId, orderId: params.orderId, resolutionId: params.resolutionId,
    eventType: params.kind === "exchange_credit" ? "exchange_credit_issued" : "store_credit_issued",
    amountUsd: -(params.amountCents / 100), method: params.kind, externalReference: credit.code,
    createdBy: params.issuedBy,
  });

  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.issuedBy, action: "credit_issued",
    customerNote: `${params.kind === "exchange_credit" ? "Exchange credit" : "Store credit"} of $${(params.amountCents / 100).toFixed(2)} has been issued (code ${credit.code}).`,
    relatedObjectType: "store_credit", relatedObjectId: credit.id,
  });

  return credit;
}

export async function closeClaim(params: { claimId: string; admin: string; customerNote?: string | null }) {
  return updateClaimStatus({
    claimId: params.claimId, newStatus: "closed", responsibility: "closed",
    actorType: "admin", actor: params.admin, customerNote: params.customerNote ?? "Your claim has been closed.",
  });
}

export async function reopenClaim(params: { claimId: string; admin: string; reason: string }) {
  const { data: current } = await supabaseAdmin.from("claims").select("reopened_count").eq("id", params.claimId).single();
  const { data, error } = await supabaseAdmin
    .from("claims")
    .update({ status: "reopened", responsibility: "bbj_action_required", closed_at: null, reopened_count: (current?.reopened_count ?? 0) + 1 })
    .eq("id", params.claimId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`reopenClaim failed: ${error?.message}`);

  await appendTimelineEvent({
    claimId: params.claimId, actorType: "admin", actor: params.admin, action: "claim_reopened",
    newStatus: "reopened", internalNote: params.reason, customerNote: "Your claim has been reopened.",
  });
  return data;
}

// ── Financial summary (§23) ───────────────────────────────────────────────────

export async function getClaimFinancialSummary(claimId: string) {
  const { data: events } = await supabaseAdmin
    .from("claim_financial_events")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  const rows = events ?? [];
  const netClaimImpactUsd = rows.reduce((sum, r) => sum + Number(r.amount_usd), 0);
  const byType: Partial<Record<FinancialEventType, number>> = {};
  for (const r of rows) {
    const t = r.event_type as FinancialEventType;
    byType[t] = (byType[t] ?? 0) + Number(r.amount_usd);
  }

  return { events: rows, byType, netClaimImpactUsd };
}
