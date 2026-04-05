import { NextRequest, NextResponse } from "next/server";
import { getSourcingRequestByToken } from "@/lib/sourcing-workflow";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const data = await getSourcingRequestByToken(token);
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(data);
}
