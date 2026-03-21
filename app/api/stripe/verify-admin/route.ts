import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let password: string | undefined;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid password." }, { status: 401 });
}
