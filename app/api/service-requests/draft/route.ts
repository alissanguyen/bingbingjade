import { NextRequest, NextResponse } from "next/server";
import { createDraftServiceRequest, ValidationError } from "@/lib/service-requests";

export async function POST(req: NextRequest) {
  let body: { serviceSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.serviceSlug?.trim()) {
    return NextResponse.json({ error: "serviceSlug is required." }, { status: 400 });
  }

  try {
    const draft = await createDraftServiceRequest(body.serviceSlug.trim());
    return NextResponse.json(draft);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/draft] Failed to create draft:", err);
    return NextResponse.json({ error: "Failed to start your request. Please try again." }, { status: 500 });
  }
}
