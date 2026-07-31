import { NextRequest, NextResponse } from "next/server";
import { createServiceCheckoutSession, ValidationError } from "@/lib/service-requests";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { url } = await createServiceCheckoutSession(id);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/checkout] Failed to start checkout:", err);
    return NextResponse.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
