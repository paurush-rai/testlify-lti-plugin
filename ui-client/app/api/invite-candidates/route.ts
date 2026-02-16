import { NextRequest, NextResponse } from "next/server";
import { inviteCandidates } from "@/src/services/testlify-service";
import { verifyLtiToken, extractBearerToken } from "@/src/lib/auth-utils";

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token || !verifyLtiToken(token))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assessmentId = req.nextUrl.searchParams.get("assessmentId");
  if (!assessmentId)
    return NextResponse.json(
      { error: "Missing Assessment ID" },
      { status: 400 },
    );

  try {
    const body = await req.json();
    const { candidates } = body;
    if (!candidates || !Array.isArray(candidates)) {
      return NextResponse.json(
        { error: "Invalid candidate data" },
        { status: 400 },
      );
    }

    const apiKey = process.env.TESTLIFY_TOKEN;
    if (!apiKey)
      return NextResponse.json(
        { error: "Configuration Error" },
        { status: 500 },
      );

    await inviteCandidates(apiKey, assessmentId, candidates);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
