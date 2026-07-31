import { NextRequest, NextResponse } from "next/server";
import { submitServiceRequest, ValidationError } from "@/lib/service-requests";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    notes?: string;
    clientType?: "new" | "existing_client";
    verified?: boolean;
    verifiedOrderNumber?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.customerName?.trim() || !body.customerEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (body.clientType !== "new" && body.clientType !== "existing_client") {
    return NextResponse.json({ error: "Invalid client type." }, { status: 400 });
  }

  try {
    const result = await submitServiceRequest({
      serviceRequestId: id,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      notes: body.notes,
      clientType: body.clientType,
      verified: body.verified,
      verifiedOrderNumber: body.verifiedOrderNumber,
    });
    return NextResponse.json({
      id: result.serviceRequest.id,
      status: result.serviceRequest.status,
      workflowMode: result.serviceRequest.service?.workflow_mode,
      alreadySubmitted: result.alreadySubmitted,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/submit] Failed to submit:", err);
    return NextResponse.json({ error: "Unable to submit your request. Please try again." }, { status: 500 });
  }
}
