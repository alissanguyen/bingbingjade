/**
 * Generalized Service Request platform — backend orchestration.
 *
 * Mirrors lib/orders.ts in shape (draft → validate → pay → fulfill), scoped
 * to services (Restoration & Preservation today; any future service line
 * tomorrow via the `services` config table, migration_117).
 *
 * Core invariant, deliberately different from the product-order pipeline:
 * a service_requests row and its attachments must exist and be validated
 * BEFORE any Stripe interaction. The webhook only ever UPDATES a
 * pre-existing row (looked up by id in session metadata) — it never
 * creates one. This is what makes "no payment without images" enforceable,
 * and is why a metadata-shape mismatch can never silently drop a paid
 * request the way it did for order #1330-3268 (see webhook route.ts).
 */

import { randomBytes } from "crypto";
import sharp from "sharp";
import type Stripe from "stripe";
import { supabaseAdmin } from "./supabase-admin";
import { stripe } from "./stripe";
import { SERVICE_REQUEST_BUCKET, resolveServiceAttachmentUrl } from "./storage";
import { calculateStripeFee, MANUAL_CAPTURE_WINDOW_DAYS, ALLOWED_COUNTRIES } from "./shipping";
import { logAudit } from "./audit";
import {
  sendServiceRequestReceivedEmail,
  sendAdminNewServiceRequestEmail,
  sendShippingInstructionsEmail,
  sendAuthorizationReleasedServiceEmail,
} from "./service-emails";

// ── Errors ──────────────────────────────────────────────────────────────────

export class ValidationError extends Error {}
export class ConflictError extends Error {}

// ── Types ───────────────────────────────────────────────────────────────────

export type WorkflowMode = "instant_purchase" | "authorization_hold" | "quote_required";

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  discounted_price_cents: number | null;
  currency: string;
  estimated_timeline: string | null;
  discounted_timeline: string | null;
  workflow_mode: WorkflowMode;
  requires_image_review: boolean;
  min_images: number;
  max_images: number;
  additional_images_limit: number;
  requires_customer_verification: boolean;
  requires_shipping: boolean;
  requires_return_shipping: boolean;
  active: boolean;
}

export interface ServiceRequestRow {
  id: string;
  request_number: string | null;
  public_token: string;
  service_id: string;
  status: string;
  client_type: string | null;
  verified: boolean;
  verification_order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  admin_instructions: string | null;
  price_cents: number | null;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  capture_status: string | null;
  authorized_amount: number | null;
  captured_amount: number | null;
  authorized_at: string | null;
  authorization_expires_at: string | null;
  captured_at: string | null;
  latest_stripe_status: string | null;
  capture_payment_method: string | null;
  quote_amount_cents: number | null;
  quote_notes: string | null;
  quote_sent_at: string | null;
  quote_expires_at: string | null;
  quote_accepted_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  return_tracking_number: string | null;
  return_carrier: string | null;
  assigned_staff: string | null;
  admin_notes: string | null;
  decline_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  service?: ServiceRow;
}

// ── Upload validation ─────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB raw — matches iPhone HEIC-original comment in /api/upload-image

/**
 * Resize + re-encode a customer-submitted photo for storage/transport. No
 * watermark (that's for public product listings, not a customer's own
 * diagnostic photos) and quality is kept high — this is compression for
 * transport, not to the point of destroying crack/scratch visibility.
 * Falls back to the original bytes untouched if sharp can't decode the
 * input (e.g. an unusual HEIC variant) rather than failing the upload.
 */
async function processServiceImage(input: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const buffer = await sharp(input)
      .rotate()
      .resize(3000, 3000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer();
    return { buffer, contentType: "image/webp" };
  } catch (err) {
    console.error("[service-requests] image processing failed, storing original", err);
    return { buffer: input, contentType: "application/octet-stream" };
  }
}

// ── Service catalog lookups ───────────────────────────────────────────────

export async function getServiceBySlug(slug: string): Promise<ServiceRow | null> {
  const { data } = await supabaseAdmin.from("services").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  return data as ServiceRow | null;
}

export async function listActiveServices(): Promise<ServiceRow[]> {
  const { data } = await supabaseAdmin.from("services").select("*").eq("active", true).order("sort_order");
  return (data ?? []) as ServiceRow[];
}

// ── Draft creation ─────────────────────────────────────────────────────────

export async function createDraftServiceRequest(serviceSlug: string): Promise<{ id: string; publicToken: string }> {
  const service = await getServiceBySlug(serviceSlug);
  if (!service) throw new ValidationError("Unknown or inactive service.");

  const { data, error } = await supabaseAdmin
    .from("service_requests")
    .insert({ service_id: service.id, status: "draft", currency: service.currency })
    .select("id, public_token")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create draft request.");
  return { id: data.id, publicToken: data.public_token };
}

// ── Attachments ─────────────────────────────────────────────────────────────

interface AddAttachmentParams {
  serviceRequestId: string;
  file: File;
  attachmentType?: string;
  uploadedBy?: string;
  /** Verifies the caller's public_token matches when uploading via the customer tracker (not the initial form draft). */
  requireToken?: string;
}

export async function addAttachment(params: AddAttachmentParams) {
  const { serviceRequestId, file } = params;
  const attachmentType = params.attachmentType ?? "customer_submission";
  const uploadedBy = params.uploadedBy ?? "customer";

  if (!file || file.size === 0) throw new ValidationError("No file provided.");
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ValidationError("Unsupported file type. Please upload a JPEG, PNG, WebP, or HEIC image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError("File is too large. Please upload an image under 20MB.");
  }

  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("id, status, public_token, service:services(max_images, additional_images_limit)")
    .eq("id", serviceRequestId)
    .maybeSingle();

  if (!request) throw new ValidationError("Service request not found.");
  if (params.requireToken && request.public_token !== params.requireToken) {
    throw new ValidationError("Not authorized for this request.");
  }
  if (!["draft", "awaiting_images"].includes(request.status)) {
    throw new ValidationError("This request is no longer accepting new images.");
  }

  const service = request.service as unknown as { max_images: number; additional_images_limit: number };
  const limit = request.status === "awaiting_images" ? service.additional_images_limit : service.max_images;

  const { count } = await supabaseAdmin
    .from("service_request_attachments")
    .select("id", { count: "exact", head: true })
    .eq("service_request_id", serviceRequestId)
    .eq("attachment_type", "customer_submission")
    .is("deleted_at", null);

  if ((count ?? 0) >= limit) {
    throw new ValidationError(`You can upload up to ${limit} images.`);
  }

  const rawBytes = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType } = await processServiceImage(rawBytes);
  const ext = contentType === "image/webp" ? "webp" : (file.name.split(".").pop() ?? "bin");
  const storageKey = `${serviceRequestId}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(SERVICE_REQUEST_BUCKET)
    .upload(storageKey, buffer, { contentType, upsert: false });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data: attachment, error: insertErr } = await supabaseAdmin
    .from("service_request_attachments")
    .insert({
      service_request_id: serviceRequestId,
      storage_key: storageKey,
      original_filename: file.name,
      mime_type: contentType,
      file_size: buffer.length,
      attachment_type: attachmentType,
      uploaded_by: uploadedBy,
      sort_order: count ?? 0,
    })
    .select("*")
    .single();

  if (insertErr || !attachment) {
    await supabaseAdmin.storage.from(SERVICE_REQUEST_BUCKET).remove([storageKey]).catch(() => {});
    throw new Error(insertErr?.message ?? "Failed to save attachment.");
  }

  return attachment;
}

export async function removeAttachment(params: { serviceRequestId: string; attachmentId: string; requireToken?: string }) {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("id, status, public_token")
    .eq("id", params.serviceRequestId)
    .maybeSingle();
  if (!request) throw new ValidationError("Service request not found.");
  if (params.requireToken && request.public_token !== params.requireToken) {
    throw new ValidationError("Not authorized for this request.");
  }
  if (!["draft", "awaiting_images"].includes(request.status)) {
    throw new ValidationError("This request can no longer be edited.");
  }

  const { data: updated } = await supabaseAdmin
    .from("service_request_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.attachmentId)
    .eq("service_request_id", params.serviceRequestId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (!updated) throw new ValidationError("Attachment not found.");
  return { removed: true };
}

export interface AttachmentRow {
  id: string;
  service_request_id: string;
  storage_key: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  attachment_type: string;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
}

/** Shapes an attachment row for a JSON API response, resolving a short-lived signed preview URL. */
export async function resolveAttachmentForResponse(attachment: AttachmentRow) {
  const previewUrl = await resolveServiceAttachmentUrl(attachment.storage_key);
  return {
    id: attachment.id,
    attachmentType: attachment.attachment_type,
    sortOrder: attachment.sort_order,
    originalFilename: attachment.original_filename,
    uploadedBy: attachment.uploaded_by,
    createdAt: attachment.created_at,
    previewUrl,
  };
}

export async function listAttachments(serviceRequestId: string) {
  const { data } = await supabaseAdmin
    .from("service_request_attachments")
    .select("*")
    .eq("service_request_id", serviceRequestId)
    .is("deleted_at", null)
    .order("sort_order");
  const rows = (data ?? []) as AttachmentRow[];
  return Promise.all(rows.map(resolveAttachmentForResponse));
}

export async function countCustomerAttachments(serviceRequestId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("service_request_attachments")
    .select("id", { count: "exact", head: true })
    .eq("service_request_id", serviceRequestId)
    .eq("attachment_type", "customer_submission")
    .is("deleted_at", null);
  return count ?? 0;
}

// ── Submission (the atomicity boundary) ────────────────────────────────────

export interface SubmitServiceRequestParams {
  serviceRequestId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  clientType: "new" | "existing_client";
  verified?: boolean;
  verifiedOrderNumber?: string;
}

export async function submitServiceRequest(params: SubmitServiceRequestParams) {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", params.serviceRequestId)
    .maybeSingle();
  if (!request) throw new ValidationError("Service request not found.");

  // Idempotent: double-click/refresh after a successful submit is a no-op,
  // never a duplicate — the optimistic lock below is what actually enforces this.
  if (request.status !== "draft") {
    return { serviceRequest: request as ServiceRequestRow, alreadySubmitted: true };
  }

  const service = request.service as unknown as ServiceRow;
  if (!params.customerName?.trim() || !params.customerEmail?.trim()) {
    throw new ValidationError("Name and email are required.");
  }

  if (service.requires_image_review) {
    const n = await countCustomerAttachments(params.serviceRequestId);
    if (n < service.min_images) {
      throw new ValidationError(
        `Please upload at least ${service.min_images} photo${service.min_images === 1 ? "" : "s"} before submitting.`
      );
    }
    if (n > service.max_images) {
      throw new ValidationError(`Please remove extra photos — maximum ${service.max_images} allowed.`);
    }
    // Confirm every attachment record actually has a live object in storage —
    // never trust the row alone (defends against a client racing a delete).
    const { data: attachments } = await supabaseAdmin
      .from("service_request_attachments")
      .select("storage_key")
      .eq("service_request_id", params.serviceRequestId)
      .eq("attachment_type", "customer_submission")
      .is("deleted_at", null);
    for (const a of attachments ?? []) {
      const { error } = await supabaseAdmin.storage.from(SERVICE_REQUEST_BUCKET).download(a.storage_key);
      if (error) throw new ValidationError("One of your uploaded photos could not be verified. Please re-upload it and try again.");
    }
  }

  let verified = false;
  let priceCents = service.base_price_cents;

  if (service.requires_customer_verification && params.clientType === "existing_client") {
    if (!params.verified || !params.verifiedOrderNumber) {
      throw new ValidationError("Please verify your prior order before proceeding at the discounted rate.");
    }
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("order_number", params.verifiedOrderNumber.trim().toUpperCase())
      .maybeSingle();
    if (!order) throw new ValidationError("Verification could not be confirmed. Please verify again.");
    verified = true;
    priceCents = service.discounted_price_cents ?? service.base_price_cents;
  }

  const nextStatus = service.workflow_mode === "quote_required" ? "quote_needed" : "pending_review";

  // Optimistic lock — only a row still in 'draft' transitions; a concurrent
  // duplicate submit loses the race and falls through to the read-back below.
  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({
      status: nextStatus,
      client_type: params.clientType,
      verified,
      verification_order_number: params.verifiedOrderNumber?.trim().toUpperCase() ?? null,
      customer_name: params.customerName.trim(),
      customer_email: params.customerEmail.trim().toLowerCase(),
      customer_phone: params.customerPhone?.trim() ?? null,
      notes: params.notes?.trim() ?? null,
      price_cents: priceCents,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", params.serviceRequestId)
    .eq("status", "draft")
    .select("*, service:services(*)")
    .maybeSingle();

  if (!updated) {
    const { data: current } = await supabaseAdmin
      .from("service_requests")
      .select("*, service:services(*)")
      .eq("id", params.serviceRequestId)
      .single();
    return { serviceRequest: current as ServiceRequestRow, alreadySubmitted: true };
  }

  const row = updated as ServiceRequestRow;

  await logAudit({
    actorUserId: "customer",
    action: "service_request_submitted",
    entityType: "service_request",
    entityId: row.id,
    newValue: { status: nextStatus, price_cents: priceCents },
  });

  if (service.workflow_mode === "quote_required") {
    await sendServiceRequestReceivedEmail({ serviceRequest: row, service, mode: "quote_required" }).catch((e) =>
      console.error("[service-requests] request-received email failed", e)
    );
    await sendAdminNewServiceRequestEmail({ serviceRequest: row, service }).catch(() => {});
  }

  return { serviceRequest: row, alreadySubmitted: false };
}

// ── Customer tracker lookups ────────────────────────────────────────────────

export async function getServiceRequestByToken(token: string): Promise<ServiceRequestRow | null> {
  const { data } = await supabaseAdmin.from("service_requests").select("*, service:services(*)").eq("public_token", token).maybeSingle();
  return data as ServiceRequestRow | null;
}

export async function getServiceRequestTimeline(serviceRequestId: string) {
  const { data } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, actor_user_id, previous_value, new_value, metadata, created_at")
    .eq("entity_type", "service_request")
    .eq("entity_id", serviceRequestId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

// ── Stripe checkout (authorization_hold / instant_purchase only) ──────────

export async function createServiceCheckoutSession(serviceRequestId: string): Promise<{ url: string | null }> {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", serviceRequestId)
    .maybeSingle();
  if (!request) throw new ValidationError("Service request not found.");

  const row = request as ServiceRequestRow;
  const service = row.service as unknown as ServiceRow;

  if (!["pending_review", "authorization_pending"].includes(row.status)) {
    throw new ValidationError("This request is not ready for checkout.");
  }
  if (service.workflow_mode === "quote_required") {
    throw new ValidationError("This service requires a quote before payment.");
  }

  // Refresh, don't duplicate, an in-flight session (refresh/double-click before
  // the customer completes Stripe's hosted checkout page).
  if (row.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
      if (existing.status === "open" && existing.url) return { url: existing.url };
    } catch {
      /* session expired or invalid — fall through and create a new one */
    }
  }

  const priceCents = row.price_cents ?? service.base_price_cents;
  if (!priceCents) throw new ValidationError("This service does not have a fixed price for direct checkout.");

  const captureMode: "manual" | "instant" = service.workflow_mode === "authorization_hold" ? "manual" : "instant";
  const txFeeCents = calculateStripeFee(priceCents, "domestic");
  const timeline = row.verified ? service.discounted_timeline ?? service.estimated_timeline : service.estimated_timeline;
  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: row.customer_email ?? undefined,
      ...(service.requires_shipping
        ? { shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES.map((c) => c.code) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] } }
        : {}),
      ...(captureMode === "manual" ? { payment_intent_data: { capture_method: "manual" } } : {}),
      line_items: [
        {
          price_data: {
            currency: service.currency,
            product_data: {
              name: service.name,
              description: timeline
                ? `Estimated timeline: ${timeline}. We'll review your submitted photos before beginning work.`
                : "We'll review your submitted photos before beginning work.",
            },
            unit_amount: priceCents,
            tax_behavior: "exclusive",
          },
          quantity: 1,
        },
        {
          price_data: { currency: "usd", product_data: { name: "Processing Fee" }, unit_amount: txFeeCents, tax_behavior: "exclusive" },
          quantity: 1,
        },
      ],
      metadata: {
        is_service_checkout: "true",
        service_request_id: row.id,
        capture_mode: captureMode,
      },
      success_url: `${SITE_URL}/restoration?checkout=success&sr=${row.id}`,
      cancel_url: `${SITE_URL}/restoration`,
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to start checkout.");
  }

  await supabaseAdmin
    .from("service_requests")
    .update({ stripe_session_id: session.id, status: captureMode === "manual" ? "authorization_pending" : row.status })
    .eq("id", row.id);

  return { url: session.url };
}

/** Instant-capture checkout for an already-accepted quote (silver/gold wrapping). */
export async function createQuoteCheckoutSession(serviceRequestId: string, publicToken: string): Promise<{ url: string | null }> {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", serviceRequestId)
    .maybeSingle();
  if (!request) throw new ValidationError("Service request not found.");
  const row = request as ServiceRequestRow;
  if (row.public_token !== publicToken) throw new ValidationError("Not authorized for this request.");
  if (row.status !== "quote_sent") throw new ValidationError("There is no pending quote to accept for this request.");
  if (!row.quote_amount_cents) throw new ValidationError("This request does not have a quote yet.");
  if (row.quote_expires_at && new Date(row.quote_expires_at) < new Date()) {
    throw new ValidationError("This quote has expired. Please contact us for an updated quote.");
  }

  const service = row.service as unknown as ServiceRow;
  const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

  if (row.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(row.stripe_session_id);
      if (existing.status === "open" && existing.url) return { url: existing.url };
    } catch { /* fall through */ }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: row.customer_email ?? undefined,
    ...(service.requires_shipping
      ? { shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES.map((c) => c.code) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] } }
      : {}),
    line_items: [
      {
        price_data: {
          currency: row.currency,
          product_data: { name: `${service.name} — Custom Quote`, description: row.quote_notes ?? undefined },
          unit_amount: row.quote_amount_cents,
          tax_behavior: "exclusive",
        },
        quantity: 1,
      },
    ],
    metadata: { is_service_checkout: "true", service_request_id: row.id, capture_mode: "instant" },
    success_url: `${SITE_URL}/service-requests/${row.public_token}?paid=1`,
    cancel_url: `${SITE_URL}/service-requests/${row.public_token}`,
  });

  await supabaseAdmin.from("service_requests").update({ stripe_session_id: session.id, quote_accepted_at: new Date().toISOString() }).eq("id", row.id);
  return { url: session.url };
}

// ── Webhook completion handler ─────────────────────────────────────────────

export async function handleServiceCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const serviceRequestId = session.metadata?.service_request_id;
  if (!serviceRequestId) {
    console.error("[service-requests] Missing service_request_id in session metadata", session.id);
    return;
  }

  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", serviceRequestId)
    .maybeSingle();
  if (!request) {
    console.error("[service-requests] service_request not found for webhook", serviceRequestId);
    return;
  }

  const row = request as ServiceRequestRow;
  // Idempotent — a Stripe webhook retry after we've already processed this
  // session must be a safe no-op, never a duplicate email or double-charge.
  if (row.capture_status === "authorized" || row.capture_status === "captured") {
    return;
  }

  const service = row.service as unknown as ServiceRow;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const captureMode = session.metadata?.capture_mode === "manual" ? "manual" : "instant";

  if (captureMode === "manual") {
    let capturePaymentMethod: string | null = null;
    let latestStripeStatus: string | null = null;
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        capturePaymentMethod = pi.payment_method_types?.[0] ?? null;
        latestStripeStatus = pi.status;
      } catch (err) {
        console.error("[service-requests] Failed to retrieve PaymentIntent (non-fatal):", err);
      }
    }
    const windowDays =
      capturePaymentMethod && capturePaymentMethod in MANUAL_CAPTURE_WINDOW_DAYS
        ? MANUAL_CAPTURE_WINDOW_DAYS[capturePaymentMethod as keyof typeof MANUAL_CAPTURE_WINDOW_DAYS]
        : 7;
    const authorizationExpiresAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: updated } = await supabaseAdmin
      .from("service_requests")
      .update({
        status: "pending_review",
        capture_status: "authorized",
        stripe_payment_intent_id: paymentIntentId,
        authorized_amount: session.amount_total ?? row.price_cents,
        authorized_at: new Date().toISOString(),
        authorization_expires_at: authorizationExpiresAt,
        latest_stripe_status: latestStripeStatus,
        capture_payment_method: capturePaymentMethod,
      })
      .eq("id", row.id)
      .select("*, service:services(*)")
      .single();

    await logAudit({
      actorUserId: "stripe_webhook",
      action: "authorization_placed",
      entityType: "service_request",
      entityId: row.id,
      newValue: { capture_status: "authorized", authorization_expires_at: authorizationExpiresAt },
    });

    const finalRow = (updated ?? row) as ServiceRequestRow;
    await sendServiceRequestReceivedEmail({ serviceRequest: finalRow, service, mode: "authorization_hold" }).catch((e) =>
      console.error("[service-requests] request-received email failed", e)
    );
    await sendAdminNewServiceRequestEmail({ serviceRequest: finalRow, service }).catch(() => {});
  } else {
    const { data: updated } = await supabaseAdmin
      .from("service_requests")
      .update({
        status: "awaiting_shipment",
        capture_status: "captured",
        stripe_payment_intent_id: paymentIntentId,
        captured_amount: session.amount_total ?? row.price_cents,
        captured_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("*, service:services(*)")
      .single();

    await logAudit({
      actorUserId: "stripe_webhook",
      action: "quote_payment_captured",
      entityType: "service_request",
      entityId: row.id,
      newValue: { capture_status: "captured" },
    });

    const finalRow = (updated ?? row) as ServiceRequestRow;
    await sendShippingInstructionsEmail({ serviceRequest: finalRow, service }).catch((e) =>
      console.error("[service-requests] shipping-instructions email failed", e)
    );
  }
}

// ── Admin: capture / release (authorization_hold flow) ─────────────────────

export async function captureServiceRequestPayment(serviceRequestId: string, actorUserId: string) {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", serviceRequestId)
    .single();
  if (!request) throw new ValidationError("Service request not found.");
  const row = request as ServiceRequestRow;

  if (!row.stripe_payment_intent_id || !row.capture_status) {
    throw new ValidationError("This request does not use manual capture.");
  }
  if (row.capture_status === "captured") {
    return { serviceRequest: row, alreadyCaptured: true };
  }
  if (row.capture_status !== "authorized") {
    throw new ConflictError(`This authorization can no longer be captured (current status: ${row.capture_status}).`);
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to retrieve payment intent from Stripe.");
  }

  if (pi.status !== "requires_capture") {
    if (pi.status === "succeeded") {
      return { serviceRequest: await finalizeServiceCapture(row, pi, actorUserId), alreadyCaptured: true };
    }
    throw new ConflictError(`Authorization is no longer capturable — current Stripe status: ${pi.status}.`);
  }

  const { data: locked } = await supabaseAdmin
    .from("service_requests")
    .update({ latest_stripe_status: pi.status })
    .eq("id", row.id)
    .eq("capture_status", "authorized")
    .select("id")
    .maybeSingle();

  if (!locked) {
    const { data: current } = await supabaseAdmin.from("service_requests").select("*, service:services(*)").eq("id", serviceRequestId).single();
    return { serviceRequest: current as ServiceRequestRow, alreadyCaptured: current?.capture_status === "captured" };
  }

  let captured: Stripe.PaymentIntent;
  try {
    captured = await stripe.paymentIntents.capture(row.stripe_payment_intent_id, { idempotencyKey: `capture_sr_${row.id}` });
  } catch (err) {
    await supabaseAdmin.from("service_requests").update({ capture_status: "capture_failed" }).eq("id", row.id).eq("capture_status", "authorized");
    throw new Error(err instanceof Error ? err.message : "Stripe capture failed.");
  }

  return { serviceRequest: await finalizeServiceCapture(row, captured, actorUserId) };
}

async function finalizeServiceCapture(row: ServiceRequestRow, pi: Stripe.PaymentIntent, actorUserId: string) {
  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({
      capture_status: "captured",
      captured_amount: pi.amount_received,
      captured_at: new Date().toISOString(),
      latest_stripe_status: pi.status,
      status: "awaiting_shipment",
      decided_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*, service:services(*)")
    .single();

  await logAudit({
    actorUserId,
    action: "service_request_approved_captured",
    entityType: "service_request",
    entityId: row.id,
    previousValue: { capture_status: "authorized" },
    newValue: { capture_status: "captured" },
  });

  const finalRow = (updated ?? row) as ServiceRequestRow;
  const service = finalRow.service as unknown as ServiceRow;
  await sendShippingInstructionsEmail({ serviceRequest: finalRow, service }).catch((e) =>
    console.error("[service-requests] shipping-instructions email failed", e)
  );

  return finalRow;
}

export async function releaseServiceRequestAuthorization(serviceRequestId: string, actorUserId: string, reason?: string) {
  const { data: request } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", serviceRequestId)
    .single();
  if (!request) throw new ValidationError("Service request not found.");
  const row = request as ServiceRequestRow;

  if (!["authorized", "authorization_expired"].includes(row.capture_status ?? "")) {
    throw new ConflictError(
      row.capture_status === "captured"
        ? "This payment has already been captured — issue a refund instead."
        : `Cannot release — current authorization status: ${row.capture_status}.`
    );
  }

  const CANCELABLE_PI_STATUSES = new Set(["requires_capture", "requires_confirmation", "requires_action", "requires_payment_method"]);
  let latestStatus = row.latest_stripe_status;

  if (row.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
      latestStatus = pi.status;
      if (CANCELABLE_PI_STATUSES.has(pi.status)) {
        await stripe.paymentIntents.cancel(row.stripe_payment_intent_id, { idempotencyKey: `release_sr_${row.id}` });
      }
    } catch (err) {
      console.error("[service-requests] Failed to cancel PaymentIntent (continuing to mark released):", err);
    }
  }

  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({
      capture_status: "authorization_canceled",
      authorization_canceled_at: new Date().toISOString(),
      latest_stripe_status: latestStatus,
      status: "rejected",
      decline_reason: reason ?? "Declined after image review",
      decided_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*, service:services(*)")
    .single();

  await logAudit({
    actorUserId,
    action: "service_request_declined_released",
    entityType: "service_request",
    entityId: row.id,
    previousValue: { capture_status: row.capture_status },
    newValue: { capture_status: "authorization_canceled", decline_reason: reason ?? null },
  });

  const finalRow = (updated ?? row) as ServiceRequestRow;
  const service = finalRow.service as unknown as ServiceRow;
  await sendAuthorizationReleasedServiceEmail({ serviceRequest: finalRow, service, reason }).catch((e) =>
    console.error("[service-requests] authorization-released email failed", e)
  );

  return finalRow;
}
