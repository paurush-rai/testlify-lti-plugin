import { NextRequest, NextResponse } from "next/server";
import { processScoreWebhook } from "@/src/services/webhook-service";

export async function POST(req: NextRequest) {
  // Basic shared secret or API Key check
  const secret = req.headers.get("x-lti-webhook-secret");
  if (!secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = await processScoreWebhook(body, secret);
    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
