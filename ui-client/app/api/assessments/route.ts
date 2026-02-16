import { NextRequest, NextResponse } from "next/server";
import { fetchAssessments } from "@/src/services/testlify-service";
import { verifyLtiToken, extractBearerToken } from "@/src/lib/auth-utils";

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req);
  // In LTI apps, the token usually contains the context, but external API keys might be stored in environment
  // or fetched based on the LTI context. For simplicity, we assume an ENV var for now or we might need to
  // fetch credentials from DB associated with the LTI installation.
  // For now, using process.env.TESTLIFY_API_TOKEN as a placeholder.

  // Auth check
  if (!token || !verifyLtiToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKey = process.env.TESTLIFY_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Service Misconfigured: Missing API Token" },
        { status: 500 },
      );
    }
    const assessments = await fetchAssessments(apiKey);
    return NextResponse.json(assessments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
