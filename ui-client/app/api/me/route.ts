import { NextRequest, NextResponse } from "next/server";
import { verifyLtiToken, extractBearerToken } from "@/src/lib/auth-utils";

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decoded = verifyLtiToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
  }

  // In a real scenario, we might want to enrich this with data from ltijs database
  // but the token contains most context info needed for the frontend.
  return NextResponse.json(decoded);
}
