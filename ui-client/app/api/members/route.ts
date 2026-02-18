/**
 * GET /api/members — Fetch course roster from LMS via NRPS.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { getMembers } from "@/lib/lti/nrps";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const session = verifySessionToken(token);

    const students = await getMembers(session);

    return NextResponse.json({
      members: students.map((s) => ({
        user_id: s.user_id,
        name: s.name,
        email: s.email,
        roles: s.roles,
      })),
      contextId: session.context.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch members", details: err.message },
      { status: 500 },
    );
  }
}
