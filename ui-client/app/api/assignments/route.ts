import { NextRequest, NextResponse } from "next/server";
import {
  getAssignments,
  createAssignments,
} from "@/src/services/assignment-service";
import { verifyLtiToken, extractBearerToken } from "@/src/lib/auth-utils";

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req);
  // Assuming we pass contextId and assessmentId in query params
  const contextId = req.nextUrl.searchParams.get("contextId");
  const assessmentId = req.nextUrl.searchParams.get("assessmentId");

  if (!token || !verifyLtiToken(token))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!contextId || !assessmentId)
    return NextResponse.json({ error: "Missing Parameters" }, { status: 400 });

  try {
    const assignments = await getAssignments(assessmentId, contextId);
    return NextResponse.json(assignments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token || !verifyLtiToken(token))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    // body should be array of assignments
    if (!Array.isArray(body))
      return NextResponse.json(
        { error: "Invalid Data Format" },
        { status: 400 },
      );

    await createAssignments(body);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
