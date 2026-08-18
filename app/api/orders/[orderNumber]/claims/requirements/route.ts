import { NextRequest, NextResponse } from "next/server";
import { getEvidenceRequirement, type ClaimType } from "@/lib/claims";

// Public, read-only — evidence requirements are not sensitive and the
// wizard needs them before a claim exists yet to know what to collect.
export async function GET(req: NextRequest) {
  const claimType = new URL(req.url).searchParams.get("claimType") as ClaimType | null;
  if (!claimType) return NextResponse.json({ error: "claimType required" }, { status: 400 });
  const requirement = await getEvidenceRequirement(claimType);
  return NextResponse.json({ requirement });
}
