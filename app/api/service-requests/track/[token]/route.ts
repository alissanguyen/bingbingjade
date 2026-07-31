import { NextRequest, NextResponse } from "next/server";
import { getServiceRequestByToken, getServiceRequestTimeline, listAttachments } from "@/lib/service-requests";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const serviceRequest = await getServiceRequestByToken(token);
  if (!serviceRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const [attachments, timeline] = await Promise.all([
    listAttachments(serviceRequest.id),
    getServiceRequestTimeline(serviceRequest.id),
  ]);

  return NextResponse.json({
    serviceRequest: {
      id: serviceRequest.id,
      requestNumber: serviceRequest.request_number,
      status: serviceRequest.status,
      service: serviceRequest.service ? { name: serviceRequest.service.name, slug: serviceRequest.service.slug } : null,
      priceCents: serviceRequest.price_cents,
      captureStatus: serviceRequest.capture_status,
      quoteAmountCents: serviceRequest.quote_amount_cents,
      quoteNotes: serviceRequest.quote_notes,
      quoteExpiresAt: serviceRequest.quote_expires_at,
      trackingNumber: serviceRequest.tracking_number,
      carrier: serviceRequest.carrier,
      returnTrackingNumber: serviceRequest.return_tracking_number,
      returnCarrier: serviceRequest.return_carrier,
      adminInstructions: serviceRequest.admin_instructions,
      createdAt: serviceRequest.created_at,
    },
    attachments,
    timeline,
  });
}
