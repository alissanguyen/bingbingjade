import { NextRequest, NextResponse } from "next/server";
import { removeAttachment, ValidationError } from "@/lib/service-requests";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await params;

  try {
    await removeAttachment({ serviceRequestId: id, attachmentId });
    return NextResponse.json({ removed: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/attachments] Delete failed:", err);
    return NextResponse.json({ error: "Failed to remove photo. Please try again." }, { status: 500 });
  }
}
