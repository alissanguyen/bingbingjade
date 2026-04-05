import { NextRequest, NextResponse } from "next/server";
import { expireStaleAttempts, expireStaleCheckoutOffers } from "@/lib/sourcing-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/maintenance/expire-attempts
 *
 * Protected by MAINTENANCE_SECRET env var.
 * Call this via cron (Vercel cron, GitHub Actions, etc.) every 15–30 minutes.
 *
 * Example cron trigger (vercel.json):
 * "crons": [{ "path": "/api/maintenance/expire-attempts", "schedule": "every 15 min" }]
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Maintenance endpoint not configured." }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [attemptsResult, offersResult] = await Promise.all([
    expireStaleAttempts(),
    expireStaleCheckoutOffers(),
  ]);

  console.info(
    `[maintenance/expire-attempts] Expired ${attemptsResult.expired} attempt(s), ${offersResult.expired} offer(s)`
  );

  return NextResponse.json({
    ok: true,
    expiredAttempts: attemptsResult.expired,
    expiredOffers:   offersResult.expired,
  });
}

// Also support GET for Vercel cron (sends GET with no body)
export async function GET(req: NextRequest) {
  return POST(req);
}
