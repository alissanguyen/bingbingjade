import { NextRequest, NextResponse } from "next/server";
import { createQuoteCheckoutSession, getServiceRequestByToken, ValidationError } from "@/lib/service-requests";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const serviceRequest = await getServiceRequestByToken(token);
  if (!serviceRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  try {
    const { url } = await createQuoteCheckoutSession(serviceRequest.id, token);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/accept-quote] Failed to start checkout:", err);
    return NextResponse.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
